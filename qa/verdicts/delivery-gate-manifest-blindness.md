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

---

# Verdict — delivery-gate-manifest-blindness (cycle 2)

**Cycle checked:** 2
**Date:** 2026-09-09
**Manifest:** `qa/manifests/delivery-gate-manifest-blindness.md` (`Fix cycle: 2 of max 3`)
**Commit under check:** `3477705` (KnowledgeBase) · artifact `D:/ai_os/.claude/hooks/delivery-gate-stop.ps1` @ `b6ee654` (ai_os)
**Contract:** `qa/contracts/delivery-gate.md` (status `proposed`)
**Mode D:** not applicable — no UI surface in the changed paths (two `.ps1` files).

```
VERDICT: FAIL
SCOREBOARD: 4/9 criteria met, 2/3 invariants hold
FAILURES:
- [C2] sev: high · The field-boundary pattern counts PROSE. The middle-dot boundary matches a
  quoted stamp inside a table cell, so THIS unit's own verdict file reads max cycle 3 when its
  only real stamp is 1 - and the live gate therefore reports pend=0 for a manifest genuinely at
  ready-for-check cycle 2. That is the silencing direction the maker rejected `unanchored` to
  avoid, already present in the shipped pattern · require the stamp to be the first field on its
  line, or exclude table/backtick contexts · issue: ISS-192
- [C6] sev: high · "shipped PS regex over 114 verdicts -> 0 misreads" is false under the hook's
  OWN reader, and its oracle shared the bug it was testing for · re-measure with the hook's
  reader and an oracle that is not the rejected pattern · issue: ISS-193
- [C5] sev: high · The census forms were transplanted into BOM'd fixture files while 114/114 real
  verdicts are UTF-8 without BOM; the em-dash boundary is unfixtured and SURVIVES mutation (my
  M6) · write at least one fixture byte-identical to a real corpus file · issue: ISS-194
- [C4] sev: medium · `**PASS** — Cycle checked: 1` (evaluator-calibration) is not matched at all
  by the shipped pattern in production · the em-dash boundary cannot survive the reader · issue:
  ISS-193
- [C1] sev: high · Unmet, honestly gated: mc-sessionstart.ps1 and mc-precommit.ps1 remain blind ·
  awaiting the Approver on qa/gates/mc-hooks-manifest-blindness.md · issue: ISS-183 (stays open)
LIVE-BROWSER: not-applicable (D:/ai_os/.claude/hooks/delivery-gate-stop.ps1, D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1)
ISSUES-WRITTEN: ISS-192, ISS-193, ISS-194, ISS-195
EXPLANATION: Everything the maker measured about its own corpus reproduces - 86/86 fixtures pass,
all five of its mutants die under my independent D-020 harness with a clean control, the ISS-187
reconciliation is exactly right (53 occurrences, 51 unique), and the ISS-186 record correction is
true (the old regex's only manifest hit today is prose in this manifest). It fails on the same
axis as cycle 1, one level up: it stopped choosing its own corpus and started choosing its own
ORACLE. It scored the new pattern against the unanchored pattern, which shares the prose-match
error, so the one place the shipped regex silences the gate - this unit's own verdict file -
scored as agreement. The gate is blind to this very handshake right now.
```

---

## What I re-ran (every number below is mine)

### 1. Fixture suite — reproduces

`powershell -NoProfile -File D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1` → **ALL PASS**,
86 `PASS` lines, 0 `FAIL`, including both new ISS-185 checks.

### 2. My own D-020 mutation harness — the maker's 5/5 reproduces, and a sixth mutant survives

Independently written (backup to `%TEMP%`, SHA256 baseline, each suite run in a `Start-Job` +
`Wait-Job -Timeout 300` so a hang is a `TIMEOUT` result, restore in a `trap` that fires on error
and interrupt, hash asserted after restore).

| mutation | result |
|---|---|
| `M0` no-op control | **clean** |
| `M1` revert the emphasis strip | **KILLED** |
| `M2` `Cycle checked` back to line-anchored | **KILLED** |
| `M3` `Fix cycle` back to line-anchored | **KILLED** — the replaced assertion does hold |
| `M4` `Status` back to line-anchored | **KILLED** |
| `M5` take the first `Cycle checked` | **KILLED** |
| `M6` **drop `\u2014` from the boundary set** | **SURVIVED** |
| `M7` drop `\u00b7` from the boundary set | **KILLED** |

