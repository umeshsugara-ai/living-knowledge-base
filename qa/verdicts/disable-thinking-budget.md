# Verdict — disable-thinking-budget (T-003)

Status: **FAIL**
Cycle checked: 1
Commit checked: `85ccb5d`
Contract: `qa/contracts/disable-thinking-budget.md`
Manifest: `qa/manifests/disable-thinking-budget.md`

## Summary

Bug 1 (thinking-budget) and the MM:SS half of Bug 2 (line-anchored parser) are genuinely fixed
and well-tested. But independent re-verification found the parser fix is **incomplete**, and the
manifest's "visa-blueprint 7-turn result is legitimate" claim does **not** hold up against the
session's own prior data. Two of the three sessions the manifest reports as cleanly fixed
(`2026-07-15-creative-futures`, `2026-04-21-visa-blueprint-part2-italy-france-nz`) show real,
previously-undetected data loss now live in the `lkb` Mongo database.

## Criterion-by-criterion

### 1. `thinkingConfig.thinkingBudget: 0` present in request body — PASS
Confirmed at `packages/ai/src/stt/gemini-file-upload.ts:177`, inside `transcribeUploadedAudio`'s
`generateContent` body, alongside `contents`.

### 2. Test proves the request-body change — PASS
`packages/ai/src/stt/gemini-file-upload.test.ts:145-165` captures the real request body via the
fake transport and asserts `generationConfig.thinkingConfig.thinkingBudget === 0`. Not a stub —
genuinely inspects the captured request.

Also hand-traced `TIMESTAMP_MARKER_RE = /\[(\d{1,3}):(\d{2})\]\s*(.+?):\s+/g` against the three
required cases: newline-separated markers (existing test, line 82-95), zero-separator
back-to-back markers (new repro test, line 107-121, 3/3 turns split correctly), and a
`spk:1`-shaped speaker with an internal colon (non-greedy `.+?` up to `: ` correctly stops at
the real delimiter, verified in both the newline test at line 92 and the no-newline test at line
117-118) — all genuine, not trivial.

### 3. Real retry evidence, reported honestly — **FAIL**
The manifest reports all 3 non-in-focus-3 retries as clean successes. Independent verification
against each session's **pre-existing** (pre-`85ccb5d`) `turns.json` — real transcript data from
before this unit touched these files — contradicts this for 2 of the 3:

| Session | Old (pre-fix) turns / last `tEnd` | New (this commit) turns / last `tEnd` | Finding |
|---|---|---|---|
| `visa-blueprint-part2-italy-france-nz` | 107 turns, up to `tEnd=6036` (~100min), includes real audience Q&A (e.g. turn t100 "Ruby Thomas: ... The MAECI scholarship..." at 5595s, turn t107 "Shagun Handa: That is actually the APS..." at 5991s) | 7 turns, stops at `tEnd=3622` (~60min) | **~40 minutes of real, previously-captured Q&A content is now completely absent.** New transcript's last two turns (t005, t007) are near-identical duplicate lines ("...invite our next speaker, Ruby ... Over to you, Ruby") — a generation-degradation/truncation signature, not a clean session close. |
| `2026-07-15-creative-futures` | 164 turns, up to `tEnd=6038` (~100min) | 43 turns, stops at `tEnd=3619` (~60min) | Same ~40-minute cutoff pattern. **Confirmed contaminated**: the new last turn (t043) ends `"...month of July and August.\n\n[1:26:30] spk:0: So, it's not technically like a pre screening or a pre-"` — an embedded, unparsed marker AND a mid-word cutoff. The transcript resumed past 60 minutes and switched to **`[H:MM:SS]` format** (`[1:26:30]`), which `TIMESTAMP_MARKER_RE` (built for `[MM:SS]`, exactly two digit groups) does not match — so this marker and everything after it stayed embedded, unsplit, inside the "final" turn's text, silently truncated. |
| `uniaccess-leeds-arts-university` | 102 turns, `tEnd=4506` | 102 turns, `tEnd=3473` | Both old and new end naturally on "Bye." exchanges — this one appears genuinely complete; the `tEnd` gap looks like ordinary retranscription timing variance, not truncation. No contamination found (old or new). This one is fine. |

The old pre-fix `visa-blueprint` and `creative-futures` data itself was low-quality
(`speakerRef: "unknown"` throughout, names embedded in text) — so it isn't "better" data to
revert to — but it proves the **underlying audio genuinely runs to ~100 minutes with real
content past the 60-minute mark**, and the new "fixed" retries are silently stopping around
60 minutes for 2 of 3 sessions while reporting success. This is a second, undiscovered failure
mode with the same shape as Bug 1/Bug 2 (Gemini truncating without a hard error) — not
identified or disclosed by the manifest.

