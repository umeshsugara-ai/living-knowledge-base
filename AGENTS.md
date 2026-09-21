# PROJECT RULES — Lab Protocol active
(extends the user-global AGENTS.md; on conflict, this file wins)

## Session start (the repo-committed hook injects this automatically; if missing, read manually)
ARCHITECTURE.md (root) → decision index from docs/DECISIONS.md (computed status) → open tasks
in TASKS.md. Pick ONE unblocked task.

## Approver
- **Approver:** Umesh — the single named owner of PROCEED/ROLLBACK/PIVOT verdicts,
  /graduate freezes, and enforcement-path changes in THIS repo.

## Update Authorization (the core rule)
- docs/DECISIONS.md: APPEND-ONLY. The only write path is `scripts/append_decision.ps1`
  (direct Edit/Write is denied by the guard; Bash bypasses are caught by the /landplane
  additions-only audit + /compound sweep). Replacement happens only via a new entry
  with a reasoned Supersedes field. Old entries are NEVER touched; effective status is
  computed.
- ARCHITECTURE.md (Hypotheses §3 / Open Questions §6): the agent may update during
  /landplane ONLY for sections listed in that session's Changes-authorized field, with
  reasoning. No entry → no edit.
- ARCHITECTURE.md (Frozen §2) and contracts/: ONLY via /graduate or an approved PIVOT
  checkpoint. Never during normal landplane.
- Enforcement paths (`.Codex/hooks/*`, `scripts/append_decision.ps1`,
  `.Codex/settings.json`): Changes-authorized alone is NOT enough — the authorizing
  entry MUST carry `**Approved-by:** Umesh`, recorded only after explicit confirmation.
- This file (project AGENTS.md): only via /compound with the Approver's approval.

## Definition of done
1. `contracts/verify_contracts.py` passes (once contracts exist; currently empty).
2. The affected stage runs green on sample data.
3. The immediate downstream stage consumes the output without error.
Evidence (command + output) pasted, or it did not happen.

## Task tracking
Entries in `TASKS.md` carry a stable ID + status field (open / in_progress / done /
blocked). DECISIONS entries cross-reference those IDs in **Links**.

## Project specifics
- Sample data location: `raw/TOC/TOC-Materials/` (23 session transcripts, 1 already piloted
  through the Gemini diarization pipeline: `27th-August-In-Focus`).
- Pipeline run command: `[ASSUMPTION]` not yet created — first `/maker` unit (T-001).
- Validator: `contracts/verify_contracts.py` (currently trivial — no frozen contracts yet).
- This repo governs `raw/TOC/` directly. `sources/whatsapp_msg/` is a git submodule source with its own
  independent Lab Protocol repo (own `.git`/ARCHITECTURE.md/DECISIONS.md) — do not
  duplicate its governance here, reference it instead.
- Full feature catalogue: `C:\Users\Lenovo\.Codex\plans\thik-hai-and-you-nested-cat.md`.
- Read-first snapshot (once T-017b lands): `docs/SNAPSHOT.md` — generated, never edit it; edit sources.

## Maker-checker discipline (installed 2026-09-03, authorized by D-006)

This project runs dev work through the maker-checker pair:

- **Substantive dev work** (feature, module, schema/data-model change, multi-file edit) → route
  through `/maker`. Announce in one line; user can say "normal" to opt out.
- **Trivial work** (typo, single command, read-only) → normal mode, no ceremony.
- Ground truth lives in `qa/contracts/` — **maker never edits it**; feedback goes verbatim into
  `qa/feedback-inbox.md`; `/checker` folds it in.
- Only `/checker` can PASS a unit. "Done" claims without a checker verdict are invalid.
- Open issues: `qa/issues.jsonl` (canonical) — Google Sheet is a synced human view only.
- **The maker↔checker handshake is files, never memory:** maker's request = manifest at
  `Status: ready-for-check` (with `Fix cycle: N`); checker's reply = `qa/verdicts/<same-slug>.md`
  (with `Cycle checked: N`); maker's close-out = manifest flip to `checked-PASS`.
- **AUTO-CONTINUE (no human hand-crank):** on session start, if the hook line or `qa/` shows
  pending state (unchecked manifest · PASS not closed out · open issues / TODO queue rows ·
  stale `.last-tick`), run `/maker continue "D:\KnowledgeBase"` **before anything else**. The
  maker self-continues via `ScheduleWakeup` and dispatches its own checker subagents and sweeps;
  the only human actions are `/maker init` (once) and answering HUMAN_GATE decisions.
- Manual overrides (never required): `/checker sweep` · `/loop /maker continue "D:\KnowledgeBase"`.

## Backlog priority override (2026-09-08, authorized by Umesh as Approver)

**This section overrides `maker/SKILL.md` backlog priority and `checker/SKILL.md` verdict rules
for THIS repo only.** The shared AIOS skills are deliberately left untouched.
Measured rationale (governance-prose vs source ratio, self-refilling QA tiers, D-014 retraction
of the `checker/SKILL.md:127` misreading): `docs/DECISIONS.md` — the backlog-priority tier list
below is the operative rule.

### Backlog priority in this repo, in order

