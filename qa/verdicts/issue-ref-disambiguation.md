# Verdict — issue-ref-disambiguation

**Cycle checked: 1**
**Date:** 2026-09-09
**Commit under check:** `0d7dcc9`
**Contract:** none (the citation corpus is ungoverned; judged against the manifest's own claims,
D-015, and the ISS-136 standing lesson that a number which does not reproduce at the submitted
commit is itself a finding).
**Mode:** A, single checker.

```
VERDICT: FAIL
SCOREBOARD: 9/12 claims evidenced, 3/3 invariants hold
FAILURES:
- [ISS-144 claim] sev: medium · the manifest reports "48 raw lines differed, 2 semantically and 42
  by re-encoding alone" — the three numbers do not add up (2+42=44) and 42 reproduces nothing; the
  ledger row this unit closes states 46, and the reproducible figure at e34ddce is 47
  serialisation-only changes out of 49 · fix: restate from the ledger's own recorded figure per
  D-015 · issue: ISS-147
- [ISS-144 attribution] sev: medium · the damage restored is attributed wholly to e34ddce ("my own
  undisclosed damage"); 144 of the 148 lines rewritten at 0d7dcc9 were compacted by 05db588, a
  CHECKER sweep commit, not by e34ddce, which touched 49 rows · fix: name 05db588 and separate the
  two re-encodings · issue: ISS-148
- [escape-hatch justification] sev: medium · "--gate g1,g4 went red on this file" is not
  reproducible at 0d7dcc9 — the shipped manifest contains no bare reference in the lane's 001-022 range at all,
  and the `(canonical)` escape it justifies has zero users anywhere on disk · fix: either land the
  escape with the reference that needs it, or state that the manifest was rephrased and the escape
  is pre-emptive · issue: ISS-149
ISSUES-WRITTEN: ISS-147, ISS-148, ISS-149, ISS-150
EXPLANATION: The engineering is sound and I would not change a line of it — G4, its tests, the
mutation kills and, most importantly, all 30 reference rewrites verify independently. The FAIL is
narrow and documentary: on a unit whose entire subject is that a cited number must resolve to the
right row, three of the manifest's own numbers do not, including the count for the very ledger
issue it closes. D-015 makes that a violation, not a typo. Correcting the prose clears it.
```

---

## What I re-ran (all at `0d7dcc9`; working tree clean apart from `.goal/goal.json` + `qa/.last-tick`)

| command | my result | manifest claimed | verdict |
|---|---|---|---|
| `node scripts/tracker-audit.mjs --gate g1,g4` | `tracker-audit: OK (gate G1,G4)`, exit 0 | same | OK |
| `node --test scripts/lib/ledger-union.test.mjs` | tests 15 · pass 15 · fail 0 · **cancelled 0** | same | OK |
| `node --test scripts/lib/tracker-audit.test.mjs` | tests 17 · pass 17 · fail 0 · **cancelled 0** | same | OK |
| `pnpm lint:structure` | exit 0 (12/12 lint tests, tracker-audit OK, depcruise 301 modules clean) | exit 0 | OK |

No `cancelled` count anywhere, so nothing is hiding behind a timed-out test.

## Mutation — my own harness, not the maker's

`scratchpad/mut.mjs`: mutates `scripts/lib/tracker-audit.mjs` in place, runs both suites under
`execSync` with `timeout: 180000`, restores the original buffer after **every** mutant and again in
a `finally`, and asserts SHA256 equality against the pre-run digest each time (D-020). Final
restore asserted identical; that path is clean in `git status` afterwards.

| mutation | my result | manifest |
|---|---|---|
| G4 never flags (`if (hits.size)` to `if (false)`) | **killed** | killed |
| drop the qualified-form scope guard (the naive rule) | **killed** | killed |
| ignore `G4_FROZEN` and judge verdicts too | **killed** | killed |
| drop the lane-number filter (flag every bare ref) | **killed** | killed |
| `--gate g1,g4` honours only the first gate | **killed** | killed |
| `(canonical)` mutes the whole file rather than one reference | **killed** | killed |
| **no-op control** | **clean** | clean |

6/6 killed, control clean. The table reproduces exactly.

## The scoping claim — reconstructed independently

I re-derived the lane-number set from the union of `qa/issues.jsonl` + `qa/issues.*.jsonl` without
importing the maker's code (22 lane numbers, 146 canonical ids), then applied both rules myself.

| rule | at `925c802` (pre-fix) | at `0d7dcc9` |
|---|---|---|
| naive — every bare `ISS-NNN` a shard also numbers | 62 files (**58** excluding `G4_FROZEN`) | 59 (55 excl. frozen) |
| scoped — only files that already use the qualified form | 7 (**3** excluding frozen) | 4, all frozen, so **0 findings** |

**The manifest's 58 to 3 reproduce**, with one unstated qualifier: both figures are *after* the
`G4_FROZEN` exclusion. The raw naive count is 62. Worth stating, since the frozen list is doing
part of the noise reduction the prose credits entirely to the scoping rule. A note, not a failure.

### Is the scoping principled or tuned?

