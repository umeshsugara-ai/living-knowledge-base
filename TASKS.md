# TASKS — Living Knowledge Base

> Stable IDs + status field mandatory. DECISIONS entries cross-reference these IDs in **Links**.
> Full feature catalogue (60+ items, grouped A–F) lives in the approved plan file:
> `C:\Users\Lenovo\.claude\plans\thik-hai-and-you-nested-cat.md` §4c. This file tracks the
> actionable front of that catalogue — the next few unblocked units, not the whole backlog.

| ID | Status | Task | Notes |
|---|---|---|---|
| T-000 | open | Backfill interview | Answered inline during `/init-lab` — see D-001. Formally closed. |
| T-001 | open | Mongo schema + deterministic validators | `sources · sessions · turns · speakers · session_pages · claims · topics · orgs · programs · decisions` (ARCHITECTURE §H1/H3/H4) |
| T-002 | open | Migrate 23 TOC sessions into the DB | With turn-level citations; depends on T-001 |
| T-003 | open | Scale Gemini pipeline from 1 to 23 sessions | Real API spend — sequence deliberately, don't bulk-fire |
| T-004 | open | Vectorless tree-index generator | Depends on T-001/T-002; cheap, unblocks T-005 |
| T-005 | open | `POST /ask` CRAG router with provenance | Depends on T-004; exit test in plan §4 |
| T-006 | open | Recording-gap rows + standing ask process | Process + minimal code |
| T-007 | open | WhatsApp → claims ingestion review | Depends on `whatsapp_msg/` being pointed at a real TOC/expert group (needs Q4 consent decision first) |
| T-008 | open | Vector index + unstructured search | Depends on T-007 |
| T-009 | open | Developer API + webhooks | Depends on T-005 |
| T-010 | open | Product shell (hosted multi-tenant app) | Depends on Q2 (stack decision) |
| T-011 | open | Meeting bot (auto-join, consent, live capture) | Depends on Q4 |
| T-012 | open | Counsellor eval harness + human golden set | Depends on Q3 (who are top counsellors / who judges) |
| T-013 | open | Avatar/voice counsellor client | Depends on T-009 |
| T-014 | open | Championship run | Depends on T-012, T-013 |
| T-015 | open | Own-model training path | Phase 6, needs explicit approval before any data export |

**Maker picks next, in order:** T-001 → T-004 → T-005 (T-003 deliberately sequenced later —
real Gemini spend).
