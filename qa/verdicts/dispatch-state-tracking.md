# Verdict — dispatch-state-tracking · **Cycle checked: 1**

**VERDICT: PASS** (with ISS-178 held OPEN — see the ledger ruling below)
**Cycle checked:** 1
**Date:** 2026-09-09 · **Mode:** A · **Dual check:** no
**Manifest:** `qa/manifests/dispatch-state-tracking.md`
**Commit judged:** `14cf3b1`
**Contract:** none existed. Ruling below.
**Bound to:** `D:\KnowledgeBase`

---

## Contract ruling (mine to make; the maker correctly did not author one)

**It does NOT belong under `qa/contracts/loop-safety.md`, and it needs its own contract.**

`loop-safety.md`'s north star is explicit and narrow: *"the loop's own verification procedure
cannot damage the artifact it verifies"* — mutation arming, restore, the commit guard. Its Scope
section names `mutate.mjs`, `qa/.mutations-active`, and `mc-precommit.ps1` and closes with "No
product code." Dispatch-state tracking damages nothing and verifies nothing; it is **handshake
liveness and observability** — whether a check that was started can be known to have died. Folding
it into loop-safety would repeat the exact error that file's own provenance note records about
`structure-lint.md` being cited as "the closest existing": judging this work against that contract
would credit it for nothing it actually does.

The right home is a new `qa/contracts/handshake-liveness.md`, covering marker write/derive
semantics, the five states, `STALE_MS`, and — crucially — the **reader** obligations on the
session-start hook and sweep check 1.

**I am not authoring it.** Initial contract creation is a human-approved START (checker
SKILL.md criticality gate). `loop-safety.md`'s own corrected provenance note is both the precedent
and the reason: *"a checker that can widen its own mandate by writing a contract is a
self-certification path, which is the one failure mode the maker-checker pair exists to prevent."*
That note also establishes that a contract of this shape would impose obligations on future
checkers (the C7/C8 class), which D-022 had to ratify separately. A `HUMAN_GATE` row is queued.

This check therefore judges the unit against **ISS-178's recorded `fix_direction`**, per D-015.

---

## D-015 measurement — against ISS-178's own recorded fix direction, by issue id

The direction, decomposed into its five obligations:

| # | ISS-178 `fix_direction` requires | Status | Evidence |
|---|---|---|---|
| 1 | maker writes `qa/dispatch/<slug>.json` at dispatch time with `{slug, cycle, dispatched_at, session_id}` | **MET** | `record()` in dispatch-state.mjs. Live on disk: `qa/dispatch/dispatch-state-tracking.json` carries exactly those four keys and no others |
| 2 | the checker deletes it when it commits the verdict | **DEVIATED — sound, see below** | `clear()` exported; correctness made independent of it |
| 3 | three states: no stamp = never dispatched · <20 min = in flight · >20 min with no matching-cycle verdict = CHECKER DIED | **MET (superset)** | five states; `STALE_MS = 20*60*1000`; `stateOf` returns exactly this trichotomy plus `not-pending`/`complete` |
| 4 | re-dispatch without consuming a fix cycle | **PARTIAL** | the *state* is emitted correctly; the *policy* belongs to a caller, and there is none |
| 5 | **"Sweep check 1 then reports three states, not two"** | **NOT MET** | nothing consumes the module. The originating defect — a dead check silently re-aged as a dispatch gap — is still live at HEAD |

**ISS-178 is therefore NOT flipped to `fixed`.** It stays `open`, with a note recording that the
mechanism landed and the readers did not. A ledger row saying "fixed" while the failure it describes
still occurs is worse than an open row.

The maker's stated reason for #5 is **structurally true and I verified it**: `mc-sessionstart.ps1`
sits under `.claude/hooks/*`, which the project CLAUDE.md places behind an `Approved-by: Umesh`
DECISIONS entry; and sweep check 1 is the checker's own protocol, which the maker is forbidden to
edit. The maker built the largest piece it is permitted to build and disclosed the remainder under
"Not done, stated rather than hidden" rather than claiming closure. That is why this is a PASS of the
unit and not of the issue.