**Principled, with a named residual hole.** The rule's logic — a document that never speaks the
qualified dialect cannot be inconsistent in it — is independent of the output it produced, and I
confirmed it against the actual population rather than the maker's summary. All 55 files invisible
to the gate at HEAD are historical master documents (`T-005-ask-router`, `T-016-*`,
`tracker-honesty`, the contracts corpus) whose bare refs correctly mean the canonical row; their
citations sit in contexts that predate any lane.

The decisive test is the merge itself. `c3989ef` added exactly 12 `qa/` files. I inspected every
one: of the four that carry bare lane-range references, **all four also use the qualified form**,
so all four are visible to the gate. Not one lane-authored file escapes through the scope guard.
The rule was not tuned until the output looked right; it is sound for this corpus.

**But the failure mode the dispatch asks about is real, and the manifest understates it.** G4 is
*inverse-selective*: it fires on the inconsistent document and is silent on the consistently wrong
one. A lane whose docs cite only bare ids — precisely the state of `a-speakers` and `b-golden-set`,
which have no shard at all — would merge completely invisibly. Known gap 2 says "G4 catches the
citations *after* such a merge"; it catches them only if the merged docs happen to mix forms, which
is luck rather than mechanism. Filed as **ISS-150** (medium), a scope note on ISS-130 rather than a
defect in this unit.

## The `(canonical)` escape, judged adversarially

