# QUEUE — top-3 recommended next units (checker sweep 2026-09-09T11:25Z, Mode B)

> Range: `f3cbe03..39e3464` (23 commits). Bound root `D:/KnowledgeBase`; the three sibling
> worktrees (`a-speakers`, `b-golden-set`, `c-unrun-writers`) were **read** for ledger-union and
> pair-state reconciliation and **not modified**.
> **Terminal state: FINDINGS: 3** — ISS-176 (high), ISS-177 (high), ISS-178 (high), plus an
> in-place re-measure on ISS-130.
> Written by this sweep: `qa/issues.jsonl`, `qa/QUEUE.md`, `qa/.last-sweep`. Nothing else.
> Two Mode A checks (`write-guard-enforcement-gaps` cycle 3, `hybrid-arms-binding` cycle 2) were
> in flight and were **not touched**.

## HUMAN_GATE — open, blocking

- `qa/gates/ledger-shard-union-hook.md` — genuinely open, `## Answered` reads
  *(unanswered)*. Enforcement-path change (`.claude/hooks/mc-sessionstart.ps1:5` is still
  `$LEDGER = 'qa/issues.jsonl'`), so it needs a `docs/DECISIONS.md` entry carrying
  **`Approved-by: Umesh`**. Unfixed half of ISS-129.
- `qa/contracts/handshake-liveness.md` — **START approval needed (new contract).** The cycle-1
  check of `dispatch-state-tracking` ruled that the maker-checker handshake mechanics do **not**
  belong under `qa/contracts/loop-safety.md`, whose north star is confined to the loop's mutation
  procedure not damaging what it verifies. Handshake liveness needs its own contract covering
  marker write/derive semantics, the five states, `STALE_MS`, and the reader obligations on
  `mc-sessionstart.ps1` and sweep check 1. Initial contract creation is a human-approved START;
  the checker declined to author it unilaterally, per `loop-safety.md`'s own corrected provenance
  note (*"a checker that can widen its own mandate by writing a contract is a self-certification
  path"*). See `qa/verdicts/dispatch-state-tracking.md`.
- `qa/gates/d023-supersede.md` — genuinely open (**no `Answered:` line at all**, only an
  "## Answer format" section). ISS-168: D-023's Result states something measurably false about
  protection and only the Approver can authorise the superseding entry.
- ISS-174 (contract `[C3]` wording) — a criticality-gated contract amendment; no gate file exists
  for it. Either open one or fold it into the d023 answer.

**Gate-file states, all nine, re-read this sweep.** Answered and acted on:
`concurrent-maker-sessions` (2026-09-08, Option 4), `golden-set-redesign` (2026-09-08, Option C),
`ledger-id-collision` (2026-09-08, per-lane namespaced ids), `ledger-id-divergence` (2026-09-08,
D-019), `mongo-host-unreachable` (2026-09-08, self-resolved),
`loop-safety-contract-ratification` (2026-09-09, Option 1 → D-022),
`vector-retrieval-contract` (2026-09-09, Option 1, both layers).

**ISS-161 is still live and still dangerous.** `loop-safety-contract-ratification.md:89` and
`vector-retrieval-contract.md:52` each still carry `**Answered:** _(pending)_` **above** their real
answer (line 91 and line 77 respectively). A first-match grep reports both gates open. This has
now misled two sweeps' dispatch instructions. Any reader must take the LAST `Answered:` line, not
the first, until the stale lines are struck.

## Top-3 recommended next units

1. **`maker-predicate-bold-status`** (ISS-176, high, enforcement path — needs `Approved-by: Umesh`).
   The Stop-hook gate that item 1 of this sweep is about is *still* half-blind: its
   `Status:\s*ready-for-check` regex cannot match `**Status:** ready-for-check`, which is the form
   every real manifest in this repo uses. Its trace for this repo reads `pend=1`; a bold-aware scan
   reads 2, and the one it does see is an unbolded `##` heading. Same class for
   `\*\*Fix cycle:\*\*` against unbolded manifests. One-line regex fix, but it is an enforcement
   path, so the D-entry comes first.

2. **`checker-dispatch-stamp`** (ISS-178, high). Give the handshake a third state. Maker writes
   `qa/dispatch/<slug>.json` at dispatch; checker deletes it when it commits the verdict. Sweep
   check 1 then separates *never dispatched* from *in flight* from *checker died* — the state that
   cost two verdicts when the previous process exited (`39e3464`). Today those three are one
   indistinguishable absence.

3. **`tick-premise-correction`** (ISS-177, high, documentary). The "16h38m / ~20 ticks" figure in
   `qa/.last-tick` is contradicted by the maker's own transcript — 26 main-chain `ScheduleWakeup`
   calls in that window; the true worst gap is 6h19m. Correct it in the *next* tick (never rewrite
   the stamp) before any DECISIONS entry inherits the wrong number. The real defect is genuine;
   only the measurement is wrong.

## TODO

_(no TODO rows this sweep — the top-3 above are the backlog)_