### Ruling on the deliberate deviation (#2) — **SOUND, and it drops nothing**

The recorded direction makes the marker's *deletion* the signal that a check finished. The module
instead derives `complete` from a matching-cycle verdict, demoting the marker to a hint that only
narrows "no verdict yet" into in-flight vs died.

I looked for what deletion buys that derivation does not, and found nothing load-bearing:

- **No state is lost.** After a verdict lands, `stateOf` returns `complete` whether or not the marker
  was deleted. Mutation M1 confirms the marker-absence precondition is genuinely absent from the
  shipped code — adding it reddens three tests.
- **Markers cannot accumulate or leak forward.** `record()` overwrites by slug, and a marker below
  the manifest's cycle is ignored, so a stale marker cannot absorb cycle N+1. M2 confirms that guard
  is live and load-bearing.
- **Deletion remains available.** `clear()` is exported and idempotent, so a checker that later
  adopts the recorded protocol changes nothing about correctness — it only removes clutter.
- **The dependency removed is real, not hypothetical.** Under the recorded direction, a checker
  running an older skill version, or one that crashes after committing its verdict, leaves a marker
  that would read as a dead check *forever* on a completed unit. Derivation is strictly more robust,
  not merely more convenient.

The deviation makes a requirement **optional rather than dropping it**, and moves correctness from
"a second actor must change protocol first" to "true today". The maker's cited precedent (D-019's
union rule sitting unimplemented for a day) is apposite. Approved.

---

## What I re-ran myself

Nothing below is taken from the manifest. Every number was re-derived.

### 1. Unit tests

```
$ node --test scripts/lib/dispatch-state.test.mjs
tests 14   pass 14   fail 0   cancelled 0   skipped 0   todo 0
```

Matches the manifest's claim.

### 2. Corpus — re-derived independently, not read from the manifest

I wrote my own scanner over `qa/verdicts/`, importing the **shipped** `verdictCycle`, and compared it
against a deliberately permissive superset (`^[^\n]*Cycle checked…`, no fence strip, no line-shape
rule) to expose every place the shipped rules change the answer.

```
total verdict files                      : 114
files containing the phrase at all       : 114   (grep -L returns nothing)
files yielding a parseable stamp         : 113
no parseable stamp                       : 1  [ 'calendar-auto-join.md' ]
shipped parser disagrees with permissive : 1  [ delivery-gate-manifest-blindness.md  shipped=2  permissive=3 ]
```

**The maker's three headline numbers are confirmed.** `delivery-gate-manifest-blindness` → 2,
`write-guard-enforcement-gaps` → 3, `hybrid-arms-binding` → 3.

**The convenient claim, checked precisely because it is convenient.** `calendar-auto-join.md` has
exactly one occurrence of the phrase, at lines 77–79:

```
**PASS — 6/6 criteria independently verified.** T-025 flipped to `done` in `TASKS.md`, `.goal/
goal.json` entry marked complete, manifest `Status:` flipped to `checked-PASS` (`Cycle checked:
1`).
```

That is a wrapped prose sentence inside a close-out paragraph with the digit on the following line,
and the file's header instead carries `**Result: PASS** (cycle 1)` — a form that is not the stamp at
all. **The maker's claim is true**: that verdict genuinely has no `Cycle checked` field, and the
parser is right to return nothing. The verdict file is the defect. It is harmless today because
`qa/manifests/calendar-auto-join.md` is at `Status: checked-PASS`, so `stateOf` short-circuits to
`not-pending` before the verdict is ever read — but a future re-open of that slug would misread as
`not-dispatched`.

**Overcount hunt (the direction that actually matters).** I printed the matching line that produced
the maximum for all 114 files and read them. Every one is a genuine stamp form — field, heading,
bullet, status-prefixed, or parenthesised. **No prose is counted anywhere in the live corpus, in
either direction.**