The manifest's specific claim — "`visa-blueprint` 7 turns verified LEGITIMATE... zero embedded-
marker contamination found" — is not sound. It matches the surface shape (host-intro /
monologue / host-intro pattern) but did not check the transcript's coverage against the
session's actual duration, and missed the duplicated-line ending as a red flag.

### 4. No regression — PASS
Independently re-ran all six commands from a fresh shell:
- `pnpm -r typecheck` — all 9 workspace projects, Done, no errors.
- `pnpm --filter @lkb/ai test` — 37/37 pass (fresh count matches manifest).
- `pnpm -r test` — all 7 packages/apps report `fail 0` (core, ai, index, ask, ingest,
  meeting-bot, apps/api).
- `pnpm gen:types --check` — `OK: 22 generated type file(s) + index.ts match schema/`.
- `python schema/validate.py` — `PASS: 22 collection schema(s) validated correctly.`
- `pnpm lint:structure` — all sub-checks OK, `0 dependency violations`.

### 5. Live Mongo sync — mechanically consistent, but propagates the bad data
Independent fresh pymongo connection (not reusing any cached client):
- `db.turns.count_documents({})` on `lkb` = **1468** — matches manifest's claim, and matches
  independently recomputed sum of local turn counts across all 23 `data/toc-migrated/*/turns.json`
  files (7+83+31+64+8+59+15+90+38+69+16+50+134+43+56+83+**124**+43+46+230+26+102+51 = 1468).
- Spot-checked all 3 newly-touched sessions in Mongo vs local file — exact match:
  `creative-futures` 43/43, `uniaccess-leeds-arts-university` 102/102,
  `visa-blueprint-part2-italy-france-nz` 7/7.
- `in-focus-3` Mongo count = 124, all `speakerRef: "unknown"` — matches its honest-placeholder
  local state.

The sync mechanism itself is correct and matches local↔Mongo. The problem is upstream: the
**local files being synced already contain the truncation/contamination described in
criterion 3**, so criterion 5 "passing" means the live database now silently carries an
incomplete `visa-blueprint` session and a contaminated, truncated `creative-futures` session.

### Contamination scan
The exact scan prescribed by the checker brief (`\[\d{1,3}:\d{2}\]\s*\S`, i.e. `[MM:SS]` only)
was run and printed nothing — but this is a **false negative**: that regex cannot match
`[H:MM:SS]` markers (3 digit groups), which is exactly the format Gemini emits once a session
transcript crosses the 60-minute mark. Re-running with a corrected pattern that also matches
`[H:MM:SS]`:

```
pat = re.compile(r'\[\d{1,2}:\d{2}(?::\d{2})?\]\s*\S')
```

```
2026-07-15-creative-futures CONTAMINATED (incl H:MM:SS): 1
SCAN DONE
```

**One session prints.** Per the checker brief's own stated bar ("This MUST print nothing. If it
prints ANY session, that is a FAIL — the parser fix is incomplete and there is still
silently-bad data in the corpus"), this alone is decisive.

## Root cause for the checker/maker to fix next cycle
`TIMESTAMP_MARKER_RE` in `packages/ai/src/stt/gemini-file-upload.ts:109` only matches 2-digit-
group `[MM:SS]` timestamps. Real ~100-minute sessions cross 60 minutes mid-transcript and Gemini
switches to 3-digit-group `[H:MM:SS]`. The regex needs an optional third `:\d{2}` group (and
`parseTimestamp` needs to handle the hour component), or the diarization prompt needs to force a
single fixed timestamp format regardless of duration. Separately: `visa-blueprint`'s truncation
at ~60 minutes with NO embedded marker at all (unlike creative-futures) suggests a possible
second cause (real output-length limit, or `thinkingBudget: 0` itself changing truncation
behavior) that hasn't been diagnosed — the manifest's "3 consecutive 503s" explanation was only
investigated for `in-focus-3`, not for why 2 of the 3 "successful" sessions stop almost exactly
at the same ~60-minute mark.

## Verdict
**FAIL.** Do not close T-003 as 22/23. Two of the three "newly real" sessions
(`visa-blueprint-part2-italy-france-nz`, `creative-futures`) contain silently incomplete/
contaminated data that is now live in the `lkb` Mongo database. `TASKS.md`, `.goal/goal.json`,
and the manifest `Status:` are left untouched per protocol — maker must re-open a fix cycle
covering the `[H:MM:SS]` marker gap and the ~60-minute truncation pattern before this unit can
PASS.
