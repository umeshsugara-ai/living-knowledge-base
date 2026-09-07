/**
 * scripts/lib/evidence.mjs — choosing and trusting live-verify evidence.
 *
 * Extracted from lib/catalogue.mjs, which had reached 248/300 LOC and was warned to extract rather
 * than append. Evidence selection is also its own concern: the scorer decides what a feature's
 * verdict IS, this decides which measurements it is allowed to believe.
 *
 * Three cycles of attacks shaped this, each defeating the previous defense:
 *   1. pick the lexically-last `live-*` folder      -> the folder NAME was the input (+19.3 pts)
 *   2. pick by the `stamp` inside the file          -> a plausibly-dated fabrication still won
 *   3. require the file to be git-TRACKED           -> editing the committed file in place still
 *                                                      won, with no banner and --check exit 0
 * So trust is now content-vs-HEAD, not path-vs-index: a file is trustworthy only if git says its
 * CONTENT matches what was committed (ISS-037).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const git = (root, args) => execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "ignore"] });

/**
 * Trust state of one evidence file, by CONTENT:
 *   "committed"  — tracked and byte-identical to HEAD; anyone can reproduce this score
 *   "modified"   — tracked but edited since commit; the committed version says something else
 *   "untracked"  — exists only on this machine
 *   "unknown"    — not a git checkout
 */
export function trustOf(root, relPath) {
  try {
    git(root, ["ls-files", "--error-unmatch", relPath]);
  } catch {
    try {
      git(root, ["rev-parse", "--git-dir"]);
      return "untracked";
    } catch {
      return "unknown";
    }
  }
  try {
    // Exit 0 = working-tree content matches HEAD. This is the check `ls-files` could not make:
    // a path can be perfectly tracked while its bytes say whatever the editor last typed.
    git(root, ["diff", "--quiet", "HEAD", "--", relPath]);
    return "committed";
  } catch {
    return "modified";
  }
}

/** True only for evidence a third party could reproduce from the repository alone. */
export function isTrustworthy(trust) {
  return trust === "committed";
}

/**
 * Trust for MANY paths in one `git status` call.
 *
 * Needed because the seventh layer of this defect chain was the code scrapers: `scrapeRoutes`,
 * `scrapePages` and `reachablePackages` read source as text with no trust check at all, so
 * uncommitted source edits moved the headline +10.5 points with every gate green and no banner
 * (ISS-047). Those scrapers touch hundreds of files, so per-path `git diff` calls would be far too
 * slow — one porcelain listing answers for all of them, and covers modified, staged AND untracked
 * in a single pass.
 *
 * Returns a Map of repo-relative path -> "modified" | "untracked", containing ONLY untrusted
 * paths; anything absent from the map is clean at HEAD.
 */
export function untrustedAmong(root, relPaths) {
  const wanted = new Set(relPaths.map((p) => p.replace(/\\/g, "/")));
  const out = new Map();
  let porcelain;
  let tracked;
  try {
    porcelain = git(root, ["status", "--porcelain", "--untracked-files=all"]).toString("utf8");
    tracked = new Set(git(root, ["ls-files"]).toString("utf8").split("\n").map((l) => l.trim()).filter(Boolean));
  } catch {
    return out; // not a git checkout; trustOf() reports "unknown" for the named inputs
  }

  // `git status` deliberately says nothing about IGNORED files, so a scraped source file listed in
  // .gitignore was read by the scrapers and then vanished from the trust check — and .gitignore
  // itself is not a scraped input, so adding a line to it was free. Verified reachable: a
  // gitignored `apps/api/src/routes/ghost.ts` is scraped while `git status --porcelain
  // --untracked-files=all` reports nothing for it. It could not be converted into points TODAY
  // (the 501 stub list dominates the route probes it could reach), so this is a blind spot rather
  // than a live inflation path — but "not exploitable" rests on which probes happen to exist, and
  // probes change. Membership in `ls-files` is the check that does not depend on that luck.
  for (const rel of wanted) {
    if (!tracked.has(rel)) out.set(rel, "untracked");
  }
  for (const line of porcelain.split("\n")) {
    if (!line.trim()) continue;
    const code = line.slice(0, 2);
    // Rename lines are "R  old -> new"; the destination is the path that was read.
    const path = line.slice(3).trim().split(" -> ").pop().replace(/^"|"$/g, "");
    if (!wanted.has(path)) continue;
    out.set(path, code === "??" ? "untracked" : "modified");
  }
  return out;
}

