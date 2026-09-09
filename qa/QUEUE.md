# QUEUE — top-3 recommended next units (checker sweep 2026-09-09T16:36+05:30, Mode B)

> Range: `6aed4fb..42f4253` (29 commits). Bound root `D:/KnowledgeBase`.
> **Terminal state: FINDINGS: 1** — new ISS-242. Also: ISS-217 fixed by restoring the
> one-line sweep stamp; ISS-241 independently re-checked and moved fixed → verified.
> Bypass detection clean; tracker G1 green; dispatch-state 16/16; decisions additions-only;
> maker live; no untracked verdicts; no production-source change in range, so the silent-failure
> hunt found no new production exposure. The in-flight root edit to `scripts/eval-recall.mjs` and
> its modified `.goal/goal.json` were not touched.

## Current top 3

1. **T-021 / golden-set embedding ambiguity — build now.** The cycle-3 PASS explicitly leaves a
   bounded question↔session cosine pass as unblocked maker work. ISS-242 corrects only the stale
   gate routing: ISS-093 is fixed; semantic sibling ambiguity remains to be measured. **Tier 1.**
2. **U2.4 / ISS-104 — finish speaker resolution without guessing.** This is the only open critical
   ledger row and the goal task is already `in_progress`; preserve the rule that low-confidence
   speakers remain unresolved. **Tier 1, security/data-integrity class.**
3. **U3.1 — close the real live-browser exit, not only the component-test slice.** The goal still
   marks Ask in progress because the remaining proof is a real question through the live API with
   at least one speaker+timestamp citation linking to a real session page. **Tier 1, UI Mode D.**

## Existing fix gap (not promoted over roadmap work)

`delivery-gate-stamp-adoption` remains `ready-for-check` cycle 1 against a cycle-1 FAIL. Its open
ISS-227/228/229 findings already describe the next fix, and the affected enforcement-path
authorization remains an explicit human gate. No duplicate issue was filed in this sweep.

## Previous sweep detail (superseded as routing; retained for audit context)

