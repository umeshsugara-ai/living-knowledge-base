# QUEUE — top-3 recommended next units (checker sweep 2026-09-08T17:46Z, Mode B)

> Range: `2ff88bb..d265833` (last sweep stamp `2026-09-08T13:05:00Z`). Bound root `D:/KnowledgeBase`;
> the three sibling worktrees (`a-speakers`, `b-golden-set`, `c-unrun-writers`) were **read** for
> bypass detection and pair-state reconciliation and **not modified**.
> **Terminal state: FINDINGS: 7** — ISS-129…ISS-135.
> Written by this sweep: `qa/issues.jsonl`, `qa/QUEUE.md`, `qa/.last-sweep`, and the mandated
> `Answered:` lines on two gate files (checker/SKILL.md Mode B check 6). Nothing else.

**Bypass detection: CLEAN on master.** Four source-touching commits since the last sweep
(`59d0579`, `ddf2543` → `qa/manifests/vector-cosine-retriever.md`; `0e4fd53`, `1df3290` →
`qa/manifests/promote-tree-entities.md`). Every one maps to a manifest that names its unit. No
repeat of the `guarded-fetcher` heredoc-deny bypass in this tree.

**Maker liveness: HEALTHY, not asleep.** `qa/.last-tick` stamped `2026-09-08T21:10:00Z` and
`d265833` landed minutes before this sweep. `promote-tree-entities` sits at `ready-for-check`
cycle 2 with a cycle-1 FAIL verdict against it — that is an *in-flight* dispatch, well inside the
20-minute window, **not** a dispatch gap. No `qa/.paused`.

**The four human downgrades hold — I checked the code, not the reasons.** `C2`/`C3` (`/ask` page):
grep for `history|filter|evidence mode|suggested` across the ask page returns nothing, so
"a single stateless query box" is accurate and the `_(auto: REAL, lowered)_` marker is earned.
`B3`/`B10` (speakers): the only `role` hits under the speaker pipeline are LLM chat-message roles in
`packages/index/src/pipeline/speakers-llm.ts:94-95`; no org and no role is extracted anywhere, so
"only aliases and confidence are emitted" holds. **No feature's probe would now over-credit it.**
`B10`'s row renders as bare `PARTIAL` without the `_(lowered)_` marker only because its probe
already returned PARTIAL — the manual verdict agrees with the probe rather than overriding it.

## Top-3

1. **`ledger-shard-union-readers`** — *maker work, no human. Tier 2 (two open high issues).*
   **ISS-129 + ISS-130.** D-019 declares that "every reader … treats the union of `qa/issues.jsonl`
   and `qa/issues.*.jsonl` as the ledger", and **no reader does**:
   `scripts/lib/tracker-audit.mjs:95` and `.claude/hooks/mc-sessionstart.ps1:5` each open the single
   file by name. `qa/issues.c-unrun-writers.jsonl` — whose `ISS-C-UNRUN-WRITERS-005` is *cited by
   D-020* — is counted by nothing and surfaced by nothing. Make both readers glob, with a test that
   drops a synthetic `qa/issues.testlane.jsonl` row and asserts the open count moves.
   Then close the other half: only `c-unrun-writers` has adopted a shard, so `a-speakers` and
   `b-golden-set` still draw from master's `ISS-NNN` sequence and the collision D-019 abolished
   "by construction" remains possible in two lanes.
   ⚠ **Needs its own DECISIONS entry with `Approved-by`** — D-019's `Changes-authorized` names only
   `.claude/CLAUDE.md`, and `mc-sessionstart.ps1` is an enforcement path.

2. **`divergence-mapping-correction`** — *maker work, bookkeeping only, no code. Tier 2 (high).*
   **ISS-132.** The mapping table in `qa/gates/ledger-id-divergence.md` — the artifact D-019
   deliberately preserved as "the historical record of what the shared counter cost" — is wrong in
   two places, re-derived from the ledger this sweep: `ISS-097 → ISS-108/111` should be `→ ISS-111`
   alone (`ISS-108` is an unrelated gazetteer residue), and **`ISS-101` and `ISS-111` are
   byte-identical findings** — a duplicate created by *this gate's own row-1 remedy* for the ISS-100
   collision. `ISS-093 → ISS-104` is unevidenced and should be proven or withdrawn. Do **not**
   renumber (D-019 forbids it); mark one of ISS-101/111 `duplicate-of` the other and fix the table.
   This sweep appended the re-derivation to the gate but left the original table byte-intact —
   correcting the historical record is the maker's edit to make, not the checker's.

3. **`d015-reproduction-block`** — *maker work, no human. Tier 3 (medium, but it is rule rot).*
   **ISS-134.** D-015 requires a fix to be measured against its issue's **own** recorded
   reproductions with the count reported by issue id. Only 2 of the 6 manifests filed since comply
   (`vector-cosine-retriever`, `vector-gap-record`); `vector-gap-tenant-id`, `chunk-backfill`,
   `index-skip-surfacing` and today's `promote-tree-entities` report none — while `qa/.last-tick`
   asserts compliance in prose. Add a required **"Reproductions re-run"** block to the manifest
   template (one line per addressed issue id: *N of M re-run, result*) and have the checker return
   `CONTRACT_MISMATCH` when a manifest claims `Issues addressed` without it. A rule enforced only
   when a checker remembers is a convention, not a gate.

### Cheap, do in passing

- **ISS-133** (medium) — `qa/manifests/speaker-verbatim-token-boundary.md` reads
  `ready-for-check (cycle 3)` **on master** against a `Cycle checked: 1` FAIL. The 17:25 tick's
  close-out is real but landed on `lane/a-speakers` only. Merge the lane, or carry the one status
  flip. A close-out in a lane is not a close-out in the tree the hook reads.
- **ISS-135** (medium) — `docs/PROGRESS.md` still prints "**EDITED SINCE COMMIT** … this score is
  not the one the repository supports", but `.goal/catalogue.json` and `docs/PROGRESS.md` were
  committed *together* in `2ff88bb` and both are clean. **28.1% is in fact supported**; the banner
  is stale and frozen into the render. Regenerate, and move the dirty-check out of the render into
  the commit path (or stamp the catalogue's blob hash so a reader can verify it).

### Gates still open on disk — no maker work possible on these

| Gate | State |
|---|---|
| `vector-retrieval-contract.md` | **`Answered: (pending)`** — genuinely open, raised 20:30 today. Asks for `/checker init-contract vector-retrieval`; contract creation is a human-gated START action and **U1.5 must not start without it** (it would inherit 0.935 as the input to a `≥0.85` criterion over a directory with no criteria). |
| `loop-safety-contract-ratification.md` | **`Answered: (pending)`** — ratify or demote `loop-safety.md` C7/C8, which a checker wrote itself beyond D-014's scope. ISS-131 is fresh evidence *for* C8. |
| `ledger-id-collision.md` · `ledger-id-divergence.md` | **Answered by this sweep**, citing D-019 / `05b93cc` (ISS-131). Were answered off-disk — the D-006 pattern, caught again. |
| `mongo-host-unreachable.md` | Self-resolved 2026-09-08. Minor hygiene: it still carries a stale `Answered: (pending)` at line 61 *above* its real resolution at line 63. |
| `concurrent-maker-sessions.md` · `golden-set-redesign.md` | Answered on disk ✅ |
