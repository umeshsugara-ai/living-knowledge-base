# Verdict — speaker-apply-write

**Date:** 2026-09-08
**Cycle checked:** 1
**Contract:** `qa/contracts/speaker-apply-write.md` (authored by this check, at the maker's request)
**Commit checked:** `3b17cf1` on `lane/a-speakers`
**Bound root:** `D:\KnowledgeBase-lanes\a-speakers` (worktree; `D:\KnowledgeBase` untouched)
**Mode:** A

```
VERDICT: FAIL
SCOREBOARD: 11/12 criteria met, 5/6 invariants hold
FAILURES:
- [C9] sev: high · scripts/sync-speakers.mjs:97 calls speakers(TENANT).replaceOne(), a method the tenant-scoped accessor does not expose — the live-write path throws TypeError on its first document · use deleteMany+insertOne like the precedent sync-real-turns.mjs, or add a tenant-merging replaceOne to scopedCollection and cover it · issue: ISS-102
ISSUES-WRITTEN: ISS-102, ISS-103
EXPLANATION: Everything the unit actually ran reproduces exactly, the merge rule is right and I would
not have it reversed, and the D-016→D-017 correction is both genuine and the mechanism I would have
required. The unit fails on the one thing it shipped but never exercised: the live-write half calls
`replaceOne` on an accessor that has no `replaceOne`, so the "separately approved step" cannot
execute at all. This is ISS-068's exact shape — a `.mjs` entrypoint outside every typecheck scope
reaching a method that isn't there — recorded a third time (ISS-060, ISS-065, ISS-068).
```

## What I re-ran myself

| Command | Result |
|---|---|
| `pnpm --filter '@lkb/index' test` | **174 pass / 0 fail** — matches the manifest exactly |
| `node --test scripts/lint.test.mjs` | **11 pass / 0 fail** — matches |
| `pnpm -r typecheck` | exit 0 — matches |
| `pnpm lint:structure` | all green; `lint-dirsize OK (75 dirs)`; depcruise 277 modules / 0 violations — matches |
| `node scripts/sync-speakers.mjs --dry-run` | 23 sessions, 494 positional, 78 (15.8 %), 2 docs, 0 collisions — **byte-for-byte the manifest's evidence block** |

No pasted claim in the manifest failed to reproduce. The evidence block is honest.

### Independent schema validation (not the maker's test)

I re-derived the two documents from `data/toc-migrated` through `resolveSpeakers` +
`buildSpeakerDocs` in my own harness and validated them against `schema/speakers.schema.json`
itself (no ajv in this repo; I wrote a subset validator covering `required`, `type`, `minItems`,
`minLength`, `minimum`, `maximum`):

```
SCHEMA OK — 2 docs validate
collisions: 0
PROPERTY PROBE OK — 500 random corpora, no empty-evidence doc, all schema-valid
```

Both documents carry exactly one evidence entry, real turn ids
(`2026-08-24-uniaccess-leeds-arts-university-t006`,
`2026-04-21-visa-blueprint-part2-italy-france-nz-t206`), confidence 0.9, and `tenantId: "toc"`.
**[C2] and [C3] are met by construction**, not by luck: the 500-corpus probe deliberately generated
speakers with zero-length evidence and repeated names, and no empty-evidence document was ever
emitted.

### Mutation testing of `buildSpeakerDocs` (9 mutants, with a no-op control)

| Mutant | Result |
|---|---|
| M0 no-op control (comment only) | 174 pass / 0 fail — **control clean, the suite is not vacuous** |
| M1 drop the empty-evidence guard | 165 / **1 fail** ✔ killed |
| M2 cross-session confidence 0.6 → 0.9 | 173 / **1** ✔ killed |
| M3 drop the collision report | 165 / **1** ✔ killed |
| M4 `sessionIds.length > 1` → `> 0` | 171 / **3** ✔ killed |
| M5 remove alias dedupe | 173 / **1** ✔ killed |
| M6 remove evidence dedupe by `turnId` | **174 / 0 — SURVIVED** |
| M7 drop `docs.sort` | 165 / **1** ✔ killed |
| M8 key the merge map by `displayName` instead of `personId` | 170 / **4** ✔ killed |

8/9 killed with a clean control. M6 is a low-severity gap only: no test feeds the same `turnId`
twice, so the dedupe is unpinned. Duplicated evidence would bloat a document, never change an
identity, so it is noted here rather than filed.

### [C7] — the dry-run genuinely does not connect

I did not rely on reading the control flow. I ran the script under a preload that replaces
`net.Socket.prototype.connect`, `net.connect`, `net.createConnection` and `dns.lookup` with
throwing tripwires, and pointed `MONGODB_URL` at an unroutable host:

```
$ MONGODB_URL="mongodb://10.255.255.1:27017" node --import ./nonet.mjs scripts/sync-speakers.mjs --dry-run
… No Mongo connection attempted (--dry-run).
exit=0
```

Zero tripwires fired. The `--dry-run` early return precedes the dynamic `import()` of
`packages/db`, so the driver is never even loaded. **[C7] met.**

### [C8] — `resolveSpeakers` only, no model path

`scripts/sync-speakers.mjs` imports `resolveSpeakers` (line 35) and calls it (line 53);
`extractSpeakers` appears nowhere but the docstring disclaiming it. `pipeline/speakers.ts` has
exactly one import, a `type` import of `Turns` — it cannot reach a provider. `extractSpeakers`
lives in `pipeline/speakers-llm.ts`, which nothing on this path imports. The network tripwire above
independently confirms the negative. **[C8] met; the claim is true as written.**

---

## Ruling 1 — the merge rule. The maker does not have it backwards.

The maker asked me to consider that merging two real people corrupts every citation that identity
carries, while splitting one person only fragments them, and to FAIL if merging is the worse error.
I have considered it and I am ruling for the merge, on four grounds:

1. **The asymmetry argument is real but it is neutralised by the gate.** A cross-session merge is
   never applied to the database by default: `sync-speakers.mjs` refuses the write outright unless
   `--allow-collisions` is passed explicitly. The default behaviour on a genuine ambiguity is
   *nothing is written and a human decides*. An unreviewed merge cannot reach the corpus, so the
   corrupted-citation scenario requires a human to have already looked at the collision and
   asserted the identity. That is the correct place for that decision to live.

2. **The merge is lossless in data, lossy only in assertion — and the split is the reverse.**
   Evidence entries carry `{turnId, sessionId}` individually, so a merged document retains
   everything needed to split it later; the per-turn provenance is intact. A split, by contrast,
   requires manufacturing an id, and that manufactured id is what later becomes load-bearing.

3. **An invented disambiguator is not merely fabricated, it is unstable.** `person:ruby-2` is
   assigned by encounter order. Insert one earlier session into the corpus and every ordinal
   renumbers — so citations minted against `person:ruby-2` silently repoint to a different human on
   the next ingest. That is a *worse* corruption than a flagged merge, because it is invisible and
   it happens without anyone making a decision at all.

4. **The same-session half is unambiguously right** and the code keeps the two cases genuinely
   distinct (M4 and M8 both die loudly), so this is not one coarse rule doing two jobs.

**One real weakness, and it is the honest version of the maker's own worry** (low severity, noted
not filed): the collision lives in the *return value*, not on the *document*. If `--allow-collisions`
is ever passed, the corpus receives a document whose only trace of contested identity is
`confidence: 0.6` — a number that could mean many things. Before that flag is used for the first
time, the persisted document should carry a machine-readable marker (a `contested: true` or a
`collisionSessionIds` array; the schema is `additionalProperties: true`, so this costs nothing).
I have written this into [I4] as an invariant rather than a criterion, because the unit does not
reach that state today. Do not let it arrive as a side effect of the live-write approval.

