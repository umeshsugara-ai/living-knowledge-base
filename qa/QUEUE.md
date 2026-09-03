# QUEUE — top-3 recommended next units (checker sweep 2026-09-03T08:07Z, Mode B safety net)

> Superseded queue note: the prior queue (stamped 07:35:58Z) recommended T-021, ISS-016/ISS-017
> pointer+manifest hygiene, and T-023 — all three of the feature units are now DONE (T-021
> checker-PASS commit `03fcf8d`/`a6a24c7`; T-023 checker-PASS commit `bcc6f1e`/`cb99a6e`; T-026
> also shipped since — `950a804`/`af6deaa` — and T-004c — `8ae94f4`/`7facc96`). ISS-016 (goal
> pointer) and ISS-017 (T-009b manifest close-out) were only partially addressed: T-009b's own
> manifest was fixed (`c742894`), but the underlying pattern immediately recurred across the four
> newly-shipped units — see finding ISS-018 below, now the #1 pick.

| # | Unit | Why | Status |
|---|---|---|---|
| 1 | ISS-018: manifest close-out gap (widened to 4 units) + verdict-wording standardization + hook regex reconciliation | severity high, actively degrading the enforcement signal: `mc-sessionstart.ps1` currently reports "PASS not closed out: 0" when the true count is 4, while `mc-precommit.ps1` correctly reports 4 — the two hooks now disagree on the same repo state. This is the same shape as ISS-017 but the fix that unit got (a one-off manual close-out) was never generalized, so it recurred immediately on the next 4 units built after ISS-017 was filed. Fix once, structurally (checklist step in the maker tick + verdict template), not per-unit. | TODO |
| 2 | T-022: Evaluator calibration on 30 hand-scored pairs | unblocked (dep T-021 done); direct continuation of the eval harness just shipped — T-021's own verdict flagged its recall@5=1.000 as heuristic-retriever-only, not evidence against the real 0.85 target; T-022 is the next honest step in that same evaluation thread | TODO |
| 3 | T-027: Watched Sources (A13) — bookmark reputed URLs → periodic fetch → hash+diff → re-ingest changed sections | unblocked (dep T-023 done, just shipped this session); directly matches Umesh's explicit feedback-inbox ask ("reputed websites ka content gold hai... track ho ke knowledge pool update ho jaye") | TODO |

## Also open (not top-3, still tracked)
- T-025 (Calendar auto-join, dep T-024 done) — unblocked, matches an explicit Umesh ask, viable alternate #3/#4.
- T-007 (WhatsApp → claims ingestion, dep T-020 done, consent Q4 resolved per ARCHITECTURE §6) — viable alternate.
- T-013 (avatar/voice client, dep T-009 done) — unblocked but no near-term driver yet.
- ISS-016 (medium, STILL OPEN — persisted through all 4 new commits this session): `.goal/goal.json`
  `"current"` remains `"T-003"` (BLOCKED unit) in both the committed HEAD and the uncommitted
  working copy, across every tick since it was first flagged — the automated "advance current"
  logic is not touching this field even as `percent`/`done` counts update correctly alongside it.
  Worth a structural fix (not another one-off pointer nudge) given the recurrence count.
- ISS-019 (medium, NEW): `qa/loop.md` (Loop-Doctor-lite spec) was never scaffolded since project
  init — `qa/adapter.json` is also absent, which is fine (falls back to the DEFAULT coding
  adapter correctly), but the loop spec itself is a genuine gap. Remedy: re-run `/maker init`
  step 3b.
- ISS-020 (low, NEW): `qa/issues.jsonl` line 17 (ISS-017) is invalid JSON — an unescaped `\s` in
  a quoted regex breaks strict per-line JSON parsing. Ledger is append-only so this line is not
  repaired; noted for any JSONL consumer (sheet-sync) to tolerant-parse.
- ISS-007 (low): contracts lack standard shape (status/north-star link/[I*]/amendment log) on
  early contracts.
- ISS-010 (medium): Phase-1 exit gaps unassigned — re-verify next sweep whether T-005b/T-019/
  T-018's delivered content already closes this; not re-checked this sweep (no new evidence).
- ISS-011 (low): ARCHITECTURE §6 Q5 attribution drift (D-003 vs D-004/D-005) — routine DECISIONS
  clarification, no ARCHITECTURE change needed.
