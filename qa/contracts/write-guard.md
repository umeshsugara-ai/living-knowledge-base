# Contract — write-guard (machine-wide PreToolUse write guard)

**Status:** proposed — awaiting Approver ratification (initial contract creation is a
human-approved START per checker/SKILL.md's criticality gate). Authored by the checker on
2026-09-09 during the `write-guard-enforcement-gaps` check, because three units have now
touched this seam with no ground truth to judge them against.

**Artifact under contract:** `D:/ai_os/.claude/hooks/aios-write-guard.ps1` (outside this repo;
registered in `C:/Users/Lenovo/.claude/settings.json` PreToolUse for `Write|Edit|MultiEdit`).
It is the sole enforcer of this repo's append-only DECISIONS wall and of the confirmation
prompt on enforcement paths, so its behaviour is in scope for this repo even though its file
is not.

**North star:** every write that the Lab Protocol says needs authorization must reach the human,
and no write that does not need authorization may prompt.

## Acceptance criteria

- **[C1] `<lab-root>/docs/DECISIONS.md` is `deny`** when the file exists, and silent when absent
  (initial `/init-lab` creation).
- **[C2] Enforcement paths at a Lab root are `ask`**, with the Lab reason (authorizing DECISIONS
  entry + `Approved-by`): `.claude/settings.json`, `.claude/settings.local.json`,
  `.claude/hooks/*`, `scripts/append_decision.ps1`, `CLAUDE.md`, `.claude/CLAUDE.md`,
  `.claude/rules/**`.
- **[C3] The same classes outside any Lab root are `ask`** with the generic config reason
  (`D:/ai_os/CLAUDE.md`, `~/.claude/settings.json`, `~/.claude/rules/*`).
- **[C4] Ordinary files are silent** — project source, `qa/**`, `README.md`, docs. The merge
  that created this artifact existed to take 84 prompting files to 0; no tightening may undo it.
- **[C5] No enforcement-shaped path is silent inside a Lab root that is `ask` outside one.**
  A guard whose protection is *weaker* in the repo it exists to protect is the defect class this
  contract is written for. This criterion is judged over **nested** `.claude/` directories, not
  only the Lab root — see [I2].
- **[C6] A committed, runnable regression harness pins C1–C5.** `D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1`
  is the existing instrument (exit code = failed checks); write-guard cases belong in it.
- **[C7] The artifact is tracked in `D:/ai_os` git.** An untracked enforcement hook is one
  `git clean` from silently disabling every criterion above.

## Invariants

- **[I1] Fail open.** Any error, malformed input, or non-`Write|Edit|MultiEdit` tool exits 0
  silently. A guard must never break a legitimate write.
- **[I2] Path-shape, not path-existence, decides.** The decision for a path must not change
  because its parent directory does not exist yet — a guard that only protects files that
  already exist does not protect creation, which is when enforcement paths are most dangerous.
- **[I3] Decisions merge most-restrictive-first** (deny > ask > allow).
- **[I4] One process, one stdin read.** The performance reason the merge exists.

## Out of scope / ignore

- CHECK 3 (anti-drift on new source files) — a heuristic, judged on its false-positive rate, not
  by these criteria.
- Prompt wording, comment style, ASCII-escaping mechanics.

## Amendment log

- 2026-09-09 · START (proposed) · initial contract, authored during the
  `write-guard-enforcement-gaps` cycle-1 check · reason: third unit on this seam, no ground truth.
