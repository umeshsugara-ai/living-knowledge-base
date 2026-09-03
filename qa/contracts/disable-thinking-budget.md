# Contract — disable-thinking-budget (T-003 real bug fix)

> Ground truth for a real root-cause finding from a diagnostic re-run of a failing session
> (`2026-07-30-in-focus-3`, 2026-09-04): the raw Gemini `generateContent` response showed
> `content.parts[0] = {"text": "\n", "thoughtSignature": "<huge opaque base64 blob>"}` —
> `finishReason: STOP` (a "successful" completion) with essentially no transcript text, because
> the model spent its response budget on hidden extended-thinking tokens (Gemini 2.5+/3.x
> models' "thinking" mode) rather than producing the requested transcript. This plausibly also
> explains the two large-file `MAX_TOKENS`/`MALFORMED_RESPONSE` failures from earlier today
> (thinking tokens eating into the budget that would otherwise go to a long verbatim transcript).
> Drafted by the maker; checker adopts or amends on first check.

## Scope
One-line-ish fix: `transcribeUploadedAudio`'s `generateContent` request body gains
`generationConfig: { thinkingConfig: { thinkingBudget: 0 } }` — Gemini's documented mechanism to
disable extended thinking on 2.5+/3.x models, freeing the entire output budget for the actual
transcript. Re-attempt the 2 confirmed `STOP`+empty-text sessions AND the 2 confirmed
`MAX_TOKENS`/`MALFORMED_RESPONSE` large-file sessions with the fix, reporting honestly whether
each now succeeds (this may not fully resolve the large-file cases if they're ALSO genuinely too
long even without thinking overhead — report the real outcome, don't assume).

## Criteria (each machine-checkable)

1. **`packages/ai/src/stt/gemini-file-upload.ts`'s `transcribeUploadedAudio`** request body now
   includes `generationConfig: { thinkingConfig: { thinkingBudget: 0 } }` alongside the existing
   `contents` field.
2. **Test proves the request body change**: a new/updated test in `gemini-file-upload.test.ts`
   asserts the `UploadTransport` was called with a body containing
   `generationConfig.thinkingConfig.thinkingBudget === 0` for the `generateContent` call — not
   just that the function still works, but that the specific fix is genuinely present in the
   real request, so a future regression (someone reverting this) would be caught.
3. **Real retry evidence, reported honestly**: the manifest documents actual re-attempts (via
   `scripts/transcribe-toc-session.mjs`) for all 4 previously-failing sessions
   (`2026-07-30-in-focus-3`, `2026-08-24-uniaccess-leeds-arts-university`,
   `2026-04-21-visa-blueprint-part2-italy-france-nz`, `2026-07-15-creative-futures`) with the
   fix active, with the REAL outcome for each (success with real turn count, or still-failing
   with the real error) — no assumption that the fix resolves all 4, only real evidence.
4. **No regression**: `pnpm -r typecheck`, `pnpm --filter @lkb/ai test`, `pnpm -r test`,
   `pnpm gen:types --check`, `python schema/validate.py`, `pnpm lint:structure` all clean.
5. **If any of the 4 sessions newly succeed**, their real turns are synced into the live `lkb`
   Mongo database too (reusing `scripts/sync-real-turns.mjs`, already checker-PASSed — not
   rebuilding sync logic, just re-running it since it already only touches non-placeholder
   sessions and leaves everything else alone).

## Non-goals for this unit
- Does NOT guarantee all 4 sessions succeed — the fix addresses a real, evidenced root cause for
  the thinking-budget waste, but a genuinely very long session might still exceed the output
  budget even with thinking disabled; if so, that's honestly reported as still needing audio
  chunking, not silently claimed as fixed.
