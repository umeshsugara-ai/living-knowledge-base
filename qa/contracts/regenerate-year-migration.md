# Contract — regenerate-year-migration (T-004c)

> Ground truth for `regenerate()`'s two disclosed scope limitations from T-004b (see
> `qa/contracts/tree-index-v2.md`'s amendment log): (1) a session that changed year is only
> cleaned up from its OLD year if that old year also happens to contain another changed session;
> (2) a topic's cross-session `evidence.sessionRefs` only refreshes within touched years, so a
> topic shared with an untouched year won't pick up a new session there until that year is itself
> touched. Drafted by the maker; /checker adopts or amends on first check.

## Scope
Extend `packages/index/src/tree/regenerate.ts` (not replace) to: (1) detect a changed session's
OLD year by scanning the input `tree` for its current location, and include that old year in
`touchedYears` even if no other changed session lives there, so the orphaned node is removed on
rebuild; (2) widen `packages/index/src/tree/build.ts`'s `buildTree` with an optional
`topicContextSessions?: Sessions[]` parameter (defaults to `sessions` — 100% backward compatible,
every existing T-004/T-004b test call site untouched) used ONLY for the cross-session topic-map
pass (pass 1), so `regenerate()` can pass the FULL tenant session list there while still only
rendering (pass 2) the touched-year subset — giving touched years' topic nodes accurate
cross-year `sessionRefs` without rebuilding untouched years. Untouched years' own topic nodes
still don't refresh (unchanged from T-004b — refreshing those would require rebuilding them,
defeating the whole point of "untouched subtree stays `===`") — this residual limitation is
disclosed, not silently reintroduced.

## Criteria (each machine-checkable)

1. **Old-year cleanup**: `regenerate(tree, changedSessionIds, sessions, sessionPages)` — for each
   id in `changedSessionIds`, scan `tree.children` (year nodes) for an existing session node whose
   `node_id` ends `/session:<id>`; if found, add that year node's `title` (the year string) to
   `touchedYears` in addition to the year(s) derived from the session's CURRENT `date` in
   `sessions`. Test: a session moves from year Y1 (present in the input `tree`, no other changed
   session in Y1) to year Y2 (new `date`) — after `regenerate`, Y1's year subtree must NOT contain
   a session node for that id (or Y1 must be entirely absent from `result.children` if it had no
   other sessions), and Y2 must contain it.
2. **`buildTree` gains `topicContextSessions?: Sessions[]`** (5th positional param, after
   `extractFn`, defaulting to `sessions`) — pass 1 (the cross-session topic map: slug → session
   ids sharing it) iterates `topicContextSessions` instead of `sessions`; pass 2 (rendering
   year/month/session/topic/org nodes) is unchanged, still iterates `sessions` only. Every existing
   `buildTree(...)` call site (T-004/T-004b tests, `regenerate.ts`'s own internal call, any
   production caller) that doesn't pass a 5th argument must produce byte-identical output to
   before this change — test: re-run T-004/T-004b's existing topic-grouping assertions unmodified.
3. **`regenerate()` passes the full tenant session list as `topicContextSessions`** when calling
   `buildTree` for the touched-year rebuild, so a topic shared between a touched year and an
   untouched year gets the untouched year's session id included in the touched year's topic node's
   `evidence.sessionRefs` (while the untouched year's own topic node, unrebuilt, still lacks it —
   documented residual gap, not a criterion violation). Test: two years, a topic present in both;
   regenerate touching only year A; year A's topic node's `sessionRefs` must include the session id
   from year B.
4. **No regression**: `pnpm -r typecheck`, `pnpm -r test` (existing tree/regenerate/tree-real-data
   suites all green, no assertion changed), `pnpm gen:types --check`, `python schema/validate.py`,
   `pnpm lint:structure` all clean.

## Non-goals for T-004c
- Untouched years' own topic nodes are NOT refreshed (would require rebuilding them — contradicts
  the `===`-preservation guarantee that is the entire point of incremental regeneration). A full
  cross-year topic refresh, if ever needed, is a separate "rebuild everything" operation, not this
  function's job. No live Mongo write. No change to `extractTopicRefs`'s heuristic itself.
