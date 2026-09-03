# Verdict — transcription-empty-result-guard (T-003 critical fix)

**Status: PASS** (Cycle checked: 1)
Contract: `qa/contracts/transcription-empty-result-guard.md`
Manifest: `qa/manifests/transcription-empty-result-guard.md`
Commit checked: `99846a3`

All commands independently re-run from a fresh shell (`cd /d/KnowledgeBase`, git-bash). No
manifest output was trusted without re-execution.

## Criterion-by-criterion

**1. `transcribeUploadedAudio` throws (never returns) on empty/whitespace text, citing real
finishReason/blockReason.**
Read `packages/ai/src/stt/gemini-file-upload.ts` in full (lines 141-189). Confirmed:
- `text.trim().length === 0` guard at line 173, strictly before the `return` at line 182 — the
  throw is unconditionally reached before any success path when text is empty.
- `finishReason`/`blockReason` are read live from the parsed response body
  (`body?.candidates?.[0]?.finishReason`, `body?.promptFeedback?.blockReason`), not hardcoded,
  with `"unknown"`/`"none"` fallbacks only when genuinely absent.
- **Replay of the real incident response** (`candidates:[{content:{parts:[]}, finishReason:
  "MAX_TOKENS"}], usageMetadata:{candidatesTokenCount:1}}` — the exact shape from the live
  62.7MB-file failure) through this code: `text` joins to `""`, the guard fires, throws
  `"...finishReason=MAX_TOKENS..."`. **The new guard would genuinely have prevented the
  original incident** had it existed at the time — confirmed by tracing, not assumed.
PASS.

**2. `transcribe-toc-session.mjs` independently refuses `turns.length===0 && existingTurns.length>0` before any write.**
Read the full file. The check is at lines 117-122, and the only `writeFileSync` call is at line
132 — strictly after. Control flow: `throw` inside the `if` unwinds via the uncaught-rejection
path to `main().catch(...)` (lines 136-139), so `writeFileSync` is never reached on that branch.
Confirmed the throw happens BEFORE the write, not after. Second independent layer genuinely
blocks the write even if layer 1 were bypassed. PASS.

**3. Tests exist and pass** — re-ran `pnpm --filter @lkb/ai test`: **35/35 pass** (33
pre-existing + 2 new: `"transcribeUploadedAudio throws (never silently returns 0 turns) on an
empty/blocked completion"` reproduces the exact real failure shape
(`finishReason:"MAX_TOKENS"`, empty `parts`, `candidatesTokenCount:1`) and asserts
`/finishReason=MAX_TOKENS/`; `"...throws on a totally empty candidates array too"` asserts
`/blockReason=SAFETY/` with no candidates at all). Read both tests in full — they exercise the
real code path, not mocks of the guard itself. PASS.

**4. No regression** — all re-run fresh, all clean:
- `pnpm -r typecheck` — 9/9 workspace projects, all "Done".
- `pnpm --filter @lkb/ai test` — 35/35 pass, 0 fail.
- `pnpm -r test` — core/ai/index/ingest/ask/meeting-bot/apps-api all green (spot-verified ask:30,
  meeting-bot:40, apps/api:18 pass counts against console output).
- `pnpm gen:types --check` — OK, 22 generated files match schema/.
- `python schema/validate.py` — PASS, 22/22 collection schemas.
- `pnpm lint:structure` — all sub-checks OK (lint-loc, lint-dirsize, lint-root, lint-dupes,
  lint-migrations, SNAPSHOT.md freshness, depcruise 0 violations). Note: lint-migrations reports
  735 files scanned vs. manifest's 733 — expected drift from files added since the manifest was
  written (this verdict's own writes), not a discrepancy of concern.
PASS.

**5. Real incident evidence preserved + restore verified.**
- (a) **Incident session genuinely restored, zero net change.** Read
  `data/toc-migrated/2026-04-21-visa-blueprint-part2-italy-france-nz/turns.json` directly:
  **107 turns, every `speakerRef === "unknown"`** (confirmed programmatically, not sampled).
  `git log --oneline -- <path>` shows the file's only touching commit is `907c9c9` (T-002
  migration) — `99846a3` does NOT appear in that log. `git show 99846a3 -- <path>` produced
  **empty diff output** — this commit made no net change to that file. The restore is real; the
  incident netted to zero actual data loss in the repo.
- (b) **`2026-05-08-funding-dreams-loans-forex` is real, good data, not a repeat of the bug.**
  Read the file: 83 turns, 7 distinct real `speakerRef` values (`Nikhil, Dev, Ritu, Shweta,
  Kanchan, Sangita, Video Narrator`) — not "unknown", not uniform. Spot-checked text content:
  substantive, coherent, topically consistent with a real "Funding Dreams: Loans, Scholarships &
  Financial Aid" webinar (FRR Forex self-introduction as "third-generation entrepreneur",
  discussion of forex rates/charges, natural multi-speaker back-and-forth, closing thank-yous).
  Content reads as genuine transcribed speech, not generic/hallucinated filler.
- `git show 99846a3 --stat` matches the manifest's 7-file list exactly: the funding-dreams
  `turns.json` (1285 lines changed, placeholder→real), the two `gemini-file-upload.*` files, the
  new `qa/contracts/` + `qa/manifests/` files, `transcribe-all-toc-sessions.mjs` (new, 57 lines),
  and `transcribe-toc-session.mjs` (+10 lines, the second guard). No unexpected files touched.
PASS.

## Additional scrutiny (batch runner, not itself a numbered criterion but load-bearing for safety)
Read `scripts/transcribe-all-toc-sessions.mjs` in full: each session runs via `spawnSync("node",
[...], {stdio:"inherit"})` — a genuinely independent child process per session (not a shared
in-process loop), so one session's throw/crash cannot propagate to or kill the batch driver.
`ok = res.status === 0` and failed sessions are collected and printed at the end
(`FAILED: <sessionId>`), and a summary report is written to
`data/eval/transcribe-all-report.json`. This matches the manifest's claim and is consistent with
how the real incident was actually caught (batch continued reporting per-session status, human
caught it reviewing progress, not a crash).

## Verdict
**PASS on all 5 criteria.** The guard is real, traced through the actual incident response shape
and confirmed to throw before any write in both layers. The incident session's data is
genuinely restored with zero net repository change. The second session's data is genuine,
varied, plausible real content. No regressions anywhere in the full test/lint/schema suite.

**It is safe to resume the batch transcription of the remaining 20 sessions.** The root cause of
*why* the 62.7MB file itself failed (likely output-length/timeout on a single non-streaming call)
remains unsolved and is correctly scoped as a disclosed non-goal/follow-up — but the failure mode
this unit targets (silent data loss on such a failure) is now closed on both layers.