```
BASELINE 3C3B260FE6A23F875B6618DB83AC81CEE6FDCEB6AA64A93AE610DDAF821751A6
RESTORED 3C3B260FE6A23F875B6618DB83AC81CEE6FDCEB6AA64A93AE610DDAF821751A6  match=True
git -C D:/ai_os status --short -- .claude/hooks/delivery-gate-stop.ps1  ->  (empty)
```

The maker's disclosure about its own vacuous `-notmatch` assertion is honest and the replacement is
real: `M3` dies on the replaced check. But `M6` shows that one of the two boundary characters the
whole census exercise was for is pinned by nothing.

### 3. The census — incomplete, and the missing form is the one that breaks

Re-derived myself over all 114 verdicts (every line containing the phrase, digits normalised to N):

```
60x  Cycle checked:** N          42x  Cycle checked: N**        26x  Cycle checked: N
 4x  # Verdict — <slug> · **Cycle checked: N**      (the maker counted 2)
 1x  - **Cycle checked: N**       1x  **Status: PASS** (Cycle checked: N)
 1x  **PASS** — Cycle checked: N                    (ABSENT from the maker's census)
 1x  **Date:** … · **Mode:** A · **Cycle checked: N**
```

Six forms was an undercount. The heading form occurs 4x, not 2x, and there is a seventh: the
mid-line em-dash form in `evaluator-calibration.md`. It is the only corpus form the shipped pattern
cannot read at all (§4), and it is the one the census missed.

### 4. Old vs new over the real corpus, under the hook's own reader

`Get-Content -Raw` in Windows PowerShell 5.1 decodes with the ANSI codepage, and there is no `pwsh`
on this machine. **All 114 verdicts are UTF-8 without a BOM** (checked byte-wise), so a U+2014 in
one of them arrives as three ANSI characters and no `\u2014` survives — the em-dash boundary never
fires in production. U+00B7 survives by accident, because the second byte of its UTF-8 encoding is
0xB7.

```
OLD  '(?m)^\s*Cycle checked:'  vs unanchored : 7 files disagree  (reproduces the maker's 7)
NEW  shipped field-boundary    vs unanchored : 1 file  disagrees (NOT 0)
     evaluator-calibration   new = -1 (no match at all)   true = 1
same corpus read with -Encoding UTF8         : 0 disagreements
```

So "0 misreads" is an artifact of reading the corpus in an encoding the hook does not use. Under the
hook's own reader it is 1. The direction is noisy, not silencing, and `evaluator-calibration`'s
manifest is not at `ready-for-check`, so there is no live miscount from this one — but the
measurement that certified the fix was taken outside the artifact's runtime, in a cycle whose
subject is measurement honesty.

### 5. The prose match — the failure that IS live, right now

The oracle problem matters because both candidate patterns make the same error, so comparing them
hides it. Running the shipped pattern over `qa/verdicts/delivery-gate-manifest-blindness.md` and
printing context for every match:

```
n=1  # Verdict — delivery-gate-manifest-blindness | Cycle checked: 1                    (real)
n=1  # INDEPENDENT CONCURRENT CHECK — … | Cycle checked: 1                              (real)
n=1  "…carries `Cycle checked: 1/2/3` and `VERDICT: FAIL`…"                              (prose)
n=3  '…verdicts with heading form : 3 (e.g. "# Verdict — <slug> · Cycle checked: 3")'    (PROSE)
n=3  '…| write-guard-enforcement-gaps | 3 | 2 | cycle 3 only in a `# Verdict — … ·
      Cycle checked: 3` heading |'                                                       (PROSE)
```

`max = 3` from two table/example cells. The manifest is at `Fix cycle: 2`. Running the shipped hook
block against the live tree:

```
pend=0 []
unclosed=2 [delivery-gate-manifest-blindness, speaker-verbatim-token-boundary]
```

