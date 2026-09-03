# Verdict — purge-retention-policy (T-026)

**Result: PASS**
Commit checked: `950a804` (`feat(core): T-026 purge/retention policy (D-008 gate, grill F6)`)
Cycle checked: 1
Checker: fresh-context, independently re-ran every command below from `D:\KnowledgeBase` in git-bash.

## Criterion-by-criterion

**C1 — `isPurgeEligible` rule order.** Read `packages/core/src/domain/purge-policy.ts:28-51` in
full. Confirmed the exact 4-check order from the contract:
1. `media.kind === "evidence-clip"` → ineligible, "retained permanently (D-008)" — unconditional,
   checked before anything else (line 29-31).
2. `turnRefs` empty/undefined → ineligible, "no turns linked" (line 33-36).
3. No claim cites any `turnRefs` id → ineligible, "no claim has cited this media yet — nothing has
   been verified" (line 38-41) — this is the conservative/non-vacuous branch the contract calls
   out explicitly; confirmed it is NOT skipped or inverted (an empty `citing` array does not fall
   through to eligible).
4. Any citing claim `status !== "verified"` → ineligible, count named in reason (line 43-49).
5. Otherwise (≥1 citing, all verified) → eligible, count named (line 51).
Order and conservative-by-design behavior match the contract exactly.

**C2 — `deriveEvidenceClipWindows`.** Read `purge-policy.ts:73-97`. Verified independently
(not just by reading):
- `tStart` clamp at 0: existing test 6 uses `tStart=5, padding=15` → clamps to 0 (`Math.max(0, ...)`
  at line 90); reran `pnpm --filter @lkb/core test` myself, test passed.
- Skips an unresolvable turn without throwing, and specifically *continues past* the bad entry
  rather than aborting the whole batch: test 6's fixture includes claim `c4` citing `t-missing`
  interleaved with valid claims (`c1`, `c2`, `c3`) — the loop uses `continue` (line 83), and the
  test asserts `windows.length === 1` with only `t1`'s window present, proving the batch did not
  abort and other valid windows still appeared. Reran, passed.
- De-duplication: `c1` and `c3` both cite `t1`, verified via `Set` keyed on `sessionId::turnId`
  (line 84-86) → exactly one window in the result. Reran, passed.

**C3 — ADR.** `docs/adr/0003-purge-retention-policy.md` is 40 lines (well under the 60-line
budget matching 0001/0002). Read in full: Decision section accurately describes what the code
does — per-media gating on all-citing-claims-verified (§1, matches C1), evidence-clip exemption
(§2, matches the `kind` check), delete deferred to a future worker (§3, matches contract
Non-goals and the file's own header comment), 15s default padding (§4, matches
`paddingSeconds = 15` in code). References `media.retention.purgeAfterVerified`
(schema/media.schema.json, T-018) as required. No doc/code mismatch found.

**C4 — Tests.** Reran `pnpm --filter @lkb/core test`: 7/7 pass (see below). Confirmed
`packages/core/package.json` (read in full) genuinely has `"test": "node --test --import tsx
\"src/**/*.test.ts\""` and `tsx: 4.23.13` in devDependencies — not assumed, read directly — and
this package had no `test` script before this unit (its only prior scripts context was
`typecheck`). All 6 contract-required test scenarios are present and independently reran.

**C5 — No regression.** All five commands rerun independently, fresh:
```
$ pnpm -r typecheck
Scope: 9 of 10 workspace projects — all "Done", 0 errors.

$ pnpm --filter @lkb/core test
tests 7 / pass 7 / fail 0

$ pnpm -r test
core 7 / index 19 / ai 23 / ingest 26 / ask 21 / meeting-bot 20 / apps/api 18 — all pass, 0 fail.

$ pnpm gen:types --check
OK: 21 generated type file(s) + index.ts match schema/
EXIT:0

$ python schema/validate.py
PASS: 21 collection schema(s) validated correctly.
EXIT:0

$ pnpm lint:structure
lint-loc: OK (124 file(s) within budget)
lint-dirsize: OK (58 dir(s) within budget)
lint-root: OK (13 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (179 unique export(s), 21 unique schema $id(s))
lint-migrations: OK (684 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (110 lines, budget 200)
✔ no dependency violations found (135 modules, 375 dependencies cruised)
EXIT:0
```
All match the manifest's claims exactly.

## `gen-types.mjs` self-healing empirical probe (the "interesting" one)

Read `scripts/gen-types.mjs`'s `indexFile()` (line 63-70) and `domainModuleNames()` (line 51-61):
confirmed it now scans `packages/core/src/domain/*.ts`, excludes `*.test.ts`, sorts, and appends
deterministic `export * from "./domain/<name>.js";` lines after the schema-derived exports.

Empirical test (not just reading the code):
1. Added `packages/core/src/domain/_checker-probe.ts` with `export const CHECKER_PROBE = 1;`.
2. Ran `pnpm gen:types` (no `--check`) → wrote `packages/core/src/index.ts`. Read the result: it
   now contains `export * from "./domain/_checker-probe.js";` immediately followed by
   `export * from "./domain/purge-policy.js";` (alphabetically sorted), with **zero** further
   changes to `scripts/gen-types.mjs` needed. This empirically confirms the "any future domain
   module gets picked up automatically" claim.
3. Deleted the probe file, reran `pnpm gen:types` to regenerate `index.ts` back to its committed
   form.
4. Verified restoration: `git diff -- packages/core/src/index.ts` returned empty (no diff at all
   against the committed version).
5. Verified no residual mess anywhere: `git status --short` / `git diff --stat` after cleanup show
   only the three unrelated background-process files already dirty before I started
   (`.goal/goal.json`, `data/eval/recall-report.json`, `qa/.last-tick` — per the task's own note
   that other agents touch these concurrently); nothing from the probe test remained.

## `git show 950a804 --stat` scope check
Diff matches the manifest's file list exactly: `docs/adr/0003-purge-retention-policy.md`,
`packages/core/package.json`, `packages/core/src/domain/purge-policy.test.ts`,
`packages/core/src/domain/purge-policy.ts`, `packages/core/src/index.ts`,
`qa/contracts/purge-retention-policy.md`, `qa/manifests/purge-retention-policy.md`,
`scripts/gen-types.mjs`. No scope creep. (Note: `docs/SNAPSHOT.md` is not part of this commit's
diff despite the manifest listing it as "regenerated" — its regenerated content was evidently
byte-identical to what was already committed at the prior HEAD, which is consistent with
`lint:structure`'s independent "matches a fresh regeneration" check passing; not a discrepancy.)

## Verdict
All 5 contract criteria independently reproduced and verified against source, not just the
manifest's pasted output. **PASS.**

Actions taken on PASS: `TASKS.md` T-026 row flipped `open` → `done` (verdict + commit `950a804`
cited); `.goal/goal.json` T-026 entry (`status: "pending"`) flipped to `"done"`.
