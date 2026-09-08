# Verdict — speaker-resolution-llm

**Date:** 2026-09-08
**Cycle checked:** 1
**Commit:** `76009f8`
**Worktree:** `D:\KnowledgeBase-lanes\a-speakers` (branch `lane/a-speakers`)
**Contract:** `qa/contracts/speaker-resolution-llm.md` — **authored by this check**, not amended
into the deterministic contract. Reason in the contract's first section: the two paths disagree
on deterministic **C6**, and a merged file would have contradicted itself.
**Adapter:** none present → default coding adapter (shell/tests, git revert-file).

```
VERDICT: PASS
SCOREBOARD: 13/13 criteria met, 4/4 invariants hold
FAILURES: none
ISSUES-WRITTEN: none
```

## What I re-ran myself

Nothing below is the maker's pasted output. Every number was produced in this worktree.

```
$ pnpm --filter '@lkb/index' test
  tests 82   pass 82   fail 0

$ pnpm -r typecheck
  apps/web, packages/{db,ai,ask,index,ingest,meeting-bot}, apps/api — all Done, exit 0

$ pnpm lint:structure
  lint-loc OK (249) · lint-dirsize OK (74) · lint-root OK (15) · lint-dupes OK (262 exports)
  lint-migrations OK (856) · snapshot --check OK (113 lines) · tracker-audit OK (G1)
  depcruise: no violations (271 modules, 821 dependencies)
```

All three reproduce the manifest exactly.

## The mutation table, re-run — including the control

I did not re-run the maker's script. I wrote my own driver, took a byte backup
(`md5 5aaaeb07b3e2855b029a0d219ba52ef7`), applied each mutation to
`packages/index/src/pipeline/speakers-llm.ts`, ran the full suite, and restored.

| mutation | result | which test caught it |
|---|---|---|
| baseline | **82 / 0** | — |
| M1 remove the verbatim rule (`includes(name)`) | **81 / 1** | "DROPS a name the cited turn does not contain verbatim — the Juben/Jubin defect" |
| **M2 no-op control** (`const __noop_control = turns.length * 0; void __noop_control;`) | **82 / 0** | — |
| M3 remove the contradiction guard (`byName.size !== 1` → `< 1`) | **81 / 1** | "one label claiming two different names is left unresolved" |
| M4 allow unknown / already-named `speakerRef` | **80 / 2** | "refuses to rename a turn that already carries a real name"; "drops a speakerRef that does not exist" |

The control is the part that makes the rest mean anything, and it is clean: a dead statement
inserted into the same function leaves the suite at 82/0, so the suite is discriminating rather
than reddening on any edit. Each mutation also fails **precisely the test that names it** — not a
diffuse cascade — which is the stronger form of the same evidence.

Restored from the byte backup; `md5` matched, `git status --porcelain` and
`git diff --stat` both empty, and the final 82/82 run above was on the restored tree.

## Claim verification (not trust)

**I2 — `speakers.ts` untouched.** Verified two ways: `git show --stat 76009f8` lists only
`config/ai-routing.yaml`, `packages/index/src/index.ts`, the two new `speakers-llm*` files and
the manifest (405 insertions, 0 deletions); and `git diff 942cf73 76009f8 -- .../speakers.ts`
(from its own PASS commit through this one) is empty. Claim holds.

**Real-corpus degradation.** I wrote my own harness against `data/toc-migrated/*/turns.json`
with `complete()` forced to throw, and got the manifest's figures exactly:

```
sessions=23  withPositional=11  degraded=11/11
resolved 78/494 (15.8%)
speakers: Ruby -> person:ruby ; Jubin Thakkar -> person:jubin-thakkar
```

A provider outage costs nothing that was already knowable, and never reports "no speakers".
**[C13] met.**

## C8, judged hardest

The manifest's own test covers one failure mode (a thrown `Error`). I probed five more, because a
guard that only handles the shape its test uses is not a guard:

| provider behaviour | result |
|---|---|
| throws `Error("429 rate limited")` | degraded, reason contains 429, fallback resolves "Jubin Thakkar" |
| throws a bare string (non-`Error`) | `degraded.reason: "...failed: string blowup"`, fallback intact |
| resolves `undefined` (malformed adapter) | degraded (`Cannot read properties of undefined`), fallback intact |
| returns empty `text`, no `json` | `"speakers response was not a JSON array"`, fallback intact |
| returns a JSON **object**, not an array | same, fallback intact |
| returns `[null, 5, "x", {displayName:null}, {…valid…}]` | valid entry survives, junk ignored, no throw |

In **every** case the caller receives both a non-null `degraded` and the deterministic result —
never an empty list. The `String(err)` branch and the `Array.isArray` check are both load-bearing
and both exercised. C8 is the strongest thing in this unit. **[C8], [C9], [I1] met.**

One boundary worth stating rather than burying: when the provider *succeeds* and honestly
identifies nobody, the result is `degraded: null` with a populated `unresolved` list
(probe B7: `unresolved: ["spk:0","spk:1"]`). That is correct — "asked and found none" is not
"could not ask" — and C9-of-the-deterministic-contract's explicit `unresolved` list is what keeps
the two distinguishable at the call site.

## C2, judged hardest — I tried to get a fabricated name past it

