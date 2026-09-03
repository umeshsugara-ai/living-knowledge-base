# Verdict — evaluator-calibration (T-022)

**PASS** — Cycle checked: 1
Contract: `qa/contracts/evaluator-calibration.md`
Manifest: `qa/manifests/evaluator-calibration.md`
Commit verified: `1d2ee71` (`1d2ee714bbd928514c59a63d7230967c977404d6`, "feat(ask): T-022 evaluator calibration harness (MAE)")

All verification below was independently re-run from a fresh shell (`cd /d/KnowledgeBase`), not
copied from the manifest's pasted output.

## Pre-check: ISS-015 blocker, and consistency with T-021's already-PASSed posture
`qa/issues.jsonl` line 15: `ISS-015`, `status: open`, `found_by: maker`, "GEMINI_API_KEY in .env
is invalid (API_KEY_INVALID)" — same blocker cited for T-003 and T-021. `qa/verdicts/
golden-set-recall.md` (T-021's already-PASSed verdict) independently verified this same ISS-015
row as genuine, not invented, under the identical disclosure pattern. T-022's manifest cites the
same blocker the same way — consistent, not a new or dodgy excuse.

## Criterion-by-criterion (contract §Criteria)

1. **`calibration.ts` — pure `computeMAE`.** Read in full. No I/O (fs/network) anywhere in the
   file. Line 42: `await Promise.resolve(scoreFn(pair.query, pair.node))` — unconditionally
   awaits, so sync and async `ScoreFn` both work unmodified. `normalize()` (line 33-35) handles
   both `ScoreResult` shapes: bare number and `[number, string]` tuple, matching `evaluator.ts`'s
   own union. `details` (line 45) names every pair's `id/predicted/reference/absError`. **PASS.**

2. **`heuristic-scorer.ts` — new, self-contained, no illegal cross-import.** Read in full — only
   imports `@lkb/core` (type) and local `../evaluator.js` (type). Read `.dependency-cruiser.cjs`
   myself: rule `ask-index-ingest-only-ai-db-core` (line 34-39) restricts `packages/(ask|index|
   ingest)/` to `ai|db|core` only — `apps/api` and `packages/index` are NOT reachable from
   `packages/ask`, so this genuinely could not be an import of `apps/api/src/score.ts`'s
   `heuristicScore` or `packages/index/src/eval/heuristic-retriever.ts`; it is a new file using the
   same bag-of-words technique independently. `pnpm lint:structure`'s depcruise step
   (`✔ no dependency violations found`, 139 modules/390 dependencies) re-ran clean, confirming no
   violation was introduced. **PASS.**

3. **`evaluator-calibration-set.json` — derived, ≥30 pairs, deterministic.** Re-ran `node
   scripts/gen-calibration-set.mjs` twice in sequence and diffed the two outputs — byte-identical
   (`diff` empty). Read the generated file: 15 golden questions × 2 pairs = 30 total; each
   `-relevant` entry's `sessionId` matches its own question's session, each `-irrelevant` entry's
   `sessionId` is a different session (fixed +7 offset into the sorted distinct-session list, per
   `gen-calibration-set.mjs` line 33) — spot-checked first 3 pairs, all correct
   (`2026-04-21-visa-blueprint...` paired against `2026-06-03-dual-enrollment-pathway`, etc).
   **PASS.**

4. **`eval-calibration.mjs` — same pattern as `eval-recall.mjs`, no network.** Read in full: builds
   the real tree from `data/toc-migrated/*` via `buildTree`, resolves `sessionId` → tree node,
   calls `computeMAE` against `heuristicScorer`, writes `calibration-report.json`
   (`{generatedAt, scorer, mae, n, details}`). `grep -n "fetch(\|http\.\|https\.\|API_KEY\|GEMINI"`
   → no matches. Re-ran it myself: `mae = 0.170 over 30 pairs` — exact match to manifest's claimed
   figure, and every "relevant" pair's predicted score is strictly higher than its paired
   "irrelevant" one (verified all 15 pairs in the printed detail). Output written matches
   `data/eval/calibration-report.json`. **PASS.**

5. **Tests exist and pass, async-scorer test genuinely async.** Read both new test files in full.
   `calibration.test.ts` line 35-40: `const asyncScoreFn = async (_q, _n): Promise<number> => ...`
   — a real `async` function returning a `Promise`, not a sync function disguised; test asserts
   `mae === 0` through the async path. Also covers perfect-prediction→0, known-offset→offset,
   per-pair detail naming, empty-set→0-not-NaN, and the `[score, reason]` tuple shape.
   `heuristic-scorer.test.ts`: matching query scores higher than non-matching, empty query → 0
   with reason, full match → 1. Re-ran `pnpm --filter @lkb/ask test`: **30/30 pass**, 0 fail — 21
   pre-existing + 9 new (6 calibration.test.ts + 3 heuristic-scorer.test.ts), matches manifest
   exactly. **PASS.**

6. **No regression — all clean, independently re-run:**
   - `pnpm -r typecheck` → all 9 workspace projects "Done", 0 errors.
   - `pnpm -r test` → core 7/0, ai 23/0, index 19/0, ingest 26/0, ask 30/0, meeting-bot 20/0,
     apps/api 18/0 — all 7 packages green, exact match to manifest's claimed counts.
   - `pnpm gen:types --check` → "OK: 21 generated type file(s) + index.ts match schema/".
   - `python schema/validate.py` → "PASS: 21 collection schema(s) validated correctly."
   - `pnpm lint:structure` → lint-loc/dirsize/root/dupes/migrations all OK, SNAPSHOT.md fresh
     (110 lines), depcruise clean (139 modules, 390 dependencies).
   **PASS.**

## Commit diff vs. manifest's file list
`git show 1d2ee71 --stat` matches the manifest's "Files touched" list exactly (12 files, 828
insertions/1 deletion), **plus** `data/eval/recall-report.json` (+1/-1 line). Verified via
`git show 1d2ee71 -- data/eval/recall-report.json`: the only change is `"generatedAt"` timestamp
(`07:53:43.695Z` → `07:55:29.165Z`). This is a housekeeping regeneration artifact from an earlier
checker re-running T-021's `eval-recall.mjs`, not part of T-022's actual work — noted per the
task instructions, not penalized.

## Judgment on the "mae=0.170 is a more meaningful result than T-021's 1.000" framing
Independently agree this holds up. T-021's `recall@5 = 1.000` was near-guaranteed given the golden
questions are literal excerpts from their own session text (the retriever only had to not actively
break). Here, the heuristic scorer's raw keyword-overlap fraction is compared against a binary
0/1 reference on a genuinely continuous scale — nothing in the harness forces "relevant" scores
toward 1.0 or "irrelevant" scores toward 0.0. The printed detail confirms the ordering held in
all 15 pairs (predicted relevant always > predicted irrelevant), but individual absolute errors
range from 0.000 to 0.576 — a real, not-rigged spread. This is legitimate evidence the harness
computes correctly end-to-end and the heuristic scorer is directionally sound, exactly as the
manifest claims — not a claim about the real LLM judge's calibration, which the contract's
Non-goals section correctly disclaims.

## Overall: PASS

All 6 contract criteria independently reproduced with matching or better evidence than the
manifest's pasted output. Scope-down (derived reference set + heuristic scorer, blocked on
ISS-015 for the real calibration) is genuine, consistent with T-021's already-PASSed precedent,
and honestly disclosed in both contract and manifest. No issues found.
