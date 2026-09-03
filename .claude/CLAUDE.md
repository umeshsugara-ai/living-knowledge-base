# PROJECT RULES — Lab Protocol active
(extends the user-global CLAUDE.md; on conflict, this file wins)

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
- Enforcement paths (`.claude/hooks/*`, `scripts/append_decision.ps1`,
  `.claude/settings.json`): Changes-authorized alone is NOT enough — the authorizing
  entry MUST carry `**Approved-by:** Umesh`, recorded only after explicit confirmation.
- This file (project CLAUDE.md): only via /compound with the Approver's approval.

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
- Full feature catalogue: `C:\Users\Lenovo\.claude\plans\thik-hai-and-you-nested-cat.md`.
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
