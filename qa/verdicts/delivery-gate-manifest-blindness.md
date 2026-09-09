# Verdict — delivery-gate-manifest-blindness

**Cycle checked:** 1
**Date:** 2026-09-09
**Manifest:** `qa/manifests/delivery-gate-manifest-blindness.md` (`Fix cycle: 1 of max 3`)
**Commit under check:** `4119563` (KnowledgeBase) · artifact `D:/ai_os/.claude/hooks/delivery-gate-stop.ps1` @ `4a71633` (ai_os)
**Contract:** `qa/contracts/delivery-gate.md` — **authored by this check** (status `proposed`,
awaiting Approver ratification). See "Contract decision" below for why it is not folded into
`qa/contracts/write-guard.md`.
**Mode D:** not applicable — no UI surface in the changed paths (two `.ps1` files).

```
VERDICT: FAIL
SCOREBOARD: 4/9 criteria met, 3/3 invariants hold
FAILURES:
- [C1] sev: high · The blindness class is unfixed in both sibling hooks the dispatch named:
  mc-sessionstart.ps1:15 and mc-precommit.ps1:43 still use the bare literal
  'Status: ready-for-check' and cannot see a bolded manifest · apply the same strip-then-anchor
  correction to both · issue: ISS-183
- [C3] sev: high · mc-sessionstart.ps1:19 still takes `Select-Object -First 1` on the cycle
  stamp — the identical first-not-highest defect this unit fixed one file over · take the
  maximum · issue: ISS-183
- [C4] sev: high · The fix is still form-fragile at the site it fixed: `(?m)^\s*Cycle checked:`
  misses the bullet form and the heading form, and 6 live verdicts are misread — including
  write-guard-enforcement-gaps, whose cycle-3 verdict has landed and still reads as PENDING ·
  allow the list/heading lead-in · issue: ISS-184
- [C5] sev: medium · The two new fixtures use only stamp forms the new regex was written to
  satisfy; neither corpus form that breaks it appears in any fixture · derive fixture inputs
  from the corpus, not from the implementation · issue: ISS-185
- [C7] sev: high · The class audit was declined rather than performed (the maker's Gap 4 and
  its Note to the checker) · the audit is now done and is ISS-183/184 · issue: ISS-183
LIVE-BROWSER: not-applicable (D:/ai_os/.claude/hooks/delivery-gate-stop.ps1, D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1)
ISSUES-WRITTEN: ISS-183, ISS-184, ISS-185, ISS-186, ISS-187
EXPLANATION: The named defect is genuinely fixed and the evidence for it independently
reproduces — I re-derived the old/new counts myself, ran the 84-fixture suite, and killed both
mutants with my own D-020 harness. It fails on the thing the maker said to push on: the same
defect class is alive in the two sibling hooks that compute the identical handshake state, and
the fix is still fragile against two verdict-stamp forms this repo writes, one of which is
misreading a landed cycle-3 verdict today. Fixing the named instance and not the class is the
ISS-165 mistake, and the maker asked to be failed on it if it were there. It is there.
```

---

## What I re-ran

Every number below is mine. Nothing in the manifest's tables was taken on trust.

### 1. Old-vs-new re-derivation over the real corpus — **reproduces**

