# Verdict — golden-set-recall (T-021)

**Result: PASS**
Commit checked: `03fcf8d` (`feat(index): T-021 golden-set + recall@k evaluation harness`)
Contract: `qa/contracts/golden-set-recall.md`
Manifest: `qa/manifests/golden-set-recall.md`
Cycle checked: 1

All verification below was independently re-run from a fresh shell (`cd /d/KnowledgeBase`), not
copied from the manifest.

## Pre-check: is the ISS-015 blocker real, or invented to dodge work?
`qa/issues.jsonl` line 15 (`ISS-015`, `status: open`, `found_by: maker`, dated 2026-09-03)
independently documents the invalid `GEMINI_API_KEY` with curl evidence
(`API_KEY_INVALID` from Google's own API, network egress confirmed working). `TASKS.md:30`
independently marks `T-003 | BLOCKED | ... | ISS-015: GEMINI_API_KEY in .env is invalid`. Both
predate/are independent of this manifest and reference the exact same root cause. **Confirmed
genuine, pre-existing, already-logged** — not a maker invention. Graded per the contract's own
"Scope, and an honest scope-down disclosed up front" section, not against the original
TASKS.md one-liner.

## Criterion-by-criterion (contract §Criteria 1–7)

**1. Golden set grounded in real content** — PASS.
- Re-ran `node scripts/gen-golden-set.mjs` myself: `wrote 46 golden questions spanning 23
  sessions`. Matches manifest exactly.
- Independently re-derived counts: `python -c "...json.load(...); print(len(d),
  len(set(...)))"` → `46 23`. ≥30 questions, spans 23/23 sessions (contract required ≥15).
- Spot-checked 4 randomly sampled entries (Python `random.seed(42)`) against the real
  `data/toc-migrated/<sessionId>/session_page.json` `keyInsights` arrays: all 4 are verbatim
  membership matches (`ashoka-university`, `xavier-university`, `visa-blueprint-part2`,
  `entrance-exams-pathways-india-part1`). Not paraphrased, not fabricated.
- Read `scripts/gen-golden-set.mjs` in full: deterministic (`sessionDirs.sort()`, first
  `MAX_PER_SESSION=2` insights in file order), no randomness, no I/O beyond local reads →
  genuinely idempotent. `git status` on `data/eval/golden-set.json` after re-running shows no
  diff (byte-identical).

**2. `packages/index/src/eval/recall.ts`** — PASS.
Read in full. `computeRecallAtK(questions, retrieve, k)` is pure (no imports beyond types, no
I/O). Critically, it does `retrieve(q.question, k).slice(0, k)` — it does NOT trust the injected
`retrieveFn` to have truncated correctly, it slices itself. The test `"k truncates the retrieved
list before checking membership"` genuinely exercises this: it hands back 3 items for `k=2` where
the correct answer (`sess1`) sits at index 2 (outside k), and asserts it counts as a miss — this
would fail if `computeRecallAtK` trusted the retriever's raw output instead of re-slicing, so the
test is non-trivial and actually proves the claim. Every miss is named with
`{id, question, expectedSessionId, got}`, not just counted.

**3. `packages/index/src/eval/heuristic-retriever.ts`** — PASS.
Read in full. Doc comment explicitly labels it "A NON-LLM stand-in for `packages/ask`'s real
`selectNodes`" and "NOT a claim that this measures the real pipeline's recall" — honestly
disclosed in the source itself, not just the manifest prose. `.filter((s) => s.sessionId !==
undefined && s.score > 0)` genuinely drops zero-overlap candidates rather than padding a ranked
list with no-signal results. Reuses the same bag-of-words tokenize/overlap technique referenced
for `apps/api/src/score.ts`.

**4. `scripts/eval-recall.mjs`** — PASS.
Read in full. Builds tree from real `readdirSync(DATA_DIR)` over `data/toc-migrated/*` (not a
fixture), uses the `tsx/esm/api` `register()` pattern matching `scripts/seed-toc.mjs`. Grepped
the eval script + both `eval/*.ts` sources for `fetch(`, `http://`, `https://`, `GEMINI`,
`API_KEY` — only hit is the doc-comment mention of `GEMINI_API_KEY` in a code comment (not a
live reference). No network call anywhere.

**5. Tests exist and pass** — PASS.
Read `recall.test.ts` (5 tests: all-hit, all-miss, mixed, k-truncation, empty-set) and
`heuristic-retriever.test.ts` (3 tests, using a real synthetic `buildTree` fixture with distinct
summaries) in full — assertions are specific and non-trivial (see criterion 2 on the truncation
test). Re-ran `pnpm --filter @lkb/index test`: **19/19 pass** (11 pre-existing + 8 new: 5
recall.test.ts + 3 heuristic-retriever.test.ts) — matches manifest exactly.

**6. Script runs end-to-end and reports an honest number** — PASS.
Re-ran `node scripts/eval-recall.mjs` myself: `recall@5 = 1.000 (46/46 hits)`, wrote
`data/eval/recall-report.json`. Matches manifest's claimed output exactly. `git status` on
`recall-report.json` shows only the `generatedAt` timestamp field differs between my run and the
committed one — everything else identical, confirming stability/no hidden randomness. Per
contract, this criterion is about the harness executing on real data and reporting honestly, not
about hitting 0.85 — satisfied.

**7. No regression** — PASS, all independently re-run:
- `pnpm -r typecheck` — all 9 projects, `Done`, 0 errors.
- `pnpm -r test` — grepped per-package pass/fail counts: `index 19, ai 23, ingest 26, ask 21,
  meeting-bot 20, apps/api 18` — all 0 fail. Matches manifest exactly.
- `pnpm gen:types --check` — `OK: 21 generated type file(s) + index.ts match schema/`.
- `python schema/validate.py` — `PASS: 21 collection schema(s) validated correctly.`
- `pnpm lint:structure` — all sub-checks OK, including
  `OK: docs/SNAPSHOT.md matches a fresh regeneration (110 lines, budget 200)` — confirmed
  genuinely fresh (regenerated and diffed clean), not stale. `depcruise`: 0 violations.

## Judgment on the "recall@5 = 1.000" framing
The manifest's own disclosure — that 1.000 mainly reflects the golden questions being literal
excerpts of the same text the heuristic retriever searches, and is explicitly NOT evidence the
real (LLM) system hits 0.85 — is an honest, correctly-reasoned disclosure, not a rationalization.
It is stated up front in both the contract's Scope section and the manifest's first paragraph,
and reinforced in the `heuristic-retriever.ts` doc comment itself (three independent places, not
just manifest prose written for the checker). The harness nonetheless has genuine, non-circular
value: it proves `computeRecallAtK`, `createHeuristicRetriever`, `buildTree`, and the golden-set
pipeline all execute correctly end-to-end against real migrated data, and gives a real, saved
(`recall-report.json`) regression baseline for the retrieval/index layer — a future change that
breaks tree-building or the heuristic scorer would show up as a recall drop even though it says
nothing about the missing LLM-reasoning layer. This is a defensible, disclosed scope-down, not a
weak eval dressed up as a strong one.

## `git show 03fcf8d --stat` vs manifest's "Files touched"
Independently re-ran `git show 03fcf8d --stat`. Diff (12 files) matches the manifest's "Files
touched" list exactly:
`scripts/gen-golden-set.mjs`, `scripts/eval-recall.mjs`, `packages/index/src/eval/recall.ts`,
`packages/index/src/eval/recall.test.ts`, `packages/index/src/eval/heuristic-retriever.ts`,
`packages/index/src/eval/heuristic-retriever.test.ts`, `packages/index/src/index.ts`,
`data/eval/golden-set.json`, `data/eval/recall-report.json`, `docs/SNAPSHOT.md`,
`qa/contracts/golden-set-recall.md`, `qa/manifests/golden-set-recall.md`. No discrepancy.

## Verdict
**PASS.** All 7 criteria independently reproduced with fresh commands, not copied from the
manifest. Scope-down is genuine (ISS-015 verified pre-existing and independently logged, matches
T-003's blocker), honestly disclosed in three places, and the harness has real regression-testing
value for the retrieval/index layer despite the circularity of the heuristic-vs-golden-set
overlap. T-021 flipped to `done` in `TASKS.md` with a note flagging the heuristic-retriever scope
and ISS-015 blocker so a future reader does not assume the 0.85 target was hit against the real
system. `.goal/goal.json`'s T-021 task entry flipped to `done` with the same note (its top-level
`current` pointer is untouched — that is ISS-016's territory, not this unit's).