The stated "five forms" is also an undercount of what exists: the `delivery-gate-manifest-blindness`
verdict's own census (its lines 547–551) records seven, including `**PASS** — Cycle checked: N` and
`**Date:** … · **Mode:** A · **Cycle checked: N**`. I verified the shipped mid-line rule reads both
of those correctly — so the undercount is in the comment, not in the code.

### 3. Adversarial parser probes (the risk surface, as instructed)

16 hand-built inputs. **Twelve behave correctly**, including the two the manifest claims and three I
expected to break it:

| probe | result |
|---|---|
| CRLF field form / CRLF heading form | correct (2 / 3) — no anchor mismatch, and 13 corpus files are CRLF |
| 4-space indented code block | rejected |
| blockquote `>` / table `\|` / leading-backtick span | rejected |
| wrapped prose with the digit on the next line (the `calendar-auto-join` shape) | rejected |
| indented ``` fence inside a list | rejected |
| closed fence quoting a higher stamp | stripped |
| **odd fence count (3 fences)** | **correct** — the non-greedy pair strips fences 1–2, leaves the trailing block, and the real stamp still wins |

**Four overcount** — filed as ISS-196:

| probe | got | should be |
|---|---|---|
| `~~~` fenced block quoting `Cycle checked: 9` | **9** | none |
| `<!-- Cycle checked: 9 -->` HTML comment | **9** | none |
| mid-line code span in prose: ``see `Cycle checked: 9` here`` | **9** | none |
| unclosed ``` fence · ````-wrapped nested fence | **9 / 7** | none / 1 |

None occurs in the corpus today (`~~~`: 0 files · HTML comments: 1 file, containing no stamp · odd
fence counts: 0 files). But the mid-line code-span shape is **live prose in 10 places**, and it is
harmless only because the quoted numbers happen not to exceed the real maximum. This matters more
than its rarity suggests: the module's own header states *"undercounting is the safe failure here"*,
and all four of these are **over**counts — the unsafe direction, in which a genuinely pending check
is silenced as `complete`. Medium, not a FAIL: no live instance, and the maker's leading-backtick
rule already blocks the most common form.

### 4. Mutation testing (D-020)

Driven through `scripts/lib/mutate.mjs` (its arm/restore ledger, not hand-rolled `sed`), every run
wrapped in `timeout 120`, restore in a `trap … EXIT INT TERM`, **each mutant grep-confirmed present
on disk before its run counted**, and a no-op control in the batch.

```
control-noop                          : SURVIVED   (correct — it is a comment)
M1  complete requires marker absent   : KILLED (3)
M2  drop earlier-cycle guard          : KILLED (3)
M3  NaN reads as in-flight            : KILLED (3)
M4  remove fence strip                : KILLED (3)
M5  widen line anchor back to \s*     : KILLED (5)
M6  same-line [ \t]* widened to \s*   : KILLED (3)
M7  first stamp instead of highest    : KILLED (3)
M8  STALE_MS -> 0                     : KILLED (3)
M10 sweep swallows a real fault       : SURVIVED  <-- test gap
M11 isReadyForCheck always true       : KILLED (7)
```

(M9, a corrupt-marker rethrow, failed to apply on a pattern miss and is counted neither way; M1 and
the shipped corrupt-marker test cover that branch.)

**9 of 10 applied mutants killed.** All five mutants the dispatch suggested were killed, including
the two the manifest's whole narrative rests on — M4 (fence strip) and M5 (line anchor).

Post-run: `git diff --quiet HEAD -- scripts/lib/dispatch-state.mjs` → clean;
`node scripts/lib/mutate.mjs assert-clean` → `MUTATIONS CLEAN: none outstanding`.

**M10 is a real finding (ISS-197).** The test at `dispatch-state.test.mjs:195` is named *"a missing
qa/ directory is empty, not a crash — **and a real fault is NOT swallowed**"* and its body is a
single assertion on the ENOENT path. No non-ENOENT case exists anywhere in the file, so
`if (err?.code !== "ENOENT") throw err;` → `if (false) throw err;` survives the full suite untouched.
The source comment above that line specifically claims it prevents "an empty, healthy-looking sweep —
the silent-failure class tracker-audit.mjs already had to fix once", and that claim is currently
unbacked by any test. A test name asserting a property the test never exercises is the same class as
the `vi.mock`-the-component-under-test case Mode D revoked. Medium.

