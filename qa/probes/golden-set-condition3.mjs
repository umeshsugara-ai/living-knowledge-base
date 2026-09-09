// qa/probes/golden-set-condition3.mjs — T-021 condition 3.
//
// WHY THIS EXISTS. `qa/gates/golden-set-redesign.md` (Option C) makes condition 3 a PRECONDITION on
// reporting a recall number: the two leakage diagnostics "must be re-run on any regenerated set
// BEFORE its recall number is reported" (`scripts/lib/golden-set-diagnostics.mjs` header, verbatim).
//
// They were run — on a 75-question set that scored recall@5 0.307. THE OPERATIVE SET IS A DIFFERENT
// ONE: `data/eval/golden-set.json` holds 92 questions generated 2026-09-08T09:01 (kept 92,
// rejected 0), and all three current reports score against it — heuristic 0.391, vector 0.935,
// hybrid 0.870. `scripts/gen-golden-set.mjs` writes the set and the reject list and nothing else,
// and no file under `data/eval/` contains a pin rate. So three recall numbers, including one this
// maker shipped and cited in a PASSed unit, rest on a set whose leakage was never measured.
//
// READ-ONLY and offline: pure functions over files already on disk. No model, no network, no
// writes outside the report path — so the checker can reproduce it exactly.
//
// Run: node qa/probes/golden-set-condition3.mjs [--write]
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { diagnose } from "../../scripts/lib/golden-set-diagnostics.mjs";
import { loadCorpora, buildPinTokens } from "../../scripts/lib/golden-set-build.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SET_PATH = join(ROOT, "data", "eval", "golden-set.json");
const OUT_PATH = join(ROOT, "data", "eval", "golden-set-diagnostics.json");

// The gate's own numbers, for a like-for-like comparison rather than a bare figure.
const LEAKY_BASELINE = { pinRate: 0.63, note: "29/46 on the set ISS-071 called unfalsifiable" };
const PRIOR_75 = { pinRate: 0.093, meanVerbatimOverlap: 0.071, note: "the 75-question set, recall@5 0.307" };

const questions = JSON.parse(readFileSync(SET_PATH, "utf8"));
// `pageText` is the corpus retrieval scores against; `turnsText` is the raw transcript the
// questions were generated FROM. Overlap is reported against the worse of the two, which is why
// both are passed — leakage from either surface invalidates the number.
const { turnsText, pageText } = loadCorpora();
const d = diagnose(questions, pageText, turnsText);

// SECOND PIN MEASUREMENT, and it is the one that means something (ISS-093). `diagnose` uses the
// BLUNT criterion — "unique in the scored corpus" — over a 3,099-word page corpus, where ordinary
// words land in exactly one session BY CHANCE. Its 17 pinned questions are pinned by `you`,
// `should`, `will`, `people`, `paths`, `skills`, `living`, `story`, `parents` — which is the same
// word list ISS-093 recorded when this criterion was used as a generation filter. A question
// "pinned" by the word `you` is not pinned at all.
//
// `buildPinTokens` is the corrected criterion: unique across the RAW TRANSCRIPTS (~218k words, so
// chance uniqueness is rare) AND present in the session's page text. Reporting both is the point —
// the blunt number is the only one comparable to the gate's 63% baseline, and the corrected one is
// the only one that estimates real leakage.
const correctedPins = buildPinTokens(turnsText, pageText);
const correctedRows = questions.map((q) => {
  const hit = [...new Set(q.question.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [])]
    .find((t) => correctedPins.get(t) === q.expectedSessionId);
  return { id: q.id, pinned: hit !== undefined, token: hit ?? null };
});
const correctedPinned = correctedRows.filter((r) => r.pinned);

const report = {
  measuredAt: new Date().toISOString(),
  goldenSet: "data/eval/golden-set.json",
  questions: d.total,
  sessions: pageText.size,
  scoredCorpus: "session_page.json (summary + keyInsights) — what retrieval scores against",
  sourceCorpus: "data/toc-migrated/<id>/turns.json — what the questions were generated from",
  pinCriterion:
    "globallyUniqueTokens over the SCORED corpus — deliberately the same blunt criterion that " +
    "produced the gate's 63% baseline, so the comparison is like-for-like. It is NOT " +
    "buildPinTokens (the ISS-093-corrected generation-time filter); using the corrected one here " +
    "would compare a new number against an old one measured a different way.",
  verbatimOverlap: {
    mean: d.meanVerbatimOverlap,
    max: d.maxVerbatimOverlap,
    nearVerbatimCount: d.nearVerbatim,
    gateRequirement: "must stay ~0 — otherwise the eval is a string-matching tautology",
  },
  uniqueTokenPin: {
    blunt: {
      pinnedCount: d.pinnedCount,
      pinRate: d.pinRate,
      uniqueTokenCount: d.uniqueTokenCount,
      criterion: "unique in the SCORED corpus (~3.1k words) — the gate's 63% baseline criterion",
      caveat:
        "dominated by ordinary-word artifacts: the pinning tokens include you, should, will, " +
        "people, paths, skills, living — the exact list ISS-093 recorded. Read as an UPPER BOUND.",
    },
    corrected: {
      pinnedCount: correctedPinned.length,
      pinRate: correctedPinned.length / (d.total || 1),
      uniqueTokenCount: correctedPins.size,
      criterion: "ISS-093's buildPinTokens: unique across the RAW TRANSCRIPTS (~218k words) AND present in the page text",
      tokens: correctedPinned.map((r) => ({ id: r.id, token: r.token })),
    },
    gateRequirement: "must fall WELL BELOW 0.63",
  },
  comparison: { leakySet: LEAKY_BASELINE, prior75QuestionSet: PRIOR_75 },
  pinnedQuestions: d.rows.filter((r) => r.pinned).map((r) => ({ id: r.id, token: r.pinToken })),
  highestOverlap: [...d.rows].sort((a, b) => b.overlap - a.overlap).slice(0, 5)
    .map((r) => ({ id: r.id, overlap: Number(r.overlap.toFixed(4)) })),
};

console.log(`golden set: ${report.questions} questions over ${report.sessions} sessions`);
console.log(`verbatim overlap: mean ${d.meanVerbatimOverlap.toFixed(4)} max ${d.maxVerbatimOverlap.toFixed(4)} near-verbatim(>=0.8) ${d.nearVerbatim}`);
console.log(`unique-token pin (BLUNT, gate-comparable): ${d.pinnedCount}/${d.total} = ${(d.pinRate * 100).toFixed(1)}%  (leaky baseline 63.0%, prior 75-q set 9.3%)`);
console.log(`unique-token pin (CORRECTED, ISS-093):        ${correctedPinned.length}/${d.total} = ${((correctedPinned.length / (d.total || 1)) * 100).toFixed(1)}%`);
console.log(`unique tokens in the scored corpus: ${d.uniqueTokenCount}`);
if (report.pinnedQuestions.length) {
  console.log("pinned by:", report.pinnedQuestions.map((p) => `${p.id}→${p.token}`).join(", "));
}

if (process.argv.includes("--write")) {
  writeFileSync(OUT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`wrote ${OUT_PATH}`);
} else {
  console.log("(dry run — pass --write to persist the report)");
}
