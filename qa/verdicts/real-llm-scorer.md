# Verdict — real-llm-scorer (T-009b)

**Result: PASS**
**Commit verified:** `089d2b6`
**Cycle checked:** 1

Independently re-verified in a fresh shell (`cd /d/KnowledgeBase`), not by trusting the manifest's
pasted output. All commands re-run below.

## Criterion checklist

1. **`ScoreFn` widened, `evaluate()` awaits regardless of shape, existing sync tests unmodified**
   — MET. Read `packages/ask/src/evaluator.ts` in full. `ScoreFn = (query, node) =>
   MaybePromise<ScoreResult>` (line 23). Runtime behavior genuinely dual: `evaluate()` builds
   `pending` by calling `scoreFn` for every candidate, checks `isPromiseLike` on each result
   (line 96), and only takes the `Promise.all` path if at least one result is a thenable;
   otherwise it returns a plain `Evaluation` synchronously (line 98-100). `isPromiseLike` (line
   37-40) is a real runtime typeof/then check, not a no-op. Confirmed via test
   `T-009b: sync score_fn keeps evaluate()/ask() synchronous (no Promise wrapping)` — asserts
   `!(syncResult instanceof Promise)`. All pre-existing sync tests in `router.test.ts` pass
   unmodified (verified by full test run below; the diff to router.test.ts is 2 non-behavioral
   type-annotation removals + 3 wholly new `T-009b:`-prefixed tests, confirmed by reading the file).

2. **`ask()`/`askV2()` await `evaluate()`** — MET. `router.ts` mirrors the same overload-split
   duality with its own `isPromiseLike` check (line 74). `ask-v2.ts` line 77:
   `const askResult = await ask(...)` — a real `await`, and necessary since `askV2`'s
   `AskV2Deps.scoreFn` is `ScoreFn` (possibly async) and in production is now `createLlmScorer`'s
   genuinely-async function.

3. **`apps/api/src/score.ts` `createLlmScorer(complete)`** — MET. Read the file in full.
   (a) Calls the injected `complete` with a real prompt built from `query`/`node.title`/
   `node.summary`, `kind: "evaluator"` — not a stub. (b) Malformed/unparseable judge response
   (`parseJudgeResponse` returns `undefined` on JSON.parse failure or non-numeric `score`) falls
   back to `heuristicScore`, never throws — verified live via
   `createLlmScorer falls back to heuristicScore on unparseable response, never throws`.
   (c) A rejected `complete` call is caught (`try/catch` wraps the whole body) and also falls back
   to `heuristicScore` rather than propagating — verified live via
   `createLlmScorer falls back to heuristicScore when complete() rejects, never throws`. System
   prompt (lines 29-34) explicitly cites the "be conservative with high scores" CRAG rule, matching
   the contract's citation requirement. `evaluator` jobKind used — matches `config/ai-routing.yaml`
   line 9 (`evaluator: [gemini, claude-code]`), which already existed (T-019), no yaml edit needed
   — confirmed by reading the file directly, git blame not required since content matches manifest
   claim of "no yaml change needed."

4. **Wired into production, `/compete/start` inherits it** — MET. Read `apps/api/src/production.ts`
   in full: `scoreFn: createLlmScorer((job) => routeComplete("evaluator", job, ...))` (lines 42-44)
   is the default `askDeps.scoreFn`, `heuristicScore` is not called directly anywhere in
   production.ts. Read `apps/api/src/routes/compete.ts` line 72:
   `askV2(question, tree, { ...deps.askDeps, tenantId })` — spreads `deps.askDeps` wholesale, so it
   automatically inherits whatever `scoreFn` `production.ts` builds, no separate wiring. Confirmed
   this matches the contract's criterion-4 claim exactly.