**Yes, an author can mute a real ambiguity by appending the marker, and nothing checks the
assertion.** It is a suppression comment: the gate is title-blind, so `ISS-021 (canonical)` is
accepted purely on the author's say-so, and a careless author clearing a red gate has two
mechanical outs — qualify the id (wrong, and the manifest's own gap 3) or append the marker
(silent).

I still judge it **acceptable in principle**: it is per-reference (the whole-file mutation is
killed), it is greppable, and it forces the author to *state* a judgement the gate cannot make,
which is strictly better than the gate guessing. That is the ordinary eslint-disable bargain, and
this repo already accepts it in the larger form of `G4_FROZEN`.

What I do not accept is the justification as written. The manifest says the gate fired on this very
file and that this earned the escape. **At `0d7dcc9` that is not reproducible**: the shipped
manifest contains no bare reference in the lane range at all (its lane-range mentions are written
`"021"` and `"022"`, unprefixed), so the gate cannot fire on it, and `(canonical)` has **zero users
in `qa/manifests/`, `qa/verdicts/` or `qa/contracts/`**. Production gate code gained a suppression
mechanism justified by an event no one can re-observe. Under ISS-136's standing lesson that is a
finding — ISS-149.

## ISS-144 — the restoration verified, the accounting not

Parsing `git show 925c802:qa/issues.jsonl` against `git show 0d7dcc9:qa/issues.jsonl`:

- **148 rows both sides. Zero added, zero removed, zero duplicate ids, id order byte-for-byte
  identical.**
- **Zero semantically changed rows** (key-sorted JSON comparison of every row).
- 144 lines differ in bytes; every difference is serialisation.
- 139 of the 143 rows that existed before `e34ddce` are now **byte-identical to their pre-damage
  form**. The four that are not — ISS-111, ISS-130, ISS-132, ISS-133 — were legitimately edited by
  later commits. 135 of the 139 rows that differed from the original at `925c802` are restored.
- Escapes remaining at HEAD: `ISS-109` alone carries genuine `\uXXXX` sequences, and it carried them
  before `e34ddce` too. The manifest's claim here is correct.

**The restoration is sound and meaning-preserving. The story told about it is not.**

**On the number 42.** At `e34ddce`, keyed by row id, 49 rows changed: 41 gained escapes, 4 went
compact to spaced, 2 changed serialisation otherwise (`ISS-109`, `ISS-139`), and **2 changed
semantically** (`ISS-111`, `ISS-132` — the unit's intended edits). So 47 serialisation-only, or 41
if you count only escape-gaining rows. The canonical ledger row **ISS-144 itself records 46**. The
manifest reports 42, which matches neither, and its own sentence — "48 raw lines differed, 2
semantically and 42 by re-encoding alone" — does not add up. D-015 requires the fix to be measured
against the issue's own recorded figures; 42 is a fourth number from nowhere. **ISS-147.**

**On the attribution.** The manifest presents the whole restoration as repairing "my own
undisclosed damage" at `e34ddce`. I traced every commit touching `qa/issues.jsonl` between
`e34ddce` and `925c802`: the file was 139-spaced / 4-compact before `e34ddce`, entirely spaced
after it, and **entirely compact at `05db588` — "checker: Mode B sweep"**. The 144-line whitespace
rewrite this unit undoes was introduced by a *checker*, not by the maker's earlier commit.
`e34ddce`'s share is 49 rows. **ISS-148.**

That misattribution has a governance edge. The manifest declines to touch `qa/verdicts/` on the
grounds that they are checker-owned and "a maker rewriting a verdict is the self-certification this
pair exists to prevent" — a position I endorse. `qa/issues.jsonl` is checker-owned by the same
skill (`/checker` is its "single writer"), and this unit rewrote all 148 of its lines. I am not
failing on it: the change is provably null, the repo's practice already tolerates maker ledger
writes, and the outcome is a *more* faithful record. But the ownership argument should be applied
consistently, or the exception stated.

## The 30 rewritten references — checked one at a time

I read every rewritten line in `guarded-fetcher.md`, `watched-sources-run.md` and
`watched-sources-url-normalisation.md` against the titles and severities in
`qa/issues.c-unrun-writers.jsonl`. **All 30 are correct.** The ones most capable of being wrong:

- `ISS-C-UNRUN-WRITERS-010` "this manifest did not exist for cycle 1" to shard 010 "dispatched for
  check with no evidence manifest on disk". Correct.
- `007` docstring overclaim to shard 007 "docstring claims the checked resolution is the one the
  caller uses; nothing pins it". Correct. And the later "check-to-connect window remains (007) …
  now tracked as 011" is coherent with shard 011, which is that window.
- `014` (`timeoutMs > 2^31-1`) and `015` (Promise.race cannot cancel the transport) match their
  shard rows verbatim, severities low/medium included.
- `018` "the fixture's `run` took no argument" to shard 018, the unpinned tenant argument on
  `POST /watched-sources/run`: the same finding stated from the fix side.
- `021` (high, `lint:structure` red, `apps/api/src` 31 files against a budget of 30) and `022` (low,
  98 ingest tests claimed vs 97 reproducing) match exactly, severity included.
- The `003` to `004` correction resolves to shard 003 (credentials in URL) and 004 (no
  de-duplication), exactly as the prose describes.

**`ISS-136` and `ISS-137` are correctly left bare.** Both resolve in the canonical ledger (136
medium/fixed — a manifest presenting `lint:structure` as passing when it did not; 137 high/verified
— the ENOENT-narrowed catch), and both are used in prose that means the canonical row. They are
also outside the lane's 001–022 range, so G4 would not have flagged them either way — the manifest
implies more care was demanded here than the mechanism actually demanded.

## The four declared gaps

1. **66 verdict refs frozen.** Accepted, and correctly reasoned. Freezing checker-owned debt in a
   named, shrink-only list beats a maker editing verdicts. As the checker on this unit I note the
   debt is now mine to clear, not the maker's.
2. **Lanes without shards.** Accurate, correctly deferred to ISS-130 — but see the overclaim above;
   G4 catches a post-merge citation only when the merged doc mixes forms. ISS-150.
3. **G4 is title-blind — the maker invites a FAIL here.** Declined on the merits. The gate is
   net-positive: it turns an invisible ambiguity into a commit-time one, cannot fire on any
   pre-lane document, is fully clearable by its own author in the same commit (G1's stated
   criterion for gating), and offers a stated-judgement escape rather than guessing. Title-blindness
   makes it a *finder* of places needing human judgement, not a fixer — which is what the manifest
   says it is. A gate that made the judgement itself would be the more dangerous artifact.
4. **The repair is not pinned by a test.** Correct and honestly stated. A byte-stability check on
   the ledger would have caught both `e34ddce` and `05db588`, and is the highest-value follow-up
   here. Not required of this unit; worth queueing.

## Not failures — notes

- `58` and `3` are post-`G4_FROZEN` counts; the raw naive figure is 62. Say so next time.
- `ISS-C-UNRUN-WRITERS-017/018/019/020` qualifies only the first element of the run. G4 does not
  match a bare `018`, so it passes the gate, but the shorthand is the same ambiguity in miniature.
- **G4 has a third false-positive class the manifest does not name: a range expression.** Writing
  this verdict, `--gate g1,g4` went red on it for a phrase naming the low end of the lane's numbering range as a bare id — a
  boundary of a range, not a citation of anything. I rephrased rather than reach for `(canonical)`,
  which would have been a false statement (the text does not cite that canonical row at all). The escape
  hatch covers "I mean the canonical row"; it has no form for "this is not a citation".
- G4 scans `qa/{manifests,verdicts,contracts}` only. Commit messages, `qa/QUEUE.md`, `TASKS.md` and
  `docs/` carry citations too and are ungated. Deliberate-looking, but unstated.

## Ledger

ISS-142 and ISS-144 both remain `open` at `0d7dcc9`. ISS-142's substance is fixed (30 refs
qualified, gate live) but I am holding it `open` pending the cycle-2 correction so that its
close-out and this verdict move together. New: ISS-147, ISS-148, ISS-149, ISS-150.

---

# Verdict — issue-ref-disambiguation

**Cycle checked: 2**
**Date:** 2026-09-09
**Commit under check:** `3380e84`
**Contract:** none (ungoverned citation corpus; judged against the manifest's own claims, D-015,
and the ISS-136 standing lesson that a number which does not reproduce at the submitted commit is
itself a finding).
**Mode:** A, single checker. Bound root: `D:/KnowledgeBase`.

```
VERDICT: FAIL
SCOREBOARD: 9/12 claims evidenced, 3/3 invariants hold
FAILURES:
- [range-endpoint rule] sev: high · the rule shipped this cycle skips any bare `ISS-NNN` that sits
  next to an em dash, en dash or `--`, which is this repo's house punctuation around citations, so
  ordinary citations now pass G4 silently; 152 of the 2,031 bare three-digit refs in `qa/*.md` are
  muted by it and the sampled ones are citations, not ranges · fix: match a whole range EXPRESSION
  (`ISS-\d{3}` required on BOTH sides of the separator) instead of sniffing 8 characters of
  context, and drop bare em/en dash from the separator set · issue: ISS-151
- [ISS-147 mechanism] sev: medium · the corrected partition 2 + 41 + 5 = 48 reproduces exactly, but
  the reason given for the 5 — "`json.dumps` also reordered keys" — is false: key order is
  identical in all five; the change is separator whitespace · fix: restate the cause as default
  separators re-spacing the rows; the conclusion drawn from the 5 survives · issue: ISS-152
- [ISS-149 residue] sev: medium · the unevidenced "this gate fired on the very manifest that
  shipped it" survives verbatim in `scripts/lib/tracker-audit.mjs:244-245` and
  `scripts/lib/ledger-union.test.mjs:186-188`, both in files this commit edited, while the manifest
  above them concedes it fired on a draft · fix: restate both comments to the checkable version ·
  issue: ISS-153
ISSUES-WRITTEN: ISS-151, ISS-152, ISS-153
EXPLANATION: The three documentary FAILures of cycle 1 are answered honestly and the arithmetic now
survives independent re-derivation. But the one piece of NEW CODE this cycle — the range-endpoint
skip written in response to my own verdict tripping the gate — punched a hole in the gate it was
patching: a dash beside a lone id is prose, and this repo writes em dashes beside citations
constantly. A gate that goes quiet on the house style is the dead-gate failure the manifest itself
warns about, arriving by the same route as the bug it fixed.
```

## What I re-ran (all at `3380e84`)

| command | my result | manifest claimed | verdict |
|---|---|---|---|
| `node scripts/tracker-audit.mjs --gate g1,g4` | `tracker-audit: OK (gate G1,G4)`, exit 0 | same | OK |
| `node --test scripts/lib/ledger-union.test.mjs` | tests 17 · pass 17 · fail 0 · **cancelled 0** | same | OK |
| `node --test scripts/lib/tracker-audit.test.mjs` | tests 17 · pass 17 · fail 0 · **cancelled 0** | same | OK |
| `pnpm lint:structure` | exit 0 (tracker-audit OK, depcruise 301 modules / 918 deps clean) | exit 0 | OK |

No `cancelled` count anywhere. **Working-tree note:** a concurrent session added untracked
`qa/contracts/{entity-promotion,vector-retrieval}.md` while I was checking; `entity-promotion.md`
cites a bare in-range id and makes the gate red *in the live tree*. That is another session's file, not
this unit's — at `3380e84` the gate is green, and I confirmed it before those files appeared.

## 1. ISS-147 — the partition, re-derived independently

`git show e34ddce~1:qa/issues.jsonl` vs `git show e34ddce:qa/issues.jsonl`, keyed by id, not by
the maker's arithmetic:

| kind | my count | manifest |
|---|---|---|
| rows added / removed | 0 / 0 | — |
| raw differing lines | **48** | 48 |
| semantically changed (`ISS-111`, `ISS-132`) | **2** | 2 |
| escape-only (parse-identical, gained a `\u` escape) | **41** | 41 |
| other re-serialisation (`ISS-109`, `ISS-126`, `ISS-127`, `ISS-128`, `ISS-C-TOPICREFS-ARG-001`) | **5** | 5 |
| sum | **48** | 48 |

The four numbers sum, the row identities match exactly, and there is **no sixth category**: each of
the 48 falls in exactly one bucket, and the 5 "other" rows are parse-identical (so not semantic)
and gained no escape (so not escape-only). ISS-147 is answered as a count.

**But the stated cause of those 5 is wrong** (ISS-152). The manifest says they prove `json.dumps`
"also reordered keys". Key order is identical in all five — the diff is separator whitespace,
`,"` becoming `, "` — plus, for `ISS-109` alone, an em dash newly written as an escape. The
*conclusion* ("restore the escapes" would have been incomplete) is right; the mechanism cited for
it is not, on a unit about citing mechanisms accurately.

`ISS-109` at HEAD is byte-identical to its pre-`e34ddce` form (`cmp`), so the manifest's "one row
still carrying an escape because it always did" is accurate.

## 2. ISS-148 — both counts confirmed, and the ownership ruling

- `e34ddce`: **48** of 143 lines touched. Confirmed.
- `05db588`: 143 → 145 lines, **all 143 pre-existing lines rewritten**, 2 rows added, **0
  escape-gaining lines** (rows carrying escapes went 43 → 1: the sweep *undid* them). Confirmed,
  and `git log -1 05db588` is indeed `checker: Mode B sweep`.
- This cycle's own ledger edit: `git show 3380e84 -- qa/issues.jsonl` = 16 changed lines over **8
  rows** (`ISS-126/127/128/144/147/148/149/C-TOPICREFS-ARG-001`) out of 148. Row-level, not a
  re-serialisation. Confirmed.

**The ownership ruling, since you asked for it plainly: `qa/issues.jsonl` is checker-owned
outright.** `checker/SKILL.md` says so twice — the checker is the "single writer of `qa/contracts/`
and of the `qa/issues.jsonl` ledger", and the ledger is named under "Checker-owned surfaces … the
only places it writes". Your "row-level shared, whole-file not" is narrower than the rule already
on the books, and you correctly predicted the objection: it was constructed after the fact and it
licenses the thing you did. Treat row edits as **requests**, not writes — state them in the
manifest's `Issues addressed` or in `qa/feedback-inbox.md` and let the checker move the row. I am
not failing you for the past status flips (they are the customary handshake here and I have made no
issue of them) and I am not asking you to revert anything; from cycle 3 on, don't write the file.

## 3. ISS-149 — half fixed

The manifest now states only what reproduces: it fired on a draft, the shipped commit cannot
demonstrate it, the trigger is reproducible on demand, and the escape had zero users at `0d7dcc9`.
I confirmed the last of those and it is stated without embellishment. The cycle-1 prose above it
stands unedited but is explicitly superseded by the cycle-2 section, which is this file's
convention — I do not read that as a quiet re-assertion.

What *is* a re-assertion is the source: `tracker-audit.mjs:244-245` and
`ledger-union.test.mjs:186-188` still tell the retracted story verbatim, in files this commit
edited. Code comments outlive the manifests that correct them. ISS-153.

## 4. The range-endpoint rule — adversarially, it is a bypass

The rule (`tracker-audit.mjs:251-253`) looks at 8 characters either side and skips the id if it
sees `..`, `--`, `–` or `—`. It never requires anything that looks like a range. My probe (temp
root, ledger `[ISS-051, ISS-LANE-051]`, one manifest that uses the qualified form):

```
FLAGGED  | baseline plain citation
SILENT   | citation preceded by an em dash      ("the count — ISS-051 is still open.")
SILENT   | citation followed by an em dash      ("ISS-051 — still open, per the ledger.")
SILENT   | citation preceded by an en dash
SILENT   | citation inside a `--` aside
SILENT   | markdown bullet 'ISS-051 -- title'
SILENT   | genuine range ISS-001..022           (intended)
SILENT   | genuine range ISS-001..ISS-022       (intended)
```

Five ordinary-citation forms are muted, and the last of them — `- ISS-NNN -- <title>` — is a shape
this repo's own documents use. Blast radius over `qa/{manifests,verdicts,contracts}/*.md` at
`3380e84`: **2,031 bare three-digit refs, 152 silenced by this rule**, the sample being citations
(`derived-input-trust.md` "**ISS-049** — my ex…", `claims-degradation-honesty.md` "nding —
ISS-060 (high)") rather than ranges. The suite cannot see it: "the range rule does not excuse an
ordinary citation on the same line" (`ledger-union.test.mjs:219`) tests a citation that is not
dash-adjacent, so it passes either way.

The rule is load-bearing all the same — it is not dead code, it is over-broad. Fix direction in
ISS-151: require `ISS-\d{3}` on both sides of the separator, match the range as one expression, and
drop bare em/en dash from the separator alternation.

## 5. Mutation — my own harness (D-020)

`scratchpad/mut.py`: copies `scripts/` **and `qa/`** to a scratch root (the bound repo's working
tree is never mutated — asserted at the end by comparing the repo file's SHA256 to the pre-run
digest), byte backup, `subprocess.run(..., timeout=300)`, restore in `finally`, SHA256 asserted
against the backup before the next mutant.

| mutation | my result | manifest |
|---|---|---|
| **the range-endpoint rule removed** | **killed** | killed |
| G4 never flags anything (`if (false)`) | **killed** | killed |
| drop the qualified-form scope guard (the 58-file version) | **killed** | killed |
| ignore `G4_FROZEN` and judge verdicts too | **killed** | killed |
| drop the lane-number filter | **killed** | killed |
| `--gate g1,g4` honours only the first gate | **killed** | killed |
| the `(canonical)` escape mutes the whole file | **killed** | killed |
| **no-op control** | **clean** | clean |

7/7 killed, control clean; the six cycle-1 mutants re-derived independently and all agree.

**A trap worth recording:** my first harness copied only `scripts/`, and `G4_FROZEN ignored`
**survived**. The cause was my harness, not the code — `ROOT` resolves relative to the module, so
in a scratch root without `qa/` the test "G4: master itself is clean under this gate" reads a
missing directory and asserts nothing. Any mutation harness for this module must copy `qa/` too or
that test is vacuous.

## 6. Cycle-1 regressions — none

- `git diff 0d7dcc9 3380e84 -- scripts/lib/tracker-audit.mjs` is **exactly the 7 added lines** of
  the range rule. Nothing else in the gate moved.
- `G4_FROZEN` byte-identical to cycle 1 (the same 4 verdict paths), and its entries still produce
  findings when the freeze is lifted, so the freeze is real rather than vacuous.
- `ISS-136` and `ISS-137` still bare in `qa/manifests/watched-sources-run.md`, once each.
- The qualified rewrites stand: 15 / 16 / 7 `ISS-C-UNRUN-WRITERS-NNN` refs in `guarded-fetcher`,
  `watched-sources-run`, `watched-sources-url-normalisation`.
- ISS-144's restoration is still semantically null: of the 143 ids common to `e34ddce` and HEAD,
  exactly 2 parse differently (`ISS-130`, `ISS-133`) and both are later *sweep* appends to
  `evidence`, not restoration damage. Ledger at HEAD: 155 rows, 155 unique ids, 0 duplicates.

## What must land in cycle 3 (a cycle-3 FAIL is STALLED)

1. **ISS-151 — the only one that is not prose.** Re-express the range rule so it matches a range
   rather than a dash, and add the cases that pass today as tests (`… — ISS-0NN …` must FLAG, on
   both sides). If you would rather withdraw the rule than get it right under time pressure, that
   is acceptable: rephrase the one verdict line it was written for and delete the rule, its two
   tests and its mutant. Either clears this. Leaving it as shipped does not.
2. **ISS-152** — one sentence: default separators re-spaced the rows; key order never changed.
3. **ISS-153** — the two code comments restated to the checkable version.
4. Do not write `qa/issues.jsonl` again (§2 ruling). ISS-142/144/147/148/149 move when a checker
   moves them.

Nothing else. The engineering outside the range rule is sound and I would not touch it.

---

# Verdict — issue-ref-disambiguation

**Cycle checked: 3**
**Date:** 2026-09-09
**Commit under check:** `ccd81d4`
**Bound root:** `D:/KnowledgeBase`
**Mode:** A (unit check). This is the **re-dispatch** of cycle 3 — the earlier cycle-3 run returned
`BLOCKED` (plan mode) and wrote no file, so it consumed no fix cycle. I treated none of its
reported evidence as established and re-derived everything below independently.

```
VERDICT: PASS
SCOREBOARD: 12/12 verify items reproduced, 4/5 disclosure invariants hold
FAILURES: none blocking
ISSUES-WRITTEN: ISS-162, ISS-163, ISS-164
EXPLANATION: ISS-151 — the high-severity finding that made this the last cycle — is genuinely and
demonstrably closed: my own probe flags all five previously-silent shapes, leaves the three genuine
range spellings silent, and the corpus mute count falls 152/2031 to 24/2266 with every one of the 24
inspected and genuine. ISS-152 and ISS-153 re-derive exactly. Every number the manifest states
reproduces at ccd81d4, including its refusal to report a green gate. What remains are two medium
documentation defects (a stale G4_FROZEN claim carried from cycle 1, and an unnamed narrowing of a
standing test) plus the ruling the maker asked for — none blocking under this repo's severity gate.
```

## How I ran it

`git worktree add --detach <scratch> ccd81d4` — a **full** worktree, not a copy of `scripts/`,
because `ROOT` in these modules is module-relative and a partial tree makes the "master is clean"
test vacuous. Every command below ran in that tree at `ccd81d4`. Master's working tree was dirty
with another lane's in-flight edits and was never used for evidence.

## The four verify commands, re-run

```
$ node --test scripts/lib/ledger-union.test.mjs    tests 20  pass 20  fail 0  cancelled 0
$ node --test scripts/lib/tracker-audit.test.mjs   tests 17  pass 17  fail 0  cancelled 0
$ node scripts/tracker-audit.mjs --gate g1,g4      1 finding, exit 1
$ pnpm lint:structure                              exit 1, failing at the tracker-audit step
```

Counts and **`cancelled 0`** match the manifest exactly. The gate is red, exactly as the manifest
says, with exactly the one finding it names.

## 1. ISS-151 — the crux. Closed.

I wrote my own probe against `auditIssueRefs` with a synthetic lane ledger numbering 006/017/022. Results (ids shown as roles, not as tokens — see the note at the end of section 9):

```
FLAGGED | em-dash PRECEDED citation                  [flagged]
FLAGGED | em-dash FOLLOWED citation                  [flagged]
FLAGGED | en-dash form                               [flagged]
FLAGGED | `--` aside                                 [flagged]
FLAGGED | list item `- ISS-0NN -- title`             [flagged]
silent  | GENUINE range lo..hi (bare-hi spelling)                 (intended)
silent  | GENUINE range lo..ISS-hi (both prefixed)             (intended)
silent  | GENUINE range lo-hi (hyphen spelling)                  (intended)
FLAGGED | SMUGGLE: range spanning a citation         [flagged]
FLAGGED | SMUGGLE: citation between range endpoints  [all three flagged]
silent  | `(canonical)` escape                       (intended)
```

All five shapes the cycle-2 rule muted are flagged again. Genuine ranges stay silent. Two deliberate
smuggling attempts — wrapping a citation inside a wide range, and sitting one between two endpoints —
both fail to hide it.

**Corpus re-measurement over every `.md` under `qa/`: 2,266 bare three-digit refs, 24 muted.** I
printed and read the surrounding 120 characters of **every one of the 24**: 23 are genuine range
expressions (`ISS-091..ISS-100`, `ISS-029..ISS-033`, `ISS-024..ISS-028`, `ISS-078..082`,
`ISS-001..ISS-141` in the QUEUE table, and so on) and one is the `(canonical)` escape in the cycle-2
verdict. **Zero false mutes.** Against 152 muted ordinary citations at cycle 2, the rule is not
narrowed — it is correct.

### The one new bypass I did find, and why it is not a failure

An em-dash chain of three ids mutes the middle one: the regex consumes the first two as a range,
so a citation can be hidden by writing an adjacent id before it across an em dash. I searched the real
corpus for this shape and **found zero instances** — all 24 mutes are `..` spellings. A theoretical
shape with no corpus presence is an `EXPLANATION` note under the >80%-confidence rule, not a FAILURE
line, and not worth a ledger row.

## 2. ISS-152 — re-derived from `e34ddce~1` vs `e34ddce`. Correct.

```
differing lines total: 48
semantic:              2   (ISS-111, ISS-132 — the intended edits)
escape-gaining:       42   (of which ISS-109 already carried escapes: 78 -> 79)
no escape change:      4   (ISS-126, ISS-127, ISS-128, ISS-C-TOPICREFS-ARG-001)
2 + 41 + 1 + 4 = 48        OK
rows before/after: 143 / 143
```

**Key order is byte-identical in all five** of the rows the manifest tables — verified per row by
comparing `Object.keys` order, not by eye. The first differing byte of each of the four re-spaced rows
is **byte 6**, `,` to `, ` — `json.dumps`'s default separator, exactly as claimed. `ISS-109`'s first
difference is at byte 3752 and is an em-dash escape on a row that already held 78 of them. The
retraction of the invented "reordered keys" mechanism is itself accurate.

One note, not a finding: key order *did* change on `ISS-111`, a semantic row. The manifest's claim is
scoped to "all five" and is true as written.

## 3. ISS-153 — the retraction reached the code.

`grep -rni` over `scripts/` at `ccd81d4` finds no trace of *"fired on the very manifest that shipped
it."* Two `fired on` hits remain and both are legitimate: an unrelated `golden-set-build.mjs` comment,
and `ledger-union.test.mjs:215` recording that G4 fired on a checker's verdict for `ISS-001..022` —
an event I confirmed is real and reproducible, and the reason the range rule exists. The replacement
comment in `tracker-audit.mjs` claims only that a document explaining ambiguity must quote ambiguous
numbers, which is a general statement about the escape and reproduces. Occurrences in `qa/` are the
retraction itself and the prior verdicts describing it — meta-references, correct.

## 4. No ledger write.

`git show --stat ccd81d4` touches `.goal/goal.json`, the manifest, `ledger-union.test.mjs` and
`tracker-audit.mjs`. `qa/issues.jsonl` is **not** in the commit. The ownership ruling was honoured.

## 5. The red gate: honest disclosure, and I cleared it as owner.

The single finding is `qa/contracts/entity-promotion.md` citing a bare in-range id. I verified each
link of the maker's account rather than accepting it:

- **The finding is correct.** The file uses `ISS-C-CLAIMS-TARGETING-001`, so it is judged; the
  canonical row at that number is *"Segregation of duties: contract authored by the maker session"*
  while `ISS-C-UNRUN-WRITERS-006` is an unrelated IPv6 range-table finding. The number is genuinely
  ambiguous.
- **It is not the maker's file.** Committed by `09f8997`, *"checker: init-contract vector-retrieval +
  entity-promotion"* at 06:28, ten minutes before `ccd81d4` at 06:38. Contracts are checker-owned by
  `checker/SKILL.md`.
- **The "green at `3380e84`" claim reproduces.** I checked out `3380e84`: `tracker-audit: OK (gate
  G1,G4)`, exit 0, and `entity-promotion.md` did not exist there.

**Ruling: honest disclosure, not a unit shipping a red gate.** The maker reported the failure
prominently, refused to print a green summary, and explicitly declined to narrow the gate to make its
own unit pass — which is the behaviour this pair exists to produce. Charging a FAIL here would stall a
unit for another role's file *and* reward the silent-narrowing alternative the maker declined.

**As the owner of `qa/contracts/`, I cleared it in this commit** — a routine amendment qualifying the
header citation with the `(canonical)` marker, with a logged reason. `--gate g1,g4` on master is now
`OK`, exit 0.

## 6. Mutation — my own harness (D-020), 7 mutants + control

Worktree-scoped paths; `timeout: 300000` on every run; byte backup restored in a `finally`;
**SHA256 asserted equal to the original after every mutant** and `git status --porcelain` confirmed
empty at the end. Where a text pattern failed to match I re-cut by line index and by string index
rather than reporting a phantom kill — three of my first-pass patterns did not match and I did not
count them until they did.

| mutation | result |
|---|---|
| G4 never flags anything (`if (false)`) | **killed** |
| drop the qualified-form scope guard (the 58-file version) | **killed** |
| ignore `G4_FROZEN` and judge verdicts too | **killed** |
| the `(canonical)` escape mutes the whole file | **killed** |
| range rule removed entirely (`ranges = []`) | **killed** |
| **regression: back to the cycle-2 context sniff** | **killed** |
| range regex stops requiring digits on the right | **killed** (4 assertions fail, incl. the list-item and both-sides tests — a semantic kill, not a crash) |
| **no-op control** | **clean** |

## 7. The narrowed standing test — defensible, but it should have been named

`"G4: master itself is clean"` became `"G4: master's manifests and verdicts are clean"`, filtered to
manifests and verdicts, in the same cycle a contract reddened it.

**Ruled defensible on the merits and under-disclosed in form.** A repo-wide assertion that a
concurrent lane's in-flight file can redden is a test people delete, and the reasoning is written
honestly into the test itself. But the manifest — which documents the red gate across two paragraphs —
never mentions that a standing assertion was narrowed, on a unit whose entire subject is disclosure.
The concrete cost: the test now reports green while `lint:structure` is red, so it no longer detects
the gate's own failure. **ISS-163, medium.** Not blocking: the assertion still kills the
right-hand-digits mutant, so it has not been hollowed out.

## 8. The ruling the maker asked for — G4 as a shared, ownerless gate

**Decision: scope G4's *gating* by ownership. `qa/manifests/` blocks; `qa/verdicts/` and
`qa/contracts/` are reported advisory. Do NOT drop G4 from `lint:structure`.** Filed as **ISS-164**.

The reasoning, against the alternative:

- `tracker-audit.mjs`'s own header states the criterion: a gate belongs in the commit gate only when
  it is *"fully in the author's control and always clearable in the same commit"*, and G2/G3 are
  excluded because each *"depends on someone ELSE acting later."* **G4 as shipped violates that
  criterion** — proven twice over, by the frozen verdict list (conceded before shipping) and by the
  `entity-promotion` incident (proven after).
- But the objection is true of `qa/verdicts/` and `qa/contracts/` and **false of `qa/manifests/`**,
  which the committing maker always owns and can always clear in the same commit. Dropping the whole
  gate to the sweep discards the half that satisfies the criterion perfectly and converts G4 into
  precisely the deferred, someone-else-acts-later class the header says people learn to bypass. That
  is why I reject the earlier run's recommendation: it generalises the ownership argument past where
  it holds.
- The residue — ambiguous refs in checker-owned files with nobody forced to clear them — is a **sweep
  duty, and the checker side accepts it here**: the sweep reads G4's advisory output over
  `qa/verdicts/` and `qa/contracts/` and files against the checker. The maker is not asked to build a
  checker's obligation.
- Once gating is ownership-scoped, ISS-163's narrowing can be reverted and the standing assertion can
  go back to repo-wide.

## 9. The four Known Gaps

1. **66 frozen verdict refs** — accepted as visible, named debt. **But one claim attached to it is
   false**, in the manifest *and* verbatim in the `G4_FROZEN` source comment: *"any NEW ambiguous ref
   anywhere fails, and the list can only shrink."* `if (G4_FROZEN.has(rel)) continue;` skips the
   **file**, not its existing refs. I probed it: appending a new bare in-range citation to
   `qa/verdicts/watched-sources-run.md` leaves `--gate g4` silent about it. **ISS-162, medium.** This
   is the ISS-153 shape — an unreproducible claim in source on a unit about claim accuracy — carried
   unexamined through three cycles, mine included until I probed it. It is **not blocking**: the
   exemption covers four named, already-conceded files, where ISS-151 muted 152 live in-corpus
   references. Under this repo's severity gate a medium is a ledger entry verified by the next unit
   touching the file, and the cheapest real fix is a checker qualifying its own four verdicts, which
   empties the set.
2. **ISS-130 (the two shardless lanes)** — genuinely out of this unit's scope, genuinely untouched,
   correctly still open. Accepted.
3. **G4 is title-blind** — accepted, and I demonstrated it on myself: my first draft of the contract
   amendment log above re-reddened the gate by writing the ambiguous number while *describing* the
   fix, and I had to rephrase. The gap is real, correctly stated, and correctly presented as making a
   human judgement cheaper rather than unnecessary. It does not make G4 net-negative: the alternative
   is 96 silently repointed citations.
4. **The escape had no user** — accurate at `ccd81d4`. I confirmed the sole occurrence in a judged
   file is a backticked *mention* inside the cycle-2 verdict, not a load-bearing use. **That gap is
   closed by this commit**: the qualified citation in `qa/contracts/entity-promotion.md` is the
   escape's first real user, written because the citation genuinely means the canonical row and
   rephrasing would have obscured it. Keeping the escape was the right call.

## Ledger

- `ISS-142` -> **fixed**, with the 66-ref residual recorded and handed to ISS-162.
- `ISS-144` -> **fixed** (partition independently re-derived).
- `ISS-151`, `ISS-152`, `ISS-153` -> **verified** — each re-derived by me this cycle, not taken from
  the manifest.
- New: **ISS-162** (medium), **ISS-163** (medium), **ISS-164** (medium, the ruling).

## Why this is a PASS on the last cycle

The finding that made cycle 3 the last one was a **bypass**: a gate reporting green over 152 live
citations. I attacked it independently — five shapes, three range spellings, two smuggling attempts,
a full-corpus mute census with all 24 mutes read by hand, and seven mutants with a clean control —
and it is closed. Every number in the manifest reproduces, including the one it refused to make look
good. Three mediums remain, two of them documentation and one of them a ruling I have now made; this
repo's own severity gate says a medium is a ledger entry, never a stalled unit.

## Postscript — the gate caught this verdict, twice

Writing the section-9 gap-3 ruling, `--gate g1,g4` went red on **this verdict file**: my probe
tables quoted synthetic in-range ids as tokens, and my contract amendment log described the fix by
writing the ambiguous number. Both are true positives by the rule and false positives in meaning —
gap 3 exactly, hit twice in one check by the checker ruling on it.

I cleared both by rephrasing rather than by reaching for the escape, because these were placeholders
in a synthetic ledger and not citations of the canonical row. **That makes three checkers who have
now preferred to rephrase**, which is real evidence for the maker's gap 4 — and it is why I did not
treat gap 4 as a reason to remove the facility: the one place in this commit where a bare id genuinely
*did* mean the canonical row (the contract header) is the one place the escape was the right tool.
The pattern is not "the escape is unused"; it is "the escape is for citations, and most in-range ids
in QA prose are illustrations." Both should stay available.
