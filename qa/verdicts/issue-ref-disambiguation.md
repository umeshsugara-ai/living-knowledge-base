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
