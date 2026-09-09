# QUEUE — top-3 recommended next units (checker sweep 2026-09-09T08:10Z, Mode B)

> Range: `169efb3..f3cbe03` (31 commits; the concurrent loop landed `2abc1c9` during the sweep —
> read, not swept). Bound root `D:/KnowledgeBase`; the three sibling worktrees (`a-speakers`,
> `b-golden-set`, `c-unrun-writers`) were **read** for ledger-union and pair-state reconciliation
> and **not modified**.
> **Terminal state: FINDINGS: 2** — ISS-160 (high), ISS-161 (medium), plus an in-place re-measure
> on ISS-130.
> Written by this sweep: `qa/issues.jsonl`, `qa/QUEUE.md`, `qa/.last-sweep`. Nothing else.

## HUMAN_GATE — open, blocking

- `qa/gates/ledger-shard-union-hook.md` — **the only genuinely open gate.** Enforcement-path change
  (`.claude/hooks/mc-sessionstart.ps1:5` is still `$LEDGER = 'qa/issues.jsonl'`), so per the project
  CLAUDE.md it needs a `docs/DECISIONS.md` entry carrying **`Approved-by: Umesh`**. Unfixed half of
  ISS-129; `scripts/lib/tracker-audit.mjs` already globs the union.

**The previous queue's gate section was stale and is corrected here.** Both
`loop-safety-contract-ratification` and `vector-retrieval-contract` were **answered 2026-09-09**
("Option 1" in each, Umesh in session, recorded on disk at `be387e0` with explicit provenance that
it was a general "go with whatever is best" rather than a clause-by-clause ruling) and both have
already been acted on — D-022 (`3c85e9a`, `Approved-by: Umesh`) ratifies loop-safety C7/C8, and
`ad6e7b7` / `09f8997` drafted the `vector-retrieval`, `entity-promotion` and `hybrid-retrieval`
contracts. Neither was answered off-disk. They still *read* as pending to a first-match grep because
each file retains a superseded `**Answered:** _(pending)_` line above its real answer — that is
ISS-161, and it is what made this sweep's own dispatch instruction wrong about them.

Answered/closed: `concurrent-maker-sessions`, `golden-set-redesign`, `ledger-id-collision`,
`ledger-id-divergence` (both via D-019), `mongo-host-unreachable` (self-resolved),
`loop-safety-contract-ratification`, `vector-retrieval-contract`.

## Top-3 recommended next units

1. **`aios-write-guard-lab-config-hole`** (ISS-160, high — tier 2). The three-into-one hook merge
   left `CLAUDE.md` and `.claude/rules/**` **silently allowed inside every Lab Protocol repo**,
   including this one: CHECK 2 is skipped whenever `$protocolRoot` is non-empty, but CHECK 1's
   enforcement list covers only `.claude/hooks/`, `.claude/settings.json` and
   `scripts/append_decision.ps1`. Probed empirically in both directions. The guard file is
   **outside this repo's bound root**, so the unit here is the repo-side half: a superseding
   DECISIONS entry correcting D-023's "Protection is unchanged" claim, which its own three-path
   parity test could not have substantiated. Full ceremony — enforcement path.
2. **`gate-answered-line-uniqueness`** (ISS-161, medium — tier 4, but cheap and it is currently
   misinforming the loop). Strike or annotate the superseded `Answered: (pending)` line when a gate
   is answered, so each gate file has exactly one. Verified cost of not doing it: this sweep was
   dispatched to chase two closed gates.
3. **The next unblocked roadmap task** (tier 3, `.goal/goal.json` `pending` with deps met). U1.5 is
   in flight at fix cycle 3 of 3 in the concurrent loop and must not be touched; the U2.1 successors
   and the newly-contracted `entity-promotion` / `vector-retrieval` layers are the honest next pull
   now that both contracts exist. **Do not** open a fourth round on the U1.5 merge seam from this
   queue.

## Ledger union (D-019 re-measure, 2026-09-09)

| Tree | Files | Rows | Parse errors | Dup ids | Open by severity |
|---|---|---|---|---|---|
| master | `issues.jsonl` (163) + `issues.c-unrun-writers.jsonl` (22) | **185** | 0 | 0 | 1 critical · 7 high · 22 medium · 18 low |
| `a-speakers` | `issues.jsonl` only — **no shard** | 103 | 0 | 0 | 4 medium · 10 low |
| `b-golden-set` | `issues.jsonl` only — **no shard** | 86 | 0 | 0 | 2 high · 1 medium · 6 low |
| `c-unrun-writers` | `issues.jsonl` (117) + shard (22) | 139 | 0 | 0 | 1 critical · 1 high · 4 medium · 16 low |

