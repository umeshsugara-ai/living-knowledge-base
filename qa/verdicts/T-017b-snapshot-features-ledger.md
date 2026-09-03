# Verdict — T-017b-snapshot-features-ledger

**Cycle checked:** 1
**Date:** 2026-09-03
**Contract:** qa/contracts/snapshot-features-ledger.md (adopted this check — see contract's own
Amendment log, two new entries dated 2026-09-03)
**Manifest:** qa/manifests/T-017b-snapshot-features-ledger.md
**HEAD at check time:** 795bd90 (feat(T-017b): SNAPSHOT.md generator + FEATURES.jsonl ledger)

## Contract adoption
Contract was maker-drafted (as T-016/T-017). Content re-read against plan §6d (Umesh's ask for a
date-wise, reasoned feature log + read-first generated snapshot to save tokens) and the
`directory_map.md` anti-pattern reference it cites — faithful. Adopted via amendment-log line
(routine gate; START stood on the plan §6d approval already). A second amendment line clarifies
that criterion 6's two sub-parts (a) SessionEnd wiring and (b) lint:structure fallback are both
required for C6 to read as fully met — the contract's "no separate /landplane dependency"
clause scopes only to (b)'s independence from `/landplane`, not a waiver of (a).

## Re-run evidence (all commands re-executed by this checker, not trusted from the manifest)

- `python schema/validate.py` → 11/11 OK incl. `features_event` (valid passes, invalid rejected
  1 error), `PASS: 11 collection schema(s)`. [C1]
- `node --test scripts/snapshot.test.mjs` → 4/4 pass (reject-missing-reason, append-only,
  `--check` 0-fresh/non-zero-stale, ≤200-line budget). [C2, C3b, C4, C8]
- `node scripts/snapshot.mjs --check` → `OK: docs/SNAPSHOT.md matches a fresh regeneration (93
  lines, budget 200)`, exit 0. `wc -l docs/SNAPSHOT.md` → 93. [C3, C4]
- Independent hand-run of C3b: copied `docs/SNAPSHOT.md`, appended a tampered line, re-ran
  `--check` → `FAIL: docs/SNAPSHOT.md is stale (2 line(s) differ...)` with per-line
  committed/fresh values printed (not just pass/fail), exit 1; restored, re-checked clean, `git
  status --porcelain` empty afterward. [C3b]
