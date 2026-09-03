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
| T-002 | done | Migrate 23 TOC sessions into schema v2 | checker PASS 7/7, verdict `b59e0ff`; content ground-truthed against source transcripts. Follow-up: `session-pages-accessor` unit (missing `session_pages` Mongo accessor found during T-002 gap review) — checker PASS, verdict `qa/verdicts/session-pages-accessor.md`, commit `7e6185a`; `lkb.session_pages` backfilled to 23 real docs via one-off insert. |
| T-003 | in_progress | Scale Gemini transcription 1→23 sessions | ISS-015 resolved (key now valid). Phase 1 done: pipeline built (`gemini-file-upload.ts` + `transcribe-toc-session.mjs`) + 1/23 real session (`2026-05-23-uniaccess-atlas-skilltech`) transcribed with real diarization, checker PASS cycle 1, verdict `qa/verdicts/gemini-audio-transcription.md`, commit `a7fb04e`. Scaling to remaining 21 sessions is deliberate follow-up, not yet started. Bug-fix mid-scale-up: batch run caught a real silent-data-loss bug (62.7MB file, `outputTokens:1`, empty turns overwriting 107 real placeholder turns) — caught before commit, restored via `git checkout --`, zero net data loss. Two-layer empty-result guard added + 2 new tests; `2026-05-08-funding-dreams-loans-forex` genuinely transcribed (83 real turns, kept). checker PASS cycle 1, verdict `qa/verdicts/transcription-empty-result-guard.md`, commit `99846a3`. Batch scale-up safe to resume for remaining 20 sessions. |
| T-004b | done | Tree topic/org child nodes + incremental regen (real T-002 data) | checker PASS 5/5, verdict `15e4ecf`; found real cross-session "New Zealand" topic |
| T-004c | done | `regenerate()`: handle session year-migration cleanup + cross-year topic-evidence refresh | checker PASS 4/4, verdict `qa/verdicts/regenerate-year-migration.md`, commit `8ae94f4` |
| T-006 | done | Recording-gap tracking (never silently drop) | checker PASS 7/7, verdict `819262a` |
| T-021 | done | Golden set (50–100 Qs) + recall@k report, target recall@5 ≥ 0.85 | checker PASS, verdict `qa/verdicts/golden-set-recall.md`, commit `03fcf8d`; harness verified against a heuristic (non-LLM) retriever — recall@5=1.000 is NOT evidence against the real 0.85 target, which is blocked on ISS-015 (invalid GEMINI_API_KEY) and deferred to a real-`selectNodes` re-run |
| T-022 | done | Evaluator calibration on 30 hand-scored pairs | depends T-021 — checked PASS cycle 1, `qa/verdicts/evaluator-calibration.md`, commit `1d2ee71`. NOTE: uses a heuristic scorer + a derived (not hand-scored) reference set, blocked on ISS-015 for the real GEMINI-backed calibration — do not read `mae=0.170` as calibrating the production LLM judge. |

## Phase A — Capture

| ID | Status | Task | Notes |
|---|---|---|---|
| T-023 | done | URL adapter (Jina Reader / Firecrawl → paragraphs-as-turns) | depends T-020; checker-verified commit `bcc6f1e`, verdict `qa/verdicts/url-adapter.md` |
| T-024 | done | **FIRST DEMO SHIPPED (grill Q9/Q10):** paste-a-link capture CLI `lkb capture <url>` → platform adapter (Vexa: Meet/Teams · browser-profile join: Zoom/others · system-audio fallback) → record → diarize → `sources/sessions/turns` w/ `captureMode`+`platform`+`joinStrategy`; provided-first soft gate warns before silent join; private vault | D-002/D-004/D-008; depends T-018 (bot fields), T-019 (STT), T-020 (recording adapter) |
| T-025 | done | Google Calendar connect + auto-join | checker PASS 6/6, verdict `qa/verdicts/calendar-auto-join.md`, commit `cfe3025`. Interface (`CalendarClient`) + pure decision layer (`selectEventsToAutoJoin`) only — no real Google Calendar credentials/implementation exist yet, not wired to production. |

## Later (unchanged)

| ID | Status | Task | Notes |
|---|---|---|---|
| T-007 | open | WhatsApp → claims ingestion review | depends T-020 |
| T-008 | open | Vector index (`chunks`, Atlas Vector Search) + unstructured search | depends T-007 |
| T-009 | done | Developer API — `POST /ask` real, honest 501 stubs, rate limiting | checker PASS 8/8, verdict `cb04252`; post-verdict security fix `be86bf8` (shell:true removed) |
| T-010 | open | Product shell (hosted multi-tenant app) — deferred, not near-term per Umesh | depends T-009 |
| T-011 | done | Phase-B per-user browser profile bot + live monitor | checker PASS 1/1, verdict `qa/verdicts/browser-profile-privacy.md`, commit `59dc2db`; real Playwright/UI wiring remains future work (see contract Non-goals) |
| T-012 | done | Compete screen (internal tier, manual entry) | checker PASS 6/6, verdict `71b5fd2` |
| T-009b | done | Make `@lkb/ask`'s `ScoreFn` async; wire a real LLM-based scorer into apps/api's /ask (replaces the heuristic keyword-overlap scorer) | checker PASS 6/6, verdict `089d2b6` |
| T-013 | open | Avatar/voice counsellor client | depends T-009 |
| T-014 | open | Championship run (uses T-012's simple compete screen, not a platform) | depends T-012, T-013 |
| T-028 | open | Counsellor user management/accounts — **explicitly deferred** (Umesh: "baad mein dekh lenge") | depends T-009 |
| T-015 | open | Own-model training path | explicit approval before any data export |
| T-026 | done | Recording purge policy: gated on verified claims + ±15 s evidence clips retained (D-008) | checker PASS 7/7, verdict `950a804` |
| T-027 | done | **Watched Sources** (A13): bookmark reputed URLs/landing pages → periodic fetch → hash+diff → re-ingest changed sections → provenance `{url, fetchedAt, diffFrom}` → change notifications | checker PASS 1/1, verdict `38bc88a` |
| T-017b | done | SNAPSHOT.md generator + FEATURES.jsonl ledger + anti-cyclic hook | checker PASS 9/9, verdict `45b1b88` (cycle 2, D-009 hook wiring) |

**Done (2026-09-03):** T-016, T-017, T-017b, T-018, T-019, T-020, T-005b, T-024, T-002, T-009,
T-004b, T-012, T-009b — all checker-PASSed and pushed. **T-003 in_progress**: ISS-015 resolved
(key valid), phase 1 (pipeline + 1/23 real session) checker-PASSed cycle 1 — scaling to remaining
21 sessions is deliberate follow-up, not yet started.
**Maker picks next:**
T-004c (regenerate edge cases, low urgency). T-010/T-028 deferred.
