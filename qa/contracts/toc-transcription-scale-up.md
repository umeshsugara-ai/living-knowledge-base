# Contract — toc-transcription-scale-up (T-003, phase 2: scale to 23/23)

> Ground truth for scaling real Gemini diarized transcription from the phase-1 proof-of-concept
> (1 real session) to the full 23-session TOC corpus, per TASKS.md's original T-003 scope
> ("Scale Gemini transcription 1→23 sessions") and the explicit go-ahead given after phase 1
> PASSed. Drafted by the maker; checker adopts or amends on first check.

## Scope, and an honest outcome disclosed up front
This is a data-backfill unit, not a code-feature unit — the criteria below are about the REAL
data state achieved, not new source code (the phase-1 pipeline + phase-1.5 empty-result guard
already shipped and PASSed; this unit runs that existing, already-checker-verified pipeline
across the remaining real sessions). **19 of 23 sessions now have real diarized transcription;
4 remain placeholder** — 2 confirmed-genuinely-blocked (both ~62MB, too long for a single
non-streaming `generateContent` call, failed 2-3 times each with different `finishReason`s:
`MAX_TOKENS`, `MALFORMED_RESPONSE`), 2 that returned `finishReason: STOP` (normally a clean
completion) with empty text across 2 attempts each — a real, currently-unexplained failure mode,
not yet root-caused. This unit does NOT claim 23/23 — it reports the true 19/23 honestly and
scopes the remaining 4 as explicit follow-up.

## Criteria (each machine-checkable)

1. **Real data state**: independently counting `speakerRef` values across all 23
   `data/toc-migrated/<sessionId>/turns.json` files, at least 19 sessions must show turns with
   real (non-`"unknown"`) speaker names/labels, and at most 4 may still be 100% `speakerRef:
   "unknown"` placeholder. The exact list of which 4 (if any) remain placeholder must match this
   manifest's disclosed list — no silent discrepancy.
2. **No regression via the empty-result guard**: for every session this unit touched (successful
   or failed), the guard from `qa/contracts/transcription-empty-result-guard.md` (already
   checker-PASSed) must have held — no session's `turns.json` was ever left empty or corrupted; a
   failed attempt leaves the PRE-ATTEMPT state (placeholder or previously-real) fully intact.
   Verifiable by confirming every currently-REAL session has a turn count consistent with a
   successful real run (never 0), and every currently-PLACEHOLDER session still has its original
   T-002 placeholder turn count and `speakerRef: "unknown"` throughout.
3. **Quality spot-check**: at least 2 of the newly-real sessions (from this scale-up pass, not
   phase 1's session) have their content checked against their known real topic (session title /
   `session.json`'s `org`) for plausibility — specific, checkable facts, not generic filler.
4. **Real cost reported honestly**: total input/output token usage across the WHOLE day's
   transcription effort (including failed attempts and retries, since those still consumed real
   tokens up to the point of failure) is summed and reported, with an approximate USD cost range
   at published Gemini Flash pricing.
5. **The 4 unresolved sessions are named, not buried**: `2026-04-21-visa-blueprint-part2-italy-
   france-nz` and `2026-07-15-creative-futures` (the confirmed ~62MB "too long for one call"
   cases) are flagged as needing an audio-chunking strategy — explicit follow-up, not retried
   further in this unit. `2026-07-30-in-focus-3` and `2026-08-24-uniaccess-leeds-arts-university`
   (the `finishReason: STOP` + empty-text cases) are flagged as an unexplained failure mode
   worth one more investigation pass later (could be a transient Gemini-side glitch, unlike the
   other two's confirmed structural limitation) — also not retried further in this unit.
6. **No regression**: `pnpm -r typecheck`, `pnpm -r test`, `pnpm gen:types --check`,
   `python schema/validate.py`, `pnpm lint:structure` all clean (these commands don't touch the
   real data files, so this criterion is really "the code from phase 1/1.5 is still intact" —
   no code changed in this unit, only data).

## Non-goals for this unit
- Does NOT solve the two distinct failure modes (large-file MAX_TOKENS/MALFORMED_RESPONSE, or
  the STOP-with-empty-text mystery) — both are real follow-up engineering work, disclosed not
  hidden. Does NOT re-seed the `lkb` Mongo database with the newly-updated turns (that's a
  separate re-run of `scripts/seed-toc.mjs`'s turns insertion, or a small targeted update script —
  a natural next step, not automated here since it touches the same real shared Mongo cluster
  flagged earlier this session, and deserves its own deliberate step). Does NOT change any source
  code — this unit is 100% a real-data-state change plus documentation.