### 5. The five states, and whether `checker-died` can fire on a live checker

The states are right and minimal: `not-pending` (no manifest, or not ready-for-check), `complete`
(verdict ≥ cycle), and the ISS-178 trichotomy. `sweep`'s `rank` orders actionable-first, which is
correct for a reconcile.

**`checker-died` CAN fire on a live checker, and 846 s is not a safe basis for 20 minutes.** The
maker's justification uses the slowest *observed* check, but every Mode A check measured so far is a
non-browser check. A Mode D unit must start a dev server, drive a real browser, and interact with
every behaviour the contract claims; the SKILL requires exactly that and forbids substituting `curl`.
Twenty minutes is not a generous ceiling for that.

I have live evidence from this very check. It is a `scripts/**` unit with no browser and no server,
and `stateOf` reported `ageMs: 382833` — **6.4 minutes** — while I was still only partway through the
corpus scan, before mutation testing had begun. Extrapolating a browser-driving check past
1 200 000 ms is not a stretch.

The consequence is bounded rather than dangerous, which is why this is an EXPLANATION question and
not a FAILURE line: a false `checker-died` costs one duplicate dispatch, and the SKILL's
`INDEPENDENT CONCURRENT CHECK` rule already governs two verdicts landing on the same slug and cycle.
The maker chose that error direction knowingly and said so. But the module has **no heartbeat**, so
the error cannot be corrected by a checker that knows perfectly well it is alive. If a reader is ever
wired up (obligation #5), a `touch`-the-marker heartbeat from the checker, or a raised `STALE_MS` for
UI-touching units, belongs in the same change. Recorded here for whoever writes
`handshake-liveness.md`; not a finding against this artifact.

### 6. The dogfood, and whether it is circular

`qa/dispatch/dispatch-state-tracking.json` was on disk before I started, written by the maker's own
dispatch, and `stateOf` reported `in-flight` twice during this check (307 s, then 383 s) with the
correct cycle and session id. It should read `complete` once this verdict lands, because
`verdictCycle` will find the `Cycle checked: 1` in this file's own heading.

**Partly circular — and the circular half is the half being tested.** The `complete` transition
proves only that the parser can read a stamp this same parser's author formatted. I wrote the heading
form above knowing exactly what the parser accepts, which is the definition of marking your own
homework, and it is the D-015 failure mode in miniature. The corpus run over **114 files written by
other actors across weeks, before this parser existed** is the non-circular evidence, and that is
where I placed the weight.

The `in-flight` half is genuinely meaningful and is *not* circular: a real marker, written by a real
dispatch, read by an independent process, correctly reporting a real running checker. That is
precisely the observation ISS-178 says did not exist, and it is the first time in this repo that a
live check has been visible on disk to anyone but the session running it.

### 7. Claims checked rather than accepted

**"Nothing consumes this yet"** — confirmed. A repo-wide search for `dispatch-state` outside the
module, its own test, and verdict/manifest prose returns no importer. No caller was quietly added.
`qa/dispatch/` contains exactly one file, this unit's own.

*Is a mechanism with no reader worth a PASS?* On balance yes — but only because it is not quite
reader-less: the maker's dispatch is a real writer and this check was a real reader. It is worth a
PASS **as the mechanism it declares itself to be**, and it is emphatically **not** worth flipping
ISS-178 to `fixed`, which is where holding it would actually have mattered. Holding the unit instead
would have blocked a correct, well-tested module behind two approvals the maker cannot grant, and
would have left the *next* dead checker just as invisible while it waited.

**"`lint:structure` is red at HEAD and not because of me"** — **independently verified, and true.**
I re-ran it myself:

```
$ pnpm lint:structure
lint-root: OK   lint-dupes: OK   lint-migrations: OK
FAIL: docs/SNAPSHOT.md is stale (74 line(s) differ from a fresh regeneration)
  line 43: committed="  - `qa/evidence/`"  fresh="  - `qa/debug/`"
  …
```

The 74 "differences" are one **single-line insertion** propagating an off-by-one down the entire tree
listing: `fresh` gains `qa/debug/` at line 43 and every subsequent line shifts by one. `qa/debug/` was
created by commit `ad98add` ("qa/debug: stall diagnosis for write-guard-enforcement-gaps cycle 3") —
**not by this unit**. Neither of the maker's two files creates a directory (`scripts/lib/` already
existed), and neither appears anywhere in the stale diff. Confirmed pre-existing. I reached that by
reading the diff rather than by repeating the maker's stash procedure, so it is an independent path to
the same answer. Not a finding against this unit; it stays for the sweep.

