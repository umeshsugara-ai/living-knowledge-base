# ADR-0001 — Schema v2 (T-018): casing, references, tenancy

## Status
Accepted (maker research pass, checker to adopt/amend on first check).

## Context
T-018 requires camelCase evidence keys, 8 new collections, and a tenancy-enforcement
mechanism, decided against real prior art rather than invented from scratch (contract
`qa/contracts/schema-v2.md` C1).

## Research
- **Vexa** (github.com/Vexa-ai/vexa, Apache-2.0, already the chosen STT vendor — D-004) —
  README + `docs/websocket.md`: meeting transcripts are stored as **segments** (time,
  speaker, text) in Postgres, deduplicated by `absolute_start_time` with `updated_at`
  precedence, then grouped by consecutive same-speaker segments for display. Segments are
  the atomic unit; nothing above them duplicates segment text — display-layer grouping is
  computed, not stored. This matches our `turns` (atomic, cited) vs. `session_pages`
  (computed summary) split.
- **Onyx** (github.com/onyx-dot-app/onyx, `backend/onyx/db/models.py`,
  `backend/onyx/connectors/README.md`) — SQLAlchemy models: `Document` rows carry a stable
  external id and are linked to connectors via a `DocumentByConnectorCredentialPair`
  association table (many-to-many, not a duplicated foreign key on the document itself).
  Chunks reference their parent document by id only; chunk text is generated at index time
  and is not the source of truth — the document is. Multi-tenant deployments give each
  tenant its **own Postgres schema** (schema-per-tenant), with one shared `public` table
  for the tenant map — i.e. tenancy is enforced by the storage boundary itself, not just an
  app-level filter.
- Already-adopted brain patterns: `pageindex-multi-source-merge` (tree nodes cite source
  ids, never inline the source text) and `vectorless-rag` (structured content stays
  citation-based, not re-embedded/duplicated) — both already assume no-duplicate-text.

## Decisions
1. **Evidence-key casing: camelCase** (`turnId`, `sessionId`), matching every other field
   in `schema/*.schema.json` (`tenantId`, `sourceId`, `personId`, `speakerRef`) — the
   `turn_id`/`session_id` snake_case was the one inconsistency. No external source dictates
   casing; this is repo-internal consistency.
2. **`media`/`chunks` reference `turns` by id only — never duplicate text.** Directly
   follows Vexa's segment-is-atomic model and Onyx's document-is-source-of-truth /
   chunk-by-reference model, and matches the already-adopted `pageindex-multi-source-merge`
   / `vectorless-rag` patterns and ARCHITECTURE H3 (no fact without a citation *to* a turn,
   not a copy *of* one). `chunks.turnRefs: string[]`, `media.turnRefs: string[]`.
3. **Tenancy enforcement: TS type-level via `coll(tenantId)` accessors**, not
   schema-per-tenant like Onyx. Onyx's Postgres-schema-per-tenant has no equivalent in a
   single MongoDB database without provisioning a DB per tenant, which ARCHITECTURE §5
   already rejects (`H5`: one Mongo, per-tenant scoping, mirroring
   `sources/whatsapp_msg/src/db`). Instead every collection document carries `tenantId`
   (schema-enforced, `required`) and `packages/db/src/collections/<coll>.ts` exports
   `coll(tenantId)` functions whose signature makes a tenant-less call a compile error
   (ARCHITECTURE §5, §4). Weaker than Onyx's storage-level boundary but consistent with the
   existing `whatsapp_msg` accessor pattern this repo already mirrors.

## Consequences
`turn_id`/`session_id` is a breaking rename (plan §6c.1, accepted). `media`/`chunks`
schemas get `turnRefs`/`sessionRefs`, not embedded turn text. Tenant isolation is
enforced by convention + compiler, not by the database — a future hardening step (not
T-018) could add a Mongo-side check (e.g. a view or `$expr` guard) if the TS boundary
proves insufficient.
