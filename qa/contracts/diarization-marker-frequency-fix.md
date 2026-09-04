# Contract — diarization-marker-frequency-fix (T-003 phase 4, completes 23/23)

> Resolves the "chunking stalls / recursive splitting doesn't converge" symptom left open at the
> end of the earlier `long-audio-chunking` work (draft contract, superseded by this one — that
> draft never reached a checker cycle). Found the REAL root cause via direct empirical testing,
> not further chunking-strategy guesses. Drafted by the maker; /checker adopts or amends on
> first check.

## The real root cause (verified, not theorized)

Earlier sessions of this project observed: re-requesting the SAME audio span, or progressively
smaller sub-spans of it, kept producing a transcript whose last turn's `tEnd` landed at
~30 seconds into the span, no matter the span's actual length (40 minutes, 20 minutes, a few
minutes) — read as "the model keeps stopping after ~30s." Two false leads were ruled out by
direct testing this cycle: (a) ffmpeg stream-copy container corruption (a byte-identical
re-encoded clip produced the IDENTICAL 30s-then-stop result — not a container issue), (b) real
audio silence at that point (`ffmpeg silencedetect` found none anywhere in the file;
`volumedetect` on the specific region showed normal speech-level volume).

**The real cause**: `DIARIZE_PROMPT` in `packages/ai/src/stt/gemini-file-upload.ts` told the
model to diarize but never required it to insert a fresh `[MM:SS]` marker at any particular
interval. For a single speaker talking continuously for several minutes, the model would emit
ONE marker at the start of that stretch and then keep generating real, correct transcript text
for minutes — with no further marker. `parseDiarizedTranscript`'s only way to compute a turn's
`tEnd` is either the NEXT marker's `tStart`, or, for the LAST turn in the whole response, a
`tStart + 30s` fallback (a documented placeholder from when this pipeline was first built).
When a long unmarked monologue happened to be the last (or only) turn in a request, that
fallback made a turn actually covering several real minutes of correctly-transcribed content
report a `tEnd` only 30 seconds past its start — the completeness checks (`shortfall`,
`findTimeGaps`) correctly read that as "this span barely got transcribed" and kept recursively
re-requesting smaller and smaller sub-spans of what was, in large part, already real, complete,
correctly-transcribed content.

Confirmed directly: a 300-second real clip from the previously "stuck" region, re-requested with
an explicit "insert a marker every 15-20 seconds" instruction, came back with 20 markers spanning
the full 293 seconds, `finishReason: "STOP"` (natural, non-truncated completion) — the SAME
underlying audio the old prompt had been reporting as "~30s covered."

## Fix cycle 2 addendum (real bug the checker found in cycle 1)

The cycle-1 checker independently found a second, real, isolated defect while verifying: one
turn (`2026-04-21-visa-blueprint-part2-italy-france-nz-t002`) had an implausibly long
`speakerRef` (~280 characters of leaked transcript text) instead of a real speaker label —
caused by `parseDiarizedTranscript`'s non-greedy speaker capture running on to an unrelated
mid-sentence colon when a marker had no real short "Name:"/"spk:N:" label immediately after it.
Root-caused, fixed at the parser level (`MAX_PLAUSIBLE_SPEAKER_LABEL_LENGTH` guard —
`packages/ai/src/stt/gemini-file-upload.ts`), covered by two new tests, and applied
retroactively to already-written data via a new one-time repair script
(`scripts/fix-corrupted-speaker-labels.mjs`) that scanned ALL 23 sessions (not just the one the
checker sampled) and found exactly one corrupted turn, matching the checker's own finding
exactly — confirming the defect was genuinely isolated, not under-scanned.

## Criteria (each machine-checkable)

1. **`packages/ai/src/stt/gemini-file-upload.ts`**'s `DIARIZE_PROMPT` requires a fresh `[MM:SS]`
   marker at least every 15-20 seconds, even when the same speaker keeps talking uninterrupted —
   never let one turn span more than ~20 seconds. Verify: read the file; `packages/ai`'s test
   suite (54 tests, unchanged — no test asserted on exact prompt text) stays green.
2. **`scripts/transcribe-long-session.mjs`**'s `MIN_RECURSE_SECONDS` lowered from 180 to 20, so
   a genuine small real gap at a chunk seam (observed: 53-54s, reproduced identically across 3
   independent top-level attempts) gets an actual recursive retry instead of being accepted as
   unresolvable purely because it's numerically smaller than an arbitrary floor. Verify: read
   the file; the real end-to-end run evidence below shows this threshold change was exercised.
3. **All 23 real TOC sessions in `data/toc-migrated/*/turns.json` and the live `lkb` Mongo
   database's `turns` collection have zero `speakerRef: "unknown"` turns** — independently
   verified via a fresh pymongo connection iterating every real `sessions` document (not a
   hardcoded list of session ids). The 3 sessions newly resolved this cycle:
   `2026-04-21-visa-blueprint-part2-italy-france-nz` (291 turns, was 107 placeholder),
   `2026-07-15-creative-futures` (269 turns, was 164 placeholder),
   `2026-07-30-in-focus-3` (96 turns, was 124 placeholder). Verify: real pymongo query, per
   session, `count({sessionId, speakerRef:"unknown"}) == 0`.
4. **No fabrication.** Every real run's console output (pasted in the manifest) shows real
   `findTimeGaps`-verified zero-gap coverage before any write, OR an explicit, disclosed
   `--allow-partial` decision with the exact reasoning (there was one such decision on an
   intermediate `creative-futures` attempt that a LATER re-run superseded with a fully clean,
   zero-gap result — the final committed data required no partial-accept at all).
5. **No regression.** `pnpm -r test` (whole workspace) and `pnpm lint:structure` both exit 0.
6. **`TASKS.md`'s T-003** marked `done`, with the real root cause and final 23/23 status
   recorded (not just "scaled up further").
7. **No `speakerRef` field across any of the 23 real sessions exceeds
   `MAX_PLAUSIBLE_SPEAKER_LABEL_LENGTH` (60 chars).** Verify: `node
   scripts/fix-corrupted-speaker-labels.mjs --dry-run` from a clean tree reports 0 corrupted
   turns found.

## Non-goals (disclosed, not hidden)
- This does not add automated silence/volume-based pre-checks to the pipeline — the
  `silencedetect`/`volumedetect` investigation was a one-off diagnostic step to rule out false
  leads, not a new permanent guard. If a future session hits a genuinely-silent long gap, the
  existing `findTimeGaps` + manual investigation path still applies.
- The marker-frequency instruction is a prompt-level mitigation, not a hard guarantee — Gemini
  could still occasionally under-mark a turn. The existing `findTimeGaps`/shortfall/recursive-
  retry machinery remains the real safety net; this fix makes that machinery converge correctly
  instead of chasing a measurement artifact.
