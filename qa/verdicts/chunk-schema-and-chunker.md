# Verdict — chunk-schema-and-chunker

**Date:** 2026-09-08
**Unit:** plan §10 **U1.2** (chunk schema + pure chunker + the ISS-096 empty-vector floor)
**Contract:** `qa/contracts/schema-v2.md` (+ `qa/contracts/ai-provider-seam.md` C9 / [I4] for the ISS-096 half)
**Manifest:** `qa/manifests/chunk-schema-and-chunker.md`
**Cycle checked: 1**
**Bound to:** `D:\KnowledgeBase`
**Mode:** A (unit check), fresh context, read-only toward the artifact

---

## VERDICT: FAIL

Not because the unit is unsound — its headline correctness property is the strongest I have
measured in this repo. It fails because two of the module's own documented guarantees are false on
a **two-turn input**, and because one of the manifest's five verify commands does not reproduce.
All three are small, mechanical, and cheaper to fix now than after rows exist.

```
SCOREBOARD: 6/8 criteria met, 4/5 invariants hold
```

---

## What I re-ran myself

| Command | Result | Manifest claimed |
|---|---|---|
| `python schema/validate.py` | **PASS, 24 collection schemas** — chunks valid fixture accepted, invalid rejected with 2 errors | matches |
| `pnpm -r test` | **392 ✔ / 0 ✖**, exit 0, across **9** workspaces (api 122, web 47, ai 79, ask 41, core 16, db 22, index 89, ingest 50, meeting-bot 49) | 392/0 — matches (says "8 packages"; it is 9 — cosmetic) |
| `pnpm -r typecheck` | exit **0** | matches |
| `pnpm gen:types --check` | `OK: 24 generated type file(s) + index.ts match schema/` | matches |
| `pnpm lint:structure` | **exit 1** — tracker-audit gate G1 fails; depcruise never ran | **claimed "clean" — does not reproduce (ISS-100)** |
| Mongo `chunks` count | **UNVERIFIED** — `Server selection timed out after 10000 ms` against `mongodb://13.202.206.101:27017` | maker made no live claim — correct |

Plus three probes of my own, written from the contract and not read from the maker's tests:
`scratchpad/fuzz-chunks.ts` (3024 chunker shapes × 13 properties), `scratchpad/max.ts` (ceiling
measurement), `scratchpad/iss096.ts` (13 shaped embed responses across both adapters).

**Mongo:** unreachable for me too, so I record UNVERIFIED and convert the timeout into neither a
pass nor a fail. The maker's reasoning that no migration is needed (no writer in code, `embeddingRef`
absent outside the generated type) is confirmed *statically* — my `grep` finds `embeddingRef` only in
prose, `TASKS.md`, `.goal/goal.json` and the retirement note inside the new schema description — but a
static grep is not a live count and I do not upgrade it into one.

---

## RULING 1 — ADR-0001 vs plan §10 (`text` on `chunks`): **the maker is RIGHT. Follow the ADR.**

The plan does not beat the ADR here, and it is not close.

**On authority.** ADR-0001 decision 2 is a *reasoned* decision with recorded prior art — Vexa's
segment-is-atomic model, Onyx's document-is-source-of-truth / chunk-by-reference model, and two
already-adopted brain patterns (`pageindex-multi-source-merge`, `vectorless-rag`). Plan §10 U1.2 is a
one-line implementation sketch. The plan's own §6c.1 *agrees with the ADR* ("`turns` is the only
text-bearing raw collection … never copied text"), so the plan contradicts itself and the ADR is the
only self-consistent reading of the two.

**On substance — three arguments the maker did not make, all pointing the same way.**

1. **`text` is a pure function of `turnRefs`, and I proved it.** Property P3b in my fuzz asserted
   `chunk.text === turnRefs.map(id => turns[id].text.trim()).join(" ")` over all 3024 shapes: **0
   violations.** A field that is derivable byte-exactly from fields already stored is duplication by
   definition, not a cache with independent content.