## Ruling 2 — D-016 → D-017. Correct catch, correct mechanism, correct order.

**(a) D-016 was genuinely never executed.** `git log -p --all -- structure.config.json` shows
exactly two commits touching the `dirsize` line: `6ef2980` introduced
`"dirsize": { "maxFiles": 30 }`, and `3b17cf1` (this unit) changed it to
`{ "maxFiles": 30, "overrides": { "scripts": 31 } }`. **`maxFiles` has never held any value but
30.** There is no intermediate commit, no reverted commit, no working-tree residue. Verified.

**(b) The override really is scoped.** `lint-dirsize.mjs` resolves the budget per directory via
`hasOwnProperty` on the override map and falls back to `maxFiles` — no prototype-chain hole, no
prefix matching that could let `scripts` cover `scripts/lib`. The new test asserts both halves:
the named directory accepts 31, and then an unlisted sibling is asserted to *fail* with the exact
message `packages/b/src: 31 files (budget 30)`. That second assertion is the one that matters and
it is there. I confirmed it is not vacuous — the test genuinely runs the linter as a child process
against a temp fixture, like every other linter test in that file. Verified.

**(c) Which would I have required?** **The override — the same call the maker made.** I would not
have required consolidation, for two reasons and one that outweighs both.

- D-016's stated reason for rejecting consolidation is weaker than it sounds: "every file is
  referenced from at least two places" argues that nothing is *dead*, not that nothing is
  *mergeable*, and both entries slide between those. So I do not accept that argument as given.
