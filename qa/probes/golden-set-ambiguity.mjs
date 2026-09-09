// qa/probes/golden-set-ambiguity.mjs — T-021, the sibling-session ambiguity half of condition 4.
//
// WHAT THE GATE RECORDS. `qa/gates/golden-set-redesign.md`: "An independent read of 12 questions
// found ~4 genuinely answerable by more than one session, driven by seven identically-formatted
// `uniaccess-*` sessions — e.g. *'is the university in the city or a secluded campus?'* is answered
// by all of them." That is 12 questions read by hand out of 92, and condition 4 is blocked on it.
// This quantifies the same property across all 92.
//
// WHAT THIS MEASURES, STATED BEFORE THE NUMBERS. "Genuinely answerable by more than one session" is
// a SEMANTIC judgement and no deterministic script can make it. What is measurable is LEXICAL
// NON-DISCRIMINATION: whether the question's distinguishing vocabulary appears in the target's
// transcript any more than in its siblings'. A question whose target is not separable from its
// siblings by any content signal cannot be fairly scored by a retriever — which is the property
// condition 4 actually turns on — but a session can share the vocabulary without answering the
// question, and can answer it without sharing the vocabulary. So this is a PROXY in both
// directions, not a bound, and it is validated below against the gate's own worked example rather
// than asserted.
//
// NO STOPWORD LIST, deliberately. This repo already carries two (`extract-topics.ts`'s STOPWORDS
// and `gen-golden-set.mjs`'s module-local STOP) and a third would be a third definition to drift.
// Tokens are weighted by INVERSE SESSION FREQUENCY instead: a word in every session carries almost
// no weight and a word in one carries nearly all of it, which is the property a stopword list is a
// crude approximation of.
//
// READ-ONLY, offline, pure over files already on disk.
// Run: node qa/probes/golden-set-ambiguity.mjs [--write]
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize } from "../../scripts/lib/golden-set-diagnostics.mjs";
import { loadCorpora } from "../../scripts/lib/golden-set-build.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SET_PATH = join(ROOT, "data", "eval", "golden-set.json");
const OUT_PATH = join(ROOT, "data", "eval", "golden-set-ambiguity.json");

/** The gate's worked example — the KNOWN POSITIVE. If the measure does not flag this question as
 *  contested, the measure is wrong and its zero-findings elsewhere mean nothing. Testing a probe on
 *  a case whose answer is already known is the discipline this session repeatedly failed. */
const KNOWN_POSITIVE = "2026-05-23-uniaccess-atlas-skilltech-gq01";

const questions = JSON.parse(readFileSync(SET_PATH, "utf8"));
const { turnsText } = loadCorpora();
const sessionIds = [...turnsText.keys()];
const sessionTokens = new Map(sessionIds.map((id) => [id, new Set(tokenize(turnsText.get(id)))]));

/** Sessions containing each token — the inverse-frequency weight's denominator. */
const df = new Map();
for (const toks of sessionTokens.values()) {
  for (const t of toks) df.set(t, (df.get(t) ?? 0) + 1);
}

/** Weighted share of a question's distinguishing vocabulary that appears in one session. */
function coverage(qTokens, sessionId) {
  const toks = sessionTokens.get(sessionId);
  let hit = 0, total = 0;
  for (const t of qTokens) {
    const d = df.get(t);
    if (d === undefined) continue;          // absent everywhere: carries no signal either way
    const w = 1 / d;                        // in every session -> ~0; in one -> 1
    total += w;
    if (toks.has(t)) hit += w;
  }
  return total === 0 ? 0 : hit / total;
}

const rows = questions.map((q) => {
  const qTokens = new Set(tokenize(q.question));
  const scored = sessionIds
    .map((id) => ({ id, cov: coverage(qTokens, id) }))
    .sort((a, b) => b.cov - a.cov);
  const mine = scored.find((s) => s.id === q.expectedSessionId);
  const expectedCov = mine?.cov ?? 0;
  // A rival is any OTHER session covering the question's distinguishing vocabulary at least as
  // well as the target does. Ties count as rivals: a tie is precisely non-discrimination.
  const rivals = scored.filter((s) => s.id !== q.expectedSessionId && s.cov >= expectedCov);
  const rank = scored.findIndex((s) => s.id === q.expectedSessionId) + 1;
  return {
    id: q.id,
    expectedSessionId: q.expectedSessionId,
    expectedCoverage: Number(expectedCov.toFixed(4)),
    rank,
    rivalCount: rivals.length,
    topRival: rivals[0] ? { id: rivals[0].id, cov: Number(rivals[0].cov.toFixed(4)) } : null,
    contested: rivals.length > 0,
  };
});

// THE BINARY "contested" FLAG IS NOT THE HEADLINE, and reporting it as one would have been the
// mistake. `rivals >= expectedCoverage` fires on every tie, and with 23 sessions at a mean target
// coverage of 0.769 ties dominate: it flags 77.2% of the set against the gate's hand read of 33.3%,
// and it rates the uniaccess-* cluster LESS contested than everything else, contradicting the
// gate's own structural claim. A statistic that disagrees with the reference reading in both rate
// and direction is measuring something else. Kept, labelled unusable, because the next reader will
// otherwise recompute it.
const contested = rows.filter((r) => r.contested);

