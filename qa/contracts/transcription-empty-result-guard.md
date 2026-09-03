# Contract — transcription-empty-result-guard (T-003 critical fix)

> Ground truth for a real data-loss bug caught live during the T-003 batch scale-up
> (2026-09-03): session `2026-04-21-visa-blueprint-part2-italy-france-nz`'s 62.7MB audio file
> produced a Gemini `generateContent` response with `outputTokens: 1` and effectively no usable
> text (a `finishReason` other than a clean stop, or a safety block). `transcribeUploadedAudio`
> parsed this to `turns: []` and returned it as if it were a valid success; the caller
> (`transcribe-toc-session.mjs`) then wrote that empty array over 107 real placeholder turns —
> a genuine regression, caught before commit (restored via `git checkout --`, no data actually
> lost in the repo, but this WOULD have been silent, permanent data loss on a session with no git
> history to fall back on, or on a second overwrite of already-real data). Drafted by the maker;
> checker adopts or amends on first check.

## Scope
Two-layer guard, defense in depth: (1) the library function itself refuses to treat an empty
completion as success; (2) the CLI script independently refuses to ever overwrite non-empty
existing turns with an empty result, regardless of why the library returned what it did.

## Criteria (each machine-checkable)

1. **`packages/ai/src/stt/gemini-file-upload.ts`'s `transcribeUploadedAudio`** now throws
   (never returns `{turns: [], ...}`) when the extracted text is empty/whitespace-only, citing
   the response's `candidates[0].finishReason` and `promptFeedback.blockReason` in the error
   message (`"unknown"`/`"none"` when absent) — a real diagnostic, not a generic failure.
2. **`scripts/transcribe-toc-session.mjs`** independently refuses to write when
   `turns.length === 0 && existingTurns.length > 0` — even if a future code path somehow produced
   an empty-but-not-thrown result, this second check still blocks the write.
3. **Tests exist and pass**: two new cases in `gemini-file-upload.test.ts` — a response with
   `finishReason: "MAX_TOKENS"` and empty `parts` throws citing that finish reason; a response
   with `promptFeedback.blockReason: "SAFETY"` and no candidates at all throws citing that block
   reason. Existing 33 tests (soon 35 with these two) unmodified and still pass.
4. **No regression**: `pnpm -r typecheck`, `pnpm --filter @lkb/ai test`, `pnpm -r test`,
   `pnpm gen:types --check`, `python schema/validate.py`, `pnpm lint:structure` all clean.
5. **Real incident evidence preserved**: the manifest documents the actual failing run's console
   output (from the live batch attempt) and confirms the affected session's `turns.json` was
   restored to its pre-incident committed state via `git checkout --` (verified: 107 turns,
   `speakerRef: "unknown"`, matching the last commit) before this fix was written.

## Non-goals for this unit
- Does NOT solve WHY the 62.7MB file's transcription failed (likely: too long for a single
  non-streaming `generateContent` call to produce a complete verbatim transcript within the
  model's practical output budget) — that's a real, separate follow-up (chunking long audio,
  switching to a model/mode built for long output, or accepting manual review for outlier
  sessions). This unit only ensures such a failure is LOUD and never silently destructive.