- But consolidation is still the wrong trade *here* on its merits: the obvious candidate is folding
  the five `lint-*.mjs` into one dispatcher, which means refactoring five separately
  checker-PASSed artifacts and five `package.json` entries to reclaim one slot. That is a large,
  risky edit bought with a budget technicality.
- The decisive point is that **the override is stronger governance than what existed before, not
  weaker.** Before this unit, the repo had one global number, so *any* pressure on *any* directory
  could only be relieved by relaxing every directory — which is precisely how D-016 nearly landed a
  repo-wide loosening under a one-directory justification. The maker did not merely get its file
  in; it removed the mechanism that made a local need express itself as a global concession.
  Refusing that improvement to force an unrelated refactor would have been the wrong call.

The catch itself — noticing mid-implementation that an approved DECISIONS entry was factually
wrong, declining to execute it, and superseding it with a reasoned entry that explicitly forbids
applying both — is the exact behaviour the Lab Protocol exists to produce. It is credited.

**One low-severity note:** nothing constrains `overrides` from becoming a dumping ground. There is
no cap on its size and no requirement that each key cite an authorizing D-entry, so the third and
fourth overrides can arrive with much less scrutiny than this first one. Worth a `$comment`
requiring a D-reference per key.

## Ruling 3 — Gap 3 (B10). The right call, and it costs the maker.

The maker predicts B10 will need a human downgrade to **PARTIAL** even after a live write, because
B10 is Speaker Intelligence *profiles* and this unit extracts no `org`, no `role`, no profile of
any kind. That is correct and it is not writing off work. `schema/speakers.schema.json` carries
optional `org` and `role`; `buildSpeakerDocs` emits neither, so a catalogue probe that only checks
"collection `speakers` is non-empty" would flip B10 to full credit on documents containing zero
profile information. Predicting that and refusing it *in advance* is the opposite of pre-emptive
write-off — it is the maker declining credit it could plausibly have taken, and naming the C2/C3
over-credit precedent as its reason. **B3 is a fair flip after a live write; B10 is not.** I concur
with the downgrade and would have imposed it if the maker had not.

## The failure — [C9], and why it is not excused by "the live write is a separate step"

`scripts/sync-speakers.mjs:97`:

```js
await speakers(TENANT).replaceOne({ _id: doc._id }, rest, { upsert: true });
```

`speakers(tenantId)` returns `scopedCollection(...)` from
`packages/db/src/lib/tenantScope.ts`, which deliberately exposes **only** tenant-safe helpers and
no raw handle (`raw` was removed under ISS-065). Its surface is:

```
$ node -e '<construct the accessor over a fake Db>'
methods on the tenant-scoped accessor: countDocuments, deleteMany, find, findOne, insertMany, insertOne, updateOne
typeof coll.replaceOne = undefined
LIVE-WRITE PATH REPRODUCTION -> TypeError: coll.replaceOne is not a function
```

So the first document of a live run throws before any write occurs. Every other `replaceOne` in
this repo (`apps/api/src/indexing.ts:146`, `whatsapp-store.ts:123/142/161`) goes through a **raw**
`db.collection()` handle, not through a scoped accessor — `sync-speakers.mjs:97` is the only place
`replaceOne` is called on the scoped accessor, and it is the one place it does not exist. Nothing
caught it: the file is `.mjs`, and every `tsconfig.json` in the repo has
`"include": ["src/**/*.ts"]`, so `pnpm -r typecheck` cannot see the entrypoint at all.