- Independent hand-run of C5 (own simulation, not the manifest's pasted one): backed up the
  ledger, `appendEvent` a `removed` row with a reason, ran
  `.claude/hooks/mc-sessionstart.ps1` → printed `FEATURE CHANGED: checker-test-removed-feature
  removed on 2026-08-25 -- checker verification row`; restored the ledger and regenerated
  `docs/SNAPSHOT.md`; `git status --porcelain` on both files came back clean. [C5]
- Independent hand-run of C2's reason-required guard: `appendEvent` with a `removed` event and no
  `reason` → threw `invalid features_event: $: missing required property 'reason'`, nothing
  written (verified via the same clean-status check). Read `scripts/lib/features.mjs`:
  `appendFileSync` only ever grows the file (append-only by construction), validates before
  writing. [C2]
- `pnpm lint:structure` → all 5 lint checks OK + `OK: docs/SNAPSHOT.md matches a fresh
  regeneration (93 lines, budget 200)` + depcruise clean, exit 0. [C4, C6b]
- `pnpm test:lint` → 14/14 pass (10 pre-existing lint tests + the 4 snapshot tests folded in).
  [C8]
- `pnpm gen:types -- --check` → `OK: 11 generated type file(s) + index.ts match schema/`.
- `pnpm -r typecheck` → 9/9 workspace projects clean.
- `pnpm -r test` → `packages/ask` 6/6, `packages/index` 4/4, 0 failures.
- Read `docs/SNAPSHOT.md`: header carries the exact `DO NOT EDIT` generated banner; §1 matches
  ARCHITECTURE.md §1 verbatim; directory tree, schema table (11 rows matching the 11 schema
  files), last-5 `FEATURES.jsonl` rows (only 5 exist, so tail(20) correctly shows all 5), and
  ARCHITECTURE §6 open questions all present in the stated order. [C3]
- `cat docs/FEATURES.jsonl` → exactly 5 `shipped` rows for T-001/T-004/T-005/T-016/T-017, each
  `reason: null` (correct — `shipped` doesn't require one), `links` pointing at manifests +
  verdicts. Verified all 10 linked files exist on disk (`ls` — all present). No invented data.
  [C9]
- Read the memory files directly at
  `C:\Users\Lenovo\.claude\projects\d--KnowledgeBase\memory\project_snapshot_first.md` and
  `...\memory\MEMORY.md` — both exist with the content the manifest quotes: the pointer file
  states "read docs/SNAPSHOT.md first... never edit it directly," and `MEMORY.md` carries the
  one-line index entry to it. [C7]
- `docs/DECISIONS.md` grepped for "D-006", "snapshot", "FEATURES.jsonl", "SessionEnd", "T-017b"
  — only the D-006 entry itself hit; its `Changes-authorized` line reads literally `.claude/
  hooks/* (add mc session-start + commit guard); .claude/settings.json (register the two hooks)`
  — two named hooks, not this SessionEnd hook. `git diff HEAD -- .claude/settings.json` → empty
  (0 lines): confirmed the maker did not sneak the wiring in and then claim otherwise. Read
  `.claude/hooks/features-snapshot-session-end.ps1` in full — it exists, is well-formed
  (git-root discovery, `git status --porcelain` gate on `docs/FEATURES.jsonl`, fails open, same
  posture as `lab-session-end.ps1`), and is simply not referenced anywhere in
  `.claude/settings.json`.

## Criteria

| # | Criterion | Result |
|---|---|---|
| C1 | features_event schema + validate.py | MET |
| C2 | appendEvent / CLI, append-only, reason-required | MET |
| C3 | snapshot.mjs generates SNAPSHOT.md per spec | MET |
| C3b | hand-edit drift caught with line-level report | MET |
| C4 | ≤200 lines, wired into lint:structure | MET |
| C5 | session-start hook FEATURE CHANGED line | MET |
| **C6** | **Regeneration wired to lifecycle points: (a) SessionEnd + (b) lint:structure fallback** | **PARTIAL — (b) MET, (a) NOT MET** |
| C7 | Memory pointer file + MEMORY.md | MET |
| C8 | Tests exist and pass | MET |
| C9 | Seed data (T-001/004/005/016/017), non-invented | MET |

C6 reasoning: the contract names two sub-parts under one criterion number. (b) is fully wired
and verified (`lint:structure` fails closed on staleness — re-proven above). (a) is written and
was hand-tested by the maker (I did not re-run the SessionEnd hook myself since that requires a
real SessionEnd invocation, but I did verify its logic by reading it and confirming its
`git status --porcelain` gate and node-invocation path are sound) but is genuinely **not wired**
into `.claude/settings.json` — verified independently via `git diff` and a `docs/DECISIONS.md`
grep, not just taken on the manifest's word. This is correctly *not* something the maker routed
around: D-006's `Changes-authorized` is scoped to two specifically-named hooks and does not cover
a third SessionEnd hook; wiring a new enforcement path without an `Approved-by:` entry would
itself violate the Lab Protocol this repo runs under. Per the checker's own hard rule ("PASS
requires every criterion evidenced... no partial PASS; that's a FAIL with a scoreboard"), C6 is
judged **not fully met** — this is a legitimate governance gate (HUMAN_GATE), not a code defect,
and is filed as such (ISS-013) rather than fixed by editing `.claude/settings.json` myself (which
I did not touch).

## Issues addressed
None claimed by the manifest (`Issues addressed: none`) — nothing to reconcile against the ledger.

## Issues written
- ISS-013 (medium, HUMAN_GATE flavor): C6(a) SessionEnd hook not wired into
  `.claude/settings.json`; needs a `docs/DECISIONS.md` entry with `Approved-by: Umesh` before it
  can be wired. C6(b) fallback fully covers regeneration-before-ship in the meantime.

## Verdict

```
VERDICT: FAIL
SCOREBOARD: 8/9 criteria met (1 partial: C6 — 6b met, 6a not), 0/0 invariants (none declared)
FAILURES:
- [C6] SessionEnd auto-regen hook exists and was hand-tested but is not wired into
  .claude/settings.json — D-006 does not authorize this specific hook · fix direction: get
  Umesh's Approved-by on a new docs/DECISIONS.md entry (scripts/append_decision.ps1) naming
  ".claude/settings.json (register features-snapshot-session-end.ps1 as a second SessionEnd
  hook)", then wire it · issue: ISS-013
ISSUES-WRITTEN: ISS-013
EXPLANATION: Every other criterion (C1-C5, C7-C9) is independently re-verified and met, including
two checks I ran myself beyond what the manifest pasted (C3b tamper-and-restore, C5 hook
simulation). C6 is a legitimate partial gap: the SessionEnd wiring genuinely isn't installed, and
correctly so — D-006's authorization doesn't cover it, and the maker reverted its own attempt to
add it rather than bypass the governance gate. This is a HUMAN_GATE blocker (Umesh's approval),
not a code defect, and does not diminish the quality of the rest of the unit — but per the
no-partial-PASS rule this is a FAIL on C6, reported plainly.
```