| attack | outcome |
|---|---|
| the Juben/Jubin defect itself ("Juben Thakur" vs `"My name is Jubin Thakkar."`) | **dropped** |
| case-folded variant (`"jubin thakkar"`) | **dropped** — no normalisation, as C2 demands |
| a name present in one cited turn but not another | the non-containing turn is **dropped**, per-turn |
| a fabricated `turnId` | **dropped**; speaker with no survivors does not ship |
| `"Ruby"` against `"My name is Rubina Shah."` | **dropped** (not a substring) |
| `"Ruby"` against `"My name is Rubykumar Shah."` | **SHIPS** as `person:ruby` |
| `"Good morning"` against `"Good morning everyone, this is our campus."` | **SHIPS** as `person:good-morning` |

The last two are real and I reproduced them. They are **not** a C2 failure and I am not filing
them against this unit, for three reasons I would defend:

1. C2 says *verbatim substring, no normalisation*. The module does exactly that, and the module's
   own doc claims exactly that — *"zero speaker name that does not appear verbatim in a cited
   turn"*. There is no overclaim anywhere in the module, the manifest, or the commit message.
   The gap is in the **criterion**, not the artifact.
2. Inventing a criterion mid-verdict in order to fail an artifact that met the stated rule is the
   mirror image of softening one to pass it. Both are prohibited.
3. This unit persists nothing (**I3**, verified: no fs/db import, no top-level side effect), so
   neither defect can reach real data from here.

So they are recorded where they can actually do harm: the new contract's
**"Deferred to the apply/persist unit — BLOCKING there"** section. The apply unit must require a
token-boundary match and reject a `displayName` that is not name-shaped, or it fails on arrival.

## Gap 5 (the maker's question), answered plainly

**No — same-first-name collision is not in scope for this unit, and I am not failing it.**

I reproduced the defect: two labels both legitimately named "Ruby" resolve to two speakers sharing
`personId: "person:ruby"`. Two distinct humans, one stored identity. It is a genuine defect and
the maker was right to be uneasy about it.

But it is not this unit's defect. `personId` comes from `personIdFor` in `speakers.ts` — a module
this unit's own **I2** forbids it from touching, and which already carries a PASS verdict. The
deterministic path collides identically on the same input, so nothing about this unit introduces
or worsens it. Charging it here would mean either failing a unit for behaviour it inherited and
may not fix, or inviting an I2 violation to fix it — and C7 is genuinely a different question
(the model asserting two names for one label), which this module does handle correctly.

It becomes blocking the moment something writes it down. That is the apply/persist unit, and it
is now written into the contract as blocking criterion 2 there. Fix it in the unit that owns
`personIdFor` or in the apply unit — not by reopening this one.

## Gap 1 (never run against a real provider) — is the scoping honest?

Yes. The manifest leads with it, the module claims a path rather than a number, and every yield
figure in the unit (78/494, 15.8%) is a **deterministic-fallback** figure that I re-derived
exactly. Nothing anywhere in the unit implies a measured improvement over 15.8%. Recorded in the
contract's "Out of scope" with the condition attached: the follow-up unit must report the real
number **even if it disappoints**.

## Criterion-by-criterion

| | status | evidence |
|---|---|---|
| C1 | met | test 1; `personId: person:nilesh-gotecha`; evidence carries the turn's own `sessionId`; probe "partial survival" shows transcript order preserved |
| C2 | met | tests 2 + 4; M1 mutation reddens; 7 adversarial probes above, 5 of 7 refused, 2 documented as a criterion gap deferred to the apply unit |
| C3 | met | test 3 — fabricated `t99` dropped, speaker with no survivors does not ship |
| C4 | met | test 4 — `["t1","t404","t2"]` → evidence `[t1, t2]` |
| C5 | met | test 5; M4 reddens it |
| C6 | met | test 6; M4 reddens it |
| C7 | met | test 7 — `resolved: []`, `unresolved: ["spk:0"]`; M3 reddens it |
| C8 | met | test 8 + 5 further failure shapes I probed; corpus run 11/11 degraded |
| C9 | met | test 9 + object/empty-body probes |
| C10 | met | test 10 asserts `kind: "speakers"`, `[id:t1]`, `[spk:0]`; `config/ai-routing.yaml` declares `speakers: [gemini, claude-code]`, parsed by `parseRoutingYaml`'s flat-key shape |
| C11 | met | test 11 — provider that throws on call is never invoked |
| C12 | met | M1 reddens exactly one named test; reproduced by me, control clean |
| C13 | met | my own corpus harness reproduced 78/494, 11/11, both speakers |
| I1 | met | no probe produced a throw, including malformed `CompleteResult` and junk arrays |
| I2 | met | `git diff 942cf73 76009f8 -- speakers.ts` empty; commit stat confirms |
| I3 | met | module imports only types + `parseJsonLoose` + `speakers.js`; no fs/db/network; no top-level statements beyond two consts |
| I4 | met | 82 = 71 prior + 11 new; no pre-existing test file appears in the commit stat (0 deletions across the whole commit) |

## Notes, not findings

- The prompt invites greeting/handover evidence, which is the intended step past 15.8% and is the
  reason this contract had to be separate. It is also the reason the verbatim rule now carries
  more weight than it does on the deterministic path — recorded as C12 so that rule can never be
  removed without a red test.
- `Job.kind` is typed `string` in `packages/ai/src/provider.ts:17`, so typecheck gives no
  guarantee that `"speakers"` matches a routing key. The yaml line makes it correct today; nothing
  would catch a future typo. Too small to file against this unit, and it is a `packages/ai`
  concern, not this module's.
- The 11 new tests were written before the implementation, as claimed — consistent with the
  commit being a single 405-insertion add with the test file present.

`ISSUES-WRITTEN: none` — nothing here is worth a ledger row. Both reproduced identity defects are
scope-placed in the contract rather than charged to a unit that cannot cause them.
