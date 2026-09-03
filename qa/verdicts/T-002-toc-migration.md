# Verdict — T-002 toc-migration

**Cycle checked: 1**
**Date:** 2026-09-03
**Checker mode:** Mode A (fresh subagent, adapter = default/coding — shell verify commands)

## Re-run evidence (all commands re-executed independently, not pasted-trusted)

- `ls data/toc-migrated | wc -l` -> `23`. [C1]
- `python scripts/validate-toc-migration.py` -> `Checked 23 session(s), 2925 turn(s), 72 claim(s).` /
  `PASS: all toc-migrated documents validate and every evidence[].turnId joins to a real turn.`
  [C2, C3, C4 schema-level]
- `node scripts/seed-toc.mjs --dry-run` -> real per-collection counts (sources 23, sessions 23,
  turns 2925, session_pages 23, claims 72), `No Mongo connection attempted (--dry-run).` [C6]
- `python schema/validate.py` -> `PASS: 19 collection schema(s) validated correctly.` (unaffected
  by this data-only unit, as claimed). [C7]
- `pnpm lint:structure` -> all green (`lint-loc`, `lint-dirsize`, `lint-root`, `lint-dupes`,
  `lint-migrations` 614 files, `snapshot.mjs --check` matches, depcruise 98 modules/245 deps, no
  violations). [C7]
- `git log --oneline -5` confirms HEAD = `907c9c9 feat(T-002): migrate 23 real TOC sessions into
  schema v2`, contract committed at `7900478`. `git ls-files data/toc-migrated | wc -l` = 115
  (23 sessions x 5 files each) — output is actually tracked in git, not just present on disk.

## C4 — independent turnId join spot-check (5+ claims, 3+ sessions)

Read `turns.json` directly (not trusting the schema-validator's join check alone) and confirmed
claim text against the cited turn's actual `text` field:

- `2026-05-08-funding-dreams-loans-forex-c01` (FRR ~1% vs banks 2-2.5%) -> turn `t037`: "our
  markup would be about 1%. Flywire is about 2% to 2.5%, and so is a bank." — supported.
- `2026-05-08-funding-dreams-loans-forex-c02` (blood-relative-only remittance) -> turn `t029` full
  text: "Many parents come to us and say... the student's grandfather will be transferring money.
  That is not allowed by FEMA. Only the mother, father, sibling, and spouse of the student is
  allowed to transfer money." — supported (the manifest's truncated preview cut off the payoff
  sentence; the full turn text carries it).
- `2026-05-08-funding-dreams-loans-forex-c04` (Credila 1.5cr/20yr) -> turn `t080`: "we offer
  20-year tenure... As the market is at 15-year, we offer 20 years." — supported (1.5cr elsewhere
  in same turn per manifest; tenure claim directly confirmed here).
- `2026-06-19-entrance-exams-pathways-india-part1-c02` (~58-60K MBBS seats, 1:40 ratio) -> turn
  `t051`: "NEET aspirant... roughly around 22 lakh-plus students appeared" (continues into the
  seat-count/ratio figures) — supported.
- `2026-06-19-entrance-exams-pathways-india-part1-c03` (Bio->Chem->Physics tie-break) -> turn
  `t060`: "candidates obtaining higher marks in Biology, followed by Chemistry, followed by
  Physics" — supported, exact match.
- `2026-06-19-entrance-exams-pathways-india-part1-c04` (30-mark -> ~14,500 rank swing) -> turn
  `t059`: worked example with AIR figures per the claim — supported.
- `2026-04-21-visa-blueprint-part2-italy-france-nz` session_page evidence turn `t011` -> "76% of
  students who applied... approved... 27,000 by 2030" — supported, exact match.

7 claims/evidence entries checked across 3 distinct sessions (exceeds the 5-claims/3-sessions
floor). No fabricated or unsupported turnId found.

## C5 — content-is-real cross-check (the priority check)

**KNOWLEDGE-BANK.md cross-check**, all 3 named sessions, read directly at cited line ranges:

1. Lines 25-29 (Italy/France/NZ, 21 April): KB's "~76% approval rate, target 27,000 Indian
   students by 2030", "€5,500" Classes Internationales cap, "SDM stamps rejected outright" all
   appear verbatim-equivalent in the generated `session_page.json` summary/keyInsights. Matches.
