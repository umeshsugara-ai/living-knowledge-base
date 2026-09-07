# Contract — knowledge-graph-accessors (plan §10 U0.9)

> Ground truth for the five `packages/db` tenant-scoped accessors over the knowledge-graph
> collections — `topics`, `speakers`, `decisions`, `orgs`, `graph_edges` — created by the
> `knowledge-graph-accessors` unit. Created and adopted by /checker in the same action: the
> manifest explicitly deferred contract-writing to the checker per the project's
> segregation-of-duties rule (ISS-006), so there is no separate maker draft to react to — this
> file *is* the first draft, written from the manifest's proposed criteria plus this checker's own
> independent read of the five files and the reference pattern.
>
> **Why this contract exists:** these five collections had real JSON schemas + generated types for
> some time with zero way to write a row to any of them — every later extraction unit (topic/org
> promotion, LLM topic/speaker/decision/graph-edge extraction) was blocked on this. The risk this
> contract guards against is narrow but sharp: a copy-pasted accessor is one string literal away
> from writing into the wrong Mongo collection, or from silently becoming the one accessor in the
> package that skips tenant scoping.

## Scope

The five accessor files under `packages/db/src/collections/` (`topics.ts`, `speakers.ts`,
`decisions.ts`, `orgs.ts`, `graph-edges.ts`) and their coverage in
`tenantScope.typecheck-test.ts`. Out of scope: the shared `scopedCollection`/`tenantScope`
mechanism itself (covered by `packages/db/src/lib/tenantScope.test.ts`'s 13 runtime tests, not by
this contract), and any future collection-specific query/business logic layered on top of these
accessors (a later unit's concern, not this one's).

## Criteria (each machine-checkable)

1. **[C1] One accessor per collection, same shape as `sessions.ts`.** Each of the five files
   exports exactly one function returning
   `scopedCollection<T>(getDb(), "<name>")(tenantId)` — no extra logic, no alternate construction
   path. Verified by reading the file; `grep -c "scopedCollection<"` on each file must equal 1.
2. **[C2] Collection name strings match their schema filenames.** The string literal passed to
   `scopedCollection` for each accessor must equal the corresponding
   `schema/<name>.schema.json` stem exactly — including `graph_edges` (underscore), even though
   the source file is named `graph-edges.ts` (hyphen, since `graph-edges` is not a valid JS
   identifier). A mismatch here is a silent wrong-collection write, not a compile error.
3. **[C3] Imported type matches the collection.** Each accessor imports its generic type
   (`Topics`, `Speakers`, `Decisions`, `Orgs`, `GraphEdges`) from `@lkb/core`, and that type must be
   the one generated from the same-named schema (`packages/core/src/generated/<name>.ts`).
4. **[C4] Tenant-less call is a compile error, for all five.** Every one of the five accessors has
   an `@ts-expect-error` assertion in `tenantScope.typecheck-test.ts` proving a zero-argument call
   fails `tsc`.
5. **[C5] Valid call typechecks, for all five.** Every one of the five accessors also appears in
   `validCalls()` in the same file, proving the correct one-argument call compiles.
6. **[C6] No duplicate accessor.** No other file in the repo constructs
   `scopedCollection(..., "<one of the five names>")` outside these five files. Checked via
   `grep -rn 'scopedCollection.*"<name>"'` across the repo.
7. **[C7] Build stays green.** `pnpm --filter @lkb/db typecheck`, `pnpm -r typecheck`, and
   `pnpm --filter @lkb/db test` (13/13) all pass with these files present.
8. **[C8] No schema regression.** `python schema/validate.py` still reports 24/24, unaffected by
   this unit (these accessors carry no validation logic of their own — schema conformance is
   enforced at the TypeScript type level via the generic parameter, not runtime here).
9. **[C9] Structure budget.** `pnpm lint:structure` (loc/dirsize/root/dupes/migrations/snapshot/
   tracker-audit/depcruise) exits 0 with these five files tracked in git.

## Invariants

- **[I1] Tenant scoping is never bypassed.** No accessor in this set may call `getDb()` directly
  or construct a Mongo collection handle outside `scopedCollection`. The whole point of the
  pattern is that a tenant-less call cannot compile — an accessor that "helpfully" adds a default
  tenant or an optional-parameter escape hatch defeats C4 and must be rejected even if it still
  typechecks under a looser signature.
- **[I2] The collection-name string is load-bearing and must be reviewed on every future edit to
  any of these five files.** Renaming the exported function or the file is safe; changing the
  string literal argument to `scopedCollection` is a data-migration-shaped change and needs its
  own decision, not a drive-by edit.
- **[I3] New knowledge-graph collections follow this same contract, not a new one.** If a sixth
  collection (e.g. a future `mentions` or `references` table) needs an accessor, it is added under
  these same nine criteria rather than spawning a parallel contract — amend this file's scope
  instead.

## Out of scope / ignore
- Collection-specific query helpers, indexes, or aggregation pipelines built on top of these
  accessors: a later unit's contract, not this one's.
- The runtime behavior of `scopedCollection` itself (tenant injection, override protection,
  empty-filter/empty-tenant handling): governed by `packages/db/src/lib/tenantScope.test.ts`,
  unchanged by this unit.

## Amendment log
- 2026-09-08 · routine · Contract CREATED and ADOPTED by /checker in the same action on the
  `knowledge-graph-accessors` cycle-1 check, from the manifest's proposed criteria (deferred per
  ISS-006 segregation-of-duties) plus this checker's own independent verification of all five
  files, `tenantScope.typecheck-test.ts`, `packages/core/src/index.ts`'s re-exports, and a
  repo-wide grep confirming no pre-existing duplicate accessor. START stands on plan §10 U0.9.