I re-implemented both the pre-fix and post-fix scanning logic from the two versions of
`delivery-gate-stop.ps1` and ran them over the live `qa/manifests` (114 files, not 113 — this
unit's own manifest is the 114th) and `qa/verdicts`:

```
OLD pend=1 [delivery-gate-manifest-blindness]        unclosed=1 [hybrid-arms-binding]
NEW pend=2 [delivery-gate-manifest-blindness,
            write-guard-enforcement-gaps]            unclosed=2 [hybrid-arms-binding,
                                                                 speaker-verbatim-token-boundary]
```

The manifest's `OLD pend=1 unclosed=0 / NEW pend=2 unclosed=1` is the same result taken before
two commits landed (`e0666d7` gave `hybrid-arms-binding` its cycle-2 verdict; this unit's own
manifest was written). Re-deriving at the tree state of `4119563`, the manifest's table is
correct item by item:

| manifest | form | manifest cycle | verdict max at 4119563 | counted as | my finding |
|---|---|---|---|---|---|
| `write-guard-enforcement-gaps` | bolded | 3 | 2 | pending | ✅ correct — its cycle-3 verdict landed at `5231a42`, **two minutes after** `4119563` |
| `hybrid-arms-binding` | unbolded | 2 | 1 | pending | ✅ correct |
| `speaker-verbatim-token-boundary` | bolded | 3 | 3 | unclosed | ✅ correct |

One thing the manifest did not notice, and which matters for the blindness argument: the OLD
logic's single hit, `delivery-gate-manifest-blindness`, is a **false positive**. That manifest's
Status line is bolded, so the old regex could not see it either — it matched the *prose* at
lines 35 and 47, where the manifest quotes the phrase while explaining the bug. The old gate was
blind to all three real handshakes and got its count of 1 from a sentence about itself.

**`unclosed=1` on `speaker-verbatim-token-boundary` does independently reproduce the Mode B
sweep's standing ruling** — I confirmed `qa/verdicts/speaker-verbatim-token-boundary.md` carries
`Cycle checked: 1/2/3` and `VERDICT: FAIL` at all three, against a manifest at
`Fix cycle: 3 of max 3`. A verdict has landed for the current cycle and the maker has not
responded: a fix gap, not a dispatch gap. Correct. (What the *code* calls it is wrong — ISS-186.)

### 2. Fixture suite — **84 checks, ALL PASS**

```
powershell -File D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1
...
  PASS  ISS-176 BOLDED '**Status:**' manifest is seen as pending
  PASS  ISS-176 highest Cycle checked wins (not the first)
ALL PASS
```
84 `PASS` lines, 0 `FAIL`.

**The maker's claim that the pre-existing fixtures encoded the same blind spot is TRUE.** The
only two prior fixtures that write a manifest Status line are `hook-fixtures.ps1:102`
(`## Status: ready-for-check`) and `:393` (`Status: ready-for-check`) — both the unbolded form,
the one shape the old regex could see. The suite was green because the tests shared the bug.

### 3. My own D-020 mutation harness — **reproduces the 2-mutant table**

Written independently of the maker's (not read, not re-run): backup to `%TEMP%`, SHA256 baseline,
each suite run wrapped in a `Start-Job` + `Wait-Job -Timeout 300` (so a hang is a `TIMEOUT`
result, not a manual kill), restore in a `finally` that fires on error and interrupt, hash
asserted after restore.

| mutation | result |
|---|---|
| `M1` revert the emphasis strip on the manifest match | **KILLED** — both ISS-176 fixtures fail |
| `M2` take the first `Cycle checked` again, not the highest | **KILLED** — the highest-cycle fixture fails |
| `M0` no-op control | **clean** — `ALL PASS` |

```
BASELINE SHA256 33BC41F212A4F74E0CEEEF962AC3E0F64014B43FC7EC6202023F0EACEBDCEC4C
RESTORED SHA256 33BC41F212A4F74E0CEEEF962AC3E0F64014B43FC7EC6202023F0EACEBDCEC4C  match=True
git -C D:/ai_os status --short -- .claude/hooks/delivery-gate-stop.ps1   ->  (empty)
```

Disclosed weakness in my own control: `M0` rewrote the file through `Set-Content`, so its hash
differed from baseline (encoding/newline) even though the content was semantically identical.
The control is a valid no-op *semantically* but was not byte-identical. Noting it rather than
claiming a cleaner run than I had.

Both mutants are killed **only by the two new fixtures** — no pre-existing fixture detects
either. The new fixtures are therefore non-vacuous for the defect they were written for. They
are also, per ISS-185, non-representative of the corpus.

### 4. The class hunt — this is where it fails

The maker's Gap 4 points at the *other predicates in the same file* (review, learning-file,
config). **I checked those and they are not affected**, and I will say so plainly rather than
let a declined audit read as a finding: `predicate 0` (orphan), `predicate 1` (edit count),
`REVIEW`, `CONFIG`, `BROWSER` and the learning-file check all parse the **transcript JSONL** —
`"type":"tool_use"`, `"file_path":"…"`, `"subagent_type":"…"`. There is no markdown in their
inputs, so C1–C4 cannot apply to them. Gap 4, as the maker framed it, is empty.

