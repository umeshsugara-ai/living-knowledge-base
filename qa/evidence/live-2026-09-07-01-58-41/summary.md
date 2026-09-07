# live-verify — 2026-09-07T01:58:41.367Z

**Overall: PASS** · PASS: 16 · STUB: 2 · MISSING: 1

- commit: `7f1df0d96d484b3b8852707dfa243bee17904b63`
- api: http://localhost:3300 · web: http://localhost:5173
- `POST /ask` exercised — appended 12 real `jobs` ledger row(s) this run (measured, not assumed)

## Checks

| verdict | check | detail |
|---|---|---|
| PASS | preflight: evidence attributable to a commit | 7f1df0d9 |
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
| jobs | 214 |
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
