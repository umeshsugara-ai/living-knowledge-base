# TASKS — Living Knowledge Base

> Stable IDs + status field mandatory. DECISIONS entries cross-reference these IDs in **Links**.
> Full feature catalogue (60+ items, A–F) and the system design live in the approved plan:
> `C:\Users\Lenovo\.claude\plans\thik-hai-and-you-nested-cat.md` (§4c, §6c). This file tracks the
> actionable front, not the whole backlog.

**Design-first gate (D-002…D-005, 2026-09-03):** no feature unit starts before T-017 is green.

## Phase 1a — Foundation

| ID | Status | Task | Notes |
|---|---|---|---|
| T-000 | done | Backfill interview | Answered inline — D-001 |
| T-001 | done | Mongo schema v1 + validators | checker PASS, verdict `2ce65d1` |
| T-004 | done | Vectorless tree-index generator v1 | checker PASS, verdict `222314a` |
| T-005 | in_progress | `POST /ask` CRAG router v1 | built; checker re-dispatched 2026-09-03 |
| T-016 | open | **Repo restructure → TS pnpm monorepo** (`packages/{core,db,ai,ingest,index,ask,meeting-bot}`, `apps/`, `workers/transcribe`, `raw/TOC`, `sources/whatsapp_msg` submodule); port `tree_index/`→`packages/index`, `ask_router/`→`packages/ask` (tests first); `ARCHITECTURE.md` ≤150 lines | plan §6c.1; one working tree |
| T-017 | open | **Structure lint in CI**: `lint-loc` (300/400), `dependency-cruiser`, `lint-dupes`, root ≤15 files, ARCHITECTURE ≤150 | gate for everything after |
| T-018 | open | **Schema v2**: camelCase evidence keys; add `programs, media(+retention), chunks, graph_edges, jobs, tenants, api_keys, consent_policies`; `schema/index.json`; generated TS types; `migrate-mongo` baseline; `packages/db` `coll(tenantId)` + boot index assertion | depends T-016 |
| T-019 | open | **AI provider seam** `packages/ai`: `providers/gemini.ts` (primary), `claude-code.ts` (OAuth `claude -p`), `anthropic.ts` (flag, off); `stt/{whisper,gemini}.ts`; `router.ts` + `config/ai-routing.yaml`; `jobs` ledger; Gemini↔Claude-Code parity test on 3 fixture sessions | D-005; depends T-016 |
| T-020 | open | **Ingestion source seam** `packages/ingest/source.ts` + `recording`, `document` adapters | depends T-018 |
| T-005b | open | Ask v2: `select_nodes` job, `(score, reason)` evaluator, `refine`, `answer`, per-call log | depends T-019 |

## Phase 1b — Prove the loop on TOC

| ID | Status | Task | Notes |
|---|---|---|---|
| T-002 | open | Migrate 23 TOC sessions into schema v2 (via Claude Code backend) | depends T-018 |
| T-003 | open | Scale Gemini transcription 1→23 sessions | Gemini tokens (D-005), sequenced |
| T-004b | open | Tree topic/speaker child nodes + incremental regen by `sessionRef` | depends T-002 |
| T-006 | open | Recording-gap rows + standing-ask process | depends T-018 |
| T-021 | open | Golden set (50–100 Qs) + recall@k report, target recall@5 ≥ 0.85 | depends T-002 |
| T-022 | open | Evaluator calibration on 30 hand-scored pairs | depends T-021 |

## Phase A — Capture

| ID | Status | Task | Notes |
|---|---|---|---|
| T-023 | open | URL adapter (Jina Reader / Firecrawl → paragraphs-as-turns) | depends T-020 |
| T-024 | open | Meeting bot: self-hosted **Vexa** + Whisper, pluggable STT, `consent_policies` default `silent-full`, full diarization + who/when provenance, private vault | D-002/D-004; depends T-019, T-020 |
| T-025 | open | Google Calendar connect + auto-join | depends T-024 |

## Later (unchanged)

| ID | Status | Task | Notes |
|---|---|---|---|
| T-007 | open | WhatsApp → claims ingestion review | depends T-020 |
| T-008 | open | Vector index (`chunks`, Atlas Vector Search) + unstructured search | depends T-007 |
| T-009 | open | Developer API + webhooks | depends T-005b |
| T-010 | open | Product shell (hosted multi-tenant app) | depends T-009 |
| T-011 | open | Phase-B per-user browser profile bot + live monitor | depends T-024 |
| T-012 | open | Counsellor eval harness: judge rubric, human golden set, MAE loop | gated Q3 (who judges) |
| T-013 | open | Avatar/voice counsellor client | depends T-009 |
| T-014 | open | Championship run | depends T-012, T-013 |
| T-015 | open | Own-model training path | explicit approval before any data export |
| T-026 | open | Recording purge-after-processing policy + migration | deferred by Umesh (D-002) |

**Maker picks next, in order:** T-016 → T-017 → T-018 → T-019.
