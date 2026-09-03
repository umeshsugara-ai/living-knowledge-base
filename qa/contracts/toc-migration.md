# Contract — toc-migration (T-002)

> Ground truth for migrating the 23 real TOC sessions into schema v2 (plan §5 Phase 1b). Drafted
> by the maker; /checker adopts or amends on first check. Per D-005 ("Claude Code / agentic /
> one-off... bulk backfill" is exactly this unit's job) — the maker (Claude, this session) does
> the extraction itself, no external LLM API call required.

## Scope
Process `raw/TOC/TOC-Materials/Transcripts/*.content.md` (23 files, old-style non-diarized
transcripts — already on disk, real content, not fixtures) plus
`raw/TOC/TOC-Materials/KNOWLEDGE-BANK.md` (the existing 240-line hand-built synthesis, usable as a
cross-check) into schema-v2-compliant JSON: one `sessions` doc, a `turns` array (paragraph-level,
since these transcripts are not speaker-diarized — `speakerRef` stays a placeholder `unknown` per
session, honestly, not guessed), one `session_pages` doc (summary + key insights, each citing real
`turnId`s), and `claims` (atomic facts, each citing real `turnId`s) — **per session, for all 23**.
No live MongoDB write required to PASS (documented unreachable-DB fallback, same precedent as
T-018's `migrate-mongo status`) — output lands as JSON files under `data/toc-migrated/<sessionId>/`
plus a `scripts/seed-toc.mjs` that WOULD load them into Mongo when reachable (validated via
`schema/validate.py`-style checks against the actual generated JSON, not fixtures).

## Criteria (each machine-checkable)

1. **All 23 sessions processed**, one output directory each:
   `data/toc-migrated/<sessionId>/{session.json, turns.json, session_page.json, claims.json}`.
   `ls data/toc-migrated | wc -l` = 23.
2. **Every `session.json` validates** against `schema/sessions.schema.json` (reuse
   `schema/validate.py`'s `Draft202012Validator` — write a small extension script
   `scripts/validate-toc-migration.mjs`/`.py` that loads each generated doc against its schema;
   do not hand-roll a second validator). `captureMode: 'provided'` (per D-008 — these transcripts
   were already provided by TOC, not silently captured) on every `sources.json`
   (also emitted per session, one per source recording/doc).
3. **Every `turns.json` entry validates** against `schema/turns.schema.json`; `speakerRef` is
   honestly `'unknown'` (not a guessed name) since the source transcripts carry no diarization;
   `tStart`/`tEnd` derived from paragraph order (monotonic, no live audio timestamps available —
   documented as a known limitation, closed by T-003's real diarization pass later).
4. **Every `session_page.json` and `claims.json` entry validates** against their schemas and
   **every `evidence[].turnId` is a real id present in that session's `turns.json`** (grep/script-
   checkable join, not just schema shape) — H3's "no fact without provenance" enforced on real
   data, not just fixtures, for the first time.
5. **Content is real, not templated:** spot-checkable — at least 3 sessions' `session_page.json`
   summaries must contain a concrete fact verifiable against `KNOWLEDGE-BANK.md`'s existing
   synthesis for that session (e.g. a number, program name, or speaker mentioned in both) —
   proving genuine extraction happened, not a boilerplate "this session covered X" placeholder.
6. **`scripts/seed-toc.mjs`**: reads `data/toc-migrated/*`, would upsert into the `sources`,
   `sessions`, `turns`, `session_pages`, `claims` collections via `packages/db`'s accessors
   (reusing `coll(tenantId)`, not raw driver calls) — `node scripts/seed-toc.mjs --dry-run` prints
   a per-collection insert count without connecting to Mongo (same environment-fallback pattern as
   T-018); `--dry-run` is required to PASS, a live run is not.
7. **No regression:** `pnpm lint:structure`, `python schema/validate.py` (existing 19 collections,
   unaffected by this data-only unit) both clean. `data/` added to root `.gitignore`'s exemption
   list is NOT needed — `data/toc-migrated/` IS committed (it's the migration output, not a
   build artifact) but stays under the root/dirsize budgets (one dir, 23 subdirs — check
   `structure.config.json`'s dirsize applies per-directory, so 23 subdirs of `data/toc-migrated/`
   is fine; each subdir has only 4 files).

## Non-goals for T-002
- No real Gemini diarization (T-003 — separate unit, real API spend, sequenced deliberately).
- No live Mongo write (documented fallback, as above). No tree-index regeneration from this data
  (T-004b). No claim-verification workflow (claims land as `needs-review`, not `verified` —
  verification is a human/eval-harness step, not this unit's job).