5. **Tests exist, cover async fake + fallback paths** — MET, with the manifest's disclosed
   substitution of `router.test.ts` for the (nonexistent) `evaluator.test.ts` judged reasonable
   (see below). Read the actual new test bodies, not just names:
   - `T-009b: sync score_fn keeps evaluate()/ask() synchronous` — asserts non-Promise return.
   - `T-009b: async score_fn makes evaluate()/ask() return a Promise, verdict unchanged` — uses a
     genuinely `async` `ScoreFn`, awaits the Promise, checks verdict + per-node reason strings came
     through — a real async path, not a trivial always-resolved stub.
   - `T-009b: async score_fn rejection propagates, does not silently resolve` — asserts
     `assert.rejects` on a throwing async scoreFn — confirms errors aren't swallowed at the
     evaluator layer (distinct from score.ts's own deliberate catch-and-fallback).
   - `apps/api/src/score.test.ts` (new file, 4 tests): valid-response parse, out-of-range clamp,
     unparseable-response fallback (asserts reason matches `/fell back/` and score equals
     `heuristicScore`'s own output), and `complete()`-rejects fallback (asserts reason matches
     `/judge call failed/`). All four genuinely exercise `createLlmScorer`'s real logic against a
     fake `complete`, not mocks of `createLlmScorer` itself.

6. **No regression — typecheck/test/gen:types/schema/lint:structure all clean** — MET, all
   re-run fresh by me:
   - `pnpm -r typecheck`: all 9 workspace projects (`packages/core, ai, db, index, ask, ingest,
     meeting-bot`, `apps/api`) — every one printed `Done`, zero errors.
   - `pnpm -r test`: `packages/ai` 23/23, `packages/index` 8/8, `packages/ingest` 18/18,
     `packages/ask` **21/21** (18 pre-existing + exactly 3 new `T-009b:`-prefixed, confirmed by
     name), `packages/meeting-bot` 20/20, `apps/api` **18/18** (14 pre-existing + exactly 4 new
     `createLlmScorer ...` tests, confirmed by name). Zero failures anywhere.
   - `pnpm gen:types --check`: `OK: 21 generated type file(s) + index.ts match schema/`.
   - `python schema/validate.py`: `PASS: 21 collection schema(s) validated correctly.`
   - `pnpm lint:structure`: lint-loc/dirsize/root/dupes/migrations all OK, SNAPSHOT.md matches a
     fresh regeneration, dependency-cruiser reports `no dependency violations found`.

## Judgment on the two disclosed deviations

1. **Overload split instead of unconditional `async evaluate()`/`ask()`.** Reasonable and
   faithful. The contract's criterion 1 states two things in tension if read maximally literally:
   "awaits the result regardless of shape" and "existing tests must pass unmodified." An
   unconditionally-`async` function returns `Promise<Evaluation>` always, which would force every
   existing non-`await`ed call site in `router.test.ts` (and any other consumer) to change or fail
   to typecheck — that breaks the actual backward-compat bar the same sentence sets. The overload
   split is a legitimate TypeScript idiom for exactly this situation (sync-input-shape ⇒
   sync-return-shape), and the runtime `isPromiseLike` check backing it is real, not decorative —
   confirmed by reading it and by the passing `instanceof Promise` assertions in both directions.
   This is not scope-cutting; it is the more disciplined implementation of the same intent.

2. **New tests landed in `router.test.ts`, not a new `evaluator.test.ts`.** Reasonable. No
   `evaluator.test.ts` file exists in this codebase — the T-005/T-005b `evaluate()` tests have
   always lived in `router.test.ts` (confirmed by reading the file: sync `fakeScoreFn` and
   `evaluate`/`ask` tests interleaved there already, pre-dating this unit). Creating a new file
   split from convention, for no functional gain, would be the wrong call. The contract's own
   parenthetical — "(extend, don't fork)" — supports keeping them together.

Neither deviation reduces coverage or hides a gap; both are judgment calls that hold up under
independent scrutiny.

## Commit audit

`git show 089d2b6 --stat` confirms the diff matches the manifest's "Files touched" list exactly:
`TASKS.md`, `apps/api/src/production.ts`, `apps/api/src/score.test.ts` (new), `apps/api/src/score.ts`,
`packages/ask/src/ask-v2.ts`, `packages/ask/src/evaluator.ts`, `packages/ask/src/router.test.ts`,
`packages/ask/src/router.ts`, `qa/contracts/real-llm-scorer.md` (new),
`qa/manifests/real-llm-scorer.md` (new). No unrelated files, no silent scope creep.

## goal.json

Checked `D:\KnowledgeBase\.goal\goal.json` — it has no `T-009b` entry in its `tasks` array (only
T-001 through T-027 plus T-005b/T-017b). Nothing to mark there; left untouched per the checker's
own instruction not to guess a task id that doesn't exist.
