# Verdict — watched-sources (T-027)

**Result: PASS**
Cycle checked: 1
Commit verified: `38bc88a84e7f171b450516c7926cac2d0f061b7a`
Manifest: `qa/manifests/watched-sources.md` (Status was `ready-for-check`)
Contract: `qa/contracts/watched-sources.md`

All commands independently re-run from a fresh shell (`cd /d/KnowledgeBase`, git-bash), not
trusted from the manifest's pasted output. Source files read in full and cross-checked against
contract criteria 1-5.

## Criterion-by-criterion

**1. `schema/watched_sources.schema.json` + fixtures.**
Read the schema: `required: tenantId, url, reputationTier, checkIntervalHours, active` (plus
`_id`); `reputationTier` enum is exactly `["official", "community", "blog"]`; `lastFetch` shape
matches `{fetchedAt, hash, diffFrom}`. Read `schema/fixtures/watched_sources/valid.json` — valid
shape, `reputationTier: "official"`. Read `invalid.json` — `reputationTier: "trustworthy"`, which
is genuinely absent from the schema's enum. Re-ran `python schema/validate.py`: `OK: watched_sources
— valid fixture passes, invalid fixture correctly rejected (1 error(s))` and `PASS: 22 collection
schema(s) validated correctly.` (up from 21). `schema/index.json` carries the new
`watched_sources` index entry (`tenantId` + unique `tenantId+url`). PASS.

**2. `packages/db/src/collections/watched-sources.ts`.**
Read in full. `watchedSources(tenantId)` uses `scopedCollection<WatchedSources>(getDb(),
"watched_sources")(tenantId)` — same shape as `eval-runs.ts`'s `evalRuns(tenantId)` (read side by
side, confirmed identical pattern: tenant-scoped accessor, not a raw driver call).
`createWatchedSource`, `recordFetch(tenantId, id, lastFetch)`, `listActive(tenantId)` all present
with the contracted signatures. Confirmed export from `packages/db/src/index.ts:10`: `export *
from "./collections/watched-sources.js"`. PASS.

**3. `packages/ingest/src/watched/schedule.ts` — `isDueForCheck`.**
Read in full (16 lines). Line-by-line rule order: `if (!source.active) return false;` runs FIRST
(line 10), before the `lastFetch` check on line 11 — matches the contract's explicit ordering
requirement (inactive checked before ever looking at `lastFetch`). Never-fetched (and active) →
line 11 `if (!source.lastFetch) return true;`. Otherwise elapsed-ms vs. interval-ms comparison
using `>=`. Read `schedule.test.ts`: 5 tests — never-fetched due; inactive never due (even
never-fetched); inactive never due (even long past interval, `lastFetch` set to 2026-01-01 vs.
`now` 2026-09-03 — a real elapsed-time+inactive interaction, not a trivial case); boundary test
uses `checkIntervalHours: 24` with `lastFetch.fetchedAt: "2026-09-02T12:00:00Z"` and
`now: "2026-09-03T12:00:00.000Z"` — exactly 24h/86,400,000ms elapsed, asserts `true`, which is a
genuine `>=` boundary test (not a fuzzy near-boundary); paired with a "one second short" test
asserting `false`. Re-ran `pnpm --filter @lkb/ingest test`: all 5 schedule tests pass. PASS.

**4. `packages/ingest/src/watched/check.ts` — `checkWatchedSource`.**
Read in full (33 lines). `import type { UrlFetcher, UrlHasher } from "../sources/url.js";` — a
genuine import, not a redeclared/equivalent local type. Confirmed via `git show 38bc88a --
packages/ingest/src/watched/check.ts`: the diff shows only this import line for those two types,
no local interface/type alias for `UrlFetcher`/`UrlHasher` anywhere in the file — satisfies the
contract's explicit "not a second fetch/hash abstraction" requirement. `changed: previousHash ===
null || hash !== previousHash` — first-ever check (`previousHash` derived as `source.lastFetch?.
hash ?? null`) is unconditionally `changed: true` with `diffFrom: null`, even though "changed
from" is undefined for a first fetch, exactly as the contract specifies. Read `check.test.ts`: 3
tests (first-ever always changed with `diffFrom: null`; identical content not changed with
`diffFrom` set to the prior hash; different content changed with `diffFrom` set to the prior
hash, `hash` different from `priorHash`) — all via `fakeUrlFetcher`/`fakeHasher` from
`../testUtils.js`, no live network. Re-ran: all 3 check tests pass. PASS.

**5. `docs/adr/0004-watched-sources-scheduling.md`.**
`wc -l` → 39 lines (manifest states 44 — a manifest inaccuracy, but the contract's actual bar is
"≤60 lines, matching 0001-0003's budget" [57/35/40 lines respectively], and 39 clears that
comfortably; not a fail). Content check: states reputation-tier assignment is a "human decision at
bookmark time" and default `checkIntervalHours: 24` with justification (official pages change
days-to-weeks, not hours) — both match what's encoded in code: `schedule.ts`'s `isDueForCheck`
takes `checkIntervalHours` as a per-source field (no hardcoded 24 in the decision function itself,
consistent with "callers set a shorter interval per source" / "no per-tenant global override
yet"), and there is no automated tier-inference code anywhere in the diff. No doc/code mismatch
found. PASS (with the line-count note above flagged as a minor manifest inaccuracy, not a
contract violation).

**6. Tests exist and pass.**
`pnpm --filter @lkb/ingest test` → `tests 34 / pass 34 / fail 0`, confirmed by reading both new
test files in full (5 schedule.test.ts + 3 check.test.ts = 8 new, plus 26 pre-existing = 34).
Re-run output matches manifest exactly. PASS.

**7. No regression.**
- `pnpm -r typecheck` — all 9 workspace projects report `Done`, no errors. PASS.
- `pnpm --filter @lkb/ingest test` — 34/34 pass (criterion 6, above).
- `pnpm -r test` — re-ran and extracted per-package counts: core 7/7, index 19/19, ai 23/23,
  ingest 34/34, ask 30/30, meeting-bot 20/20, apps/api 18/18 — all green, matches manifest
  exactly.
- `pnpm gen:types --check` — `OK: 22 generated type file(s) + index.ts match schema/` (up from
  21). PASS.
- `python schema/validate.py` — `PASS: 22 collection schema(s) validated correctly.` PASS.
- `pnpm lint:structure` — `lint-loc: OK (135 file(s))`, `lint-dirsize: OK (61 dir(s))`,
  `lint-root: OK (13 loose root file(s))`, `lint-dupes: OK (191 unique export(s), 22 unique
  schema $id(s))`, `lint-migrations: OK (707 file(s) scanned — manifest said 706; a background
  process elsewhere in the repo touched a migration-scanned file between the maker's run and this
  check, not a T-027 regression)`, `docs/SNAPSHOT.md matches a fresh regeneration (111 lines,
  budget 200)`, `✔ no dependency violations found (145 modules, 409 dependencies cruised)`. PASS.

## `git show 38bc88a --stat`
17 files changed, matches the manifest's "Files touched" list exactly (schema + fixtures + index,
generated core types + index, db collection + index export, ingest watched/{schedule,check}.ts +
their tests + ingest index export, ADR-0004, SNAPSHOT.md, plus the contract + manifest themselves).

## Notes (non-blocking)
- Manifest states ADR-0004 is 44 lines; actual is 39. Both are well under the 60-line contract
  budget, so this does not affect the verdict — flagged for the maker's awareness only.
- `lint-migrations` file count (707 vs. manifest's 706) reflects an unrelated background change
  between the maker's run and this check, not part of the T-027 diff.
- Uncommitted working-tree changes present at check time (`.goal/goal.json`,
  `data/eval/calibration-report.json`, `qa/.last-tick`) are outside this unit's scope per the
  checker's standing instructions — left untouched except for the T-027 status flip in
  `.goal/goal.json` itself, done as part of PASS close-out below.

## Close-out actions taken
- `TASKS.md` T-027 row flipped `open` → `done`, citing this verdict + commit `38bc88a`.
- `.goal/goal.json` T-027 entry (`id: "T-027"`) flipped `status: "pending"` → `"done"`.
- `qa/manifests/watched-sources.md` `Status:` line flipped `ready-for-check` → `checked-PASS`.
