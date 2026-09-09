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
