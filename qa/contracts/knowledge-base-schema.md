# Contract — knowledge-base-schema (T-001)

> Ground truth for the Mongo data model underlying the Living Knowledge Base (ARCHITECTURE.md
> §2.1 / §H1 / §H3 / §H4). Maintained by /checker; /maker reads only.

## Scope
The nine collections that make up the Raw + Knowledge layers (Index layer — `tree_index`,
`vector_index`, `graph_edges` — is out of scope for T-001; see T-004/T-008). This contract
covers: `sources`, `sessions`, `turns`, `speakers`, `session_pages`, `claims`, `topics`, `orgs`,
`decisions`.

## Criteria (each machine-checkable)

1. **Schema files exist** as JSON Schema (Draft 2020-12) under `schema/`, one file per
   collection, named `<collection>.schema.json`.
2. **Every schema declares `required`** for its natural-key / provenance fields (see field list
   below) — a document missing a required field must fail validation.
3. **Provenance is mandatory on knowledge-layer collections** (H3): `session_pages`, `claims`,
   `speakers`, `decisions` each require an `evidence` array of `{turn_id, session_id}` objects,
   `minItems: 1`.
4. **Tenancy field present** (ARCHITECTURE §5): every collection's schema requires `tenantId`
   (string).
5. **Speaker identity is alias-based** (H4): `speakers.schema.json` models `aliases: string[]`
   and forbids a bare `name` as the only identity field — `personId` is the required stable key.
6. **A Python validator (`contracts/verify_contracts.py` extension or a new
   `schema/validate.py`) can load every schema file and validate at least one passing and one
   failing fixture document per collection**, proving the schemas are both loadable and
   discriminating (not vacuously permissive).
7. **Fixtures exist** under `schema/fixtures/<collection>.valid.json` and
   `<collection>.invalid.json` for every collection in scope.
8. **`python schema/validate.py` exits 0** when run against the valid fixtures and reports every
   invalid fixture as failing (proving the checker can re-run it independently).

## Non-goals for T-001
- No live MongoDB connection required — schema + validator only. Wiring to an actual Mongo
  instance is a later unit.
- No API/route code — that's T-005/T-009.

## Amendment log
- 2026-09-03 · routine · scope note: validate.py now covers 10 schemas (tree_index added by T-004) — C6/C7/C8 apply to every `*.schema.json` present under `schema/`; "nine collections" in Scope predates `schema/tree_index.schema.json` and 10 is the correct count · ISS-004 cycle-1 check
