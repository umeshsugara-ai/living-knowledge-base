/**
 * scripts/lib/dispatch-state.mjs -- ISS-178. Make dispatch a FILE event, not a memory event.
 *
 * THE DEFECT. The handshake's only signal that a check is outstanding is the ABSENCE of
 * `qa/verdicts/<slug>.md`. That absence is byte-identical for two states that need opposite
 * responses:
 *
 *   - the checker was never dispatched      -> dispatch it
 *   - the checker died mid-check            -> re-dispatch, and DO NOT consume a fix cycle
 *
 * On 2026-09-09 two Mode A checkers were live when the Claude process exited. Neither wrote a
 * verdict. `qa/.last-tick` recorded the dispatch in PROSE only, so the session-start hook and
 * sweep check 1 both read a plain absence and silently re-aged a dead check as a "dispatch gap".
 * `write-guard-enforcement-gaps` cycle 3 sat in exactly that shape and was only known to be live
 * because a human said so out of band.
 *
 * THE DESIGN, and the one decision in it: **state is DERIVED, never trusted from the marker.**
 * The recorded fix direction has the checker delete its marker on commit. This module deliberately
 * does not depend on that: a matching-cycle verdict always wins over whatever the marker says, so
 * a checker that never deletes anything -- an older skill version, a crash after the commit, a
 * different actor entirely -- still produces the correct state. Requiring a second actor to change
 * its protocol before this works would be a mechanism that cannot be implemented, which is exactly
 * how D-019's union rule sat unimplemented for a day (see tracker-audit.mjs's ISS-129 note).
 *
 * The marker is therefore a HINT that narrows "no verdict yet" into in-flight vs died. It is never
 * evidence that a check passed, and nothing here reads or writes a verdict.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

/** A check younger than this is assumed to be running. Longer than any observed Mode A check
 *  (the slowest measured on this repo is ~14 min: 846 s for hybrid-arms-binding cycle 3), so a
 *  live checker is never reported dead. Erring long is the safe direction -- a false "died"
 *  triggers a duplicate dispatch, which is the concurrency bug this repo hit today. */
export const STALE_MS = 20 * 60 * 1000;

const DISPATCH_DIR = "dispatch";

/** Highest `Fix cycle: N` in a manifest, or 0. Emphasis is stripped first because manifests use
 *  `**Fix cycle:** 2` and `## Status:` interchangeably -- the exact blindness ISS-176 was filed
 *  for, and there is no reason to reproduce it here. */
