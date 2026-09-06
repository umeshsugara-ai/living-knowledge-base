# Verdict — api-server-env-config-fix

**Contract:** qa/contracts/developer-api.md
**Manifest:** qa/manifests/api-server-env-config-fix.md
**Cycle checked:** 1
**Date:** 2026-09-06
**Mode:** A (unit check), fresh subagent, no builder context

VERDICT: FAIL
SCORE_UNIT: n/a (default coding adapter, shell verify)
SCOREBOARD: 7/8 criteria met, N/A invariants (contract has no separate [I*] invariants)

## What I independently re-ran (not trusted from the manifest)

1. `cd apps/api && npx tsc --noEmit -p tsconfig.json` → exit 0, no output. Matches manifest.
2. `cd apps/api && node --test --import tsx "src/**/*.test.ts"` → **66/66 pass, 0 fail.** Matches
   manifest exactly.
3. Read `apps/api/src/index.ts` directly: confirmed real code changes — `dotenv`'s `config()` is
   called with a path resolved via `fileURLToPath`/`path.resolve` off the module's own location
   (works regardless of cwd), and `connect()` now reads `process.env.MONGODB_URL` /
   `process.env.MONGODB_DB` (previously `MONGO_URL`/`MONGO_DB`, which never existed in `.env`).
4. Confirmed `.env` actually contains `MONGODB_URL=mongodb://13.202.206.101:27017` (the real
   remote host) and `CORS_ORIGINS=http://localhost:5173`. `.env.example` diff shows the added
   `CORS_ORIGINS=...` line with a comment, matching the manifest's description.
5. Found a live `apps/api` process already bound to :3300 and `apps/web` to :5173 (both curl
   200). Rather than trust that these were started post-fix, I additionally booted a **fresh,
   independent** `apps/api` instance myself on a spare port (`PORT=3399 npx tsx src/index.ts`,
   background, real stdout captured to a file, not paraphrased):
   ```
   ◇ injected env (11) from ..\..\.env
   @lkb/api listening on :3399
   ```
   This exactly matches the manifest's claimed expected boot output (I could not find that string
   anywhere in the source and was suspicious it was fabricated — it is not; it is `dotenv`'s own
   console banner, confirmed by directly observing it). I killed this spare instance afterward
   (verified via a follow-up request timing out).
6. Ran `node scripts/seed-demo-server.mjs` myself → produced a fresh real demo API key against
   real seeded Mongo data (25 sessions, 23 session_pages, tenant "toc").
7. `curl http://localhost:3300/sessions -H "Authorization: Bearer <my own fresh key>" -H "Origin:
   http://localhost:5173"` → **200, real JSON body** with 25 real session documents (titles, dates,
   orgs — e.g. "UniAccess Live: Xavier University", "In Focus #4"), plus
   `Access-Control-Allow-Origin: http://localhost:5173` and `Vary: Origin` headers present,
   confirming the CORS fix is live and correctly scoped to the configured origin (not `*`).
   `curl` with no Authorization header → 401 as expected.
8. `pnpm -r typecheck` → all 10 packages report `Done`, no errors, including `apps/api`.
9. `pnpm -r test` → exit 0, no failing suites across the whole monorepo (spot-checked matches for
   "fail"/"error" in the output are all test *names* describing negative-path behavior, e.g. "throws
   ... never a silent empty result" — none are actual failures).
10. `pnpm gen:types --check` → `OK: 24 generated type file(s) + index.ts match schema/`.
11. `python schema/validate.py` → `PASS: 24 collection schema(s) validated correctly.`
12. **`pnpm lint:structure` → FAIL.** `lint-root: FAIL — 1 violation(s) / root has 18 loose files
    (budget 15): ... brain-before-click.png dashboard-fixed.png dashboard-live-check.png ...`.
    Confirmed these three PNGs are genuinely untracked (`git status --short` shows `??`) and NOT
    covered by `.gitignore` (`git check-ignore -v` returns nothing for any of the three; the
    repo's only PNG ignore rule is `reference/kb-deck-screens/*.png`). The manifest's own "Screenshot
    evidence" line names `dashboard-fixed.png` as one of these files, left at repo root, untracked.

## Judgment against contract criterion 8 ("No regression: ... `pnpm lint:structure` ... all clean")

This manifest's own scope is narrowly the env/CORS startup fix, and that fix itself is real,
correctly implemented, and independently reproduced by me end-to-end (fresh server boot, fresh
seed, fresh curl, fresh Playwright-equivalent header check). Criteria 1–7 of the contract (server
shape, auth, `/ask`, stub routes, webhooks stub, rate limiting, tests) are unaffected by this unit
and remain evidenced by the still-passing 66/66 test suite.

However, contract criterion 8 explicitly requires `pnpm lint:structure` to be clean as part of "no
regression," and it is not clean right now — it fails specifically because of byproduct screenshot
files this unit's own verification work left sitting at the repo root, pushing the loose-file count
3 over budget. This is a real, machine-checkable, reproducible failure on a stated criterion, not a
suspicion — I re-ran the command myself and got a deterministic FAIL both times I ran it. Per the
checker's "PASS requires every criterion evidenced; no partial PASS" rule, this closes the unit
FAIL rather than a partial pass, even though the fix's substance is sound and low-risk to fix
(delete or relocate the 3 screenshots).

FAILURES:
- [C8] sev: medium · `pnpm lint:structure`'s `lint-root` check fails (18 loose root files vs
  budget 15) because this unit's own evidence screenshots (`brain-before-click.png`,
  `dashboard-fixed.png`, `dashboard-live-check.png`) were left untracked at repo root instead of
  in a gitignored/scratch location · fix: move or delete the three PNGs (e.g. into `.handoffs/`
  or a new gitignored `evidence/` dir) before re-submitting; the env/CORS code changes themselves
  need no change · issue: ISS-023

ISSUES-WRITTEN: ISS-023

## EXPLANATION

The actual bug fix (dotenv loading, correct `MONGODB_URL`/`MONGODB_DB` var names, `CORS_ORIGINS`)
is real and verified independently — I reproduced the root cause's absence-of-fix state
conceptually (the old code path would default to `localhost:27017` and an empty CORS allow-list)
and confirmed the fixed code now connects to the real remote Mongo and serves the browser
correctly with matching CORS headers. The sole reason this doesn't PASS is a self-inflicted
side effect of this unit's own evidence-gathering (screenshots left in repo root) tripping a
pre-existing, unrelated structural lint budget that the contract's criterion 8 explicitly holds
this unit accountable for keeping clean. This should be a fast, low-risk fix-cycle-2 turnaround:
relocate/delete the three PNGs and re-submit; no code logic needs to change.