The class is alive somewhere else — in the two hooks the dispatch named:

```
$ powershell -File D:/KnowledgeBase/.claude/hooks/mc-sessionstart.ps1
MAKER-CHECKER ACTIVE: … Checks pending: 2 [delivery-gate-manifest-blindness,
hybrid-arms-binding] | PASS not closed out: 0 | …
```

Against the corrected count (`pend=2` including `write-guard-enforcement-gaps`, `unclosed=2`
including `speaker-verbatim-token-boundary`), the SessionStart directive — the thing that tells
a fresh session what is pending **before anything else** — cannot see either cycle-3-of-3 unit.
`mc-precommit.ps1:43` reports `u=2` for the identical reason, so a commit that should warn about
both is silent. And `mc-sessionstart.ps1:19` still ends in `Select-Object -First 1`: the same
first-not-highest bug, one file away, untouched. (Its regex `[:*\s]+` *does* tolerate the bold,
so the two hooks are blind in complementary ways — neither is correct.)

### 5. The fix is still fragile at its own site

Scanning every verdict for the maximum `Cycle checked` under the shipped anchored pattern versus
the true maximum:

```
MISS calendar-auto-join:              anchored_max=-1  true_max=1
MISS eval-baseline-control:           anchored_max=-1  true_max=1
MISS evaluator-calibration:           anchored_max=-1  true_max=1
MISS T-012-compete-screen:            anchored_max=-1  true_max=1
MISS transcription-empty-result-guard:anchored_max=-1  true_max=1
MISS write-guard-enforcement-gaps:    anchored_max=2   true_max=3
```
```
verdicts with line-start form : 108
verdicts with bullet form     : 2    (e.g. "- **Cycle checked: 1**")
verdicts with heading form    : 3    (e.g. "# Verdict — <slug> · **Cycle checked: 3**")
```

`^\s*` consumes whitespace, not `- ` and not `# Verdict — … · `. So the gate that was just
taught to see a bolded **manifest** still cannot see a bolded **verdict heading**, and
`write-guard-enforcement-gaps` is being counted as a pending check *today*, with its cycle-3
verdict on disk since `5231a42`. Same defect class, same nine lines, one layer down.

### 6. The ISS-177 correction — **the maker is right; the sweep undercounted**

Recounted myself over `C:/Users/Lenovo/.claude/projects/d--KnowledgeBase/*.jsonl`, main-chain
only (`isSidechain` false), window `2026-09-08T10:56:13Z … 2026-09-09T04:09:10Z`:

```
raw main-chain occurrences : 53      <- reproduces the maker exactly
unique by tool_use id      : 51
transcript files involved  : 2
first / last               : 2026-09-08T10:56:13Z / 2026-09-09T04:09:10Z
largest gap                : 4:53:54  (09-08T20:00:46 -> 09-09T00:54:40)
2nd largest                : 3:58:51
```

**And the 2× discrepancy the maker declined to reconcile reconciles in one query:**

```
27 calls  38fdc7ba-2ad2-…jsonl
26 calls  d3f69058-522c-…jsonl
```

The sweep counted **one of the two transcript files** — `d3f69058`, 26 calls. The maker counted
both. The maker's method is the correct one and its figures stand; the only imprecision is that
53 raw double-counts two `tool_use` ids present in both files of a fork/resume pair, so the
unique count is 51 (ISS-187, low).

