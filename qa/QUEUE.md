# QUEUE — top-3 recommended next units (checker sweep 2026-09-09T13:25Z, Mode B)

> Range: `39e3464..fef1548` (24 commits). Bound root `D:/KnowledgeBase`; the sibling worktrees were
> **read** for ledger-union only and **not modified**.
> **Terminal state: FINDINGS: 5** — ISS-200 (high), ISS-201 (high), ISS-202 (high), ISS-203
> (medium), ISS-204 (medium).
> Written by this sweep: `qa/issues.jsonl`, `qa/QUEUE.md`, `qa/gates/handshake-liveness-contract-start.md`,
> `qa/.last-sweep`. Nothing else. `.goal/goal.json` and `docs/SNAPSHOT.md` deliberately untouched.
> One Mode A check (`delivery-gate-manifest-blindness` cycle 3, manifest 8 min old) was **in flight
> and not touched** — 20-minute rule.

## Sweep check 1 now runs `scripts/lib/dispatch-state.mjs` — ADOPTED

The sweep's own pair-state reconciliation was performed this tick by
`sweep(root)` from `scripts/lib/dispatch-state.mjs`, not by a hand-rolled grep. **It earned it on
this run:** a naive first-`Cycle checked` read reports `speaker-verbatim-token-boundary` as pending
at cycle 3 with a cycle-1 verdict; the module reports `complete` at cycle 3, which is correct and
matches what the last four sweeps had to establish by hand each time. Its own 16 tests pass.

**One bound, and it is not optional.** The module reports
`delivery-gate-manifest-blindness: not-dispatched` for a check that is demonstrably in flight,
because **no writer is wired** — nothing calls `record()`, and `qa/dispatch/` does not exist. So the
reader is adopted **for reporting only**. A sweep or hook that dispatched on `not-dispatched` today
would cause the exact duplicate-concurrent-check collision of 2026-09-09, not prevent it.
**ISS-178 stays open**, and its remaining scope is now precisely: wire the writer, then permit
dispatch on this signal.

## HUMAN_GATE — open, blocking

- **`qa/gates/handshake-liveness-contract-start.md` — NEW this sweep.** START approval for
  `qa/contracts/handshake-liveness.md`. This was a QUEUE row only until now; a gate that exists
  only in a queue is the D-006 loop, so it is on disk. It also records this sweep's **confirmation**
  that ISS-196 and ISS-199 are one problem (a machine-read field recovered from free-form prose) and
  that **ISS-199 should not be fixed as written** — no fourth stripper round.
- **`qa/gates/enforcement-hooks-unauthorized-and-live-regressed.md` — answer it, but read ISS-200
  first.** Its section 2 no longer describes the working tree.
- **`qa/gates/mc-hooks-manifest-blindness.md` — genuinely open, genuinely separate.** See the ruling
  below.
- **`qa/gates/ui-surfaces-test-file-exclusion.md` — NEW, non-blocking.** Raised by the
  `vacuous-evidence-probes` cycle-1 checker: should `qa/ui-surfaces.json` exclude `*.test.*` from
  the D-024 browser trigger? A test-only unit tripped the live-browser gate on the `.tsx` extension
  alone. Checker recommends APPROVE; it is a gate weakening read by `delivery-gate-stop.ps1`, so it
  needs `Approved-by: Umesh` in a DECISIONS entry, not a checker's edit. **Nothing is blocked on
  it** — that unit PASSed on an explicit not-applicable ruling.
- `qa/gates/ledger-shard-union-hook.md` — still `(unanswered)`. Unfixed half of ISS-129.
- `qa/gates/d023-supersede.md` — still no `Answered:` line at all. ISS-168.
- ISS-174 (contract `[C3]` wording) — still no gate file. Open one or fold it into the d023 answer.

### RULING — the two enforcement gates must NOT be merged

They look overlapping and are not. They concern **different files in different repositories under
different rules**, and merging them would produce one gate that cannot be answered with one decision.

| | `enforcement-hooks-unauthorized-and-live-regressed` | `mc-hooks-manifest-blindness` |
|---|---|---|
| Files | `D:/ai_os/.claude/hooks/delivery-gate-stop.ps1`, `edit-in-place-guard.ps1` | `D:/KnowledgeBase/.claude/hooks/mc-sessionstart.ps1`, `mc-precommit.ps1` |
| Repo | `D:/ai_os` — **outside this bound root** | this root |
| Rule invoked | machine-wide hooks running unreviewed from a working tree | project CLAUDE.md "Update Authorization": Lab enforcement path, needs `Approved-by: Umesh` |
| The ask | *commit or revert what is live; retro-authorize `4a71633`* | *may these two files be changed at all* |
| Verified | `git status` in `D:/ai_os` — 2 files modified | the two files exist here and carry the bare literal |

