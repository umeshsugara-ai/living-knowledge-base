**VERDICT: PASS**

# Verdict — knowledge-graph-accessors (plan §10 U0.9)

**Cycle checked: 1**
Contract: `qa/contracts/knowledge-graph-accessors.md` (created and adopted by this checker in
this same action — the manifest deferred contract-writing per ISS-006 segregation-of-duties, so
there was no separate maker draft to react to).
Manifest: `qa/manifests/knowledge-graph-accessors.md`

Fresh, isolated context. Nothing in the manifest was trusted without independent re-derivation —
every file was read directly, every command re-run from scratch, and a repo-wide grep was run to
rule out a duplicate accessor before accepting the "purely additive" claim.

## 1. Pattern match against `sessions.ts` (reference)

PASS. Read `packages/db/src/collections/sessions.ts` and all five new files directly:

- `topics.ts` → `export function topics(tenantId) { return scopedCollection<Topics>(getDb(), "topics")(tenantId); }`
- `speakers.ts` → `scopedCollection<Speakers>(getDb(), "speakers")(tenantId)`
- `decisions.ts` → `scopedCollection<Decisions>(getDb(), "decisions")(tenantId)`
- `orgs.ts` → `scopedCollection<Orgs>(getDb(), "orgs")(tenantId)`
- `graph-edges.ts` → `export function graphEdges(tenantId) { return scopedCollection<GraphEdges>(getDb(), "graph_edges")(tenantId); }`

All five are byte-for-byte the same 3-line shape as `sessions.ts`, differing only in the type,
collection-name string, and function name. Import path (`../client.js`, `../lib/tenantScope.js`)
and the tenant-required-by-construction pattern match exactly.

**Collection-name-vs-schema-filename check (the one specifically flagged as a real-bug risk):**
confirmed `graph-edges.ts` (hyphenated filename, since `graph-edges` is not a valid JS identifier)
passes the string `"graph_edges"` (underscore) to `scopedCollection`, matching
`schema/graph_edges.schema.json`'s stem exactly, and the exported function is camelCased
`graphEdges`. The other four filenames, collection strings, and function names all match their
schema stems directly (`topics`/`topics`, `speakers`/`speakers`, `decisions`/`decisions`,
`orgs`/`orgs`). No mismatch found.

## 2. `tenantScope.typecheck-test.ts` coverage

PASS. Read the file directly. All five new accessors (`topics`, `speakers`, `decisions`, `orgs`,
`graphEdges`) are imported, each has its own `@ts-expect-error` no-argument-call line (10 total
`@ts-expect-error` assertions for 10 accessors, old five + new five), and each also appears in
`validCalls()` with a valid `"toc"` tenant argument. Matches the existing five
(`sources`/`sessions`/`turns`/`claims`/`gaps`) one-for-one in structure.

## 3. Typecheck

PASS, re-run fresh:

```
$ pnpm --filter @lkb/db typecheck
> tsc --noEmit -p tsconfig.json
(clean, no output/errors)

$ pnpm -r typecheck
Scope: 10 of 11 workspace projects
apps/web typecheck: Done
packages/core typecheck: Done
packages/db typecheck: Done
packages/ai typecheck: Done
packages/ask typecheck: Done
packages/ingest typecheck: Done
packages/index typecheck: Done
apps/api typecheck: Done
packages/meeting-bot typecheck: Done
```

All 10 typecheck-bearing workspace projects clean.

## 4. `@lkb/db` test suite

PASS, re-run fresh:

```
$ pnpm --filter @lkb/db test
ℹ tests 13
ℹ pass 13
ℹ fail 0
```

13/13, the shared `tenantScope`/`scopedCollection` mechanism all five new accessors depend on.
Confirms the manifest's reasoning that no collection-specific test is needed — none of the
existing accessor files (`sessions.ts`, `claims.ts`, etc.) has its own test file either.

## 5. Schema validation regression check

PASS, re-run fresh:

