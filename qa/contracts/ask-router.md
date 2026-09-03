# Contract — ask-router (T-005)

> Ground truth for the CRAG-style `/ask` retrieval + answer router (ARCHITECTURE.md §2.2,
> brain page `corrective-rag-crag`). Maintained by /checker; /maker reads only.

## Scope
A pure Python module implementing the CRAG flow over the tree index built in T-004:
tree-search candidate nodes → per-node relevance scoring (injectable, not hardcoded to any
LLM vendor) → verdict derivation (`correct` / `ambiguous` / `incorrect`) → answer assembly
with internal citations, and — on `ambiguous`/`incorrect` — a web-fallback seam (injectable,
mockable) whose results are cited **separately** from internal ones. No live LLM call, no
live web search, no HTTP/API layer required for T-005 — those are wired in T-009. All model
and web calls are injected callables so the routing logic is independently testable and
network-free by default.

## Criteria (each machine-checkable)

1. **`ask_router/evaluator.py` exists** exporting `evaluate(query: str, candidates: list[dict], score_fn) -> dict`
   that scores each candidate node via the injected `score_fn(query, node) -> float in [0,1]`
   and returns `{"scored": [...], "good_docs": [...], "verdict": "correct"|"ambiguous"|"incorrect"}`.
2. **Threshold logic matches the CRAG paper defaults**, tunable via parameters: verdict is
   `correct` if any score `>= 0.7`; `incorrect` if all scores `< 0.3`; else `ambiguous`.
   `good_docs` includes every candidate scoring `>= 0.3`, independent of the verdict (the
   documented CRAG gotcha: correct-verdict answers still exclude sub-0.3 docs).
3. **`ask_router/router.py` exists** exporting `ask(query, tree, tree_search_fn, score_fn, web_fallback_fn=None) -> dict`
   that: (a) calls `tree_search_fn` to get candidate nodes, (b) calls `evaluate`, (c) on
   `correct` returns an answer built from `good_docs` only with `web_used: False`, (d) on
   `ambiguous`/`incorrect` calls `web_fallback_fn(query)` (if provided) and merges its results,
   returning `web_used: True` with internal and web sources kept in **separate lists**
   (`sources.internal`, `sources.web`) — never merged into one undifferentiated list.
4. **No web_fallback_fn provided + verdict != correct → explicit `insufficient_coverage: True`**
   in the result, never a silent empty answer and never a fabricated one.
5. **Every citation in the answer traces back to a real node/turn.** `sources.internal` items
   carry `node_id` (and, when present on the node, `evidence.sessionRef`); `sources.web` items
   carry whatever `web_fallback_fn` returned verbatim (untouched, not reinterpreted).
6. **Verdict + score + reason are always returned**, even on `correct` — auditability
   (ARCHITECTURE §2.2 "log score + verdict + reason on every call").
7. **Tests exist and pass:** `python ask_router/test_router.py` exits 0, covering: (a) a
   query where a fake `score_fn` returns one candidate `>= 0.7` → verdict `correct`, no web
   call made even if `web_fallback_fn` is supplied (proves internal-first is enforced, not
   just possible); (b) all candidates scoring `< 0.3` → verdict `incorrect`, web_fallback_fn
   invoked, `web_used: True`, sources split correctly; (c) mixed scores (some `>= 0.3`, none
   `>= 0.7`) → verdict `ambiguous`, both `good_docs` and web results present in the merged
   answer; (d) `verdict != correct` with no `web_fallback_fn` → `insufficient_coverage: True`,
   no exception raised.

## Non-goals for T-005
- No real LLM scoring, no real web search (Tavily etc.), no HTTP endpoint — `score_fn` and
  `web_fallback_fn` are test doubles here; wiring real providers is T-009.
- No query-rewrite step (CRAG's optional polish, brain page notes it helped little in
  practice) — can be added later as an injectable seam without changing this contract.
