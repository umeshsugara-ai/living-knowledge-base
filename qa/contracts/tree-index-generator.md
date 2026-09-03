# Contract — tree-index-generator (T-004)

> Ground truth for the vectorless tree-index generator (ARCHITECTURE.md §2.1 Index layer,
> brain pages `vectorless-rag` / `pageindex-multi-source-merge`). Maintained by /checker;
> /maker reads only.

## Scope
A deterministic, pure Python module that builds a **vectorless JSON tree** — tenant → year →
month → session → topic — from `session_pages` + `sessions` documents (schema:
`schema/session_pages.schema.json`, `schema/sessions.schema.json`). No live MongoDB connection
required for T-004; the generator operates on in-memory lists of dicts shaped like those
schemas (a DB-backed loader is a later integration unit).

## Criteria (each machine-checkable)

1. **`schema/tree_index.schema.json` exists** and validates a tree node shape: `node_id`,
   `title`, `level` (`tenant|year|month|session|topic`), `summary`, `children: []`,
   optionally `sessionRef`/`evidence`.
2. **`tree_index/build_tree.py` exists** exporting a pure function
   `build_tree(sessions: list[dict], session_pages: list[dict], summarize=None) -> dict` that
   returns one root tree node per tenant.
3. **No embeddings, no vector math anywhere in this module** — grep-checkable: the module
   contains no `embed`, `cosine`, or vector-similarity code (vectorless-rag rule: tree
   structure, not similarity search).
4. **Correct grouping:** given N sessions across ≥2 distinct year/month buckets for the same
   tenant, the returned tree nests them month-under-year-under-tenant, and every session leaf
   is reachable by walking `children` from the tenant root.
5. **Every session node carries `evidence`**: `sessionRef` (the session `_id`) — so a node
   can always be traced back to its source document (H3, no fact without provenance).
6. **`summarize` is injectable, not hardcoded.** When no `summarize` callable is passed, the
   node `summary` falls back to the session_page's own `summary` field (schema
   `session_pages.summary`) rather than calling any LLM/network code — so the module is
   testable and network-free by default. When a `summarize` callable IS passed, its return
   value is used instead (proves the LLM-summarization seam exists without requiring a live
   API key to test it).
7. **`tree_index/tree_search.py` exists** exporting `tree_search(tree: dict, node_ids: list[str]) -> list[dict]`
   that walks the tree and returns the matching nodes by `node_id` (the retrieval half of the
   PageIndex pattern — LLM reasoning over this tree picks `node_ids`; this function just does
   the lookup, no LLM call inside it).
8. **Tests exist and pass:** `python tree_index/test_build_tree.py` exits 0, covering (a) a
   multi-session, multi-month fixture builds correctly nested tree, (b) every session leaf has
   `evidence.sessionRef` pointing to a real session `_id` in the input, (c) `tree_search`
   correctly retrieves a known node by id and returns empty for an unknown id, (d) the
   `summarize`-injection fallback behavior from criterion 6.

## Non-goals for T-004
- No live LLM call, no MongoDB read/write, no HTTP/API layer — those are later units
  (T-005 CRAG router calls `tree_search`, T-009 wires an API).
- No incremental/partial regeneration logic — full-rebuild-from-input only for this unit.