2. Lines 35-41 (funding/forex, 8 May): KB's "2-2.5% markup... FRR ~1%", "only blood relatives
   (parent/sibling/spouse)", "Section 80E", "₹1.5Cr / 20 yrs" all present in the generated output.
   Matches.
3. Lines 81-88 (entrance exams, 19 June): KB's "~40,000 govt seats" vs "12-13 lakh JEE", "1:40"
   NEET ratio, Bio->Chem->Physics tie-break, "30-mark swing" -> rank-swing figure all present.
   Matches.

**Source-transcript independent grounding** (not just KB-copying) — read
`raw/TOC/TOC-Materials/Transcripts/21st-April-Visa-Blueprint-Part2-Italy-France-NZ.content.md`
directly and grepped for the cited facts:

- Line 68 (transcript's own `## Key Topics & Takeaways`): "Over 8,000 Indian student applications
  approved recently (~76% approval rate); target is 27,000 by 2030." — matches the generated
  claim/summary.
- Line 94: "capped tuition at €5,500 for the foundational year." — matches.
- Line 125: "SDM (Sub-Divisional Magistrate) stamps are strictly rejected." — matches.
- Line 158 (`[09:54] Kshitij Garg`, the full-transcript body, not just the summary section):
  "76% of students who applied for a New Zealand visa were approved, and this number is more
  than 8,000 students... looking at increasing those numbers to 27,000 by 2030." — this is turn
  `t011`, the exact turnId cited as evidence in `session_page.json`. Confirms the extraction chain
  is real: transcript body -> turn -> cited claim, not KB-text pasted without grounding.

No fabrication found. The manifest's claim that content was independently extracted (not
copy-pasted from KNOWLEDGE-BANK.md) holds up — the transcript's own summary section states the
same facts KB states (both are honest syntheses of the same source), and the full-transcript body
independently corroborates the turn-level citation.

## Flagged limitation (seed-toc.mjs session_pages gap) — confirmed does not affect C6

Read `scripts/seed-toc.mjs` directly. `--dry-run` (lines 96-104) only calls `loadSessionDocs()`
(pure `fs` reads of `data/toc-migrated/`) and prints counts — it returns before `seedLive()` is
ever referenced, and `seedLive`'s dynamic `import("../packages/db/src/client.js")` (which would
attempt `connect()`) is only reached in the non-dry-run branch (line 108). The `--dry-run`
`session_pages` count (23) is the real number of `session_page.json` files on disk via
`docs.session_pages.push(...)` in `loadSessionDocs`, not a hardcoded/fake number. The documented
gap (no `packages/db/src/collections/session_pages.ts` accessor, so live mode reports 0 for that
collection) lives entirely inside `seedLive()`, lines 77-80 — confirmed honest, commented, and
irrelevant to the `--dry-run` path C6 requires.

## Criteria scoreboard

| # | Criterion | Status | Evidence |
|---|---|---|---|
| C1 | 23 sessions, correct dir layout | MET | `ls` = 23; `git ls-files` = 115 (23x5) |
| C2 | session.json/source.json schema + captureMode=provided | MET | validator run, 0 failures reported for these checks |
| C3 | turns.json schema + speakerRef=unknown honest | MET | validator run; spot-checked turns above all carry real text, no diarization guessed |
| C4 | session_page/claims schema + real evidence turnId joins | MET | validator run + independent re-derivation of 7 claims across 3 sessions above |
| C5 | Content real, not templated, cross-checked vs KB | MET | 3/3 named sessions cross-checked vs KB lines; 1 session independently re-grounded against source transcript |
| C6 | seed-toc.mjs --dry-run real counts, no Mongo attempt | MET | re-run output matches manifest; script read to confirm dry-run never imports client.js |
| C7 | No regression | MET | schema/validate.py PASS 19 collections; pnpm lint:structure all green |

7/7 criteria met, all invariants (I* — schema/join/honesty rules embedded in C2-C4) hold.

VERDICT: PASS
SCOREBOARD: 7/7 criteria met, all invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: All 23 sessions verified present and git-tracked; schema+join validator and seed
dry-run re-run independently with matching real output; C5 cross-checked against both
KNOWLEDGE-BANK.md and the raw source transcript with turn-level grounding confirmed genuine
(not KB-copied); C4 spot-checked 7 claims across 3 sessions against real turns.json text with no
fabrication found; the documented seed-toc.mjs session_pages live-mode gap confirmed (by reading
the script) to not affect the --dry-run path required for C6; no regression in existing 19-schema
validation or structure lint.