**Judgement on Gap 1.** In a manifest whose entire subject is a false measurement, stopping at
"two counts disagree by 2× and I have not reconciled it" is weak — the reconciliation was a
per-file breakdown away, and the maker had already guessed the cause correctly ("most likely
transcript-file scope") without spending the one query that would confirm it. But the maker's
refusal to *adopt* the sweep's number without deriving it is exactly right, and is the discipline
that would have prevented the original error. Weak, defensible, not a FAIL line — the count it
reported is correct.

## The four declared Known Gaps

| # | Gap | Judgement |
|---|---|---|
| 1 | 53-vs-26 unreconciled | **Resolved by this check.** The maker is right; the sweep read one file of two. Honest to declare, cheap to have closed. Not a failure. |
| 2 | `qa/.last-tick` cannot be corrected in place | **Accepted.** Append-only prose log; the manifest is the correction, and now this verdict is too. Correct handling. |
| 3 | No fixture pins the gate against a real manifest corpus | **Upheld, and it is worse than stated** — the synthetic fixtures do not merely omit the corpus, they omit the corpus forms that *break the new code*. → ISS-185, and it is why C4 shipped broken. |
| 4 | Other predicates unaudited | **Half-empty, half-fatal.** The other predicates in the same file are transcript/JSON parsers and are provably unaffected. The class is instead alive in `mc-sessionstart.ps1` and `mc-precommit.ps1`. → ISS-183, and the reason for this FAIL. |

## Contract decision

**`delivery-gate` gets its own contract; it is not folded into `write-guard.md`.**
`qa/contracts/write-guard.md` is scoped to `aios-write-guard.ps1`, a **PreToolUse** guard whose
north star is *"every write that needs authorization reaches the human, and no write that does
not may prompt."* This artifact is a **Stop** hook: different trigger, different failure mode
(silence rather than a spurious prompt), different blast radius (it can end a session, never a
write). Folding them would leave half of `write-guard.md`'s C1–C7 untestable against its own
declared artifact. Written as `qa/contracts/delivery-gate.md`, status **proposed**, awaiting
Approver ratification per the criticality gate on initial contract creation.

Its `[C7]` deliberately encodes what this unit invited: *a defect found in one predicate is
audited across every predicate and every sibling hook that shares the pattern, and the audit
result is stated — "checked, not affected" is an acceptable answer; silence is not.*

## Scoreboard detail

| criterion | verdict | basis |
|---|---|---|
| C1 all Status forms seen by every reader | **FAIL** | siblings blind (ISS-183) |
| C2 quoted prose not counted | met | the 4 NEW matches are all genuine `ready-for-check`; no false positive in 114 manifests |
| C3 highest cycle, never first | **FAIL** | fixed in delivery-gate, unfixed in mc-sessionstart:19 (ISS-183) |
| C4 stamp found in every form written | **FAIL** | 6 verdicts misread (ISS-184) |
| C5 fixtures pin the real corpus form | **FAIL** | fixtures authored from the fix (ISS-185) |
| C6 old-vs-new re-derivation, itemised | met | table given, reproduces at `4119563` |
| C7 class audited across siblings | **FAIL** | declined by the maker; performed here (ISS-183) |
| C8 fail-open preserved | met | outer `try/catch → exit 0` and all `-ErrorAction SilentlyContinue` paths unchanged |
| C9 block budgets / per-predicate markers | met | fixtures "blocks 3 times in one session" and "4th stop is silent" both PASS |

| invariant | verdict |
|---|---|
| I1 no edits, no commits, writes confined to `%TEMP%/claude-delivery-gate` | holds |
| I2 no blindness/noise tradeoff | holds — strip-then-anchor buys C1 without losing C2, verified over the corpus |
| I3 D-020 mutation discipline | holds — independently reproduced, restore hash-asserted, tree clean |

## What would make cycle 2 a PASS

1. `mc-sessionstart.ps1:15,19` and `mc-precommit.ps1:43` corrected the same way (ISS-183).
2. The `Cycle checked` pattern widened to the bullet and heading forms, with
   `write-guard-enforcement-gaps` demonstrably no longer counted as pending (ISS-184).
3. Fixtures derived from the corpus spellings rather than the implementation (ISS-185).
4. One line stating the audit result for the transcript-parsing predicates — "checked, not
   affected, they parse JSONL" — so C7 is satisfied by a statement rather than by silence.

ISS-186 (medium) and ISS-187 (low) are ledger entries per the repo's severity gate and are not
required for the cycle-2 PASS.

---

# INDEPENDENT CONCURRENT CHECK — delivery-gate-manifest-blindness

**Cycle checked: 1**
**Date:** 2026-09-09
**Checker:** second, independently dispatched Mode A check (the orchestrator dispatched this unit
believing no verdict existed; one did, at commit `6c85d39`). Per checker/SKILL.md the earlier
verdict is left byte-intact and this one is appended. I re-derived the corpus counts before
reading the primary verdict's reasoning; where we agree the agreement is independent, and where
we differ it is named below.
**Commit under check:** `4119563` (KnowledgeBase) · artifact `D:/ai_os/.claude/hooks/delivery-gate-stop.ps1` @ `4a71633` (ai_os)
**Contract:** `qa/contracts/delivery-gate.md` — see "Contract ruling" below. I concur with it and
adopt it as the contract for this check.
**Mode D:** not applicable — changed paths are two `.ps1` files, no UI surface.

```
VERDICT: FAIL
SCOREBOARD: 5/9 criteria met, 3/3 invariants hold
FAILURES:
- [C1] sev: high · The blindness class is unfixed in the two sibling readers of the same
  handshake state: mc-sessionstart.ps1:15 and mc-precommit.ps1:43 both match the bare literal
  'Status: ready-for-check', which cannot see '**Status:** ready-for-check' · apply the same
  strip-then-anchor correction · issue: ISS-183 (concurred, not re-filed)
- [C3] sev: high · mc-sessionstart.ps1:19 still takes `Select-Object -First 1` on the cycle
  stamp — the identical first-not-highest defect, one file over · take the maximum ·
  issue: ISS-183 (concurred)
- [C4] sev: high · The committed fix is a STRICT REGRESSION on five verdicts: the anchored
  Cycle-checked pattern returns NO match (-1) on calendar-auto-join, eval-baseline-control,
  evaluator-calibration, T-012-compete-screen and transcription-empty-result-guard, where the
  old unanchored regex found 1; write-guard-enforcement-gaps reads 2 against a true 3 ·
  allow the list/heading/parenthetical lead-in · issue: ISS-184 (concurred, regression
  direction added here)
- [C5] sev: medium · Neither new fixture uses a stamp form that breaks the new regex ·
  derive fixtures from the corpus · issue: ISS-185 (concurred)
- [C7] sev: high · The class audit the maker's own Gap 4 names was declined, and the two
  siblings that share the predicate were never opened · state the audit result ·
  issue: ISS-183 (concurred)
- [GOV] sev: high · The enforcement-path edit shipped with NO authorizing docs/DECISIONS.md
  entry carrying 'Approved-by: Umesh'. D-024 authorizes the BROWSER predicate; D-025 is
  withdrawn; D-026 states 'Changes-authorized: none'; D:/ai_os/decisions/log.md's 2026-09-09
  entry authorizes only the turn-scoping + budget change (8fd5625), (a) and (b), not this
  regex change. HUMAN_GATE for the Approver, not a maker fix · issue: ISS-189
- [GOV] sev: high · D:/ai_os working tree carries UNCOMMITTED edits to three enforcement
  files — delivery-gate-stop.ps1, edit-in-place-guard.ps1, hook-fixtures.ps1 — so the hook
  running on every session on this machine is not any reviewed commit · issue: ISS-190
LIVE-BROWSER: not-applicable (.claude/hooks/delivery-gate-stop.ps1, .claude/hooks/tests/hook-fixtures.ps1)
ISSUES-WRITTEN: ISS-189, ISS-190, ISS-191
EXPLANATION: The named defect is real and the committed fix closes it — I reproduced both the
blindness and the cure over the live corpus, and the fix over-matches none of my prose probes.
It fails on the class: the two sibling hooks that read the same handshake still carry both
defects, and the cycle-stamp anchoring is itself a regression on five verdicts. Separately, the
change shipped on an enforcement path with no Approved-by entry, and further unreviewed edits to
that hook are sitting uncommitted in the AIOS working tree right now.
```

## What I re-derived myself (not read from the manifest)

**Manifest forms, counted over all 114 files in `qa/manifests/`** — the manifest claims 15
bolded; I count **16 today**, and its own manifest is one of them, so 15 before this unit: claim
verified rather than accepted. Full census, including a fifth form the manifest does not mention:

| form | files | old regex sees it | committed fix sees it |
|---|---|---|---|
| bolded key (`**Status:**` + value) | 16 | **no** | yes |
| heading (`## Status:` + value) | 45 | yes | yes |
| bare (`Status:` at line start) | 29 | yes | yes |
| whole-line emphasis (`**Status: checked-PASS**`, e.g. `bom-and-unreadable-evidence.md:92`) | present | yes | yes |
| no line-start Status at all (prose only) | remainder | n/a | n/a |

**Old vs new over the live tree** (my own PowerShell re-implementation of both predicates):

```
OLD       : matched 1 manifest  - delivery-gate-manifest-blindness   (and only via the PROSE
                                  line 35, which quotes the heading form inside backticks -
                                  its real bolded Status line was invisible)
COMMITTED : matched 2 manifests - delivery-gate-manifest-blindness, speaker-verbatim-token-boundary
```

`speaker-verbatim-token-boundary` is a **cycle-3-of-3** unit at the bolded form. The old gate
could not see it. That is the manifest's central claim, independently reproduced. The manifest's
literal figures (`OLD pend=1 unclosed=0 / NEW pend=2 unclosed=1`) do not reproduce today because
the tree moved — `hybrid-arms-binding` and `write-guard-enforcement-gaps` have both since closed
out — but the *shape* reproduces exactly. Not a finding; recorded so a later reader does not
mistake drift for a false claim.

**C2 over-match probe.** Ten fixtures, four of them prose shapes that merely quote the phrase:

| fixture | OLD | COMMITTED |
|---|---|---|
| bolded key, `(cycle 1)` suffix | no | **yes** |
| heading form | yes | yes |
| bare form | yes | yes |
| whole-line emphasis | yes | yes |
| prose, mid-sentence | yes | **no** |
| prose, code-span quoting the heading form | yes | **no** |
| prose, bullet with a code-span quote | yes | **no** |
| prose, blockquote of an old manifest | yes | **no** |
| prose, inside a table row | yes | **no** |
| closed unit (`checked-PASS`) | no | no |

The committed anchor is correct on all ten. **C2 met** — and the manifest's claim that stripping
emphasis *alone* would be noisy is true and demonstrated (the OLD column).

**Cycle-stamp scan over all 113 verdicts.** This is where it breaks:

| verdict | true max | committed fix reads | stamp form that defeats it |
|---|---|---|---|
| calendar-auto-join | 1 | **-1** | stamp inside a prose sentence |
| eval-baseline-control | 1 | **-1** | `- **Cycle checked:** 1` (bullet lead-in) |
| evaluator-calibration | 1 | **-1** | `**PASS** — Cycle checked: 1` (mid-line) |
| T-012-compete-screen | 1 | **-1** | `- **Cycle checked: 1**` |
| transcription-empty-result-guard | 1 | **-1** | `**Status: PASS** (Cycle checked: 1)` |
| write-guard-enforcement-gaps | 3 | **2** | cycle 3 only in a `# Verdict — … · **Cycle checked: 3**` heading |

Five of those six are a **regression against the code being replaced**: the old unanchored
pattern found the stamp, the anchored one does not. That distinction is not in ISS-184's row and
I add it here — this is not only "still fragile", it is "worse at the site it fixed".

**Fixture suite.** `powershell -File D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1` → `ALL PASS`,
including the two ISS-176 fixtures. **That does not evidence the unit under check.** The suite
runs against the *working tree*, which already contains an uncommitted cycle-2 attempt (widened
character classes plus `ISS-185` fixtures) absent from `4a71633`. A green suite here is evidence
about work in progress, not about the submitted commit. The ISS-175 concern about
`hook-fixtures.ps1:126` did not affect this check: line 126's fixture writes its verdict file
correctly and its assertion is live, not vacuous.

**Sibling audit, performed (C7).** `mc-sessionstart.ps1:15` and `mc-precommit.ps1:43` match the
bare literal and are blind to all 16 bolded manifests; `mc-sessionstart.ps1:19` takes
`Select-Object -First 1`. Both defects, both siblings, unfixed. The other
`delivery-gate-stop.ps1` predicates (review, learning-file, config, browser) parse JSONL and file
paths, not markdown emphasis — checked, not affected.

## The finding the primary verdict does not carry: no `Approved-by`

`.claude/hooks/*` is an enforcement path. This repo's `.claude/CLAUDE.md` "Update Authorization"
requires an authorizing `docs/DECISIONS.md` entry carrying `**Approved-by:** Umesh`, **written
first**. I looked for one and there is none:

- **D-024** authorizes `delivery-gate-stop.ps1`'s *fifth (BROWSER) predicate* — a different
  predicate, and its `Changes-authorized` names that work.
- **D-025** authorized a scoping change to the maker predicate and is **withdrawn by D-026**.
- **D-026** states verbatim: `**Changes-authorized:** none - this entry withdraws an
  authorization and changes no file.`
- `docs/DECISIONS.md` ends at **D-026**. No entry mentions ISS-176.
- `D:/ai_os/decisions/log.md` has **zero** occurrences of `ISS-176`. Its 2026-09-09 entry
  ("the maker loop's continuation guard was asking the wrong question") carries
  `Approved-by: Umesh` for exactly two decisions — *(a)* scope the test to the current turn and
  raise the budget to 3 blocks, *(b)* fix it in the global hook. That is commit `8fd5625`. It
  does not reach a markdown-form change to the manifest predicate.

So `4a71633` shipped unauthorized. **This is a HUMAN_GATE, not a maker fix.** The maker cannot
retroactively authorize its own enforcement-path edit, and the repo has direct precedent for
routing exactly this to the Approver (`ISS-C-UNRUN-WRITERS-005` and `-013` both stop at
"ENFORCEMENT PATH … needs the Approver"). The correct next step is one `append_decision.ps1`
entry that either ratifies `4a71633` (and the cycle-2 widening) with `Approved-by: Umesh`, or
orders its revert. The direction of harm here is mild — the change makes a blind gate see — which
is exactly why the process finding matters more than the code one: an enforcement path that may
be edited without an entry whenever the edit *looks* good is not an enforcement path.

**Compounding it:** `git status` in `D:/ai_os` shows `M .claude/hooks/delivery-gate-stop.ps1`,
`M .claude/hooks/edit-in-place-guard.ps1`, `M .claude/hooks/tests/hook-fixtures.ps1`. The hook
executing on every Stop on this machine right now is **not** `4a71633` and not any commit
(ISS-190).

**A latent defect in that uncommitted version (ISS-191, medium).** The cycle-2 widening replaces
the anchor with a character class that contains a backtick and `>`, so it re-opens C2: my
code-span probe and blockquote probe both match again, and the code-span form exists on line 35
of this unit's own manifest. It is **latent, not live** — I re-ran the full corpus and the widened
regex matches the same 2 manifests as the committed one today, because the file carrying that
prose line is itself genuinely at `ready-for-check`. Filed medium so cycle 2 does not trade C1
for C2 (contract `[I2]`).

## Contract ruling (the judgement the manifest asked for)

**`qa/contracts/write-guard.md` does NOT cover this, and I concur with the primary check's
decision to author `qa/contracts/delivery-gate.md` instead.** Independently reasoned: different
hook *events* (`PreToolUse` vs `Stop`), different failure directions (write-guard fails by
prompting or by letting a write through; this one fails by silence or by blocking a healthy
session), different blast radii (a write vs a session). Folding them would leave write-guard's
`[C1]`–`[C7]` untestable against half their own artifact. The new contract's `[C1]`–`[C9]` are
the right criteria, and `[I2]` — "a change that trades C1 for C2 is a FAIL, not a tradeoff" — is
the criterion that caught ISS-191 here. It stays at `Status: proposed`; initial contract creation
is a human-approved START and I do not ratify it myself.

## Where I differ from the primary verdict

- Scoreboard **5/9** here vs 4/9. I judge **[C3]** met *for the artifact this unit changed* — the
  highest-cycle loop in `delivery-gate-stop.ps1` is correct — and charge the sibling's `-First 1`
  under C1/C7 rather than counting C3 twice. Same defects, same issue id, different bookkeeping;
  it does not change the verdict.
- I add the **regression direction** on C4 (five verdicts go from readable to unreadable) and the
  two **governance findings**, which the primary verdict does not carry.
