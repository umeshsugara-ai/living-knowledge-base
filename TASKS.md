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
| T-005 | done | `POST /ask` CRAG router v1 | checker PASS cycle 2, verdict `129f8f1` |
| T-016 | open | **Repo restructure → TS pnpm monorepo** (`packages/{core,db,ai,ingest,index,ask,meeting-bot}`, `apps/`, `workers/transcribe`, `raw/TOC`, `sources/whatsapp_msg` submodule); port `tree_index/`→`packages/index`, `ask_router/`→`packages/ask` (tests first); `ARCHITECTURE.md` ≤150 lines | plan §6c.1; one working tree |
| T-017 | open | **Structure lint in CI**: `lint-loc` (300/400), `dependency-cruiser`, `lint-dupes`, root ≤15 files, ARCHITECTURE ≤150 | gate for everything after |
| T-018 | open | **Schema v2**: bounded web research + `docs/adr/0001-schema-v2.md` first; camelCase evidence keys; add `programs, media(+retention, kind incl. evidence-clip), chunks, graph_edges, jobs, tenants, api_keys, consent_policies`; `sources.captureMode`; `schema/index.json`; generated TS types; `migrate-mongo` baseline; `packages/db` `coll(tenantId)` + boot index assertion | depends T-016 |
| T-019 | open | **AI provider seam** `packages/ai`: FIVE adapters `gemini` (default first), `anthropic` (API key + OAuth), `openai`, `ollama`, `claude-code`, each with `listModels()` (per-provider model dropdown); user-editable ordered chain per jobKind in `config/ai-routing.yaml` (len ≥1); `stt/{whisper,gemini}.ts`; `jobs` ledger; parity test on 3 fixture sessions; web-search provider (Tavily) for CRAG fallback | D-005 + D-008; depends T-016 |
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
| T-024 | open | **FIRST FEATURE UNIT (grill Q9/Q10):** paste-a-link capture CLI `lkb capture <url>` → platform adapter (Vexa: Meet/Teams · browser-profile join: Zoom/others · system-audio fallback) → record → diarize → `sources/sessions/turns` w/ `captureMode`+`platform`+`joinStrategy`; provided-first soft gate warns before silent join; private vault | D-002/D-004/D-008; depends T-018 (bot fields), T-019 (STT), T-020 (recording adapter) |
| T-025 | open | Google Calendar connect + auto-join | depends T-024 |

## Later (unchanged)

| ID | Status | Task | Notes |
|---|---|---|---|
| T-007 | open | WhatsApp → claims ingestion review | depends T-020 |
| T-008 | open | Vector index (`chunks`, Atlas Vector Search) + unstructured search | depends T-007 |
| T-009 | open | Developer API + webhooks | depends T-005b |
| T-010 | open | Product shell (hosted multi-tenant app) | depends T-009 |
| T-011 | open | Phase-B per-user browser profile bot + live monitor | depends T-024 |
| T-012 | open | Counsellor eval harness — **internal tier first, alongside T-005b** (grill Q12/F5): configurable panel (`eval_runs.panel[]` + credibility tier), in-house counsellors as first panel, frozen+hashed question bank (D-007), LLM-judge MAE ≤ 0.5 loop; public tier gated on independent panel | D-007; depends T-005b |
| T-013 | open | Avatar/voice counsellor client | depends T-009 |
| T-014 | open | Championship run | depends T-012, T-013 |
| T-015 | open | Own-model training path | explicit approval before any data export |
| T-026 | open | Recording purge policy: gated on verified claims + ±15 s evidence clips retained (D-008) | depends T-018 |
| T-027 | open | **Watched Sources** (A13): bookmark reputed URLs/landing pages → periodic fetch → hash+diff → re-ingest changed sections → provenance `{url, fetchedAt, diffFrom}` → change notifications | depends T-023 |
| T-017b | open | SNAPSHOT.md (generated, ≤200) + FEATURES.jsonl ledger + hook injection of recent removed/updated features + memory pointer (plan §6d) | depends T-017 |

**Maker picks next, in order:** T-016 → T-017 → T-017b → T-018 → T-019 → T-020 → **T-024 (first demo)** → T-005b + T-012.
