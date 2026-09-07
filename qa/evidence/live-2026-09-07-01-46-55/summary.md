# live-verify — 2026-09-07T01:46:55.865Z

**Overall: PASS (DIRTY-TREE — not attributable to fbda37b4)** · DIRTY-TREE: 1 · PASS: 15 · STUB: 2 · MISSING: 1

- commit: `fbda37b4182b13c97203a7d76d0f58b4d8cc896d` — **working tree DIRTY**, so this run is not valid as final acceptance evidence for this commit
- api: http://localhost:3300 · web: http://localhost:5173
- `POST /ask` exercised — appended 12 real `jobs` ledger row(s) this run (measured, not assumed)

## Checks

| verdict | check | detail |
|---|---|---|
| DIRTY-TREE | preflight: evidence attributable to a commit | 9 uncommitted file(s) — not reproducible from fbda37b4 alone; not valid as final acceptance evidence for a shipped commit |
| PASS | preflight: mongo collection counts | 11/24 collection(s) have ≥1 real document |
| PASS | GET /sessions (scope: sessions) | HTTP 200 |
| PASS | GET /sources (scope: sources) | HTTP 200 |
| PASS | GET /gaps (scope: gaps) | HTTP 200 |
| PASS | GET /graph (scope: graph) | HTTP 200 |
| PASS | GET /calendar/upcoming (scope: calendar) | HTTP 200 |
| PASS | GET /meeting-candidates (scope: gmail) | HTTP 200 |
| PASS | GET /whatsapp/groups (scope: whatsapp) | HTTP 200 |
| PASS | GET /keys (scope: keys) | HTTP 200 |
| STUB | GET /search (scope: search) | HTTP 501 |
| STUB | GET /citations/none (scope: citations) | HTTP 501 |
| MISSING | GET /health | HTTP 404 |
| PASS | reconcile: GET /sessions length == sessions in Mongo | api=26 mongo=26 |
| PASS | GET /sessions/2026-04-21-visa-blueprint-part2-italy-france-nz (scope: sessions) | HTTP 200 |
| PASS | POST /ask (scope: ask) | HTTP 200 |
| PASS | POST /ask side effect measured | appended 12 real `jobs` ledger row(s) |
| PASS | POST /ask returns at least one citation | 3 internal + 0 web · verdict=correct |
| PASS | POST /ask citations resolve to real sessions | 3/3 cited sessionRef(s) exist in Mongo |

## Collection counts (real `countDocuments`)

| collection | documents |
|---|---|
| api_keys | 5 |
| chunks | 0 |
| claims | 81 |
| consent_policies | 0 |
| decisions | 0 |
| eval_runs | 4 |
| features_event | 0 |
| gaps | 0 |
| graph_edges | 0 |
| jobs | 178 |
| media | 0 |
| meeting_candidates | 13 |
| orgs | 0 |
| programs | 0 |
| session_pages | 24 |
| sessions | 26 |
| sources | 26 |
| speakers | 0 |
| tenants | 0 |
| topics | 0 |
| tree_index | 1 |
| trusted_senders | 1 |
| turns | 2118 |
| watched_sources | 0 |

## Not exercised (write paths, deliberately)

`POST /ingest` · `POST /whatsapp/ingest` · `POST /compete/*` · `POST /gmail/scan` ·
`POST /keys` · `DELETE /keys/:id` · `POST /webhooks/register` — this run never mutates
application content, so these are reported as uncovered rather than silently skipped.

## Browser half (not automatable away)

Run `pnpm demo:live` and click through: http://localhost:5173/ · /sessions · /brain · /calendar · /sources ·
/ingest · /whatsapp · /meeting-bot · /settings. Each page's numbers must reconcile against the
collection counts above and the raw bodies in `api/`.