export function manifestCycle(text) {
  const m = /^[\s\-*#>|`]*Fix cycle:\s*(\d+)/m.exec(text.replace(/\*\*/g, ""));
  return m ? Number(m[1]) : 0;
}

/** True when the manifest is asking for a check. Anchored to line start so a close-out section
 *  that merely QUOTES the phrase in prose is not counted. */
export function isReadyForCheck(text) {
  return /^[\s\-*#>|`]*(?:#+\s*)?Status:\s*ready-for-check/m.test(text.replace(/\*\*/g, ""));
}

/**
 * Highest `Cycle checked: N` in a verdict. A verdict file ACCUMULATES one section per cycle, so
 * taking the FIRST match returns cycle 1 forever and a landed cycle-3 check reads as pending.
 *
 * ANCHORED AT COLUMN 0, deliberately, and this is not cosmetic. The first version of this function
 * allowed `^[\s\-*#>|`]*`, and running it over the live corpus -- before dispatching, which is the
 * only reason it was caught -- read `delivery-gate-manifest-blindness` as cycle 3 when its highest
 * real stamp is 2. The extra match was an INDENTED, WRAPPED TABLE CELL INSIDE A FENCED CODE BLOCK,
 * in a passage discussing this exact class of bug. Leading `\s*` is what admits it: a wrapped
 * prose line is indistinguishable from a field once arbitrary indentation is allowed.
 *
 * FIVE forms are real in this corpus, counted over all 114 verdict files -- so an anchor that only
 * accepts the field form silently loses five verdicts, which is the opposite failure:
 *   Cycle checked: 2                          field form (after emphasis is stripped)
 *   # Verdict - <slug> · Cycle checked: 3     heading form
 *   - Cycle checked: 1 (matches Fix cycle 1)  bullet form
 *   PASS - Cycle checked: 1                   after a status prefix
 *   Status: PASS (Cycle checked: 1)           parenthesised
 *
 * So the rule is about the LINE, not the prefix: the line must not be indented and must not open a
 * table (`|`), blockquote (`>`) or code span (a backtick). That excludes the false positive by
 * construction rather than by a denylist of phrasings.
 *
 * The digit must sit on the SAME line: `\s*` matches newlines, so a wrapped prose line ending in
 * "…(`Cycle checked:" swallows the number from the line below. `calendar-auto-join.md:78` is
 * exactly that sentence, and `[ \t]*` is what rejects it. (That verdict then has no parseable
 * stamp at all -- a defect in the verdict, not in this parser, and it is reported rather than
 * papered over.)
 *
 * The error direction is chosen: missing a real stamp costs one duplicate dispatch, while counting
 * a prose number silences a genuinely pending check. Undercounting is the safe failure here.
 */
export function verdictCycle(text) {
  let hi = -1;
  for (const m of stripQuoted(text).matchAll(/^(?![ \t>|`])[^\n]*?\bCycle checked:?[ \t]*(\d+)/gm)) {
    const n = Number(m[1]);
    if (n > hi) hi = n;
  }
  return hi;
}

/**
 * Removes every region where a `Cycle checked: N` is being QUOTED rather than recorded: HTML
 * comments, fenced code blocks, and inline code spans. Emphasis markers go too, since the field
 * form is written `**Cycle checked:** 2`.
 *
 * ISS-196. The first shipped version stripped only ``` fences, via `^```[\s\S]*?^```` — and the
 * cycle-1 checker found four shapes that defeat it, all in the UNSAFE direction against this
 * module's own "undercounting is safe" rule: `~~~` fences, HTML comments, mid-line code spans, and
 * an UNCLOSED or nested fence (a non-greedy pair strips nothing when the closer is missing, and
 * mispairs on ````-wrapped nesting). Shape (c), a mid-line code span, is live prose in ten verdict
 * files today and was harmless only because the numbers quoted there happened not to exceed the
 * real stamp. "Harmless by luck of the numbers" is not a property worth relying on.
 *
 * Fences are paired by SCANNING, not by one regex: a closer must use the same marker character and
 * be at least as long as its opener (so ```` survives an inner ```), and an opener that is never
 * closed suppresses everything after it. Suppressing too much is the safe direction here.
 */
function stripQuoted(text) {
  const noComments = text.replace(/<!--[\s\S]*?-->/g, "");
  const out = [];
  let fence = null; // { char, len }
  for (const line of noComments.split("\n")) {
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (m && m[1][0] === fence.char && m[1].length >= fence.len) fence = null;
      out.push(""); // keep line count stable; content suppressed either way
      continue;
    }
    if (m) {
      fence = { char: m[1][0], len: m[1].length };
      out.push("");
      continue;
    }
    out.push(line);
  }
  // Inline code spans last, so a span inside a fence was already removed with the fence.
  return out.join("\n").replace(/`[^`\n]*`/g, "").replace(/\*\*/g, "");
}

/** Records that a checker was dispatched. Called by the maker in the same turn as the dispatch. */
export function record(root, slug, cycle, sessionId, now = Date.now()) {
  const dir = join(root, "qa", DISPATCH_DIR);
  mkdirSync(dir, { recursive: true });
  const row = { slug, cycle, dispatched_at: new Date(now).toISOString(), session_id: sessionId };
  writeFileSync(join(dir, `${slug}.json`), JSON.stringify(row, null, 2) + "\n", "utf8");
  return row;
}

/** Removes a marker. Safe to call when none exists -- clearing is idempotent by design, because
 *  the caller that most needs it (a reconcile finding a completed check) cannot know whether the
 *  checker already deleted it. */
export function clear(root, slug) {
  rmSync(join(root, "qa", DISPATCH_DIR, `${slug}.json`), { force: true });
}

function readMarker(root, slug) {
  const p = join(root, "qa", DISPATCH_DIR, `${slug}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    // A corrupt marker must degrade to "no marker" -- i.e. to the OLD two-state behaviour -- and
    // never to a thrown reconcile. This module can only ever add information.
    return null;
  }
}

/**
 * Derives one of five states for a unit.
 *
 *   not-pending    the manifest is not asking for a check
 *   complete       a verdict exists for the manifest's current cycle (marker, if any, is garbage)
 *   not-dispatched no marker for this cycle and no matching verdict  -> dispatch
 *   in-flight      marker for this cycle, younger than staleMs        -> wait
 *   checker-died   marker for this cycle, older than staleMs          -> RE-DISPATCH, no fix cycle
 *
 * A marker whose `cycle` is BELOW the manifest's is ignored: cycle N+1 has not been dispatched
 * just because cycle N was. That is the re-aging bug in its most likely disguise.
 */
export function stateOf(root, slug, { now = Date.now(), staleMs = STALE_MS } = {}) {
  const mPath = join(root, "qa", "manifests", `${slug}.md`);
  if (!existsSync(mPath)) return { slug, state: "not-pending", reason: "no manifest" };
  const mText = readFileSync(mPath, "utf8");
  if (!isReadyForCheck(mText)) return { slug, state: "not-pending", reason: "manifest not ready-for-check" };

  const cycle = manifestCycle(mText);
  const vPath = join(root, "qa", "verdicts", `${slug}.md`);
  const vc = existsSync(vPath) ? verdictCycle(readFileSync(vPath, "utf8")) : -1;

  // A landed verdict is the authority, whatever the marker says. This is what makes the module
  // correct against a checker that never deletes its marker.
  if (vc >= cycle) return { slug, state: "complete", cycle, verdictCycle: vc };

  const marker = readMarker(root, slug);
  if (!marker || Number(marker.cycle) !== cycle) {
    return { slug, state: "not-dispatched", cycle, staleMarker: marker ? Number(marker.cycle) : null };
  }

  const age = now - Date.parse(marker.dispatched_at);
  // NaN (an unparseable timestamp) must not read as young: `NaN > staleMs` is false, which would
  // silently report a dead check as in-flight. Treat it as dead so it gets re-dispatched.
  const died = !(age <= staleMs);
  return {
    slug,
    state: died ? "checker-died" : "in-flight",
    cycle,
    ageMs: Number.isFinite(age) ? age : null,
    dispatched_at: marker.dispatched_at,
    session_id: marker.session_id,
  };
}

/** Every manifest's state, worst-first, so a reconcile reads the actionable rows at the top. */
export function sweep(root, opts = {}) {
  const dir = join(root, "qa", "manifests");
  let names = [];
  try {
    names = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch (err) {
    // Only "no manifests directory" is expected. A bare catch here would swallow a real fault and
    // report an empty, healthy-looking sweep -- the silent-failure class tracker-audit.mjs already
    // had to fix once.
    if (err?.code !== "ENOENT") throw err;
  }
  const rank = { "checker-died": 0, "not-dispatched": 1, "in-flight": 2, complete: 3, "not-pending": 4 };
  return names
    .map((f) => stateOf(root, f.slice(0, -3), opts))
    .filter((r) => r.state !== "not-pending")
    .sort((a, b) => rank[a.state] - rank[b.state] || a.slug.localeCompare(b.slug));
}
