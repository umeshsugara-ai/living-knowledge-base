# Verdict — T-001-knowledge-base-schema
**Checked:** 2026-09-03
**Cycle checked:** 1
**Checker:** /checker Mode A (fresh subagent, project root `D:\KnowledgeBase`)

## Re-run evidence

`python schema/validate.py` (re-run independently, not pasted):
```
OK: claims — valid fixture passes, invalid fixture correctly rejected (1 error(s))
OK: decisions — valid fixture passes, invalid fixture correctly rejected (1 error(s))
OK: orgs — valid fixture passes, invalid fixture correctly rejected (1 error(s))
OK: session_pages — valid fixture passes, invalid fixture correctly rejected (1 error(s))
OK: sessions — valid fixture passes, invalid fixture correctly rejected (3 error(s))
OK: sources — valid fixture passes, invalid fixture correctly rejected (4 error(s))
OK: speakers — valid fixture passes, invalid fixture correctly rejected (2 error(s))
OK: topics — valid fixture passes, invalid fixture correctly rejected (1 error(s))
OK: turns — valid fixture passes, invalid fixture correctly rejected (3 error(s))

PASS: 9 collection schema(s) validated correctly.
```
Exit code: 0 (confirmed).

`python -c "import json,glob; [json.load(open(f)) for f in glob.glob('schema/*.schema.json')]"`
→ no exception (confirmed).

`ls schema/fixtures` → 18 files present, one `.valid.json` + one `.invalid.json` per collection
(claims, decisions, orgs, session_pages, sessions, sources, speakers, topics, turns).

Read all 9 schema files directly and `schema/validate.py` source directly (not summarized by
the maker).

## Criteria

1. **[C1] Schema files exist under `schema/`, one per collection, JSON Schema Draft 2020-12** —
   MET. All 9 files present, each declares `"$schema": "https://json-schema.org/draft/2020-12/schema"`.
2. **[C2] Every schema declares `required` for natural-key/provenance fields** — MET. Verified
   per-file: sources (`_id, tenantId, kind, hash, consent, createdAt`), sessions (`_id, tenantId,
   sourceId, title, date, status`), turns (`_id, tenantId, sessionId, speakerRef, tStart, tEnd,
   text`), speakers (`_id, tenantId, personId, aliases, evidence`), session_pages, claims,
   decisions (all include `evidence`), topics, orgs.
3. **[C3] Provenance mandatory on knowledge-layer collections** — MET. `session_pages`, `claims`,
   `speakers`, `decisions` each require `evidence: array, minItems: 1`, items require
   `turn_id` + `session_id`. Confirmed by direct read of all four files.
4. **[C4] Tenancy field present on every collection** — MET. All 9 schemas require `tenantId`
   (string, minLength 1).
5. **[C5] Speaker identity is alias-based (H4)** — MET. `speakers.schema.json` requires
   `personId` (described "stable identity — never a bare display name (H4)") and `aliases`
   (array, minItems 1); no bare `name` field exists in the schema at all.
6. **[C6] A Python validator loads every schema and validates one passing + one failing fixture
   per collection** — MET. `schema/validate.py` calls `Draft202012Validator.check_schema` (schema
   loadability) then asserts the valid fixture produces zero errors AND the invalid fixture
   produces ≥1 error, explicitly failing if the invalid fixture "unexpectedly PASSED validation
   (schema is too permissive)" — this is a real discriminating check, not vacuous.
7. **[C7] Fixtures exist under `schema/fixtures/<collection>.{valid,invalid}.json` for every
   collection in scope** — MET. 18/18 files present, confirmed by directory listing.
8. **[C8] `python schema/validate.py` exits 0 against valid fixtures and reports every invalid
   fixture as failing** — MET. Re-run independently: exit 0, all 9 collections show "correctly
   rejected" with non-zero error counts.

## Invariants
None separately enumerated beyond the criteria above (contract has no `[I*]` section).

## Issues addressed
Manifest claims none — ledger has no matching open issues for this feature to check against.

VERDICT: PASS
SCOREBOARD: 8/8 criteria met, 0/0 invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: All 9 in-scope collections (sources, sessions, turns, speakers, session_pages,
claims, topics, orgs, decisions) have Draft 2020-12 schemas with required natural-key/provenance
fields, mandatory tenantId, and evidence[]-based provenance on the four knowledge-layer
collections. Speakers model alias-based identity via personId + aliases, no bare name. The
validator genuinely discriminates (rejects invalid fixtures, not vacuously permissive) and was
re-run independently with matching output (exit 0, 9/9 OK).