Why this is a FAIL and not a deferred item:

- **The unit ships the path and describes its behaviour affirmatively.** The manifest states that
  collisions "on a live run **block** the write unless `--allow-collisions` is passed." That claim
  is unfalsifiable as written — the branch it guards cannot execute. Gap 2 defers *running* the
  write; it does not disclose that the write is unwired.
- **The precedent the manifest cites does not have this defect.** `sync-real-turns.mjs` writes with
  `deleteMany` + `insertOne`, both of which exist and both of which re-inject `tenantId`. The maker
  correctly copied that file's `const { tenantId: _t, ...rest }` idiom — an idiom that is only
  correct *because* `insertOne` injects the tenant — and then paired it with a method that does not.
  So the parallel drawn to the precedent is false in exactly the place that matters.
- **This is the third recurrence of one root cause.** ISS-060 (a hand-carried tenantId in a raw
  filter destroyed another tenant's claims), ISS-065 (seven call sites went around the guard), and
  ISS-068 (`sync-real-turns.mjs` — *the same class of script* — called `raw.countDocuments` and
  broke the moment `raw` was removed, "missed by a grep scoped to `apps/`, `packages/` alone"). The
  comment recording ISS-068 sits in the very file being called here. A seam that has paid for this
  three times does not get the benefit of the doubt a fourth.
- **[I1] cannot be established.** The strip of `tenantId` is safe *only* under an accessor that
  re-injects it. Fix `replaceOne` the wrong way — by adding a passthrough to `scopedCollection`
  without the tenant merge, which is the most natural-looking fix — and the corpus receives
  tenant-less documents that violate the schema's `required: ["tenantId"]` and defeat tenant
  isolation. The invariant is not merely unproven; the current shape actively invites the unsafe
  repair.

**Fix direction (either is acceptable):** (i) mirror the precedent — `deleteMany({ personId })`
then `insertOne(rest)`, both tenant-merged today; or (ii) add `replaceOne` to `scopedCollection`
merging `tenantId` into *both* the filter and the replacement, alongside a test in
`tenantScope.typecheck-test.ts`'s neighbourhood asserting the tenant lands in the stored document.
Either way, add a test that exercises the write branch against an injected fake collection — the
pattern `apps/api/src/indexing.test.ts` already uses (it records `replaceOne` calls against a fake)
— so this branch stops being the only code in the unit that nothing looks at. See ISS-103 for the
systemic half.

## Ledger

- **ISS-102** (high) — `sync-speakers.mjs:97` live-write path calls a non-existent accessor method.
- **ISS-103** (medium) — `.mjs` entrypoints under `scripts/` are outside every typecheck and every
  test, so accessor-surface drift reaches them only at runtime; fourth manifestation of the
  ISS-060/065/068 family.

No issue was filed for the surviving M6 mutant or for the two low-severity notes above; they are
recorded here in prose deliberately, per D-013/D-014/D-015.

## What cycle 2 needs

Only [C9] and [I1]. Do not touch the merge rule, the confidence drop, the collision gate, the
override mechanism, or the B10 downgrade — all four rulings above are in the maker's favour and
re-litigating them would waste the cycle. Re-submit at `Fix cycle: 2` with the write branch
exercised by a test.

---

# Verdict — speaker-apply-write (cycle 2)

**Date:** 2026-09-08
**Cycle checked:** 2
**Contract:** `qa/contracts/speaker-apply-write.md`
**Commit checked:** `1d2e77e` on `lane/a-speakers`
**Bound root:** `D:\KnowledgeBase-lanes\a-speakers` (worktree; `D:\KnowledgeBase` untouched)
**Mode:** A

```
VERDICT: PASS
SCOREBOARD: 12/12 criteria met, 6/6 invariants hold
FAILURES: none
ISSUES-WRITTEN: none
EXPLANATION: ISS-102 and ISS-103 are both closed, and closed structurally rather than patched. I
tested ISS-103's own stated acceptance in BOTH directions myself and both redden `pnpm -r typecheck`
at the exact lines the maker quoted. I independently re-derived the two documents from the corpus,
pushed them through `writeSpeakerDocs` against a target modelled on the real `scopedCollection`
source, and validated the persisted result against `schema/speakers.schema.json` with Python
`jsonschema`: both documents validate and both carry `tenantId` — the bare-replace trap is genuinely
closed, not renamed. Delete-by-`personId` is correct rather than a mismatch, because `_id` is
`<tenantId>-<personId>` deterministically and `deleteMany` is tenant-merged, so the two keys select
the same single row; a second identical run left 2 documents, not 4. The deferral of the `contested`
marker is accepted as a low note but its stated reasoning is wrong, and I say so below.
```

## The two directions of ISS-103's acceptance — I ran both

ISS-103's acceptance was: *"reintroducing ISS-102's exact line must redden a command that runs in
CI, not merely fail when a human triggers a live write."*

**Direction 1 — reintroduce `replaceOne` in `writeSpeakerDocs`.** I replaced the
`deleteMany`+`insertOne` pair in `packages/index/src/pipeline/speaker-docs.ts` with
`await target.replaceOne({ personId: doc.personId }, rest, { upsert: true });` and ran
`pnpm -r typecheck`:

```
packages/index typecheck: src/pipeline/speaker-docs.ts(145,18): error TS2339:
  Property 'replaceOne' does not exist on type 'SpeakerWriteTarget'.
packages/index typecheck: Failed
```

**Direction 2 — remove `deleteMany` from `scopedCollection`.** I deleted the `deleteMany` line from
`packages/db/src/lib/tenantScope.ts` and ran `pnpm --filter '@lkb/db' typecheck`:

```
src/collections/tenantScope.typecheck-test.ts(65,79): error TS2339:
  Property 'deleteMany' does not exist on type '{ find: ...; insertOne: ...; }'
src/lib/tenantScope.test.ts(53,24) / (60,24) / (68,24): same
```

Both are the exact errors the manifest quotes, at the exact lines. Each file was restored from a
pre-mutation copy and confirmed with `cmp` (`RESTORED_OK`), and `git status --porcelain` was empty
after every mutation. The mechanism is real and lives in CI, not in a comment.

## Does `writeSpeakerDocs` actually persist a schema-valid, tenant-carrying document?

Yes, and I did not take the maker's test's word for it. I built my own harness that re-derives the
corpus through `resolveSpeakers` + `buildSpeakerDocs`, pushes the result through the real
`writeSpeakerDocs`, and logs exactly what reaches `insertOne`:

```
DETERMINISTIC: true
insertOne receives keys: _id,personId,aliases,confidence,evidence      <- tenantId stripped
```

That stripped document is then handed to the scoped accessor, whose source
(`packages/db/src/lib/tenantScope.ts`) reads `insertOne: (doc) => raw.insertOne({ ...doc, tenantId })`
— it re-attaches the tenant. I modelled that re-attachment in the harness and validated the
resulting stored documents against the **real** `schema/speakers.schema.json` with Python
`jsonschema` (which, unlike the repo's `scripts/lib/mini-schema.mjs`, does implement `minItems`):

```
VALID toc-person:jubin-thakkar tenantId= toc
VALID toc-person:ruby         tenantId= toc
```

**[I1] holds.** The bare-replace trap I named at cycle 1 is closed by routing through the one
accessor method that re-injects the tenant — the strip is only safe because of that, and the maker
states that reason in the source comment rather than leaving it as folklore.

## Is the delete-then-insert idempotent, and does it delete by the right key?

Yes to both, and the `personId`/`_id` question I asked has a clean answer rather than a latent bug.

- `_id` is `<tenantId>-<personId>`, derived deterministically in `buildSpeakerDocs`, and
  `deleteMany` is tenant-merged by the accessor. So `{ tenantId, personId }` and
  `{ _id: "<tenantId>-<personId>" }` select the **same single row**. There is no key by which a
  delete could miss the row the subsequent insert then duplicates, and none by which it could reach
  another tenant's row.
- Empirically, running `writeSpeakerDocs` twice over the real corpus:
  `write1 {before:0,written:2,after:2}` then `write2 {before:2,written:2,after:2}`, stored length 2.
  No accumulation, no orphan.
- `personId` is in fact the more robust of the two keys: it would still find and replace a row whose
  `_id` was produced by an older derivation, where an `_id` filter would silently insert a duplicate.
  Choosing it was right.

**[C9] is met.** Every operation invoked — `countDocuments`, `deleteMany`, `insertOne` — exists on
`scopedCollection` (I read the source, I did not infer it); the collision gate blocks the live write
unless `--allow-collisions` is passed (`scripts/sync-speakers.mjs`, before any Mongo import); the
write is idempotent.

## Do the four new tests use a faithful fake, or a convenient one?

Faithful, and structurally prevented from being convenient. The fake is **typed as
`SpeakerWriteTarget`**, so it cannot offer a method the production accessor lacks — the exact
permissiveness that produced ISS-102 is now a compile error inside the test file too. I checked its
three methods against `tenantScope.ts` line by line: `insertOne` spreads `{ ...doc, tenantId }` in
both; `deleteMany` matches on the filter and returns `deletedCount` in both; `countDocuments`
returns a count in both. My own independent harness, written without reading their fake, reproduced
identical behaviour.

I did **not** simply accept the four tests. Mutation testing of `writeSpeakerDocs`, with a no-op
control:

| Mutant | `@lkb/index` result |
|---|---|
| M0 control — comment only, no behaviour change | 178 pass / 0 fail — **control clean; the suite is not vacuous** |
| M1 — drop the `deleteMany` call | 178 tests, **2 fail** |
| M2 — drop the `insertOne` call | 178 tests, **3 fail** |
| M3 — pass the whole `doc` instead of the stripped `rest` | 178 pass / 0 fail — survives |
| M4 — delete by `{ _id: doc._id }` instead of `{ personId }` | 178 pass / 0 fail — survives |

M3 and M4 survive, and neither is a defect: passing the unstripped document to a scoped `insertOne`
yields the identical stored document (`{ ...doc, tenantId }` where `doc.tenantId` is already that
same tenant), and M4 selects the same row as shown above. They are equivalent mutants, not blind
spots — but they do mark the honest limit of what these four tests can distinguish, which is worth
knowing before someone treats the tenantId assertion as broader than it is (low note 1).

Every mutation was reverted from a pre-mutation copy and confirmed with `cmp`; the working tree was
clean after each.

## The declared verify suite, re-run in full

| Command | Result |
|---|---|
| `pnpm -r test` | core 7, db 13, ai 70, ingest 41, ask 32, **index 178**, meeting-bot 40, apps/api 109 — **490 pass / 0 fail** |
| `pnpm -r typecheck` | exit 0, 10 projects Done |
| `pnpm lint:structure` | green; lint-root OK, lint-dupes OK, lint-migrations OK (884 files), SNAPSHOT fresh, tracker-audit G1 OK, depcruise 277 modules / 0 violations |
| `node --test scripts/lint.test.mjs` | 11 pass / 0 fail |
| `node scripts/sync-speakers.mjs --dry-run` | 23 sessions, 494 positional, 78 (15.8 %), 2 docs, no collisions — unchanged, matches the manifest |

No live write was run. **[C10] reproduces exactly**; every number in the cycle-2 evidence block is
one I produced myself.

**[C7] re-verified by instrumentation, not by reading control flow** (the write path changed, so the
cycle-1 result does not carry over automatically). I monkey-patched `net.createConnection`,
`net.connect`, `tls.connect`, `dns.lookup` and `dns.promises.lookup` before importing the script
under `--dry-run`:

```
NETWORK CALLS: 1 [ 'net.createConnection "\\?\pipe\...\tsx-Lenovo\14564.pipe"' ]
```

The single call is a local Windows named pipe opened by the `tsx` loader itself — not a socket, not
a DNS lookup, and not attributable to the script. The `@lkb/db` client and the `speakers` collection
are both `await import`ed **after** the `--dry-run` early return.

## The `contested` marker: the deferral is accepted, the reasoning is not

I am ruling on this plainly because the maker asked for it plainly.

**The deferral itself is fine.** The `contested` marker was a low note, not a criterion. [C5] and
[I4] are satisfied without it: collisions are returned alongside the docs, the confidence drops from
0.9 to 0.6, and a live run blocks unless `--allow-collisions` is passed. Ambiguity survives. Nothing
in the contract obliges the field, and no collision exists in the corpus.

**The reasoning offered for it is wrong, and I do not want it becoming precedent.** The maker argues
that adding the field "would be the same mistake as the `replaceOne` path: shipping code no test and
no run has touched." That is not what ISS-102 was. `replaceOne` was unexercised **because it was
structurally unexercisable** — it lived in a `.mjs` file outside every typecheck and every test, and
the only thing that could have run it was a live production write. A `contested: true` flag on a
cross-session merge is the opposite case: it sits in typechecked source, on a code path that
**already has three passing unit tests** (`merges the same person across sessions`, `a cross-session
merge lowers confidence`, `two speakers in ONE session...`), and could be asserted today in a test
that needs no Mongo, no live run and no approval. The `speakers` schema is
`additionalProperties: true`, so it is schema-legal now.

So: correct call, wrong reason. "No test can reach it" was the ISS-102 lesson; "no data exercises it
yet" is a different and much weaker argument, and citing the first to justify the second would let a
genuinely testable gap be deferred under the authority of a lesson about untestable code. Deferring
until the first real collision is a reasonable product judgement on its own merits — it does not need
the analogy, and the analogy does not hold.

## Low notes (not failures — none of these blocks the PASS)

1. **The tenantId test asserts a composition, not the function alone.** `the stored document carries
   its tenantId` passes because the *fake* re-attaches the tenant, exactly as the real accessor does.
   It is a valid test of `strip + scoped insert`, and I verified the fake's fidelity against
   `tenantScope.ts` myself — but M3 above shows it cannot detect a change to the strip itself. Read
   it as pinning the contract with the accessor, not the internals of `writeSpeakerDocs`.
2. **`insertOne` is pinned for existence, not for shape.** In `tenantScope.typecheck-test.ts`,
   `_count` and `_delete` carry explicit type annotations; `const _insert = coll.insertOne;` does
   not. The manifest says all three are pinned "with the right shapes" — for `insertOne` that is an
   overclaim. Removing it still reddens typecheck, so the acceptance holds; a signature change is
   caught only incidentally, by the five other `collections/*.ts` call sites (I confirmed this by
   adding a required second parameter: five errors, none of them at line 65). One annotation would
   close it.
3. **Delete-then-insert is not atomic.** A crash between `deleteMany` and `insertOne` loses that
   speaker's row until the next sync. This is the precedent's behaviour (`sync-real-turns.mjs`) and
   acceptable for a re-runnable sync over a derived collection — recorded so it is a known property
   rather than a discovery.
4. **The sync is authoritative-by-replacement.** `deleteMany({ personId })` will discard a richer
   document (an `org`, a `role`, a hand-corrected alias) written by any future unit or human,
   replacing it with the deterministic-only version. Correct for an empty collection and for today's
   single writer; it becomes a real question the moment a second writer touches `speakers`.

## Ledger

- **ISS-102** to `fixed` (2026-09-08). Verified by direction-1 mutation: the line cannot be
  reintroduced without failing `pnpm -r typecheck`.
- **ISS-103** to `fixed` (2026-09-08). Verified by direction-2 mutation: accessor drift reddens the
  db package's typecheck at the source of the drift. Note the fix is narrower than the issue's
  primary suggestion — `scripts/*.mjs` is still outside typecheck; what changed is that the *write
  logic* is no longer in a `.mjs` file, and the accessor surface it depends on is pinned where it is
  owned. That satisfies the stated acceptance for this seam. Any future `.mjs` entrypoint that
  reaches the accessor directly reopens the shape, which is why the issue's own
  `scripts/tsconfig.json` remedy is still worth doing on its own merits.

Neither is `verified` yet: that requires a later re-check, and for ISS-102 the honest final
confirmation is the first live write actually completing.

## Not in scope of this PASS

No live write has been performed; catalogue **B3** and **B10** have not flipped and must not be
flipped on this verdict. The maker's expectation that B10 needs a human downgrade to PARTIAL stands
and was already endorsed at cycle 1. The unit remains deterministic-only at 78/494 (15.8 %) and two
speakers, which the contract accepts as a stated limitation, not a defect.
