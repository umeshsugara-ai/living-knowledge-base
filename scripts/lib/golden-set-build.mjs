/**
 * scripts/lib/golden-set-build.mjs — the corpora, the pin criterion, provenance, and the no-API
 * re-filter path for `gen-golden-set.mjs`. Split out when that file crossed its 300-LOC budget;
 * the generator keeps the prompt and the generation loop.
 *
 * Deliberately NOT merged into `golden-set-diagnostics.mjs`. The diagnostics measure how leaky a
 * set is; this file decides which questions ship. Keeping them apart is what stops the measurement
 * from grading the filter's own criterion — the tautology ISS-092 was filed for.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize, globallyUniqueTokens, verbatimOverlap } from "./golden-set-diagnostics.mjs";

const loadJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_DIR = join(ROOT, "data", "toc-migrated");
const OUT_DIR = join(ROOT, "data", "eval");
const OUT_PATH = join(OUT_DIR, "golden-set.json");
const GENERATION_MODEL = "gemini-2.5-pro";
/** Gemini's DEFAULT_MODEL — what the summarize jobKind resolves to, i.e. what wrote session_page. */
const SUMMARIZER_MODEL = "gemini-2.5-flash";
const MAX_OVERLAP = 0.5; // a question sharing a >=50% token run with the transcript is a copy

/**
 * Provenance is WRITTEN BY THE GENERATOR, so it cannot describe a set the generator did not
 * produce. It used to be a hardcoded string inside `eval-recall.mjs`; when this unit replaced the
 * golden set, that string went on asserting the OLD set's properties — a field whose entire
 * purpose is honesty became the report's one false statement (ISS-091). A derived record cannot
 * drift from its subject, which is the actual fix; correcting the sentence would only have reset
 * the clock on the same failure.
 *
 * `afterTheFact` marks a record rebuilt by `--provenance-only` from artifacts already on disk. It
 * is honest but weaker: the counts are read from the real files, while the model and filter fields
 * describe what THIS code does now, which is only the truth if the code has not changed since.
 */
export function writeProvenance(kept, rejectedCount, sessionCount, afterTheFact) {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, "golden-set-provenance.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        recordedAfterTheFact: afterTheFact,
        generator: "scripts/gen-golden-set.mjs",
        source: "data/toc-migrated/<sessionId>/turns.json (raw transcript)",
        model: GENERATION_MODEL,
        summarizerModel: SUMMARIZER_MODEL,
        independence:
          `different model from the summarizer (${SUMMARIZER_MODEL}), but the SAME vendor and ` +
          "family, so same-source vocabulary leakage is reduced less than a cross-vendor run would",
        promptStrategy:
          "real student questions, near-neighbour sessions named so wording must fit them too",
        postFilter:
          "rejects any candidate carrying a token unique to its own session within the SCORED " +
          `corpus (session_page summary+keyInsights), or overlapping the transcript past ${MAX_OVERLAP}`,
        postFilterBiasWarning:
          "the pin check runs over the same corpus the retriever scores, so it preferentially " +
          "removes questions the retriever would answer — the resulting recall is a DOWNWARD-" +
          "BIASED FLOOR, not an unbiased estimate. eval-recall.mjs measures the size of that bias.",
        kept,
        rejected: rejectedCount,
        sessions: sessionCount,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log(`wrote golden-set-provenance.json (afterTheFact=${afterTheFact})`);
}

/**
 * Tokens that would let a question be answered by keyword-spotting rather than comprehension.
 *
 * TWO conditions, and the first one is the fix for ISS-093. The original criterion was "unique in
 * the corpus retrieval scores" — the `session_page` text. That corpus is **3,099 words across all
 * 23 sessions**, roughly 135 words each, and at that size ordinary words land in exactly one
 * summary BY CHANCE and register as rare. Measured: `should`, `will`, `you`, `people`, `paths`,
 * `skills`, `living` were all "page-unique", and **13 of 17 rejections fired on words like those**
 * — the filter was discarding good questions for containing "should".
 *
 * Uniqueness is now computed over the **turns** corpus: 217,980 words, ~70× larger, where a token
 * appearing in exactly one session is genuinely rare rather than a sampling artefact. Verified on
 * the same words: none are turns-unique, while `flywire` — an actual brand name — is unique in
 * both.
 *
 * The second condition survives unchanged from the original design, and is still right: a rare
 * word is only a *shortcut* if the retriever can see it, so it must also appear in the target's
 * page text. Dropping it would reject questions over words that cannot influence retrieval at all.
 */
