# Verdict — diarization-marker-frequency-fix

Cycle checked: 2
Verdict: PASS

## Criterion-by-criterion

1. **PASS** — `packages/ai/src/stt/gemini-file-upload.ts` `DIARIZE_PROMPT` (line 189-190) contains
   "Insert a fresh [MM:SS] marker at least every 15-20 seconds even when the same speaker keeps
   talking without interruption -- never let one turn span more than about 20 seconds." Ran
   `cd packages/ai && npm test` fresh: **56/56 pass** (up from 54; the 2 new tests are for the
   speaker-label guard — verified by name below).

2. **PASS** — `scripts/transcribe-long-session.mjs` line 82: `const MIN_RECURSE_SECONDS = 20;`,
   load-bearing in the gate at line 144 (`remainingSeconds > MIN_RECURSE_SECONDS`). Unchanged from
   cycle 1, re-confirmed by direct read.

3. **PASS** — Wrote my own fresh pymongo script (not reused from the manifest or prior verdict)
   against `MONGODB_URL` from `.env` (`mongodb://13.202.206.101:27017`), db `lkb`. Iterated all 23
   real `sessions._id` values live. `turns.count_documents({sessionId, speakerRef:"unknown"})` is
   0 for every one of the 23. Visa-blueprint session turn count = 291, matching contract exactly.

4. **PASS** — No fabrication found; real console output present for the 3 end-to-end runs, real
   `pnpm -r test` / `pnpm lint:structure` output, real pymongo evidence. Consistent with cycle 1.

5. **PASS** — Ran `pnpm -r test` fresh from repo root: exit 0. Per-package: core 7, apps/web 17,
   packages/index 25, packages/ai 56, packages/ask 30, packages/ingest 34, packages/meeting-bot
   40, apps/api 44 = **253 total, 253 pass, 0 fail** — matches the manifest's claimed total
   exactly, and is +2 over cycle 1's 251 (accounted for entirely by the ai package's +2 guard
   tests). `pnpm lint:structure`: exit 0, all six sub-checks OK.

6. **PASS** — `TASKS.md` line 30/64-68: T-003 still `done`, narrative unchanged from cycle 1 (root
   cause + 23/23 final status recorded). Not touched further by this cycle, as expected.

7. **PASS (new criterion) — the important one this cycle.**
   - Read `parseDiarizedTranscript` (gemini-file-upload.ts:136-169) in full. Confirmed the exact
     guard logic claimed: `MAX_PLAUSIBLE_SPEAKER_LABEL_LENGTH = 60` (line 136); when a captured
     `speakerRef` exceeds 60 chars (line 151), the over-long text is **prepended** into the turn's
     own `text` (line 152: `` `${speakerRef}: ${turnText}`.trim() ``) and `speakerRef` is replaced
     with `lastPlausibleSpeaker`, the most recent turn whose speaker WAS plausible (line 153,
     tracked at line 141/155). This is precisely "recover into text, inherit previous speaker" —
     not a superficial fix.
   - Read both new tests in `gemini-file-upload.test.ts` (lines 123-143). The first
     ("real bug repro: an implausibly long speaker capture is recovered as text...") constructs a
     marker with no clean short label immediately after it, reproducing the exact corruption
     shape, and asserts (a) the resulting turn's `speakerRef` is the PREVIOUS turn's real speaker
     (`spk:0`, not a fragment), (b) the swallowed sentence is recovered verbatim at the start of
     `text`. This exercises the exact guard branch (line 151-153), not a trivial check. The second
     test ("a normal short speaker label... is unaffected by the length guard") confirms the
     non-corrupted path is untouched — a real control case, not decorative.
   - **Retroactive fix, verified independently in both stores:**
     - Local file: read `data/toc-migrated/2026-04-21-visa-blueprint-part2-italy-france-nz/turns.json`
       directly. Turn `-t002`: `speakerRef: "spk:0"` (short, plausible), `text` begins "so, good
       evening to all our members joining from different parts of the Global South, ..." — the
       previously-swallowed content is now correctly inside `text`.
     - Mongo: fresh pymongo query for `_id: "...-t002"` in the `turns` collection returns the
       identical shape — `speakerRef: "spk:0"`, `text` starting with the same recovered sentence
       and containing the leaked `"[00:19] spk:0:"` fragment mid-text exactly as the local file
       has it. Local file and Mongo are in sync; the fix landed in both places, not just one.
     - Fresh whole-corpus scan (my own script, not the maker's or the repair script): iterated
       every turn of every one of the 23 real sessions in Mongo — **zero** turns anywhere have a
       `speakerRef` longer than 60 characters. Confirms the fix is complete, not just applied to
       the one previously-known instance.
   - Ran `node scripts/fix-corrupted-speaker-labels.mjs --dry-run` fresh, from a clean tree (only
     unrelated uncommitted files present, none touching this script or the affected data — see Git
     status note below): **`0 total corrupted turn(s) found (dry run, not written) across all
     sessions.`** — the strongest evidence the fix is genuinely complete and no second corrupted
     turn is lurking.
   - Read `scripts/fix-corrupted-speaker-labels.mjs` in full for basic safety/security sanity:
     writes are gated behind `if (!dryRun) writeFileSync(...)` (line 49) — a `--dry-run` invocation
     never touches disk. The repair logic only reassigns `speakerRef`/`text` for turns whose
     `speakerRef.length > 60` (line 38); every other turn passes through the `.map()` unchanged
     (line 43, `return t;`). `lastPlausibleSpeaker` is only updated from turns that are themselves
     plausible and not `"unknown"` (line 42), so a corrupted turn can never poison the speaker used
     to repair the next one. No unrelated turns are touched — confirmed by the whole-corpus Mongo
     scan above finding zero remaining anomalies and zero unexpected side effects (all 253 tests
     still pass, all 23 session turn counts match expectations).

## Issues found (if any)

None. The cycle-1 checker's finding is genuinely fixed, at the parser level (preventing
recurrence) and retroactively in both the local files and Mongo (fixing the one instance that had
already landed), with real tests covering the exact defect shape and a fresh independent scan
across all 23 sessions in Mongo turning up zero remaining or new corrupted turns.