`mc-hooks-manifest-blindness` names `delivery-gate-stop.ps1` only to say it is **not** a Lab
enforcement path and therefore needed no gate — that is a disclaimer, not an overlap. Answering one
"A" does not answer the other in either direction. **Keep both.** The real defect the merge question
was reaching for is different and now filed: **ISS-201** — `edit-in-place-guard.ps1` is listed by
filename in one gate and described by neither, while its live uncommitted diff allowlists `\qa\` and
`\.goal\` and so silently disables the drift guard over this repo's entire governed surface.

## Top-3 recommended next units

1. **`vacuous-tenancy-assertion` — ISS-202 item 3 (high, SECURITY CLASS, uncapped).**
   `apps/api/src/indexing/promote-entities.test.ts:86-95`, the test named *"ISS-126: every write is
   tenant-scoped on filter and body"*, has three escape hatches: the filtered array is never
   asserted non-empty; the body check is gated on `if ("tenantId" in body)`, so an implementation
   that drops `tenantId` from `$set` entirely **passes** (the ISS-156 mutation this same file
   documents as having survived); and the filter half of its own name is never checked. Tenancy →
   full ceremony, no round cap. Backlog tier 2.

2. **`vacuous-evidence-probes` — ISS-202 items 1 and 2 (high).**
   `qa/evidence/live-rank-probe-2026-09-08.mjs:16-22` compares `lexicalSearchTurns`' output against
   the array it was built from, so its `0 mismatches` is true by construction — and it never calls
   `createMongoSearchDeps`, the store ISS-083/084 were defects *in*. It is standing evidence for a
   claim it cannot support. `apps/web/src/pages/AskPage.test.tsx:140-147` never submits the form its
   assertion is about. Both one-line fixes; medium ceremony. Backlog tier 2.

3. **`T-021` — golden set 50-100 Qs + recall@k report (target recall@5 ≥ 0.85).**
   Backlog **tier 3, the roadmap tier that is not optional**. Deps `['T-002']` are met; it is the
   lowest-numbered pending task with satisfied deps. Pulled deliberately: tiers 1-2 above are two
   units, and the D-013 override exists precisely so a tick does not spend its third slot on another
   medium-severity polish item.

**Not units, on purpose:**
`ISS-204` (SNAPSHOT / `lint:structure` RED) — **ownership ruled, no ceremony**: the next maker tick
that closes *any* unit regenerates `docs/SNAPSHOT.md` and commits it under a narrow
`-- docs/SNAPSHOT.md` pathspec as part of that close-out. The one objection ("regenerating sweeps
other sessions' content into my commit") is answered entirely by the narrow pathspec.
`ISS-199` — **held, do not fix as written**; it waits on the handshake-liveness gate above.
`ISS-203` — needs the same human START; the sweep declined to author the criterion itself.

## Concurrency — checked, not colliding

`qa/.last-tick` commit timestamps are **strictly monotonic** over the last 12 stamps
(07:49 → 07:58 → 09:03 → 09:39 → 11:36 → 11:40 → 11:43 → 11:59 → 12:11 → 12:50 → 13:08 → 13:14).
No out-of-order stamp, no lost tick. The earlier duplicate concurrent check on
`delivery-gate-manifest-blindness` cycle 1 is visible in history as two verdict sections, and both
were retained per the INDEPENDENT CONCURRENT CHECK rule — the mechanism worked. The structural cause
is unfixed and is exactly ISS-178's unwired writer, above. This sweep did not touch the in-flight
cycle-3 unit.

## Ledger — union, D-019

`qa/issues.jsonl` 206 + `qa/issues.c-unrun-writers.jsonl` 22 = **228 rows, 228 distinct ids, 0
duplicates, 0 parse errors**, canonical sequence `ISS-001..ISS-204` with **no gaps**. Open before
this sweep: 66 (1 critical / 15 high / 29 medium / 21 low). Reopen-power **not exercised** — no
PASSed unit's claim was found unbacked this sweep.

**ISS-161 is still live.** `qa/gates/loop-safety-contract-ratification.md` and
`vector-retrieval-contract.md` still carry `**Answered:** _(pending)_` *above* their real answers.
Readers must take the **last** `Answered:` line. The new gate file added this sweep has exactly one,
and it is last.