**The gate cannot see that this unit is awaiting a cycle-2 check.** The maker's stated reason for
rejecting `unanchored` was that future prose could make a pending unit look closed. Present prose
already does, through the `·` boundary it added instead. Invariant **I2** — "a change that trades C1
for C2 (or the reverse) is a FAIL, not a tradeoff" — is exactly this, so I2 does not hold.

A milder instance of the same class: the marker class admits a backtick, so the manifest's own prose
line beginning `` `## Status: ready-for-check` `` matches the Status predicate (ISS-195). No live
false-pending today, because that file's real Status line also matches; a `checked-PASS` manifest
quoting the phrase at line start would produce one.

### 6. ISS-187 — reconciliation verified exactly

Counted independently over `C:/Users/Lenovo/.claude/projects/d--KnowledgeBase/*.jsonl`, main-chain
`tool_use` blocks named `ScheduleWakeup`, window `2026-09-08T10:56` – `2026-09-09T04:10`:

```
38fdc7ba  occurrences 27  unique 26
d3f69058  occurrences 26  unique 25
TOTAL     occurrences 53  UNION unique 51
```

53, 26 and 51 all land. One nit: the two duplicates are intra-file (27→26 and 26→25), not "across a
fork/resume pair" as the manifest words it; the reconciled figure is right either way.
**ISS-187 verified.**

### 7. ISS-186 — half true, half deferred, and the deferral is convenient

The record correction is TRUE. Running the pre-fix predicate over the live manifests, its only hit is
`delivery-gate-manifest-blindness`, matching the sentence at manifest line 34 rather than a Status
line. The old gate saw zero real handshakes.

The deferred half is not out of scope. `$unclosed++` sits five lines below the line this unit edited,
inside the same nine-line block, and increments the counter this unit's own [C3] fix computes; its
sibling `mc-sessionstart.ps1:22` does test `VERDICT:\s*PASS`. Live consequence today: both items the
gate calls "PASS not closed out" carry `VERDICT: FAIL`. Calling it "a predicate this unit did not
otherwise touch" is inaccurate — it is one added conjunct in the block under edit. **ISS-186 stays
open.** Not scored as its own FAIL line (the filing was correct and the scope call is arguable), but
the reason given for it is not honest.

### 8. ISS-183 — gated correctly

- `git log --all -- .claude/hooks/mc-sessionstart.ps1 .claude/hooks/mc-precommit.ps1` → last touch
  `2be1a47` (the D-006 wiring commit). **The maker did not edit either file.** Confirmed.
- `qa/gates/mc-hooks-manifest-blindness.md` is well-formed: the one-line question, the CLAUDE.md
  clause that forces the gate, a measured defect table with file/line/effect, the exact change, an
  answer format, and links.
- Option B is honest. Declining leaves the hooks blind, and the follow-on it names — standardise
  every manifest on the unbolded form — is the real alternative, not a strawman.
- **The `mc-sessionstart.ps1:17` claim is true, not convenient.** `Fix cycle[:*\s]+(\d+)` against
  `**Fix cycle:** 2`: `[:*\s]+` consumes `:`, `*`, `*`, ` `. Verified by running it, not by reading.
  Line 19's `Select-Object -First 1` and line 15's bare literal are correctly named as the two
  affected sites.

### 9. Known Gaps, judged

1. **ISS-186's message half** — real gap, accepted; the reason given for it is rejected (§7).
2. **`(` and backtick admit a quoted stamp** — the maker was right to push here, and understated it.
   It named `(` and backtick and missed that `·` does the same thing, *and already does it today, in
   its own verdict file*. "Zero occurrences across 114 verdicts" is false: there are two, in the one
   file the gate reads for this unit. This is the FAIL.
3. **ISS-183 gated** — accepted and correctly handled (§8).
4. **The census is a snapshot** — accepted, and the snapshot itself was incomplete (§3).

### 10. [C7] — the class audit

**Met.** The transcript-scanning predicates were cleared in cycle 1 (they parse JSONL, not markdown);
the two siblings were audited and gated; the one sibling line claimed unaffected genuinely is. I
re-derived each of those rather than adopting them. What [C7] does not yet cover is the *new* class
this cycle introduced — a boundary set that matches prose — which is why ISS-192 asks for a sweep
across `Status`, `Fix cycle` and `Cycle checked` together rather than a patch to one of them.