/** Human-readable warning for a non-trustworthy trust state, or "" when it is fine. */
export function trustWarning(trust, relPath) {
  if (trust === "committed") return "";
  if (trust === "modified") {
    return `**EDITED SINCE COMMIT — \`${relPath}\` no longer matches the version in git, so this score is not the one the repository supports**`;
  }
  if (trust === "untracked") {
    return `**UNCOMMITTED — \`${relPath}\` is not in git, so nobody else can reproduce this score**`;
  }
  return `**NOT A GIT CHECKOUT — the provenance of \`${relPath}\` cannot be established**`;
}

/**
 * Content fingerprint of the measurements that actually matter.
 *
 * Hashes the CANONICAL parsed content (stamp + sorted collection counts), not the raw bytes: a
 * raw-byte hash flipped on checkout under `core.autocrlf=true`, which sent `--check` STALE on an
 * untouched clone (ISS-039). A fingerprint that changes when nothing meaningful changed trains
 * people to ignore it.
 */
export function fingerprint(pre) {
  const counts = Object.fromEntries(Object.entries(pre.collections ?? {}).sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha256")
    .update(JSON.stringify({ stamp: pre.stamp ?? null, counts }), "utf8")
    .digest("hex")
    .slice(0, 12);
}

/**
 * The most recent usable live-verify evidence, chosen by the timestamp INSIDE each file.
 * Throws on future-dated evidence — that is either fabricated or a broken clock, and neither
 * should quietly set a headline number.
 */
export function loadCollectionCounts(root, now = Date.now()) {
  const dir = join(root, "qa", "evidence");
  if (!existsSync(dir)) return { counts: null, source: null, unreadable: [] };

  const runs = [];
  const unreadable = [];
  for (const name of readdirSync(dir).filter((n) => n.startsWith("live-"))) {
    const rel = `qa/evidence/${name}/preflight.json`;
    const abs = join(dir, name, "preflight.json");
    if (!existsSync(abs)) continue;
    let pre;
    try {
      // Strip a leading UTF-8 BOM (bytes EF BB BF) before parsing — Windows PowerShell 5.1's
      // `Out-File -Encoding utf8` writes one, and JSON.parse throws on it (ISS-040). Failing to
      // read a candidate must never look the same as that candidate not existing.
      const BOM = String.fromCharCode(0xfeff);
      pre = JSON.parse(readFileSync(abs, "utf8").replace(new RegExp(`^${BOM}`), ""));
    } catch (err) {
      unreadable.push({ rel, reason: err.message });
      continue;
    }
    if (!pre.collections || Object.keys(pre.collections).length === 0) continue;
    const at = Date.parse(pre.stamp ?? "");
    runs.push({ name, rel, pre, at: Number.isNaN(at) ? 0 : at });
  }
  if (runs.length === 0) return { counts: null, source: null, unreadable };

  runs.sort((a, b) => b.at - a.at);
  const chosen = runs[0];
  if (chosen.at > now + 60_000) {
    throw new Error(
      `evidence run "qa/evidence/${chosen.name}" is dated in the future (${chosen.pre.stamp}) — refusing to score from it`,
    );
  }
  const trust = trustOf(root, chosen.rel);
  return {
    counts: chosen.pre.collections,
    source: chosen.rel,
    stamp: chosen.pre.stamp ?? "(no stamp)",
    hash: fingerprint(chosen.pre),
    trust,
    trusted: isTrustworthy(trust),
    warning: trustWarning(trust, chosen.rel),
    unreadable,
  };
}
