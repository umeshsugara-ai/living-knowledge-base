# Contract — compete-screen (T-012, internal tier only)

> Ground truth for the counsellor compete screen, scoped down 2026-09-03 by Umesh: "ek screen
> banega jahan counsellor basic details daal ke start kar payenge, dont take it too much." ONE
> manual-entry form — no self-serve onboarding, no panel-management UI. Internal scoring tier only
> (per grill Q12/F5 and D-007) — the public-championship tier (independent human panel) is a later
> unit gated on Q3 (who judges externally), not built here. Drafted by the maker; /checker adopts
> or amends on first check.

## Scope
A minimal `eval_runs` collection + one HTML form (served by `apps/api`, reusing its existing
Express app from T-009 rather than starting a second server) where Umesh types a counsellor's
basic details (name, optional org) and a question, clicks start, and gets back **both** the KB's
answer (via T-009's real `/ask`) and a place to record the counsellor's own answer + a score —
producing one `eval_runs` row with `credibility: 'internal'` (per D-007/grill Q2, since this has
no independent panel). No real-time multi-user competition infrastructure, no counsellor accounts,
no question bank UI (D-007's frozen bank is referenced by id, not re-implemented here).

## Criteria (each machine-checkable)

1. **`schema/eval_runs.schema.json`** + fixtures: `{_id, tenantId, question, counsellor: {name,
   org?}, aiAnswer: {text, sources}, counsellorAnswer: {text}, score: {ai: number, counsellor:
   number, notes?}, credibility: 'internal'|'independent-human'|'calibrated-llm', createdAt}` —
   `required: tenantId, question, counsellor, credibility, createdAt`. `credibility` defaults to
   `'internal'` for anything built by this unit (D-007's tier rule — public results need
   `'independent-human'`, not producible by a one-person form). Extends `schema/validate.py`'s
   existing loop (20→21 collections).
2. **`packages/db/src/collections/eval-runs.ts`**: `coll(tenantId)` accessor matching the existing
   5 (T-018/T-006), `create`/`recordScore`/`listByCredibility`.
3. **One route, `apps/api/src/routes/compete.ts`** (added to the existing T-009 Express app, not
   a new server): `POST /compete/start` (scope `compete`, new scope added to the auth scope list)
   — body `{question, counsellor: {name, org?}}`, calls the existing `/ask` logic internally (reuse
   `askV2`'s composition, don't duplicate it), returns `{evalRunId, aiAnswer}`. `POST
   /compete/:id/score` — body `{counsellorAnswer, score: {ai, counsellor}, notes?}`, updates the
   `eval_runs` row via `recordScore`.
4. **One HTML form**, served as a static file at `GET /compete` (Express `express.static` or an
   inline route — whichever is simpler given the existing `apps/api` structure) — plain HTML +
   vanilla JS (no new frontend framework/dependency), fields: counsellor name (required), org
   (optional), question (required), a "Start" button calling `/compete/start`, then a results view
   showing the AI's answer with sources, a textarea for the counsellor's answer, two score inputs
   (AI score, counsellor score, both 1-5), and a "Save" button calling `/compete/:id/score`. This
   is intentionally plain — the criterion is that it round-trips through the two routes correctly
   in a browser, not that it looks polished (Umesh's own words: "dont take it too much").
5. **Tests exist and pass:** `apps/api/src/routes/compete.test.ts` (node --test, in-process,
   matching T-009's test pattern) covering: `/compete/start` with a fake `askV2`/store produces an
   `eval_runs` row with `credibility: 'internal'`; `/compete/:id/score` updates the existing row
   (not a new one); missing `compete` scope → 403 (reusing T-009's auth middleware, not a second
   auth system); a nonexistent `:id` on `/score` → 404.
6. **No regression:** `pnpm -r typecheck`, `pnpm -r test` (existing 8 in `apps/api` + new),
   `pnpm gen:types --check`, `python schema/validate.py` (21/21), `pnpm lint:structure` all clean.

## Non-goals for T-012
- No public/independent-human panel tier (gated on Q3 — who are the external counsellors, who
  judges). No question-bank management UI (D-007's bank is referenced by id/text only). No
  counsellor self-registration or accounts (T-028, explicitly deferred). No real LLM-based scoring
  automation here — score fields are typed in by Umesh directly on this screen, matching "manual"
  exactly as asked. No leaderboard/aggregation view (a later unit once multiple runs exist).