> Range: `6d4f8e8..af7798d` (274 commits since the stamp's FIRST line; 24 since its last).
> Bound root `D:/KnowledgeBase`. `D:/KnowledgeBase-lanes/*` and `D:/ai_os` were **read only**.
> **Terminal state: FINDINGS: 8** — ISS-214..ISS-221, plus three open highs closed as stale
> (ISS-176, ISS-177, ISS-182).
> Written by this sweep: `qa/issues.jsonl`, `qa/QUEUE.md`, `qa/gates/d015-generalisation-scope.md`,
> two `Answered:` corrections in `qa/gates/`, `qa/.last-sweep`. Nothing else.
> One Mode A check (`delivery-gate-stamp-adoption`, ISS-205) was **in flight and not touched**,
> nor was `D:/ai_os/.claude/hooks/delivery-gate-stop.ps1`.

## The two stalls: judged, and the generalisation is HALF right

`qa/debug/delivery-gate-manifest-blindness-cycle3.md` claims both stalls share one root cause —
*"the artifact that decides whether the fix is correct was authored by the author of the fix"* —
and proposes widening D-015 from the *corpus* to *"the corpus, the specification, and the instrument"*.

- **INSTRUMENT limb: upheld.** Four self-chosen judges in one unit (fixtures → oracle → bound →
  mutant set), each defect found by an independent party, each satisfying D-015's letter. A real
  gap in a real rule.
- **SPECIFICATION limb: refuted.** `qa/contracts/write-guard.md` has exactly one commit, `d703897`,
  a **checker** commit, and says so in its own header. The specification was written by the
  independent party and was still wrong. Its defect is different: [C1] contradicts [I2], and
  neither covers the undecidable third state (`grep` for fail-closed language → 0 hits).
- **Consequence:** this is **two rules, not one**, and conflating them aims the remedy (more
  independence) at the seam that already had it. Escalated as `qa/gates/d015-generalisation-scope.md`
  (ISS-220), which asks the Approver for A, B, both, or neither.

## HUMAN_GATE — open, blocking (7, was 8)

| gate | state | note |
|---|---|---|
| `d015-generalisation-scope.md` | **NEW, unanswered** | blocks a rule, not a build; A/B/both/neither |
| `delivery-gate-c4-heading-form.md` | unanswered | blocks `delivery-gate-manifest-blindness` (STALLED); 3 of its 5 failures collapse here |
| `d023-supersede.md` | unanswered | decision-log accuracy only; no build blocked |
| `ui-surfaces-test-file-exclusion.md` | **NEW, unanswered** | exclude `*.test.*` from the D-024 browser trigger? checker recommends APPROVE; gate weakening, so needs `Approved-by`. **Nothing blocked** |
| `handshake-liveness-contract-start.md` | unanswered | START for `qa/contracts/handshake-liveness.md`; blocks the ISS-178 reader half |
| `ledger-shard-union-hook.md` | unanswered | **same file as the next row** — see ISS-214 |
| `mc-hooks-manifest-blindness.md` | unanswered | **same file as the row above** — merge into one decision |
| `enforcement-hooks-unauthorized-and-live-regressed.md` | `Answered: (pending)` | **premise overtaken** — see ISS-200 and ISS-219; section 2 no longer describes disk |
| ~~`loop-safety-contract-ratification.md`~~ | **ANSWERED** | stale `_(pending)_` above the real answer — corrected this sweep (ISS-161 recurrence) |
| ~~`vector-retrieval-contract.md`~~ | **ANSWERED** | same defect, same correction |

`concurrent-maker-sessions`, `golden-set-redesign`, `ledger-id-collision`, `ledger-id-divergence`,
`mongo-host-unreachable` are answered and stay answered.

## Stale-premise audit — three highs closed, two re-aimed

| issue | premise | state |
|---|---|---|
| ISS-176 | `delivery-gate-stop.ps1` cannot match a bolded Status | **STALE → fixed.** :160 now `^[\s\-*#>\|]*Status:`. Authorization residual is ISS-189 alone. |
| ISS-182 | cycle-3 fixtures uncommitted in `D:/ai_os` | **STALE → fixed.** Committed at `bbabf41`; `git status` is clean for that path. |
| ISS-177 | the 16h continuation-gap figure is false | **STALE → fixed.** D-026 (`d5cde7b`) corrects the premise and withdraws D-025. |
| ISS-201 | `edit-in-place-guard.ps1` "uncommitted, live on every session" | **PREMISE EXPIRED.** Not registered anywhere → not live. Re-aimed as **ISS-219**. |
| ISS-190 | *three* hooks uncommitted in `D:/ai_os` | **PARTLY STALE.** Now two (`delivery-gate-stop`, `edit-in-place-guard`); the fixtures file is committed. |
| ISS-129 | no ledger reader implements the D-019 union | **HALF DONE.** `tracker-audit.mjs:47-51` reads the union; `mc-sessionstart.ps1` still reads one file — that half is `ledger-shard-union-hook`. |
| ISS-183 | `mc-sessionstart`/`mc-precommit` blind to bold | **HOLDS.** Both still carry the literal `'Status: ready-for-check'` (`:15`, `:43`). |
| ISS-104 | critical; naming-cue rule does not close C2b | **HOLDS.** D-015's own measurement (15/20) is the reason. |

## Enforcement-path authorisation — the three sets, and where they disagree

**(a) Registered** in `~/.claude/settings.json` (7): `aios-write-guard`, `precompact-snapshot`,
`delivery-gate-stop`, `anti-drift-session-start`, `evaluate-due-session-start`, `lab-session-start`,
`lab-session-end`.
**(b) Committed** in `D:/ai_os` (11 + fixtures): those 7 plus `config-protection`,
`decisions-append-guard`, `edit-in-place-guard`, `external-skill-guard`.
**(c) Covered by an authorizing DECISIONS entry with `Approved-by: Umesh`:** `mc-sessionstart` +
`mc-precommit` (D-006), `features-snapshot-session-end` (D-009), the hook command strings (D-010),
`decisions-append-guard` + `lab-session-start` (D-011), `mc-precommit` deny branch (D-017), ledger
path (D-020), `delivery-gate-stop`'s fifth BROWSER predicate (D-024). D-025 authorized the maker
predicate and **D-026 withdrew it.**

Disagreements:
1. **(a) ∖ (b) — none.** Every registered hook is tracked. But **two registered hooks are dirty**
   (`delivery-gate-stop`, `edit-in-place-guard`), so what runs is not any reviewed commit — ISS-190.
2. **(b) ∖ (a) — four dead hooks** (`config-protection`, `decisions-append-guard`,
   `edit-in-place-guard`, `external-skill-guard`). Only `decisions-append-guard`'s de-registration is
   documented (D-026). `anti-drift/SKILL.md:34` still tells auditors to verify a registration that
   does not exist — ISS-216.
3. **(a) ∖ (c) — `delivery-gate-stop.ps1`'s maker predicate is UNAUTHORIZED at HEAD.** D-025 was the
   only entry covering it and D-026 withdrew that authorization; `4a71633` still stands — ISS-189.

**Is `D:/ai_os`'s lack of `docs/DECISIONS.md` a governance gap? No — correctly out of scope, with one
caveat.** `D:/ai_os` is a shared toolchain, not a research repo; the Lab Protocol's `Approved-by`
rule is a *this-repo* rule and the project CLAUDE.md is explicit that it governs `raw/TOC/` and its
own enforcement paths. The rule already reaches these hooks by the right route: it binds the
*change*, not the *repo*, because `.claude/hooks/*` in the Update Authorization section is read as
"the enforcement paths this repo depends on", which is how D-024 came to name a `D:/ai_os` path in
its `Changes-authorized` field. **The caveat:** that reading is convention, not mechanism — nothing
in `D:/ai_os` refuses an unauthorized hook edit, which is exactly how `4a71633` shipped. Do not fix
this by installing the Lab Protocol in `D:/ai_os`; fix it, if at all, by having the delivery gate
refuse to end a session in which a registered hook file was edited without a matching D-entry.

## Ledger union (D-019)

| tree | files | rows | distinct ids | dup ids | parse errors | open (crit/high/med/low) |
|---|---|---|---|---|---|---|
| master | `issues.jsonl` + `issues.c-unrun-writers.jsonl` | 223 + 22 = **245** | 245 | **0** | 0 | 1 / 16 / 36 / 23 |
| lane `a-speakers` | `issues.jsonl` | 103 | 103 | 0 | 0 | 0 / 0 / 4 / 10 |
| lane `b-golden-set` | `issues.jsonl` | 86 | 86 | 0 | 0 | 0 / 2 / 1 / 6 |
| lane `c-unrun-writers` | `issues.jsonl` + shard | 117 + 22 = **139** | 139 | 0 | 0 | 1 / 1 / 4 / 16 |

**ISS-130 re-measured.** The two shardless lanes still carry an un-namespaced `qa/issues.jsonl`.
Cross-tree collisions (same id, *different finding*): `a-speakers` **2** (ISS-102, ISS-103 —
speaker-seam findings on master, script-hygiene findings in the lane); `b-golden-set` **0**;
`c-unrun-writers` **0**. Both lanes are otherwise strict prefixes of master, so the exposure is
frozen at 2 and D-019 forbids renumbering — correct, and it should be recorded as closed-at-2
rather than re-measured every sweep.

**But the axis that actually collided today is not the lane axis.** Two concurrent writers in
*this* worktree both allocated ISS-212 and ISS-213 during this sweep. Filed as **ISS-221**; the
sweep's rows were refiled at ISS-219/ISS-220.

## Normal duties

- **Bypass detection:** 274 commits in range, no unit-shaped commit without a manifest. Clean.
- **Pair state:** 119 manifests. Two `STALLED` (both with a `qa/debug/` report — no stall lacks a
  diagnosis). One fix-gap, `speaker-verbatim-token-boundary` — **confirmed for the fifth time** as
  an unmerged-lane artifact and filed as ISS-218 so the sixth sweep does not re-derive it.
- **`docs/DECISIONS.md` additions-only:** `git diff 6d4f8e8..HEAD -- docs/DECISIONS.md` → **169
  insertions, 0 deletions.** Clean.
- **Liveness:** `qa/.last-tick` fresh, no `qa/.paused`. Not asleep.
- **Feedback inbox:** three 2026-09-09 entries unmarked; two were acted on (`de39232`), the third —
  Umesh on human approval vs maker-checker validation — is genuinely unfolded and is in direct
  tension with seven open gates. **ISS-215.**
- **Reopen-power:** not exercised.

## Top 3 — recommended next units

1. **ISS-219 + ISS-201 (high) — settle what the live write guard actually allows.** Re-aim the
   authorization question at the *committed* `aios-write-guard.ps1`, note that the `qa`/`.goal`
   signals are near-inert behind the `sourceExts` gate, and close or restate ISS-201. Cheapest of
   the three and it removes a false high from the priority signal. **Tier 2** (open high).
2. **ISS-215 (high) — fold the Umesh inbox entry, and use it to triage the gate queue.** Seven gates
   are open and three block STALLED units; the entry names the test that sorts them into
   "enforcement-path, genuinely needs the Approver" and "contract/log accuracy, a checker can
   settle". Pair it with ISS-214 (two gates, one file) and present the Approver **one** consolidated
   decision sheet. **Tier 2.**
3. **ISS-221 (high) — make issue-id allocation atomic.** Two agents in one worktree collided on two
   ids inside ten minutes, and the sweep's own dedup guard *silently dropped* its rows. A lockfile
   around read-max-then-append, failing loudly instead of deduping. D-019's shards do not cover
   this axis. **Tier 2.**

**Deliberately NOT queued:** ISS-180 (blocked behind the C1 amendment — gate B), ISS-205 and the C4
gate (under an in-flight Mode A check), ISS-202 (its three fixes are committed and awaiting the
`vacuous-evidence-probes` verdict), ISS-130 (closed at 2 by construction).

| id | unit | severity | status |
|---|---|---|---|
| ISS-219 | write-guard-allowlist-authorization | high | TODO |
| ISS-215 | gate-queue-triage-and-inbox-fold | high | TODO |
| ISS-221 | atomic-issue-id-allocation | high | TODO |
