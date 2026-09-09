# Verdict — dispatch-state-quoting-and-vacuity

**Cycle checked: 1**
**Date:** 2026-09-09
**Checker:** Mode A, fresh context, bound to `D:\KnowledgeBase`
**Manifest:** `qa/manifests/dispatch-state-quoting-and-vacuity.md` (Status: ready-for-check, Fix cycle 1)
**Commits judged:** `d8c2eba` (fix), `b7d91bd` (manifest)
**Contract:** none. Judged against the recorded `fix_direction` of ISS-196/197/198.

```
VERDICT: PASS
SCOREBOARD: 3/3 issues met, 2/2 module invariants hold (undercount-is-safe on the live corpus; verdict beats marker)
FAILURES: none
LIVE-BROWSER: not-applicable (scripts/lib/dispatch-state.mjs, scripts/lib/dispatch-state.test.mjs, .gitignore — none under apps/ or packages/; no importer outside scripts/)
ISSUES-WRITTEN: ISS-199 (medium, residual quoting shapes — filed, not blocking)
EXPLANATION: All five recorded reproductions of ISS-196 now return -1, the ISS-197 test is
mutation-proven non-vacuous (M10 kills, and ENOTDIR — not ENOENT — is what Windows actually
raises here, so the vacuity the issue described cannot recur silently), and ISS-198's ruling is
encoded at .gitignore:57 without breaking the module's cross-session claim. I re-derived the
corpus comparison against commit 14cf3b1's parser myself: zero of 115 verdicts changed their
parsed cycle and the same single file (calendar-auto-join.md) is unparsed, so the maker's
"no verdict lost its stamp" claim holds independently. Three quoting shapes outside the issue's
recorded set still overcount (ISS-199); they are the same class this fix narrowed, none occurs
parseably in the live corpus, and none is in a recorded fix direction — filed, not a FAIL.
```

## On the contract question

I agree with my predecessor. A checker authoring `qa/contracts/handshake-liveness.md` and then
grading against it is self-certification; leaving it as a HUMAN_GATE was correct. Judging against
three recorded `fix_direction` strings is workable for a unit this size and would not be for the
next one.

## What I re-ran (evidence I produced, not the maker's paste)

```
$ node --test scripts/lib/dispatch-state.test.mjs
ℹ tests 16   ℹ pass 16   ℹ fail 0   ℹ cancelled 0

$ git check-ignore -v qa/dispatch/dispatch-state-tracking.json
.gitignore:57:qa/dispatch/	qa/dispatch/dispatch-state-tracking.json
$ git status --short qa/dispatch        # (no output — no longer untracked-and-unruled)
```

### ISS-196 — recorded reproductions, verbatim from the issue's `evidence`

| # | recorded reproduction | result | verdict |
|---|---|---|---|
| (a) | `~~~\nCycle checked: 9\n~~~` | **-1** | closed |
| (b) | `<!-- Cycle checked: 9 -->` | **-1** | closed |
| (c) | ``see `Cycle checked: 9` here`` | **-1** | closed |
| (d1) | unclosed ` ``` ` opener | **-1** | closed |
| (d2) | ` ```` `-wrapped nested fence | **-1** | closed |

**5/5 recorded cases (4/4 shapes) closed.** Nine further probes I authored (real stamp after a
`~~~` block, after an HTML comment, fence with an info string, fences indented 3 and 4 spaces,
`~~~` closed by ` ``` ` and the reverse, a comment opener inside a fence, a real stamp followed by
a higher quoted one) all return the correct value — i.e. the fix does not over-suppress. Authoring
those is additional to, not a substitute for, the ledger's cases (D-015).

### ISS-196 — over-suppression regression check (the live risk in this fix)

Ran commit `14cf3b1`'s `verdictCycle` and HEAD's over all of `qa/verdicts/`:

```
files 115  parsedOld 114  parsedNew 114
unparsed under NEW: [ 'calendar-auto-join.md' ]
DIFFS (file, old, new): none
```

**No real verdict lost or changed its parsed cycle.** The maker's claim is confirmed by my own run,
not accepted.

### ISS-197 — is the new test vacuous again?

Two ways it could have been, both checked:

- **Throwing before `readdirSync`?** No — `sweep()`'s `try` block is the first statement after the
  path join, so nothing else can raise.