Master canonical is `ISS-001..ISS-161` contiguous plus the two lane-shaped ids ISS-143 recorded.
**ISS-130 collision re-measure:** `a-speakers` next allocation `ISS-104` collides with **56**
existing master rows (was 38 — the window grows monotonically with every master row);
`b-golden-set` next allocation `ISS-087` collides with **73**. `c-unrun-writers` holds the shard but
its canonical file sits at ISS-117 against master's ISS-161, so a canonical allocation there would
collide with 44. Two of three lanes still have not adopted D-019.

## Concurrent-write damage — checked, NONE reached this repo

The shared-config corruption seen this session (`C:/Users/Lenovo/.claude/settings.json` overwritten
twice, once reverting the hook change and once dropping 101 of 108 `permissions.allow` rules) did
**not** reach anything under `D:/KnowledgeBase`. Measured, not assumed:

- `docs/DECISIONS.md` is **additions-only across the whole range** — `git diff --numstat` reports
  `16  0`, and a `grep -c` for removed lines over the range diff returns **0**. Only two commits
  touch it (`3c85e9a` +8, `e045cb8` +8), each a single appended entry.
- `.claude/settings.json` lost exactly the 10 lines D-023 authorizes and nothing else; the file is
  valid JSON and `mc-precommit.ps1` remains registered under `PreToolUse` matcher `Bash|PowerShell`.
  All `SessionStart` / `SessionEnd` entries intact.
- `qa/issues.jsonl` row count is **monotonically non-decreasing** across every commit that touches
  it (143 → 145 → 148 → 148 → 152 → 152 → 155 → 157 → 158 → 159 → 161): no truncation, no lost
  rows. The 139 deleted lines in the range diffstat are in-place status/evidence updates to existing
  rows, not removals.
- `C:/Users/Lenovo/.claude/settings.json` currently holds **112** allow rules and the single
  `aios-write-guard.ps1` PreToolUse registration — the restore from
  `settings.json.bak-2026-09-09` held.

## Pair-state

- `speaker-verbatim-token-boundary` — **unmerged-lane artifact; master needs no action.** Master's
  manifest is `ready-for-check` cycle 3 and master's verdict *does* carry `Cycle checked: 3`
  (line 424, commit `62c4637`), so the handshake is matched — a fix gap by the letter, not a
  dispatch gap. `lane/a-speakers` has already flipped it to
  `superseded-by speaker-denylist-ledger-corpus (STALLED at cycle 3 of 3)`, and that branch is
  unmerged. It resolves on merge. Third sweep to rule the same way; not re-filed.
- `issue-ref-disambiguation` — `ready-for-check` cycle 3, out for a check right now. **Not touched.**
- `hybrid-merge` — `Fix cycle: 3 of max 3`, cycle-3 work in flight in the concurrent loop
  (`2abc1c9`, tick 03:40Z). **Not touched.** A further FAIL is STALLED and stops for the human.
- All other manifests are `checked-PASS` with cycle numbers matching their verdicts.

## Normal duties

**Bypass detection CLEAN.** All 10 source-touching commits in the range map to a manifest naming
their unit (`b90e206` / `a8c3dce` → `hybrid-merge`, `0d7dcc9` / `3380e84` / `ccd81d4` →
`issue-ref-disambiguation`, `9a2226f` / `683fe25` / `26fc450` → `entity-id-tenant-namespace`,
`e34ddce` → `divergence-mapping-correction`). `f3cbe03` "wip iss-158" is the in-flight hybrid-merge
cycle-3 work, superseded minutes later by `2abc1c9` which names its unit — not filed as a bypass.
Maker **live** (tick 03:40Z), no `qa/.paused`, no undiagnosed STALLED / EXHAUSTED stamp. Feedback
inbox fully folded. `qa/.regrill-due` absent, no `GRILL:` row raised. Every verdict in range is
tracked and committed. Reopen-power **not exercised** — no PASSed unit's claim was found unbacked.

**Was the machine-wide hook change a maker-checker unit, and should it have been?** It was not, and
the answer splits. The **in-repo half is correctly governed**: D-023 exists, carries
`Approved-by: Umesh`, and its `Changes-authorized` ("remove the redundant PreToolUse
decisions-append-guard registration only; mc-precommit.ps1 and all SessionStart/SessionEnd entries
unchanged") describes `e045cb8`'s diff exactly — 10 lines removed, one registration, nothing else.
The **out-of-repo half should have had a check.** It is an enforcement-path change, which this
repo's own severity gate routes to full ceremony regardless of severity, and the specific thing a
fresh checker does — re-derive rather than trust, probe the paths the author did not choose — is
precisely what would have caught ISS-160. The author's parity test was real and was run; it just
tested the three paths that happen to survive. That is the D-015 failure shape in a new place: a
change measured against a corpus its own author chose.
