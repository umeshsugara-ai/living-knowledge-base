# Contract — ask-router-v2 (T-005b)

> Ground truth for wiring `packages/ask` (T-005, ported to TS in T-016) into `packages/index`
> (T-004, tree-search) and `packages/ai` (T-019, provider seam), per the AI-engineer lens's
> flagged gap: "the LLM node-selection step is missing... router.py's tree_search_fn currently
> receives (tree, query) but tree_search.py takes node_ids". Drafted by the maker; /checker
> adopts or amends on first check.

## Scope
Add the three missing pipeline steps between tree-search and the existing evaluator/router:
`selectNodes` (LLM reasons over the tree, picks candidate node_ids — the step `packages/index`'s
`tree_search` assumes already happened), `refine` (CRAG's decompose→filter→recompose on both
internal and web docs, per the brain page gotcha the AI-engineer lens flagged as "missing in
router.py"), and `answer` (final generation from refined context). Add a per-call audit log using
T-019's `jobs` ledger. No live LLM/HTTP calls required — every new step takes an injected
`Provider`-shaped completion function (reusing T-019's seam), testable with fakes.

## Criteria (each machine-checkable)

1. **`selectNodes(query, tree, complete): Promise<string[]>`** in `packages/ask/src/select-
   nodes.ts` — builds a prompt from the tree's flattened `{node_id, title, summary}` list (reuse
   `packages/index`'s tree-walk, do not re-flatten by hand), calls the injected `complete`
   (T-019's `Provider['complete']` shape), parses a `{node_ids: string[]}` JSON response, and
   feeds those ids to `packages/index`'s existing `treeSearch(tree, node_ids)` to get full nodes.
   This is the missing link the AI-engineer lens flagged — `ask()`'s `tree_search_fn(tree, query)`
   signature mismatch is resolved by `selectNodes` owning the query→node_ids step and `treeSearch`
   staying id→nodes, unchanged.
2. **`refine(docs, query, complete): Promise<string>`** in `packages/ask/src/refine.ts` —
   decompose (split each doc's text into sentence-level strips), filter (per-strip keep/drop via
   injected `complete`), recompose (join kept strips). Applied to BOTH `good_docs` (internal) and
   web-fallback results when the router's verdict is `ambiguous`/`incorrect` — the exact gap the
   AI-engineer lens cited ("refine web docs too — currently missing in router.py").
3. **`answer(query, refinedContext, sources, complete): Promise<{text: string, sources}>`** in
   `packages/ask/src/answer.ts` — generates the final answer from refined context via injected
   `complete`, passes `sources` through unchanged (internal/web still separated per T-005's
   existing contract, not touched here).
4. **`askV2(query, tree, deps): Promise<AskResult>`** in `packages/ask/src/ask-v2.ts` — composes
   `selectNodes → evaluate (T-005's existing evaluate) → refine → answer`, wraps the whole flow so
   every external call (selectNodes' LLM call, each refine call, the answer call, and the original
   evaluator's `score_fn`) is logged via T-019's `recordJob` (injected `write`), producing an
   append-only per-query audit trail: `{jobKind: 'ask', step, provider, model, costUsd}[]`. Does
   NOT replace `packages/ask/src/{evaluator,router}.ts` (T-005's `ask()` stays as the lower-level
   primitive `askV2` builds on — no duplication, `askV2` imports and calls it).
5. **Tests exist and pass:** `packages/ask/src/{select-nodes,refine,answer,ask-v2}.test.ts`
   (node --test) covering: `selectNodes` parses a fake LLM's `node_ids` response and returns the
   matching tree nodes; `refine` drops a strip a fake `complete` marks irrelevant and keeps one it
   marks relevant (mirrors T-005's CRAG worked example); `askV2` end-to-end on a fixture tree +
   fake providers produces a result with `sources.internal`/`sources.web` separated (unchanged
   from T-005) AND a non-empty audit-log array; a verdict-`correct` fixture case skips `refine`/
   web entirely (T-005's existing internal-first guarantee still holds through `askV2`).
6. **No regression:** `pnpm -r typecheck`, `pnpm -r test` (existing 48 + new tests), `pnpm
   gen:types --check`, `python schema/validate.py`, `pnpm lint:structure` all clean. T-005's
   original `ask()`/`evaluate()` exports and their existing tests are untouched.

## Non-goals for T-005b
- No HTTP route (`POST /ask` itself is T-009). No real provider wiring (fakes only, as
  established by T-019). No vector-index query path (structured tree only — unstructured/vector
  is T-008).
