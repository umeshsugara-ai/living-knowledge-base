# live-verify — 2026-09-08T11:06:33.153Z

**Overall: INCONCLUSIVE (DIRTY-TREE — not attributable to 6788a6a0)** · DIRTY-TREE: 1 · PASS: 1 · INCONCLUSIVE: 1

- commit: `6788a6a07c2f7a9d2948b9d9fc5bf50b9fe4eb49` — **working tree DIRTY**, so this run is not valid as final acceptance evidence for this commit
- api: http://localhost:3300 · web: http://localhost:5173
- `POST /ask` exercised — appended an unmeasured number of real `jobs` ledger row(s) this run (measured, not assumed)

## Checks

| verdict | check | detail |
|---|---|---|
| DIRTY-TREE | preflight: evidence attributable to a commit | 2 uncommitted file(s) — not reproducible from 6788a6a0 alone; not valid as final acceptance evidence for a shipped commit |
| PASS | preflight: mongo collection counts | 12/24 collection(s) have ≥1 real document |
| INCONCLUSIVE | api: credential | no LKB_API_KEY / --key — run `node scripts/mint-key.mjs` first |

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
| jobs | 226 |
| media | 0 |
| meeting_candidates | 13 |
| orgs | 0 |
| programs | 0 |
| session_pages | 24 |
| sessions | 26 |
| sources | 26 |
| speakers | 2 |
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