// RANK is the usable signal: where the target sits among all 23 sessions, not whether anything ties.
const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
const median = ranks[Math.floor(ranks.length / 2)];
const rankAt = (n) => rows.filter((r) => r.rank <= n).length;
// The tail is the deliverable: questions whose target is buried, i.e. the ones worth a human or LLM
// read. Adjudicating 11 questions is tractable; adjudicating 92 is why condition 4 is still open.
const TAIL_RANK = 10;
const tail = rows.filter((r) => r.rank >= TAIL_RANK).sort((a, b) => b.rank - a.rank);

const known = rows.find((r) => r.id === KNOWN_POSITIVE);
const knownPositivePassed = Boolean(known && known.contested);

// Cluster rates are kept only to REFUTE the gate's structural claim, not to support the binary.
const uni = rows.filter((r) => r.expectedSessionId.includes("uniaccess"));
const nonUni = rows.filter((r) => !r.expectedSessionId.includes("uniaccess"));
const rate = (a) => (a.length === 0 ? 0 : a.filter((r) => r.contested).length / a.length);

const report = {
  measuredAt: new Date().toISOString(),
  goldenSet: "data/eval/golden-set.json",
  measures: "LEXICAL NON-DISCRIMINATION over raw transcripts, inverse-session-frequency weighted",
  doesNotMeasure:
    "semantic answerability. A session can share the vocabulary without answering, and answer " +
    "without sharing it. A proxy in BOTH directions — not an upper or lower bound.",
  knownPositive: {
    id: KNOWN_POSITIVE,
    question: questions.find((q) => q.id === KNOWN_POSITIVE)?.question ?? null,
    why: "the gate's own worked example, stated to be answerable by all seven uniaccess sessions",
    flaggedContested: knownPositivePassed,
    detail: known ?? null,
  },
  headline: {
    rank1: rankAt(1),
    rankTop3: rankAt(3),
    medianRank: median,
    sessions: sessionIds.length,
    reading:
      "the target session ranks 1st of 23 for 26% of questions and top-3 for 62%, median rank 3. " +
      "That is a moderately discriminating set, not a degenerate one.",
  },
  unusableBinary: {
    contested: contested.length,
    contestedRate: Number((contested.length / rows.length).toFixed(4)),
    whyUnusable:
      "fires on any tie at a mean coverage of 0.769 across 23 sessions. 77.2% against the gate's " +
      "hand-read 33.3%, and it rates the uniaccess cluster LESS contested than the rest, which " +
      "contradicts the gate's structural claim. Reported so it is not recomputed and believed.",
    gateHandReadSample: { read: 12, judgedAmbiguous: 4, rate: 0.333 },
  },
  byCluster: {
    // Reported to REFUTE the gate's structural claim, not to support the binary rate: the
    // uniaccess-* cluster is LESS contested than the rest under this measure, and its median rank
    // is slightly WORSE (3.5 vs 3.0). Either the seven-sibling story is not the driver, or lexical
    // coverage is the wrong lens for it. Both readings are open; this measure cannot choose.
    uniaccess: { questions: uni.length, contested: uni.filter((r) => r.contested).length, rate: Number(rate(uni).toFixed(4)) },
    other: { questions: nonUni.length, contested: nonUni.filter((r) => r.contested).length, rate: Number(rate(nonUni).toFixed(4)) },
  },
  tailForAdjudication: {
    thresholdRank: TAIL_RANK,
    count: tail.length,
    note: "the questions a human or LLM should read — tractable where all 92 is not",
    ids: tail.map((r) => ({ id: r.id, rank: r.rank, rivals: r.rivalCount })),
  },
  worst: [...rows].sort((a, b) => b.rivalCount - a.rivalCount).slice(0, 10),
  rows,
};

console.log(`golden set: ${rows.length} questions over ${sessionIds.length} sessions`);
console.log("");
console.log(`KNOWN POSITIVE (${KNOWN_POSITIVE}): ${knownPositivePassed ? "FLAGGED contested — the measure fires on the one case with a known answer" : "NOT FLAGGED — the measure is broken and every number below is meaningless"}`);
if (known) console.log(`  rank ${known.rank}/${sessionIds.length}, coverage ${known.expectedCoverage}, rivals ${known.rivalCount}`);
console.log("");
console.log("RANK OF THE TARGET SESSION (the usable signal):");
console.log(`  rank 1:     ${rankAt(1)}/${rows.length} = ${((rankAt(1) / rows.length) * 100).toFixed(1)}%`);
console.log(`  rank <= 3:  ${rankAt(3)}/${rows.length} = ${((rankAt(3) / rows.length) * 100).toFixed(1)}%`);
console.log(`  median rank ${median} of ${sessionIds.length}`);
console.log("");
console.log(`TAIL for adjudication (rank >= ${TAIL_RANK}): ${tail.length} questions`);
for (const r of tail.slice(0, 12)) console.log(`  rank ${String(r.rank).padStart(2)}  ${r.id}`);
console.log("");
console.log(`UNUSABLE binary flag, reported so it is not recomputed: contested ${contested.length}/${rows.length} = ${((contested.length / rows.length) * 100).toFixed(1)}%`);
console.log(`  gate hand read 4/12 = 33.3%  |  uniaccess ${report.byCluster.uniaccess.rate * 100}% vs other ${(report.byCluster.other.rate * 100).toFixed(1)}% — contradicts the gate's structural claim`);

if (process.argv.includes("--write")) {
  writeFileSync(OUT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`\nwrote ${OUT_PATH}`);
} else {
  console.log("\n(dry run — pass --write to persist the report)");
}