### On the maker's Note to the checker

You asked whether 0/0 across the real corpus should have settled the field-boundary-versus-unanchored
choice, and whether the extra boundary characters are unjustified complexity. Neither of the two
answers you offered. The choice of *direction* was right: a silenced gate is worse than a noisy one,
and that reasoning stands. What is wrong is that the pattern you picked does not deliver it — the
boundary set you added is precisely what makes it match prose, in the silencing direction, on the
very file this check has to read. And 0/0 could never have settled it, because the comparison was
against the pattern you were rejecting; an oracle that fails the same way scores every shared failure
as agreement. Not unjustified complexity — complexity that bought the defect it was meant to prevent.

### Counting note (observation, not a failure)

`Fix cycle` in a manifest is still read with `-match`, i.e. the first occurrence, while [C3]'s second
sentence asks for the highest. No manifest in the corpus diverges today, so this stays an observation
rather than a FAIL line — but it is the same first-not-highest shape, one predicate over.

---

# Verdict — delivery-gate-manifest-blindness (cycle 3)

**Cycle checked:** 3
**Date:** 2026-09-09
**Manifest:** `qa/manifests/delivery-gate-manifest-blindness.md` (`Fix cycle: 3 of max 3`)
**Commit under check:** `55e90cf` (KnowledgeBase) · artifact `D:/ai_os/.claude/hooks/delivery-gate-stop.ps1` @ `bbabf41` (ai_os)
**Contract:** `qa/contracts/delivery-gate.md` (status `proposed`)
**Mode D:** not applicable — no UI surface in the changed paths (two `.ps1` files).

```
VERDICT: FAIL
SCOREBOARD: 5/9 criteria met, 2/3 invariants hold
FAILURES:
- [C2] sev: high · The safety property is FALSE, not merely un-oracled. The cycle-3 code-span
  stripper can MANUFACTURE a stamp that is in no stamp position in the file: a "Cycle checked:"
  label whose value sits in an inline span, followed by a line beginning with a digit, reads that
  digit (measured: shipped=3, with no "Cycle checked: 3" anywhere in the file). The pattern's
  \s* also crosses newlines, so a bare label line adopts the next paragraph's leading number.
  Both read HIGHER than any stamp present - the silencing direction · require the digits on the
  same line as the label ([^\S\r\n]* instead of \s*) and reject a label whose value was erased by
  stripping · issue: ISS-205
- [C4] sev: medium · The heading form "# Verdict - <slug> · **Cycle checked: N**" - named
  verbatim in C4 and present in 4 live verdicts - is now unreadable by design. A shipped
  blindness is what C4 forbids; that it fails safe does not make the criterion met · re-reach the
  form without a decode-dependent boundary (strip a heading's leading run of non-alphanumerics
  before matching), or take the criterion to the Approver as a CRITICAL amendment · issue: ISS-206
- [C5] sev: medium · The third vacuous fixture in three cycles. The check labelled "ISS-185 the
  middle-dot heading form is unreachable" asserts only "1 check(s) pending", which is true for
  ANY reader returning < 6, including one that reads nothing. Proven: my mutant M5 removes the
  "(" boundary - killing the census form "**Status: PASS** (Cycle checked: N)" - and the whole
  suite still passes · assert the computed cycle, not the pending count, and add a case whose
  only reachable stamp is the paren form · issue: ISS-207
- [I2] sev: high · "A change that trades C1 for C2 (or the reverse) is a FAIL, not a tradeoff."
  Cycle 3's central move is exactly that trade - it ships a known-unreadable real form to buy
  prose safety, and argues the trade is correct. The argument may well be right; the invariant
  says it is not the maker's to make inside a fix cycle · issue: ISS-206
- [C1] sev: high · Unmet, honestly gated (unchanged from cycle 2): mc-sessionstart.ps1 and
  mc-precommit.ps1 remain blind · awaiting the Approver on qa/gates/mc-hooks-manifest-blindness.md
  · issue: ISS-183 (stays open)
LIVE-BROWSER: not-applicable (D:/ai_os/.claude/hooks/delivery-gate-stop.ps1, D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1)
ISSUES-WRITTEN: ISS-205, ISS-206, ISS-207, ISS-208, ISS-209
EXPLANATION: Every cycle-2 finding is genuinely closed, each verified against its own recorded
reproduction: this unit's verdict now reads max cycle 2 - its true maximum - instead of 3, and the
live gate reports pend=1 naming this very handshake, so the blindness that made cycle 2 fail is
gone. ISS-193 is genuinely MOOT: across all 232 real manifests and verdicts read three ways (PS
default, -Encoding UTF8, .NET ReadAllText) not one decision changes. ISS-186 is fixed and its
sibling mc-sessionstart.ps1:22 does test VERDICT: PASS as claimed. Both self-found broken fixtures
are genuinely repaired - M1 and M4 both die now. It fails because the property justifying the whole
cycle does not hold: the stripper this cycle added can itself invent a stamp that is nowhere in the
file, and the measurement cannot see that, because its reference bound counts prose mentions as
stamps - so the exact cycle-2 defect scores as "equal", never "higher". Cycle 3 of 3: STALLED.
```

