# Verdict — sync-real-turns-to-mongo (T-003 phase 3)

**Result: PASS**
Cycle checked: 1
Contract: `qa/contracts/sync-real-turns-to-mongo.md`
Manifest: `qa/manifests/sync-real-turns-to-mongo.md`
Commit checked: `9b5af46`

Fresh-context, independent re-verification. All commands re-run from a clean shell
(`cd /d/KnowledgeBase`, git-bash), Mongo re-queried via a fresh pymongo connection against
`MONGODB_URL` from `.env`, db `lkb` (no `MONGODB_DB` override present, matches the script's
`"lkb"` fallback).

## Criterion 1 — `--dry-run` never touches Mongo

Re-ran `node scripts/sync-real-turns.mjs --dry-run`. Output lists all 19 real sessions with
exact local turn counts, byte-identical to the manifest's pasted output, ending in
`No Mongo connection attempted (--dry-run).` Read `scripts/sync-real-turns.mjs` in full
(lines 1-82): the dynamic `import("../packages/db/src/client.js")` (line 54) sits strictly
after the `if (DRY_RUN) { ...; return; }` branch (lines 48-51) — `--dry-run` cannot reach the
`connect()` call under any code path. Matches `seed-toc.mjs`'s precedent. **PASS.**

## Criterion 2 — live-run mechanics (delete-then-insert, correct scope, placeholders untouched)

Read the live-run path (lines 53-75):
- `deleteMany({tenantId, sessionId: s.sessionId})` (line 64) runs and is awaited **before** the
  insert loop (lines 65-70) — correct delete-then-insert order, scoped to `{tenantId,
  sessionId}`, not a bare `{sessionId}` or unscoped filter. No risk of cross-session or
  cross-tenant deletion.
- Insert goes through `turns(tenantId).insertOne(rest)` (packages/db's tenant-scoped accessor,
  `packages/db/src/collections/turns.ts` → `scopedCollection`), never a raw driver call —
  matches ARCHITECTURE §5.
- The session loop (line 40-43) only iterates `realSessions`, built by `classify()` (lines
  25-31) which excludes placeholder sessions (`turns.every(speakerRef === "unknown")`). No
  placeholder session ever enters the delete/insert loop. **PASS.**

## Criterion 3 — real run executed, reported honestly

Independent Mongo verification (script written and run this cycle, not copy-pasted from the
manifest — `verify_mongo.py`, connects fresh via pymongo):

```
=== TOTAL COUNT ===
mongo total turns: 1689
independently computed expected total: 1689
match: True
num real sessions: 19, num placeholder sessions: 4

=== PLACEHOLDER SESSIONS (all 4) — contamination check ===
2026-04-21-visa-blueprint-part2-italy-france-nz: local=107 mongo_total=107 mongo_unknown=107 OK=True
2026-07-15-creative-futures: local=164 mongo_total=164 mongo_unknown=164 OK=True
2026-07-30-in-focus-3: local=124 mongo_total=124 mongo_unknown=124 OK=True
2026-08-24-uniaccess-leeds-arts-university: local=102 mongo_total=102 mongo_unknown=102 OK=True
ALL PLACEHOLDER SESSIONS CLEAN: True
```

(a) **Total count**: independently summed the 19 real local `turns.json` lengths + the 4
placeholder local counts = **1689**, matches Mongo's `count_documents({})` = **1689** exactly.
Not copied from the manifest — computed fresh by walking `data/toc-migrated/` myself.

(b) **Placeholder untouched, all 4, exhaustively** (not sampled): for every placeholder
session, `count_documents({sessionId})` == `count_documents({sessionId, speakerRef:
"unknown"})` == local count. Zero contamination on all 4.

(c) **Real sessions have real speakerRef + correct content**: spot-checked 3 sessions
deliberately different from the manifest's own spot-check (`2026-05-08-funding-dreams-loans-forex`,
`2026-06-30-exploring-identity-success-counseling`, `2026-08-27-in-focus-4`) — for each, Mongo
turn count matches local count, `speakerRef: "unknown"` count is 0, and the first 5 turns'
`text` field matched byte-for-byte between local `turns.json` and the Mongo document fetched by
the same `_id` (15/15 checked, 0 mismatches). Example:

```
2026-05-08-funding-dreams-loans-forex: local_count=83 mongo_count=83
  _id=...-t001: text_match=True speakerRef_local=Nikhil speakerRef_mongo=Nikhil
  _id=...-t002: text_match=True speakerRef_local=Dev speakerRef_mongo=Dev
  ...
```

An aggregate `speakerRef` distribution across all 19 real sessions shows ~85 distinct real
names/labels (Sapna Goyal, Bhakti, Amrita, ... down to singletons), zero `"unknown"` entries —
consistent with genuine diarization output, not placeholder residue. **PASS.**

## Criterion 4 — no regression

Re-ran all four from a fresh shell:

```
$ pnpm -r typecheck          → 9/9 workspace projects, all "Done"
$ pnpm gen:types --check     → OK: 22 generated type file(s) + index.ts match schema/
$ python schema/validate.py  → PASS: 22 collection schema(s) validated correctly.
$ pnpm lint:structure        → lint-loc/dirsize/root/dupes/migrations all OK, SNAPSHOT.md
                                matches regeneration, depcruise: no violations (155 modules,
                                437 dependencies)
```

All clean. **PASS.**

## `git show 9b5af46 --stat`

```
 qa/contracts/sync-real-turns-to-mongo.md |  50 +++++++++++++++
 qa/manifests/sync-real-turns-to-mongo.md | 101 +++++++++++++++++++++++++++++++
 scripts/sync-real-turns.mjs              |  81 +++++++++++++++++++++++++
 3 files changed, 232 insertions(+)
```

Matches the manifest's 3-file claim exactly. No data-file changes in-repo — the real data
change lives only in Mongo, correctly not committed as JSON (would duplicate the DB and drift
immediately).

## Overall

All 4 contract criteria independently re-verified from scratch, including a from-scratch
recomputation of the expected 1,689 total, exhaustive (not sampled) contamination checks on
all 4 placeholder sessions, and byte-for-byte content verification on 3 real sessions not
previously spot-checked by the maker. No discrepancies found.

**PASS.** T-003 stays `in_progress` (4/23 sessions still placeholder, follow-up engineering
work not started) but the live `lkb` database's `turns` collection now genuinely reflects the
19/23 real-transcription state.
