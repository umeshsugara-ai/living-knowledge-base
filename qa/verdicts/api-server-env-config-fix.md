# Verdict — api-server-env-config-fix

**Contract:** qa/contracts/developer-api.md
**Manifest:** qa/manifests/api-server-env-config-fix.md
**Cycle checked:** 2
**Date:** 2026-09-06
**Mode:** A (unit check), fresh subagent, no builder context

VERDICT: PASS
SCORE_UNIT: n/a (default coding adapter, shell verify)
SCOREBOARD: 8/8 criteria met, N/A invariants (contract has no separate [I*] invariants)

## What I independently re-ran (not trusted from the manifest or from my own cycle-1 verdict)

Cycle 1 (commit `0f18dc9`) found the env/CORS fix itself real and correct across 11 checks, with
the sole failure being three untracked evidence screenshots at repo root breaking
`pnpm lint:structure`'s `lint-root` budget (ISS-023). This cycle re-verifies everything — not just
the claimed fix — because a regression could in principle have crept in between cycles.

1. **`git status --short`** (fresh, before touching anything): confirms `brain-before-click.png`,
   `dashboard-fixed.png`, `dashboard-live-check.png` are gone — none of the three appear anywhere
   in the working tree. Root directory listing (`ls -la .`) independently confirms no `.png` files
   sit at repo root at all. Remaining untracked entries are `.handoffs/` (a directory, not a loose
   root file per `lint-root`'s own accounting) and `qa/manifests/api-server-env-config-fix.md`
   (inside `qa/`, not root).
2. **`pnpm lint:structure`** (fresh run) → **all 7 sub-checks green**:
   `lint-loc: OK (206 file(s) within budget)`, `lint-dirsize: OK (74 dir(s) within budget)`,
   **`lint-root: OK (15 loose root file(s), 1 gitignored excluded)`** (exactly at budget, the
   regression is gone), `lint-dupes: OK`, `lint-migrations: OK`, `snapshot.mjs --check: OK`,
   `depcruise: ✔ no dependency violations found (239 modules, 702 dependencies cruised)`. This
   directly closes ISS-023 — reproduced myself, not pasted from the manifest.
3. **`cd apps/api && npx tsc --noEmit -p tsconfig.json`** → exit 0, no output. Unchanged from
   cycle 1.
4. **`cd apps/api && node --test --import tsx "src/**/*.test.ts"`** → **66/66 pass, 0 fail.**
   Exact same count as cycle 1 — no regression from the cleanup.
5. **`pnpm -r typecheck`** → all 10 workspace projects (`apps/web`, `apps/api`, `packages/core`,
   `packages/ai`, `packages/db`, `packages/ask`, `packages/index`, `packages/ingest`,
   `packages/meeting-bot`) report `Done`, zero errors.
6. **`pnpm -r test`** → full monorepo suite green, including `packages/meeting-bot` (40/40 pass)
   and `apps/api`'s full 66-test suite (spot-read every line of output — no failures, "fail"/
   "error" substring hits are all negative-path test *names*, e.g. "never a silent 500").
7. **`pnpm gen:types --check`** → `OK: 24 generated type file(s) + index.ts match schema/`.
8. **`python schema/validate.py`** → `PASS: 24 collection schema(s) validated correctly.`
9. **Fresh, independent server boot** — started my own `apps/api` instance on a spare port
   (`PORT=3398 npx tsx apps/api/src/index.ts`, background, real stdout captured to a file, never
   paraphrased):
   ```
   ◇ injected env (11) from .env
   @lkb/api listening on :3398
   ```
   No Mongo connection error, confirms `.env` is actually loaded and points at the real remote
   host, not the `localhost:27017` default the bug used to fall back to.
10. **Fresh seed + fresh curl** — ran `node scripts/seed-demo-server.mjs` myself (own key, own
    run, not reused from the manifest or cycle 1): produced a fresh demo key against real Mongo
    data (25 sessions, 23 session_pages, tenant "toc"). Then:
    `curl http://localhost:3398/sessions -H "Authorization: Bearer <my fresh key>" -H "Origin:
    http://localhost:5173"` → **200, real JSON body** (25 real session documents: titles, dates,
    orgs — e.g. "Visa Blueprint Part 2: Italy, France, New Zealand"), with
    `Access-Control-Allow-Origin: http://localhost:5173` and `Vary: Origin` present — CORS fix
    confirmed live and correctly scoped (not `*`). `curl` with no Authorization header → 401.
11. Killed my spare `:3398` instance afterward and verified it is actually down (`curl` to it
    times out / connection refused post-kill) — no orphaned process left behind by this check.

## Judgment against contract criterion 8

Criterion 8 ("No regression: ... `pnpm lint:structure` ... all clean") is now met: the fresh
`lint-root` re-run reports exactly 15 loose root files against the 15-file budget — clean, not
merely close. All other sub-checks of criterion 8 (`typecheck`, `test`, `gen:types --check`,
`schema/validate.py`, `depcruise`) remain green, matching cycle 1. Criteria 1–7 (server shape,
auth, `/ask`, stub routes, webhooks stub, rate limiting, tests) are unaffected by either this
unit or its cycle-2 fix and remain evidenced by the still-passing 66/66 `apps/api` test suite and
the independently reproduced live server behavior (real Mongo data served, correct CORS headers,
401 on missing auth).

No new findings. ISS-023 is genuinely fixed — the fix was a real deletion of the three untracked
files (confirmed via `git status --short` and a root directory listing), not a relocation that
would dodge the lint-root count via `.gitignore`, and not a claim taken on trust.

ISSUES-WRITTEN: none (ISS-023 closed as `verified` in `qa/issues.jsonl`, not opened)

## EXPLANATION

This is a straightforward fix-cycle-2 close-out: the substantive fix (dotenv loading, correct
`MONGODB_URL`/`MONGODB_DB` var names, `CORS_ORIGINS`) was already independently verified as real
in cycle 1 and shows no regression here (same 66/66 tests, same typecheck/schema/gen:types green,
a fresh independent server boot + curl reproducing real data and correct CORS headers again). The
sole cycle-1 blocker — three untracked evidence screenshots pushing the repo root over its
15-file lint budget — is confirmed gone by direct inspection, and `pnpm lint:structure` now
passes clean end-to-end when I ran it myself, not pasted from the manifest. All 8 contract
criteria are evidenced. PASS.