## What I re-ran — every number below is mine

### 1. Fixture suite

`powershell -NoProfile -File D:/ai_os/.claude/hooks/tests/hook-fixtures.ps1` → **ALL PASS**, 0 FAIL,
including all four new/rebuilt cases.

### 2. The safety property, re-derived over all 115 verdicts in the hook's own runtime

```
  shipped PowerShell block vs the unanchored raw bound
  higher (SILENCES)  0        equal  110        lower  5
```

Reproduces the maker's `0 / 110 / 4`; the fifth `lower` is `dispatch-state-tracking.md`, which
landed after the manifest was written. Live state: `pend=1 unclosed=0`, and the single pending item
is `delivery-gate-manifest-blindness mc=3 vc=2` — **this handshake, correctly seen.** Cycle 2's
headline defect is dead.

### 3. Attacking the property — the answer to the Note to the checker

The dispatch asked for a verdict the reader scores higher than any real stamp. Three constructions,
run through the shipped code:

| construction | shipped reads | is that number a stamp in the file? |
|---|---|---|
| label, value in an inline span, next line `3 criteria met.` | **3** | **no** |
| bare label line, blank line, `9 issues were written.` | **9** | **no** |
| label, span `not a number, see`, then `9 lines below.` | **9** | no (only `1`) |

All three read **higher**, so the property is false as stated. The mechanism is the cycle-3 addition
itself: `Strip-Code` deletes the span, `\s*` then walks across the newline, and the label adopts a
number that was never its value.

**The deeper problem is the measurement, and it is worse than the counterexamples.** The reference
bound counts *any* occurrence anywhere, prose included. So the very defect cycle 3 exists to fix —
cycle 2 reading `3` out of a quoted table cell — scores as `equal`, not `higher`. Verified: a
verdict whose only real stamp is 1 and whose prose reads `the maker claimed (Cycle checked: 9)`
returns **9**, and the property reports no violation. A bound that classifies the failure it was
built for as compliant is not a weak oracle; it is blind on the one axis that matters. Gap 1
understates its own problem.

Both defects are constructed, not live: **zero** of the 115 real verdicts contain a newline-spanning
match. This is a real defect in the claim, and a latent one in the reader.

### 4. ISS-193 mootness — verified, and the disagreement genuinely stops mattering

232 files (115 verdicts + 117 manifests), three decoders, comparing both the computed cycle and the
`ready-for-check` decision: **0 decode-sensitive files.** The reasoning holds in general too — a
mis-decoded U+2014/U+00B7 can only yield non-ASCII characters, and none of `^`, `(`, the marker
class or a digit is reachable that way, so no decode can *create* a match. Which reader mangles the
em dash is now unanswerable from this code and no longer needs an answer. **MOOT, correctly
claimed** — the disagreement itself no longer matters, which is a better outcome than winning it.

### 5. My own D-020 mutation harness — 10 mutants, independently written