2. **Storing it creates a drift hazard the citation model cannot tolerate.** If a turn is later
   corrected, re-diarized, or redacted, a stored `chunk.text` keeps the old wording silently, and a
   `/citations` answer would display text the cited turn no longer contains. That is exactly the
   property ARCHITECTURE H3 exists to hold ("no fact without a citation *to* a turn, not a copy *of*
   one").
3. **D-008's gated purge.** A duplicate of turn text inside `chunks` is a second place a purge must
   reach and a second place it can be missed. Nobody wants to discover that during a deletion request.

**And the cost of *not* storing it is already paid.** The only price is a read-time join to render a
snippet — and `search-store` already performs exactly that join to resolve turns and sessions for
`/search`. The code path exists; U1.4/U1.5 reuse it rather than write it.

**On the vector, the maker's distinction holds.** A vector is not a second copy of the source: it is
an irreversible derived numeric artifact, it is *not* reconstructible without paying a model, and
cosine cannot operate on a pointer. Retiring `embeddingRef` (a `string`) for `vector: number[]` +
`dims` is the correct and necessary reading of D-a.

**Consequence I am recording rather than leaving to memory:** plan §10 U1.2's `text` requirement is
**struck**, and I have amended `qa/contracts/schema-v2.md` to say so, so U1.4/U1.5 cannot re-litigate
it from the plan text. The rest of that plan line (`vector: number[]`, `dims`, `chunkIndex`, "do not
lean on `additionalProperties: true`") stands and is satisfied.

## RULING 2 — the U1.2/U1.3 split: **CORRECT, but conditionally — and I have written the condition to disk.**

The test I applied is not "is this convenient" but **"are the deferred checks impossible here, or
merely inconvenient?"**

They are impossible here. "chunks non-empty for all 26 sessions" and "`vector.length === dims` for
100% of rows" both presuppose **rows**, a row presupposes an embedding, and wiring `embed()` into
`apps/api/src/indexing.ts` is *verbatim* the plan's own U1.3 ("New step in
`apps/api/src/indexing.ts:44` — inject `embed` alongside `complete`"). The maker did not invent this
boundary to duck a check; it found an off-by-one **in the plan** and said so in the manifest before
being asked. The alternative it names — folding U1.2+U1.3 into one unit spanning schema, chunker,
embedding, orchestration and a live write — is genuinely too large to check honestly, and this repo's
recent history (ISS-095: the one unexercised code path was the paid one) is a standing argument for
smaller units.

**But a criterion that lives only in a manifest's prose is a criterion on its way to being lost.**
That is the precise mechanism by which a unit shrinks its acceptance criteria — not by denying them,
but by promising them to a successor that never records the promise. So the ruling is conditional and
I have discharged the condition myself, in the one place I own: a routine amendment to
`qa/contracts/schema-v2.md` adding **C8**, which binds those two row-level checks to U1.3 and adds the
gap I found while checking the schema (below). U1.3 now cannot PASS without them.

**The gap that amendment closes.** I probed the schema independently of the fixtures:

```
REJECTED  vector [] only (dims 3 kept)      -> '[] should be non-empty'
REJECTED  dims 0 only (vector kept)         -> '0 is less than the minimum of 1'
REJECTED  dims -1
ACCEPTED  no vector/dims at all             <- a chunk row with NO embedding validates
ACCEPTED  dims 99 with a 3-element vector   <- dims and vector.length need not agree
```

`vector` and `dims` are **optional** and **uncorrelated**. At U1.2 that is right — the chunker emits
plans, not rows. At U1.3 it is the ISS-096 failure mode wearing a different hat: a row written with no
vector, or with a `dims` that lies, validates cleanly and then silently matches nothing. JSON Schema
cannot express `dims === vector.length`, so it must be a write-time assertion in the indexing path.
C8 now says so.

---

## Criterion-by-criterion

| # | Criterion (as this unit engages it) | Verdict |
|---|---|---|
| C1 | ADR-0001 governs `chunks`' reference model | **MET** — followed, and flagged rather than silently chosen (ruling 1) |
| C2 | camelCase keys; generated types regenerated | **MET** — `gen:types --check` clean, 24 files |
| C3 | `chunks` schema + valid/invalid fixtures pass `validate.py` | **MET** — and the invalid fixture genuinely exercises the new floor |
| C7 | No regression (validate.py / gen:types / `-r test` / lint:structure) | **NOT MET** — `lint:structure` exits 1 (ISS-100) |
| C9 (`ai-provider-seam`) | `embed()` refuses what it cannot pair; empty batch is a free no-op | **MET** — 13/13 on both adapters, 0 transport calls for `texts: []` |
| — | Chunker: no silent turn loss, never split mid-turn | **MET, strongly** (below) |
| — | Chunker: `maxChars` is a hard ceiling (`build-chunks.ts:44`) | **NOT MET** — ISS-099 |
| — | Chunker: "no chunk duplicates its predecessor" (manifest step 4) | **NOT MET** — ISS-098 |

| Invariant | Verdict |
|---|---|
| [I4] a batch is never silently mispaired | **HOLDS** — the empty-vector family is now closed on both adapters |
| every non-blank turn reaches ≥1 chunk | **HOLDS** — 0 violations / 3024 shapes |
| no `turnRef` is invented | **HOLDS** — 0 violations |
| chunk text is exactly its whole turns | **HOLDS** — 0 violations |
| chunk width stays within the declared bounds | **FAILS** — 37% of multi-turn chunks over ceiling |

---

## 3 · The silent-turn-loss hunt — the chunker survives it cleanly

This was the check that mattered most, and I ran it as a **property fuzz I wrote myself**
(`scratchpad/fuzz-chunks.ts`), not by reading the maker's tests: **24 hand-built awkward sequences +
3000 randomized ones = 3024 shapes**, each asserted against 13 properties.

The hand-built set covers everything the dispatch asked for and more: all-tiny (×50); one enormous
(5000 chars) among tiny; enormous first; enormous last; all-enormous; alternating long/short;
**exactly at threshold** (400, 800) and adjacent (399, 799); a single turn; two turns; blanks
interleaved; all blank; empty input; whitespace-padded turns; `overlapTurns` 0 / 3 / 5-on-a-3-turn
corpus; `targetChars === maxChars`; and the perverse `targetChars > maxChars`.

**Zero violations of every loss-shaped property:**

- **P1 coverage** — every non-blank turn appears in ≥1 chunk, and `coversAllTurns` agreed with my
  independent recomputation every time. **No silent turn loss in any shape.**
- **P2** — no `turnRef` was ever invented; every id emitted came from the input.
- **P3 / P3b never-split, verified independently as instructed** — for every chunk,
  `text.length === Σ(trimmed turn lengths) + (n − 1)` joining spaces, *and* the stronger byte-exact
  form `text === turns.map(trim).join(" ")`. **0 violations.** No turn was ever cut.
- **P4** `chunkIndex` dense from 0 · **P8** blank turns never emitted · **P9** turn order preserved
  within and across chunks · **P10** no turn repeated inside one chunk · **P11** no empty chunk ·
  **P13** no usable turns ⇒ no chunks.

The three design decisions in the file header are sound and I endorse all three. In particular the
over-long-turn rule ("an over-long chunk is a cost problem, a dropped one is a correctness problem")
is the right trade and it is genuinely implemented — the `current.length > 0` guard at `:86` is what
lets a 5000-char turn through whole, and it does.

## 4 · The overlap tail — one direction holds, the other does not

The maker calls this the subtlest bug in the file and is right to. I checked **both** directions
across all 3024 shapes.

**Direction A — the tail is never lost: HOLDS.** Property P7 asserted that the last usable turn is in
the *final* chunk: **0 violations**, including single-turn inputs, `overlapTurns: 0`, `overlapTurns: 5`
on a 3-turn corpus, and every enormous-turn shape. The `emitted` set test at `:93-94` is correct and
does its job.

**Direction B — no chunk is duplicated: FAILS, and on a two-turn input.**

```
buildChunks([700 chars, 500 chars])   // default options
→ [ {0, [t0], 700}, {1, [t0], 700}, {2, [t0,t1], 1201} ]
     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^ byte-identical chunks
```

1172 of 3024 shapes emit a chunk identical to its predecessor; 11015 chunk pairs are fully subsumed.
`[900,900,900]` reproduces it; `[5,5,5000,5,5]` emits `[t2]` alone, wholly contained in both
neighbours — meaning **the most expensive turn in that session is embedded twice**.

The maker's own analysis named the two failure modes as *emit unconditionally* (duplicate) and *skip
unconditionally* (lose the tail), and then fixed only the second. The tail block at `:93` got the
un-emitted test; the `maxChars` pre-flush at `:86` did not. After `flush()` carries the tail forward
at `:78`, `current` holds **only already-emitted turns**, and `current.length > 0` cannot tell that
apart from a real in-progress chunk. Filed as **ISS-098** with the one-line fix direction: hoist the
un-emitted test into a helper and use it in both places, so they cannot drift again.

**The same root cause breaks the ceiling.** `flush()` restores the overlap into `current` and resets
`chars` to its length, so the `:86` guard is evaluated against a chunk that then grows by the overlap
*plus* the new turn. Measured over 4000 random sessions: **22885 of 61352 multi-turn chunks exceed
`maxChars = 800`** — 37% — worst case **1790 chars, 2.2×** the ceiling, on a chunk of just two turns.
The deliberate single-over-long-turn exemption is excluded from that count; these are ordinary
multi-turn chunks. `build-chunks.ts:44` says "**Hard ceiling**: a chunk never starts a new turn that
would carry it past this," and the plan specifies "~400–800 chars". Filed as **ISS-099**; one change
closes both.

Neither is silent loss, and I want that proportionality on the record: nothing is unfindable. The cost
is real but bounded — duplicated paid embedding calls, and duplicate rows competing for a top-k slot
in the brute-force cosine that U1.4's recall@5 delta will be measured on.

## 5 · The ISS-096 floor — fully closed, on both halves

**Adapters** (my own probe, both providers, 13 responses, transport calls counted):

| Response | gemini | ollama |
|---|---|---|
| 3 texts → 3 empty vectors | **THROWS** | **THROWS** |
| 1 text → 1 empty vector | **THROWS** | **THROWS** |
| first vector empty, rest populated | **THROWS** (floor) | **THROWS** (floor) |
| last vector empty, rest populated | **THROWS** (ragged) | **THROWS** (ragged) |
| `embeddings: [{},{},{}]` (no `values` key) | **THROWS** | n/a |
| **`texts: []`** | `{vectors:[],dims:0}`, **0 transport calls, no throw** | same |
| healthy 3×2 | `dims 2`, order preserved | `dims 2`, order preserved |

The floor is placed after the count check and before the ragged check, which is why it closes the
*whole* empty-vector family rather than just the all-empty case, and it cannot misfire on the empty
batch because `texts.length === 0` returns before it. C9's "an empty array must never reach a paid
endpoint" is preserved — I counted the calls rather than trusting it.

**Schema half** — verified independently of the fixtures (table under Ruling 2): `vector` `minItems: 1`
and `dims` `minimum: 1` each reject **on their own**, and the invalid fixture yields exactly those two
errors, so it genuinely exercises the floor rather than tripping on something else. `ISS-096` is
flipped `open → fixed` in the ledger (a later re-check moves it to `verified`).

---

## What the maker should NOT change

- **The ADR call.** Do not add `text`. Ruling 1 is the ruling.
- **The U1.2/U1.3 boundary.** Do not fold U1.3 in. Ruling 2 is the ruling; the deferred checks are now
  contract C8 and will be enforced there.
- **The over-long-turn-ships-alone rule.** Correct as written.
- **The `emitted` test at `:93-94`.** It is right; it just needs a twin at `:86`.

## To close cycle 2

1. **ISS-098 + ISS-099** — one fix at `build-chunks.ts:86`, plus a regression assertion over *generated*
   shapes (not a fixture): no two chunks share an identical `turnRefs` list, no chunk is a subset of its
   predecessor, and every multi-turn chunk is within `maxChars`.
2. **ISS-100** — flip `TASKS.md:94` U1.1 `open → done`, re-run `pnpm lint:structure` to exit 0 (and let
   depcruise actually run), and correct the manifest's Evidence line.
3. Re-submit at `Fix cycle: 2`.

---

```
VERDICT: FAIL
SCOREBOARD: 6/8 criteria met, 4/5 invariants hold
FAILURES:
- [chunker: no duplicate chunks] sev: medium · buildChunks emits a chunk byte-identical to its
  predecessor on an input as small as two turns (700+500 chars); 1172/3024 fuzzed shapes affected ·
  at :86 flush only when `current` holds an un-emitted turn — the same test :93-94 already does ·
  issue: ISS-098
- [chunker: maxChars hard ceiling] sev: medium · 37% of multi-turn chunks exceed the documented
  ceiling (22885/61352), worst 1790 vs 800, because the overlap carry is re-added after the guard ·
  same fix as ISS-098; then assert the ceiling over generated shapes · issue: ISS-099
- [C7 no regression] sev: low · `pnpm lint:structure` exits 1 on tracker-audit G1, not "clean" as the
  manifest states; depcruise never ran · flip TASKS.md:94 U1.1 to done and correct the manifest ·
  issue: ISS-100
ISSUES-WRITTEN: ISS-098, ISS-099, ISS-100 (+ ISS-096 flipped open → fixed)
EXPLANATION: Both requested rulings go the maker's way. Following ADR-0001 over plan §10's `text`
field is correct — I proved chunk text is a byte-exact function of `turnRefs`, so storing it is pure
duplication with a drift hazard against ARCHITECTURE H3 and D-008's purge; the vector is genuinely a
different thing and `embeddingRef` was right to retire. The U1.2/U1.3 split is correct because the two
deferred checks are impossible without U1.3's writer, not merely inconvenient — but a criterion living
in manifest prose is a criterion on its way to being lost, so I amended the contract with C8 to bind
them to U1.3, along with a gap I found myself: `vector`/`dims` are optional and uncorrelated, so a
row with no vector, or a lying `dims`, validates. The chunker survives the silent-loss hunt cleanly —
3024 generated shapes, zero coverage failures, zero invented refs, and never-split verified
byte-exactly — and the overlap tail is never lost. It fails on the other direction the maker itself
named: after the carry, the maxChars pre-flush re-emits already-emitted turns, producing duplicate
chunks and breaking the documented ceiling on two-turn inputs. Cost, not correctness — but it doubles
the embedding spend on the longest turns and pollutes the top-k that U1.4's recall delta is measured
on, and it is a one-line fix now versus a re-index later. Mongo was unreachable for me too
(10s timeout), so the `chunks` collection is recorded UNVERIFIED, not passed and not failed.
```