- T-003 BLOCKED on ISS-015 (invalid GEMINI_API_KEY — needs a valid key from Umesh).
  T-010/T-028 explicitly user-deferred — do not recommend.

## This sweep's findings (see qa/issues.jsonl for full detail)

- **No bypass found.** Every commit since the last sweep (`qa/.last-sweep` read as
  `2026-09-03T07:35:58Z FINDINGS: 2`) that touches source maps to a matching manifest+verdict
  pair, all independently re-verified by the checker (evidence quoted in each verdict's commit
  message): T-004c (`8ae94f4`/`7facc96`), T-023 (`bcc6f1e`/`cb99a6e`), T-021 (`03fcf8d`/
  `a6a24c7`), T-026 (`950a804`/`af6deaa`). The one non-code commit in range, `c742894` (ISS-017
  close-out fix), is legitimate — it flips only T-009b's manifest, citing the real existing PASS
  verdict, no scope creep.
- **NEW — ISS-018 (high):** the manifest-close-out gap ISS-017 named for T-009b alone has
  recurred across all four units built afterward — `qa/manifests/regenerate-year-migration.md`,
  `url-adapter.md`, `golden-set-recall.md`, `purge-retention-policy.md` are all still
  `Status: ready-for-check` despite clean cycle-1 PASS verdicts, and all four verdicts still use
  `**Result: PASS**` instead of the SKILL-mandated `VERDICT: PASS` line. Hand-ran
  `mc-sessionstart.ps1`: it reports `Checks pending: 1 [regenerate-year-migration] |
  PASS not closed out: 0` — undercounting (true unclosed count is 4). Hand-ran
  `mc-precommit.ps1`: it correctly reports `4 unit(s) still awaiting /checker verdict` — **the
  two enforcement hooks now disagree with each other on identical repo state**, which is worse
  than either hook being wrong alone. Filed as the new #1 priority since it is actively
  degrading the session-start signal this pair depends on for auto-continue.
- **NEW — ISS-019 (medium):** `qa/loop.md` (Loop-Doctor-lite spec) has never existed since
  project init; `qa/adapter.json` absence is expected/correct (DEFAULT coding adapter applies)
  but the loop spec itself is a real, previously-unflagged gap.
- **NEW — ISS-020 (low):** `qa/issues.jsonl` line 17 (ISS-017) fails strict JSON parsing due to
  an unescaped backslash in a quoted regex literal inside its title. Ledger is append-only, so
  not repaired — flagged for any JSONL consumer to tolerant-parse.
- **ISS-016 re-checked, still open:** confirmed via `git log -p -- .goal/goal.json` that
  `"current"` has stayed `"T-003"` through every commit touching that file this session,
  including the four most recent ticks — the drift is not self-healing, it needs the structural
  fix named in the ledger.
- **Ledger/TASKS.md consistency:** read `TASKS.md` in full and cross-checked all `done` rows
  against `qa/verdicts/` and `qa/issues.jsonl` — no `done` task found with a missing verdict; no
  verdict found with no corresponding `done` row. `.goal/goal.json`'s `tasks[]` array confirms
  T-022/T-025/T-027/T-007 dependency-readiness matches TASKS.md exactly.
- **Feedback inbox:** all three dated entries already carry "folded" annotations with specific
  commit/contract references from prior sweeps; re-read in full, no new unfolded content found.
- **Enforcement liveness:** both hooks exit 0 (see ISS-018 for the content-level disagreement
  between them). Repo has 30+ commits since the last sweep alone — versioning alive.
- **Loop spec (Loop-Doctor-lite):** absent — see ISS-019.
- **Goal-coverage:** `python D:/ai_os/.claude/skills/goal/scripts/monitor.py "D:\KnowledgeBase"`
  ran clean, reporting **62% complete** (`done`/`total` progress; `eligible: 11` open/unblocked
  tasks; no notifications). This matches the uncommitted working-tree `.goal/goal.json`'s
  `percent: 62` (committed HEAD still shows 59% — one tick behind, expected given `af6deaa` is
  the latest commit and a further local tick ran after it).
- **Re-grill:** not due. `qa/.regrill-due` absent; `qa/.paused` absent. Plan says re-grill ~4
  weeks after the T-024 capture-CLI demo (`e2a8136`, 2026-09-03) — same calendar day as this
  sweep, so 4 weeks has obviously not elapsed. Reasoning holds, correctly absent.