export function buildPinTokens(turnsText, pageText) {
  const rareInTranscripts = globallyUniqueTokens(turnsText);
  const pins = new Map();
  for (const [token, sessionId] of rareInTranscripts) {
    const page = pageText.get(sessionId);
    if (page && tokenize(page).includes(token)) pins.set(token, sessionId);
  }
  return pins;
}

/** Corpora, built once and shared by generation and re-filtering so the two cannot diverge. */
export function loadCorpora() {
  const sessionIds = readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((d) => existsSync(join(DATA_DIR, d, "turns.json")))
    .sort();
  const turnsText = new Map();
  const pageText = new Map();
  const titles = new Map();
  for (const id of sessionIds) {
    turnsText.set(id, loadJson(join(DATA_DIR, id, "turns.json")).map((t) => t.text ?? "").join(" "));
    const pagePath = join(DATA_DIR, id, "session_page.json");
    if (existsSync(pagePath)) {
      const p = loadJson(pagePath);
      pageText.set(id, [p.summary ?? "", ...(p.keyInsights ?? [])].join(" "));
    }
    const sessionPath = join(DATA_DIR, id, "session.json");
    titles.set(id, existsSync(sessionPath) ? (loadJson(sessionPath).title ?? id) : id);
  }
  return { sessionIds, turnsText, pageText, titles };
}

/**
 * Re-apply the CURRENT filter to the candidates already on disk — no API call, no new questions.
 *
 * This exists because ISS-093 is a defect in the *criterion*, not in the questions: the same 92
 * candidates, judged correctly, yield a different and better set. Regenerating would have cost
 * spend, produced different questions, and invalidated the human read of the sampled ones. This
 * keeps every question that was already reviewed and only changes which of them ship.
 */
export function refilter() {
  const { turnsText, pageText, sessionIds } = loadCorpora();
  const pins = buildPinTokens(turnsText, pageText);
  const previouslyKept = loadJson(OUT_PATH).map((q) => ({ sessionId: q.expectedSessionId, question: q.question }));
  const rejectedPath = join(OUT_DIR, "golden-set-rejected.json");
  const previouslyRejected = existsSync(rejectedPath) ? loadJson(rejectedPath) : [];
  const candidates = [...previouslyKept, ...previouslyRejected];

  const bySession = new Map();
  const kept = [];
  const rejected = [];
  for (const c of candidates) {
    const pin = [...new Set(tokenize(c.question))].find((t) => pins.get(t) === c.sessionId);
    const overlap = verbatimOverlap(c.question, turnsText.get(c.sessionId) ?? "");
    if (pin) {
      rejected.push({ ...c, reason: `pinned by rare token "${pin}"` });
      continue;
    }
    if (overlap > MAX_OVERLAP) {
      rejected.push({ ...c, reason: `verbatim overlap ${overlap.toFixed(2)}` });
      continue;
    }
    const n = (bySession.get(c.sessionId) ?? 0) + 1;
    bySession.set(c.sessionId, n);
    kept.push({
      id: `${c.sessionId}-gq${String(n).padStart(2, "0")}`,
      question: c.question,
      expectedSessionId: c.sessionId,
    });
  }

  writeFileSync(OUT_PATH, JSON.stringify(kept, null, 2) + "\n", "utf8");
  writeFileSync(rejectedPath, JSON.stringify(rejected, null, 2) + "\n", "utf8");
  writeProvenance(kept.length, rejected.length, bySession.size, true);
  console.log(
    `refiltered ${candidates.length} candidate(s): ${kept.length} kept, ${rejected.length} rejected, ` +
      `${bySession.size}/${sessionIds.length} sessions covered`,
  );
}