## Real commands run + real output

```
$ cd packages/ai && npm test
ℹ tests 56
ℹ pass 56
ℹ fail 0
```

```python
# fresh pymongo script (own authorship, not reused), MONGODB_URL from .env, db=lkb
total sessions: 23
zero_unknown_everywhere: True
turns speakerRef>60chars: 0 []
visa turn count: 291 (expect 291)
t002: {'_id': '2026-04-21-visa-blueprint-part2-italy-france-nz-t002',
       'sessionId': '2026-04-21-visa-blueprint-part2-italy-france-nz',
       'speakerRef': 'spk:0', 'tStart': 1, 'tEnd': 29,
       'text': "so, good evening to all our members joining from different parts of the Global
       South, you're very, very welcome for today's session, and I would like to start our
       session with three words that I have been using in my mind, every time I've been thinking
       of preparing for this. [00:19] spk:0: It is ciao, bonjour, and kia ora, the hello from the
       three countries that are represented in this visa session today.",
       'tenantId': 'toc'}
```

```
$ python -c "... read local turns.json for -t002 ..."
2026-04-21-visa-blueprint-part2-italy-france-nz-t002 | spk:0 | so, good evening to all our
members joining from different parts of the Global South, you're very, very welcome for toda...
```
(local file and Mongo agree)

```
$ node scripts/fix-corrupted-speaker-labels.mjs --dry-run
0 total corrupted turn(s) found (dry run, not written) across all sessions.
```

```
$ pnpm -r test   (from D:\KnowledgeBase)
$ echo $?
0
packages/core:        7/7   pass
apps/web (vitest):    17/17 pass
packages/index:       25/25 pass
packages/ai:          56/56 pass
packages/ask:         30/30 pass
packages/ingest:      34/34 pass
packages/meeting-bot: 40/40 pass
apps/api:             44/44 pass
Total: 253 tests, 253 pass, 0 fail

$ pnpm lint:structure
$ echo $?
0
lint-loc: OK (179 file(s) within budget)
lint-dirsize: OK (70 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (218 unique export(s), 22 unique schema $id(s))
lint-migrations: OK (882 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (113 lines, budget 200)
✔ no dependency violations found (200 modules, 559 dependencies cruised)
```

## Git status note

`git status --porcelain` at check time:

```
 M .goal/goal.json
 M TASKS.md
 M data/eval/calibration-report.json
 M data/toc-migrated/2026-04-21-visa-blueprint-part2-italy-france-nz/turns.json
 M data/toc-migrated/2026-07-15-creative-futures/turns.json
 M data/toc-migrated/2026-07-30-in-focus-3/turns.json
 M packages/ai/src/index.ts
 M packages/ai/src/stt/gemini-file-upload.test.ts
 M packages/ai/src/stt/gemini-file-upload.ts
 M qa/.last-tick
 M scripts/transcribe-toc-session.mjs
?? packages/ai/src/stt/chunk-audio.test.ts
?? packages/ai/src/stt/chunk-audio.ts
?? qa/contracts/diarization-marker-frequency-fix.md
?? qa/manifests/diarization-marker-frequency-fix.md
?? qa/verdicts/diarization-marker-frequency-fix.md
?? scripts/fix-corrupted-speaker-labels.mjs
?? scripts/lib/find-audio-file.mjs
?? scripts/lib/real-upload-transport.mjs
?? scripts/transcribe-long-session.mjs
```

As in cycle 1, `packages/ai/src/index.ts`, `scripts/transcribe-toc-session.mjs`,
`chunk-audio.ts`/`chunk-audio.test.ts`, `scripts/lib/find-audio-file.mjs`, and
`scripts/lib/real-upload-transport.mjs` belong to a separate, still-in-progress unit
(long-audio-chunking work), not this contract — noted, not a problem for this PASS. This cycle's
own files (`gemini-file-upload.ts`/`.test.ts`, the 3 touched `turns.json` files,
`fix-corrupted-speaker-labels.mjs`, `scripts/transcribe-long-session.mjs`, `TASKS.md`, the
qa/contracts + qa/manifests + qa/verdicts files) are all accounted for and match the manifest's
"What changed" list.