Backup outside the repo, SHA256 baseline, each suite run in a `Start-Job` + `Wait-Job -Timeout 300`
so a hang is a `TIMEOUT` and not a hang, restore in a `finally` that fires on error and interrupt,
hash asserted after every restore (`RESTORE OK sha256=0E49236…`; `git status` on the hook is clean).

| mutant | result |
|---|---|
| M0 no-op control | **clean** |
| M1 drop inline code-span stripping | **killed** (2 fixtures) |
| M2 take the first cycle stamp, not the highest | **killed** (1) |
| M3 status predicate line-anchored, no emphasis strip | **killed** (10) |
| M4 ISS-186: count any verdict as PASS-not-closed-out | **killed** (1) |
| M5 **drop the `(` boundary** | **SURVIVED** |
| M6 cycle stamp never matches | **killed** (4) |
| M7 fix-cycle predicate line-anchored only | **killed** (2) |
| M8 re-add both non-ASCII boundaries | **killed** (2) |
| M8a re-add **only** the em-dash boundary | **SURVIVED** |

M5 is the third vacuous fixture (see [C5]). M8a is ISS-194's residual: the em-dash boundary is still
unfixtured — cycle 3 resolved it by *deleting the code* rather than pinning it, which is sufficient
today and silently unpins any future reintroduction. M8's kill comes from the middle dot, not the em
dash, exactly as in cycle 2. Filed low, not charged.

### 6. Each cycle-2 issue measured against its OWN recorded reproduction (D-015)

| issue | recorded reproduction | result now |
|---|---|---|
| ISS-192 | own verdict scores max cycle 3 against a real max of 1; live `pend=0` | reads **2**, its true maximum, and `pend=1`. **fixed** |
| ISS-193 | "0 misreads" false under the hook's own reader | 0/232 decode-sensitive. **fixed (moot)** |
| ISS-194 | em-dash boundary unfixtured, survives mutation | boundary removed; M8a still survives. **fixed, residual ISS-208** |
| ISS-195 | the manifest's backtick-quoted status line counts as a handshake | stripped; no live false positive. **fixed** |
| ISS-186 | a FAIL labelled "PASS not closed out" | M4 kills it; sibling `mc-sessionstart.ps1:22` confirmed to test the same. **fixed** |

### 7. A residual found while checking ISS-195's fix

The leading-marker class still contains the table pipe, so an **unbackticked** table row quoting the
status counts as a handshake. Zero live occurrences (today's `pend=1` is correct) and it fails
noisily rather than silently. Ledger only: ISS-209.

### 8. Gap 4 confirmed

No fixture file contains a fenced block at all, so `Strip-Code`'s fence branch is exercised by
nothing. Honestly disclosed by the maker; ledger only, not charged.

## Judging the deliberate regression (dispatch item 3)

The direction is right and the reasoning is good: a gate that nags is survivable, a gate that goes
quiet is what this seam exists to prevent. My objection is not to the tradeoff — it is to **who made
it.** [I2] says a shipped blindness is not something a fix cycle may choose, and [C4] names the
discarded form by example. The maker is asking to be relieved of a criterion its new design cannot
meet, which is the one amendment shape a checker may never grant inside a verdict.

Will it strand a future unit? Yes, in one specific way: a verdict written in that heading form
against an open manifest reads as **pending forever**, and the implied remedy — that checkers always
write the stamp on its own line — is a convention no code enforces. That cost is small and
self-announcing, which is exactly what makes it a good candidate for an **amendment** and a bad one
for silence.

## Recommendation, given this is cycle 3 of 3

**STALLED — and it should not go to a cycle 4.** The shipped state is strictly better than both
predecessors and the live gate is correct right now. Three of the five findings (C4, I2, and the C5
fixture) are one decision, not three: whether the contract keeps C4. That is an Approver call under
the criticality gate, and this project's class-based round cap sends a non-security seam past two
rounds to a `HUMAN_GATE`, not to another round. ISS-205 is the one genuine code defect and is a
small regex change (`\s*` → `[^\S\r\n]*`) that belongs in whatever unit next touches this block.

**Contract note:** `qa/contracts/delivery-gate.md` stays at `Status: proposed` and I have **not**
amended C4. Softening it now, with a verdict pending on it, is the one thing this role may not do.
