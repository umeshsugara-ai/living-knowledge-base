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
| T-016 | done | Repo restructure → TS pnpm monorepo | checker PASS 9/9, verdict `66f1372` |
| T-017 | done | Structure lint in CI | checker PASS 10/10, verdict `4ccfcfd` |
| T-018 | done | Schema v2 (ADR-first, camelCase evidence, 8 new collections, migrate-mongo) | checker PASS 7/7, verdict cycle-1 (recovered from network-error-interrupted dispatch) |
| T-019 | done | AI provider seam (5 adapters + STT sub-seam) | checker PASS 8/8, verdict `424bb38` |
| T-020 | done | Ingestion source seam (recording, document adapters) | checker PASS 7/7, verdict `3d2bb6f` |
| T-005b | done | Ask v2: selectNodes/refine/answer + audit log | checker PASS 6/6, verdict `e5dafe3` |

## Phase 1b — Prove the loop on TOC

| ID | Status | Task | Notes |
|---|---|---|---|
| T-002 | done | Migrate 23 TOC sessions into schema v2 | checker PASS 7/7, verdict `b59e0ff`; content ground-truthed against source transcripts |
| T-003 | BLOCKED | Scale Gemini transcription 1→23 sessions | ISS-015: GEMINI_API_KEY in .env is invalid (Google API_KEY_INVALID) — needs a valid key from Umesh |
| T-004b | done | Tree topic/org child nodes + incremental regen (real T-002 data) | checker PASS 5/5, verdict `15e4ecf`; found real cross-session "New Zealand" topic |
| T-004c | done | `regenerate()`: handle session year-migration cleanup + cross-year topic-evidence refresh | checker PASS 4/4, verdict `qa/verdicts/regenerate-year-migration.md`, commit `8ae94f4` |
| T-006 | done | Recording-gap tracking (never silently drop) | checker PASS 7/7, verdict `819262a` |
| T-021 | open | Golden set (50–100 Qs) + recall@k report, target recall@5 ≥ 0.85 | depends T-002 |
| T-022 | open | Evaluator calibration on 30 hand-scored pairs | depends T-021 |

## Phase A — Capture

| ID | Status | Task | Notes |
|---|---|---|---|
| T-023 | open | URL adapter (Jina Reader / Firecrawl → paragraphs-as-turns) | depends T-020 |
| T-024 | done | **FIRST DEMO SHIPPED (grill Q9/Q10):** paste-a-link capture CLI `lkb capture <url>` → platform adapter (Vexa: Meet/Teams · browser-profile join: Zoom/others · system-audio fallback) → record → diarize → `sources/sessions/turns` w/ `captureMode`+`platform`+`joinStrategy`; provided-first soft gate warns before silent join; private vault | D-002/D-004/D-008; depends T-018 (bot fields), T-019 (STT), T-020 (recording adapter) |
| T-025 | open | Google Calendar connect + auto-join | depends T-024 |

## Later (unchanged)

| ID | Status | Task | Notes |
|---|---|---|---|
| T-007 | open | WhatsApp → claims ingestion review | depends T-020 |
| T-008 | open | Vector index (`chunks`, Atlas Vector Search) + unstructured search | depends T-007 |
| T-009 | done | Developer API — `POST /ask` real, honest 501 stubs, rate limiting | checker PASS 8/8, verdict `cb04252`; post-verdict security fix `be86bf8` (shell:true removed) |
| T-010 | open | Product shell (hosted multi-tenant app) — deferred, not near-term per Umesh | depends T-009 |
| T-011 | open | Phase-B per-user browser profile bot + live monitor | depends T-024 |
| T-012 | done | Compete screen (internal tier, manual entry) | checker PASS 6/6, verdict `71b5fd2` |
| T-009b | done | Make `@lkb/ask`'s `ScoreFn` async; wire a real LLM-based scorer into apps/api's /ask (replaces the heuristic keyword-overlap scorer) | checker PASS 6/6, verdict `089d2b6` |
| T-013 | open | Avatar/voice counsellor client | depends T-009 |
| T-014 | open | Championship run (uses T-012's simple compete screen, not a platform) | depends T-012, T-013 |
| T-028 | open | Counsellor user management/accounts — **explicitly deferred** (Umesh: "baad mein dekh lenge") | depends T-009 |
| T-015 | open | Own-model training path | explicit approval before any data export |
| T-026 | open | Recording purge policy: gated on verified claims + ±15 s evidence clips retained (D-008) | depends T-018 |
| T-027 | open | **Watched Sources** (A13): bookmark reputed URLs/landing pages → periodic fetch → hash+diff → re-ingest changed sections → provenance `{url, fetchedAt, diffFrom}` → change notifications | depends T-023 |
| T-017b | done | SNAPSHOT.md generator + FEATURES.jsonl ledger + anti-cyclic hook | checker PASS 9/9, verdict `45b1b88` (cycle 2, D-009 hook wiring) |

**Done (2026-09-03):** T-016, T-017, T-017b, T-018, T-019, T-020, T-005b, T-024, T-002, T-009,
T-004b, T-012, T-009b — all checker-PASSed and pushed. **T-003 BLOCKED** on ISS-015 (invalid
Gemini key).
**Maker picks next:**
T-004c (regenerate edge cases, low urgency). T-010/T-028 deferred.