- **ENOENT on Windows (which would make it vacuous a second time)?** No. Measured on this machine:
  `readdirSync` on a path that is a file gives `code=ENOTDIR, errno=-4052`. The test additionally
  asserts `err.code !== "ENOENT"` inside its `assert.throws` validator, so the vacuous shape is
  ruled out by the test itself rather than by platform luck.
- **Mutation:** `if (err?.code !== "ENOENT") throw err;` → `if (false) throw err;` **kills** the
  suite (rc=1). It survived all 14 tests before this unit. The property is now backed.

### ISS-198 — ruling checked, not just read

`qa/dispatch/` is genuinely ignored (`.gitignore:57`, tracked file, so it applies in D-019 lane
worktrees too). It does not break the module's cross-session claim: markers are read from the same
working tree by a later *process*, which git-ignoring does not affect. The one cost the issue named
— `git clean -fd` erasing a live marker — degrades to `not-dispatched`, i.e. re-dispatch without
consuming a fix cycle, which is the safe direction and consistent with "a matching-cycle verdict
always wins". The position is coherent and encoded where a reader will find it.

## Mutation run (D-020)

Own harness: `scripts/lib/mutate.mjs` arm/restore, `timeout 180` on every run, `restore` in a
`trap … EXIT INT TERM ERR`, and each mutant asserted (i) present on disk with a single-occurrence
anchor and (ii) **parseable via `import()`** before its run counted. A **no-op control** ran in the
same batch.

| mutation | result | expected |
|---|---|---|
| M0 — control (comment text only) | survive | survive ✅ |
| M-codespan — drop the inline span strip | kill | kill ✅ |
| M-tilde — strip only ` ``` `, not `~~~` | kill | kill ✅ |
| M-unclosed — never enter the fence state | kill | kill ✅ |
| M-comment — drop the HTML-comment strip | kill | kill ✅ |
| M-fencelen — closer length ignored (` ```` ` nesting) | kill | kill ✅ |
| M-indent — drop the `\s{0,3}` indented-fence allowance | **survive** | kill ❌ |
| M10 — swallow non-ENOENT | kill | kill ✅ |

`assert-clean` green before and after; `git diff --quiet HEAD -- scripts/lib/dispatch-state.mjs`
clean at the end. The control surviving is what makes the seven other results readable — the two
false signals the maker reported (an anchor mismatch reading as a survivor, a shell-mangled heredoc
reading as a kill) are exactly what the anchor-count and parse assertions here exclude.

**M-indent survives**: the 1–3-space-indented-fence allowance the maker added is untested. This is a
low-severity coverage note, not a defect and not a backlog item — the behaviour it guards is
correct, it simply has no test. Stated here rather than filed.

## Residual, filed as ISS-199 (medium, does not block this PASS)

Three shapes outside ISS-196's recorded set still overcount — the unsafe direction against the
module's own header claim:

| shape | parsed | should be |
|---|---|---|
| ``see ``Cycle checked: 9`` here`` (double-backtick span) | **9** | -1 |
| ``a ` b `Cycle checked: 9` `` (odd backticks on one line) | **9** | -1 |
| a ` ``` ` closer carrying trailing text, then a quoted stamp | **8** | -1 |

None is a regression — the first two behaved identically under `14cf3b1`. None occurs parseably in
today's corpus: the one live double-backtick stamp (`qa/verdicts/dispatch-state-tracking.md:169`)
sits on a `|` table row, which the line-shape guard already excludes. Filed as medium so the next
unit touching this file verifies it (severity gate), **not** pulled as a unit.

## Judgement on the module itself (asked explicitly)

Not held, not reverted. Two consecutive rounds produced defects, but the second round's defects
were three mediums found by a checker and closed in one cycle with mutation evidence — that is the
loop working, not a file out of control. The honest structural observation is that ISS-196 and
ISS-199 are the same never-ending problem: **a machine-read field is being recovered from free-form
prose, so every round buys one more markdown edge case.** The durable fix is a canonical stamp the
parser can anchor on (a front-matter key, or a rule that the stamp is the first `Cycle checked:` at
column 0) rather than an ever-better quoting stripper. That is a design decision for the queued
`qa/contracts/handshake-liveness.md` gate, not something a checker should decide or a maker should
be asked to guess at now.