1. `qa/QUEUE.md` top clear TODO row — **unless** it names a round-capped seam (below).
2. Open ledger issues at **critical / high** severity.
3. **The next unblocked roadmap task** — `.goal/goal.json` `tasks[]` at `pending` with deps met,
   or its `TASKS.md` row. **This tier is not optional and not last.** If tiers 1–2 are clear, pull
   a feature, not a medium-severity polish item.
4. Open ledger issues at **medium** severity.
5. Contract criteria not covered by any PASSed unit (gap analysis).
6. Feedback-inbox items awaiting build.

State which tier the picked unit came from, every tick.

### Severity gate

- **Full ceremony** (manifest + verdict + contract + close-out) only for **high/critical**, and for
  anything touching **auth, tenancy, or data writes** regardless of severity. That is the mechanism
  that caught the cross-tenant read disclosure (ISS-5A) — it is not being weakened.
- **Medium** — one-line ledger entry; verified inside the next unit that touches the same file.
- **Low** — ledger entry only. **Never a pulled unit.** 65 of 84 issues were medium/low and each
  consumed the same ceremony as the security bug.

### Round cap

**Corrected by D-014 (2026-09-08) — the cap is CLASS-based, not count-based.**

| Finding class | Rule |
|---|---|
| **Security class** — tenancy, auth, cross-tenant read, data write, credential handling | **Never capped.** Opens a unit at any round count. |
| Everything else — coverage, cost, style, doc accuracy, N+1, unasserted fields | Capped at **2 PASSes** on that seam. Further findings are filed `file-don't-fix` and never become units. |

Before pulling a non-security unit, count prior PASSed verdicts naming the same seam; at ≥2, skip
it and say so. If a seam looks unsafe past the cap, raise a `HUMAN_GATE` — do not open round N+1.
Measured rationale (why the count-based cap was withdrawn — ISS-078 found at round 5 after four
PASSes; class-based rule keeps the grind-stop without the severity-decay assumption): D-014. The
adversarial bypass hunt is **kept** — it is what found ISS-078; its output is *filed* rather than
automatically promoted into round N+1.

### Verdict rule

`ISSUES-WRITTEN: none` is a **complete and creditable check**, not a lapse. A checker that finds
nothing on a correct implementation has done its job. Low-severity observations go in
`EXPLANATION:` as notes and do **not** enter the backlog.

### `BACKLOG_EMPTY`

Redefined for this repo: no pending handshake, no open **critical/high/medium** issues, no TODO
queue rows, sweep fresh. Open `low` issues do **not** keep the loop alive.

### Measuring a fix against the ledger (2026-09-08, authorized by D-015)

When a unit's stated purpose is to fix a filed issue:

- Its standing regression test **re-runs that issue's own recorded reproductions verbatim** from
  `qa/issues.jsonl`. The ledger's cases are the floor of the suite, not a starting point.
- The manifest's Evidence section **reports the count against that corpus, by issue id** —
  `ISS-093: 15/20 refused`. Authoring an additional corpus is encouraged; **substituting** one for
  the ledger's recorded cases is not.
- A recorded reproduction deliberately left open must be **named, with its reason**, not omitted
  from the measurement.

Measured rationale (speaker-verbatim-token-boundary cycle 3 measured 12/12 against a self-authored
corpus while the ledger's own 20 attacks gave 15/20 — "a fix measured against a corpus its own
author chose is marking homework with an easier exam"): D-015.

### Per-lane issue ledgers (2026-09-08, authorized by D-019)

Two concurrent maker loops must not draw issue ids from one sequence.

- A lane working in a git worktree writes to **`qa/issues.<lane>.jsonl`** and allocates ids
  **`ISS-<LANE>-NNN`** (`<LANE>` = the worktree/branch suffix, uppercase), counting from 001 within
  that file alone. `qa/issues.jsonl` keeps its meaning and numbering for main-tree work.
- **Every reader treats the union of `qa/issues.jsonl` and `qa/issues.*.jsonl` as the ledger** — the
  checker sweep, the tracker audit, any open-issue count. A lane file is a shard, not a private copy.
- **Lane ids are never renumbered on merge.** That permanence is the point: it is what keeps every
  manifest, verdict and commit message that cites an id correct forever.

Measured rationale (both loops allocated ISS-100/102/103 the same day and gave different ids to the
same findings — speaker-seam issues ISS-093/095/097/098 in `lane/a-speakers` live in the canonical
ledger as ISS-104/106/108+111/109; D-015 measurement depends on ids resolving to the right row;
renumbering rejected as rewriting ids other lanes cite): D-019. The same collision hit DECISIONS
itself — `append_decision.ps1` refused the non-sequential id, which is the guard the issue ledger
lacks.

### Mutation-run safety (2026-09-08, authorized by D-020)

Every mutation run — maker or checker — must:

- **wrap the test command in a `timeout`**, and
- **restore from a byte backup in a trap that fires on timeout, interrupt AND error**, never only on
  the success path, then verify with `cmp`.

**Why.** A hand-rolled harness mutated a redirect loop to a genuinely infinite loop: the suite
**hung rather than failed**, had to be killed manually, and **the mutant was left applied on disk**
until restored from backup — the same hazard class as ISS-083. `scripts/lib/mutate.mjs` provides an
arm/restore ledger that `assert-clean` checks against HEAD. Prefer it over hand-rolled
`sed`/`python` mutation; if you hand-roll, the two rules above are the minimum.