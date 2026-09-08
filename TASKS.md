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
| T-003 | done | Scale Gemini transcription 1→23 sessions | Phases 1-3 as before (PASSed). **Phase 4 (long-audio-chunking + real root-cause fix), checker PASS**, verdict `qa/verdicts/diarization-marker-frequency-fix.md`: real root cause of the "chunking stalls" symptom found and fixed — `DIARIZE_PROMPT` (`packages/ai/src/stt/gemini-file-upload.ts`) never required frequent `[MM:SS]` markers, so a long uninterrupted monologue could come back as ONE turn with a single leading marker; the parser's `tEnd = tStart + 30s` last-turn fallback then drastically understated real coverage, making fully-transcribed audio look truncated. Fixed by requiring a fresh marker at least every 15-20s. Also fixed `scripts/transcribe-long-session.mjs`'s `MIN_RECURSE_SECONDS` (180→20) so a small real boundary gap gets an actual recursive retry instead of being given up on immediately. **23/23 TOC sessions now genuinely real** (independently re-verified via fresh pymongo: zero `speakerRef: "unknown"` turns remain anywhere) — visa-blueprint (291 turns), creative-futures (269 turns), in-focus-3 (96 turns) newly real this cycle. |
| T-004b | done | Tree topic/org child nodes + incremental regen (real T-002 data) | checker PASS 5/5, verdict `15e4ecf`; found real cross-session "New Zealand" topic |
| T-004c | done | `regenerate()`: handle session year-migration cleanup + cross-year topic-evidence refresh | checker PASS 4/4, verdict `qa/verdicts/regenerate-year-migration.md`, commit `8ae94f4` |
| T-006 | done | Recording-gap tracking (never silently drop) | checker PASS 7/7, verdict `819262a` |
| T-021 | blocked | Golden set (50–100 Qs) + recall@k report, target recall@5 ≥ 0.85 | **Reverted from `done` 2026-09-07 (plan §10 U0.6).** The harness is real and checker-PASSed (`qa/verdicts/golden-set-recall.md`, commit `03fcf8d`), but it was only ever run against a heuristic (non-LLM) retriever, so `recall@5=1.000` is a property of the proxy and says nothing about the 0.85 target. ISS-015 (the invalid key that blocked it) is long resolved — the real run is simply outstanding. Not done until measured against the real provider chain. |
| T-022 | blocked | Evaluator calibration on 30 hand-scored pairs | **Reverted from `done` 2026-09-07 (plan §10 U0.6).** depends T-021. Checker-PASSed cycle 1 (`qa/verdicts/evaluator-calibration.md`, commit `1d2ee71`), but with a heuristic scorer and a *derived* (not hand-scored) reference set — so the MAE-vs-human calibration this task exists to prove was never performed, and `mae=0.170` must not be read as calibrating the production LLM judge. Not done until run against the real judge with a genuinely hand-scored set. |

## Phase A — Capture

| ID | Status | Task | Notes |
|---|---|---|---|
| T-023 | done | URL adapter (Jina Reader / Firecrawl → paragraphs-as-turns) | depends T-020; checker-verified commit `bcc6f1e`, verdict `qa/verdicts/url-adapter.md` |
| T-024 | done | **FIRST DEMO SHIPPED (grill Q9/Q10):** paste-a-link capture CLI `lkb capture <url>` → platform adapter (Vexa: Meet/Teams · browser-profile join: Zoom/others · system-audio fallback) → record → diarize → `sources/sessions/turns` w/ `captureMode`+`platform`+`joinStrategy`; provided-first soft gate warns before silent join; private vault | D-002/D-004/D-008; depends T-018 (bot fields), T-019 (STT), T-020 (recording adapter) |
| T-025 | done | Google Calendar connect + auto-join | checker PASS 6/6, verdict `qa/verdicts/calendar-auto-join.md`, commit `cfe3025`. Interface (`CalendarClient`) + pure decision layer (`selectEventsToAutoJoin`) only — no real Google Calendar credentials/implementation exist yet, not wired to production. |

## Phase 3 — Surface it