---

## Mode D ruling

**Not applicable.** Judged from the **changed paths** per D-024, not from `qa/adapter.json`: the
commit touches `scripts/lib/dispatch-state.mjs`, `scripts/lib/dispatch-state.test.mjs`, and the
manifest. `qa/ui-surfaces.json` lists `scripts/**` under `genuinely_not_user_facing`, and I confirmed
the indirect case too — no file under `apps/` or `packages/` imports this module, so there is no
retrieval-or-ranking path by which it could change what a page renders. The maker's claim holds.

---

## Findings

All three are **medium**. Per this repo's severity gate they are ledger entries verified inside the
next unit that touches these files, not full-ceremony units, and none of them drives the verdict.

- **ISS-196** — `verdictCycle` overcounts prose in four shapes (`~~~` fence, HTML comment, mid-line
  backtick code span, unclosed/nested ``` fence). This is the *unsafe* direction against the module's
  own documented error-direction claim. No live instance; the code-span shape is live prose in 10
  corpus files and harmless only by luck of the numbers involved.
- **ISS-197** — `dispatch-state.test.mjs:195` names "a real fault is NOT swallowed" and never tests
  it; the mutation `if (false) throw err;` survives the full suite.
- **ISS-198** — `qa/dispatch/` is untracked *and* absent from `.gitignore`, with no deliberate ruling
  either way. A concurrent session's `git add -A` would commit a stale marker permanently; a
  `git clean -fd` erases live ones. The directory needs a decision, most likely `.gitignore`.

Plus a queued **HUMAN_GATE**: START approval for `qa/contracts/handshake-liveness.md`.

---

```
VERDICT: PASS
SCOREBOARD: 3/5 ISS-178 fix-direction obligations met, 1 sound deviation, 1 not met (readers unwired, disclosed); 9/10 applied mutants killed; 113/114 corpus verdicts parsed, 0 prose counted
FAILURES (if any):
- none at >80% confidence. Three medium findings filed (ISS-196/197/198); per this repo's severity gate those are ledger entries, not FAIL lines.
LIVE-BROWSER: not-applicable (scripts/lib/dispatch-state.mjs, scripts/lib/dispatch-state.test.mjs — scripts/** is genuinely_not_user_facing and nothing under apps/ or packages/ imports it)
ISSUES-WRITTEN: ISS-196, ISS-197, ISS-198
EXPLANATION: The module is correct and its evidence is real: I re-derived the corpus myself over all 114 verdicts (113 parse, zero prose counted, and the maker's convenient claim about the one failure checks out — calendar-auto-join.md genuinely has no stamp field), and 9 of 10 applied mutants died, including all five the dispatch suggested. The deliberate deviation from ISS-178's recorded fix direction is sound: deriving `complete` from a matching-cycle verdict makes the marker optional rather than dropping a requirement, and is strictly more robust than depending on a second actor to delete it. ISS-178 nonetheless stays OPEN — the direction's fifth obligation is that sweep check 1 report three states, nothing consumes this module, and the dead-checker defect is still live at HEAD. This belongs in a new qa/contracts/handshake-liveness.md rather than under loop-safety.md, whose north star is mutation damage; that contract is a human-approved START, so I have queued the gate instead of authoring it.
```