```
$ python schema/validate.py
OK: topics — valid fixture passes, invalid fixture correctly rejected (1 error(s))
OK: speakers — valid fixture passes, invalid fixture correctly rejected (2 error(s))
OK: decisions — valid fixture passes, invalid fixture correctly rejected (1 error(s))
OK: orgs — valid fixture passes, invalid fixture correctly rejected (1 error(s))
OK: graph_edges — valid fixture passes, invalid fixture correctly rejected (2 error(s))
...
PASS: 24 collection schema(s) validated correctly.
```

24/24, all four specifically-flagged collections (`topics`, `speakers`, `decisions`, `orgs`) plus
`graph_edges` pass. No regression — this unit touched no schema file, as claimed.

## 6. Structure lint

PASS, re-run fresh:

```
$ pnpm lint:structure
lint-loc: OK (225 file(s) within budget)
lint-dirsize: OK (74 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (247 unique export(s), 24 unique schema $id(s))
lint-migrations: OK (1106 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (115 lines, budget 200)
tracker-audit: OK (gate G1)
✔ no dependency violations found (247 modules, 732 dependencies cruised)
```

Clean, including `lint-dupes` (247 unique exports — no duplicate export names introduced).

## 7. `@lkb/core` exports — independently confirmed, not trusted

PASS. Read `packages/core/src/index.ts` directly: `export * from "./generated/topics.js"`,
`./generated/speakers.js`, `./generated/decisions.js`, `./generated/orgs.js`,
`./generated/graph_edges.js` are all present. Read each generated file directly and confirmed the
exact interface names used by the new accessors exist:

- `packages/core/src/generated/topics.ts:7` → `export interface Topics {`
- `packages/core/src/generated/speakers.ts:7` → `export interface Speakers {`
- `packages/core/src/generated/decisions.ts:7` → `export interface Decisions {`
- `packages/core/src/generated/orgs.ts:7` → `export interface Orgs {`
- `packages/core/src/generated/graph_edges.ts:7` → `export interface GraphEdges {`

The manifest's claim that no `packages/core` change was needed is correct — all five types were
already generated and re-exported before this unit.

## 8. Duplicate-accessor check (own grep, not trusted from the manifest)

PASS. Ran independently across the whole repo:

```
$ grep -rn "scopedCollection.*\"topics\"\|scopedCollection.*\"speakers\"\|scopedCollection.*\"decisions\"\|scopedCollection.*\"orgs\"\|scopedCollection.*\"graph_edges\"" --include="*.ts" .
./packages/db/src/collections/decisions.ts:8:  ...
./packages/db/src/collections/graph-edges.ts:8:  ...
./packages/db/src/collections/orgs.ts:8:  ...
./packages/db/src/collections/speakers.ts:8:  ...
./packages/db/src/collections/topics.ts:8:  ...
```

Only the five new files match — no pre-existing or alternate-named accessor for any of these
collections exists elsewhere in the repo. `lint-dupes` (§6 above) independently corroborates via
its unique-export-name count. Genuinely additive, not a duplicate-definition problem.

## Contract

Wrote `qa/contracts/knowledge-graph-accessors.md` — 9 machine-checkable criteria (accessor shape,
collection-name-vs-schema-filename match, correct imported type, tenant-less-call compile error
and valid-call coverage for all five, no duplicate accessor, typecheck/test/schema-validate/
lint:structure all green) and 3 invariants (tenant scoping never bypassed even by a "helpful"
default, the collection-name string is load-bearing and reviewed on every future edit, future
knowledge-graph collections extend this contract rather than spawning a new one). Adopted directly
since the manifest explicitly deferred the draft to the checker (ISS-006) — there was no prior
draft to amend, so creation and adoption happen in the same amendment-log entry.

## Overall

**PASS.** All checks independently re-run and confirmed: pattern match (including the
specifically-flagged `graph_edges` underscore-vs-hyphen collection-name risk, which is correctly
handled), full typecheck-test coverage for all five accessors, clean typecheck/test/schema-
validate/lint:structure, genuine `@lkb/core` export pre-existence, and no duplicate accessor
anywhere in the repo. Pure additive change as claimed.