| ID | Status | Task | Notes |
|---|---|---|---|
| U3.1 | in_progress | Ask page (`apps/web/src/pages/AskPage.tsx`) | Shipped + checker PASS 8/8 (`qa/verdicts/web-ask-page.md`, commit `a7641bf`) against the contract the checker authored. **NOT done against plan §10's own exit criterion** — "Playwright asks a real question, >=1 citation renders and links to a real session page." Verified only by component tests with the `ask` API module spied; never run against a live tenant. Catalogue C2/C3 downgraded REAL->PARTIAL on 2026-09-08 for the same reason (no evidence mode / filters / history; no confidence, excerpts, follow-ups or feedback). Two items carried forward from the verdict: C5's no-`sessionRef` branch is correct but untested, and a once-observed C4 flake (test measured at 1277ms against `waitFor`'s 1000ms default -- fix with an explicit timeout, never a retry). |

## Later (unchanged)

| ID | Status | Task | Notes |
|---|---|---|---|
| T-007 | open | WhatsApp → claims ingestion review | depends T-020 |
| T-008 | open | Vector index (`chunks`, Atlas Vector Search) + unstructured search | depends T-007 |
| T-009 | done | Developer API — `POST /ask` real, honest 501 stubs, rate limiting | checker PASS 8/8, verdict `cb04252`; post-verdict security fix `be86bf8` (shell:true removed) |
| T-010 | done | Product shell (`apps/web`, real Vite+React SPA) — un-deferred 2026-09-04 (Umesh asked for a proper professional UI: sidebar nav, dashboard, Obsidian-style brain/graph view, calendar). Phases 0-3: `qa/verdicts/web-app-shell-brain-calendar.md`, checker PASS. Phase 4 (Settings/API-key CRUD — real list/create/revoke, tenant-isolated, raw key shown once): `qa/verdicts/web-settings-keys.md`, checker PASS. Ingest/Meeting-Bot pages remain a separate, later unit (not part of T-010's original scope). | depends T-009 |
| T-011a | done | Phase-B per-user browser profile bot + live monitor — **privacy/consent logic only** | checker PASS 1/1, verdict `qa/verdicts/browser-profile-privacy.md`, commit `59dc2db`; real Playwright/UI wiring remains future work (see contract Non-goals). **Renamed from T-011 on 2026-09-07**: this row and `.goal/goal.json`'s T-011 were two different scopes sharing one id, so this row read as "the meeting bot is done" when it never claimed that. |
| T-011 | open | Meeting bot (auto-join, consent, live capture) — the FULL bot | All three joiners (vexa / browser / system-audio) are explicit stubs and `@lkb/meeting-bot` is imported by nothing; the catalogue scores it STUB (A10). Umesh 2026-09-07: this is a priority and gets made real — plan §10 U4.2, sequenced after the recording-upload path. |
| T-012 | done | Compete screen (internal tier, manual entry) | checker PASS 6/6, verdict `71b5fd2` |
| T-009b | done | Make `@lkb/ask`'s `ScoreFn` async; wire a real LLM-based scorer into apps/api's /ask (replaces the heuristic keyword-overlap scorer) | checker PASS 6/6, verdict `089d2b6` |
| T-013 | open | Avatar/voice counsellor client | depends T-009 |
| T-014 | open | Championship run (uses T-012's simple compete screen, not a platform) | depends T-012, T-013 |
| T-028 | open | Counsellor user management/accounts — **explicitly deferred** (Umesh: "baad mein dekh lenge") | depends T-009 |
| T-015 | open | Own-model training path | explicit approval before any data export |
| T-026 | done | Recording purge policy: gated on verified claims + ±15 s evidence clips retained (D-008) | checker PASS 7/7, verdict `950a804` |
| T-027 | done | **Watched Sources** (A13): bookmark reputed URLs/landing pages → periodic fetch → hash+diff → re-ingest changed sections → provenance `{url, fetchedAt, diffFrom}` → change notifications | checker PASS 1/1, verdict `38bc88a` |
| T-017b | done | SNAPSHOT.md generator + FEATURES.jsonl ledger + anti-cyclic hook | checker PASS 9/9, verdict `45b1b88` (cycle 2, D-009 hook wiring) |

**Done (2026-09-03/04):** T-016, T-017, T-017b, T-018, T-019, T-020, T-005b, T-024, T-002, T-009,
T-004b, T-012, T-009b, T-010 — all checker-PASSed and pushed. **T-003 done (2026-09-04)**: all 4
phases checker-PASSed. Phase 4 found and fixed the real root cause behind the earlier "2 sessions
structurally blocked" symptom (a diarization-prompt gap, not a hard size/model limit — see the
T-003 row above) — 23/23 TOC sessions now genuinely real, independently re-verified in Mongo.
**Maker picks next:**
T-004c (regenerate edge cases, low urgency). T-010 done. T-028 stays deferred. Ingest +
Meeting-Bot pages (apps/web) are open follow-up work, not yet started.

## Phase 0-4 — the current roadmap (plan §10 U-units)

> Imported 2026-09-08. These are the units the plan actually sequences; until now they existed
> ONLY in the plan file, so the maker's roadmap tier could not see them and pulled self-generated
> QA work instead. Statuses were verified on disk, not copied from the plan.

| ID | Status | Task | Notes |
|---|---|---|---|
| U0.5 | done | Catalogue scorer + docs/PROGRESS.md (machine-derived verdicts) | plan §10 Phase 0 |
| U0.6 | done | Tracker honesty: reconcile goal.json/TASKS.md, revert T-021/T-022 to partial | plan §10 Phase 0 |
| U0.7 | done | GET /health + GET /search un-stub (lexical over turns) | plan §10 Phase 0 |
| U0.8 | done | GET /citations/:claimId un-stub | plan §10 Phase 0 |
| U0.9 | done | Five packages/db accessors (topics, speakers, decisions, orgs, graph-edges) | plan §10 Phase 0 |
| U0.10 | blocked | Honest eval baseline against a real LLM (redo T-021/T-022) | BLOCKED by qa/gates/golden-set-redesign.md — the recall@5 metric is saturated at 1.000, so a real-LLM rerun would produce a second unfalsifiable number. Needs the human gate answered first. |
| U1.1 | open | embed() on the Provider seam (Gemini + Ollama over existing Transport) | plan §10 Phase 1. packages/ai/src/provider.ts exists; zero embed references today. |
| U1.2 | open | Chunking + real chunks rows (schema needs vector:number[] + dims) | embeddingRef is a string pointer; cosine needs the numbers in the doc |
| U1.3 | open | Embed on index (apps/api/src/indexing.ts, delete-then-insert) |  |
| U1.4 | open | Brute-force cosine retriever behind vectorSearchFn | D-a: Atlas Vector Search unavailable (self-hosted Mongo, no +srv). Its recall delta claim additionally needs U0.10. |
| U1.5 | open | Hybrid merge (tree + vector + lexical, RRF) into askV2 | do NOT rewrite router.ts — ask() already takes candidates via a thunk |
| U2.1 | open | Promote topics + orgs from the tree deterministically (no LLM) | cheapest real Phase 2 win; also backfills claims.topicRefs, which nothing has ever written |
| U2.2 | open | Extraction-quality harness + golden set (built BEFORE the LLM extractors) | metrics incl. hallucination rate = cited id absent from turns |
| U2.3 | open | LLM topic extractor via the existing extractFn seam | keep the regex heuristic as degradation fallback |
| U2.4 | open | Speaker resolution (TOC turns are literally spk:0) | leave low-confidence speakers UNRESOLVED rather than guessing |
| U2.5 | open | Decisions extraction (claims.ts template, different prompt) |  |
| U2.6 | open | Real graph_edges rows + merge at the route boundary | do NOT reshape flatten-graph.ts — map in routes/graph.ts |
| U3.2 | open | Search page / global search bar | builds on U0.7 + U1.5 |
| U4.1 | open | Recording/file upload wired to a real transcribe worker | workers/transcribe is a 3-line placeholder; packages/ingest recording adapter is real but unwired |
| U4.2 | open | ONE real meeting-bot joiner (browser/Meet); quarantine the other two | three stubs + a package imported by nothing is negative-value inventory |
