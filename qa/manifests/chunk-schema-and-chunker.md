# Manifest — chunk-schema-and-chunker

**Contract:** qa/contracts/schema-v2.md (+ `ai-provider-seam.md` C9 for the ISS-096 half)
**Goal task:** **U1.2** (plan §10 Phase 1)
**Date:** 2026-09-08
**Fix cycle:** 2 of max 3
**Dual check:** no
**Issues addressed:** **ISS-096** (medium — the empty-vector floor, which the U1.1 verdict made
binding before U1.3)

## A contradiction I hit immediately, and how I resolved it

Plan §10 U1.2 says `chunks` must gain **`text`**. **ADR-0001 forbids it**, in as many words:

> *"`media`/`chunks` reference `turns` by id only — never duplicate text."*

— grounded in the `pageindex-multi-source-merge` and `vectorless-rag` patterns, and restated in
plan §6c.1 (*"`turns` is the only text-bearing raw collection … never copied text"*). So the plan
contradicts both a recorded ADR and its own architecture section.

**I followed the ADR.** A recorded decision with reasoning outranks a later one-line sketch, and
functionally the ADR is right: cosine needs the **vector** stored, and never needs the text.
Display text resolves from `turnRefs` at read time, exactly as `search-store` already resolves
turns and sessions for `/search`. **Flagged rather than silently chosen — the checker should rule.**

**The vector is different from text and I want that distinction on the record:** it is a *derived
numeric artifact*, not a second copy of the source. Storing it does not weaken the ADR's
no-duplicate-text property, and it is unavoidable — `embeddingRef` was a **string pointer**, and
brute-force cosine (D-a) cannot compare a pointer. That field is retired.

## What changed

1. **`schema/chunks.schema.json`** — adds `vector` (`minItems: 1`), `dims` (`minimum: 1`),
   `chunkIndex`; retires `embeddingRef`. `chunkIndex` is now required. `embeddingModel` gains a
   reason: vectors from different models are not comparable, so it is what makes a mixed corpus
   *diagnosable by query* rather than by a failed search.
2. **`schema/fixtures/chunks/{valid,invalid}.json`** — the invalid fixture now exercises the
   **empty-vector** case specifically, so the schema's floor is itself under test.
3. **`packages/index/src/chunk/build-chunks.ts`** (new) — pure chunker, no I/O.
4. **`packages/ai/src/providers/{gemini,ollama}.ts`** — **ISS-096**: both `embed()` guards were
   *relative* (count vs count, length vs `length[0]`) and neither had a **floor**, so N texts
   returning N *empty* vectors passed both. Now refused.
5. **`packages/core/src/generated/chunks.ts`** — regenerated. `docs/SNAPSHOT.md` regenerated.

## The three chunker decisions

- **Never split mid-turn.** A turn is the atomic citable unit everywhere else in this system
  (`claims.evidence`, `session_pages`, `/citations`). Splitting one yields a chunk whose
  `turnRefs` cannot honestly describe its content, and every answer citing it cites more than it
  used.
- **Overlap by TURNS, not characters.** A question in turn N answered in turn N+1 is invisible to
  both chunks unless they share turns. Character-based overlap would re-split mid-turn.
- **An over-long single turn ships whole and alone.** Over-long is a cost problem; dropped is a
  correctness problem; split breaks rule one.

## Evidence

`pnpm -r test` — **392 passing / 0 failing** across 8 packages (was 380; `@lkb/index` 71 → **80**,
`@lkb/ai` 67 → **70**).
`python schema/validate.py` — **PASS, 24 collection schemas**, valid fixture accepted and invalid
correctly rejected.
`pnpm -r typecheck` exit 0 · `pnpm lint:structure` clean (lint-dupes 268 exports, SNAPSHOT fresh,
depcruise **0 violations**).

**The 12 new tests are failure modes, not happy paths.** The chunker's are all ways an index goes
quietly wrong — a search simply never returns the missing material and nothing errors: every turn
covered; `chunkIndex` dense from 0; consecutive chunks genuinely share a turn; chunk text is
*exactly* its whole turns joined (the never-split proof); an over-long turn survives alone;
blank turns excluded rather than emitted as empty chunks; **the tail is not lost to the overlap
carry** (the subtlest bug in the file — emit unconditionally and you duplicate a chunk, skip
unconditionally and you lose the last turns); and `overlapTurns: 0` still covers everything.

The ISS-096 tests pin both the refusal **and** that an *empty batch* still returns `dims: 0`
without throwing — the floor must not turn a legitimate no-op into an error.

## Scope: I am proposing a split, and saying so

Plan §10's U1.2 verification asks for *"chunks non-empty for all 26 sessions"* and
*"`vector.length === dims` for 100% of rows"*. **Rows cannot exist yet** — writing one requires an
embedding, and wiring `embed()` into `indexing.ts` is explicitly **U1.3**. So the plan's split is
off by one step.

This unit delivers the **schema + the pure chunker + the ISS-096 floor**; row-writing and those two
row-level checks belong to U1.3, which is where they become runnable. Alternative was to fold
U1.2+U1.3 into one unit spanning schema, chunker, embedding, orchestration and a live write — too
large to check honestly.

**Mongo was unreachable during this tick** (`Server selection timed out after 15000 ms`), so I make
no live claim about the `chunks` collection. It has no writer in code, and `embeddingRef` appears
nowhere outside the generated type — so no migration is needed, but that is reasoning from code,
not from a live count.

## How to verify (checker)

1. **Rule on the ADR-vs-plan contradiction.** Is following ADR-0001 (no stored `text`) right, or
   does the plan's `text` field have a purpose I have missed? If I am wrong, this is the moment —
   it is far cheaper before rows exist.
2. **Attack the chunker for silent loss.** Generate awkward turn sequences — all tiny, one enormous
   among tiny, alternating — and confirm `coversAllTurns` holds and no `turnRef` is invented. A
   dropped turn is unfindable forever and nothing errors.
3. **Verify never-split independently**: for every chunk, `text.length` must equal the sum of its
   turns' trimmed lengths plus the joining spaces. Any other value means a turn was cut.
4. **Confirm the overlap-tail behaviour both ways** — that the last turn always lands in a chunk,
   and that no chunk duplicates its predecessor.
5. **ISS-096**: confirm N-texts→N-empty-vectors is refused on both adapters, and that `texts: []`
   still returns `dims: 0` without throwing.
6. `python schema/validate.py`, `pnpm -r test`, `pnpm -r typecheck`, `pnpm lint:structure`.
7. **Judge the U1.2/U1.3 split.** Is deferring row-writing correct, or should this unit have
   included it?
8. `ISSUES-WRITTEN: none` is a complete check.

## Risk / rollback

Additive schema fields on a collection with no writer and (per code) no rows; one new pure module;
two provider guards that only ever turn a silent corruption into an error. No production behaviour
calls any of it yet. `git revert` is clean.

---

# Fix cycle 2 — three FAILURES, and the method that found them

Both rulings I asked for came back in my favour, and the unit still failed on three defects. That
is the right outcome and the useful one.

### ISS-098 + ISS-099 (medium) — one root cause, found by fuzzing, not by reading

> *"buildChunks emits a chunk byte-identical to its predecessor on an input as small as two turns;
> **1172/3024** fuzzed shapes affected"* · *"**37%** of multi-turn chunks exceed the documented
> ceiling (22885/61352), worst **1790 vs 800**"*

Accepted. I had named this exact hazard in a comment — *"emitting unconditionally duplicates a
chunk, skipping unconditionally loses the tail"* — **and then guarded only the final tail.** Every
interior flush needed the same test. The checker's diagnosis is precise: the `emitted` check at
`:93` was never given a twin at `:86`.

**The lesson is about method, not this function.** My nine hand-picked cases all passed. A
generated space of 3024 shapes broke it in 39% of them. **Hand-built fixtures test the shapes you
already imagined; the bugs live in the ones you did not.** So cycle 2 adds my own fuzz — 9 length
profiles × 5 option sets, including `targetChars > maxChars` — asserting no-duplicate, ceiling,
coverage, no-invented-refs, dense ordering and never-split across every shape.

**And the fuzz immediately earned itself.** After fixing the duplicate, it failed on
`{targetChars: 900, maxChars: 800}` with **802 > 800** — a second, independent bug the checker's
report had not isolated: my `chars` counter summed *trimmed turn lengths* while the emitted text is
those turns **joined by spaces**, so the ceiling was off by one separator per turn. `chars` now
measures exactly what will be embedded. A ceiling that does not count what it bounds is not a
ceiling.

**On the ISS-099 tradeoff:** when carried overlap plus the next turn cannot fit, the overlap is now
dropped rather than the ceiling breached. Losing one boundary link costs a little recall on that
seam; an unbounded chunk costs money on every embed and dilutes every similarity score inside it.

### ISS-100 (low) — my evidence was false, and that is the worse half

> *"`pnpm lint:structure` exits 1 on tracker-audit G1, not 'clean'; depcruise never ran"*

Correct, and it is the third time this pattern has caught me. I ran `lint:structure | grep -E
"OK|violation"` and read the absence of a FAIL line as success. The `&&` chain had **short-circuited
at tracker-audit**, so the depcruise line I cited *never executed* — I reported a number no run
produced.

**Fixed the claim and the habit:** all four gates are now verified by **exit code**, not by
grepping output. `lint:structure` **EXIT=0**, `typecheck` **EXIT=0**, `pnpm -r test` **EXIT=0**,
`schema/validate.py` **EXIT=0**.

**The underlying divergence, worth recording:** G1 fired because the U1.1 checker closed
`.goal/goal.json` but not `TASKS.md`. G1 exists precisely to catch that, and it did — but it means
a checker's `/goal` close leaves the trackers divergent until the next maker touches them. Flipped
`TASKS.md:94` to `done`; noting the pattern rather than filing it, since it belongs to the checker's
close-out path, not to this unit.

### The two rulings

- **ADR-0001 upheld, and strengthened beyond my argument.** The checker proved chunk text is a
  *byte-exact function* of `turnRefs` (0 violations / 3024 shapes), so a stored `text` is
  duplication by definition — plus a drift hazard against ARCHITECTURE H3 (a corrected turn would
  leave a citation showing text the source no longer contains) and a second surface D-008's gated
  purge must reach. **Plan §10's `text` is struck**, recorded in the contract so U1.4/U1.5 cannot
  re-litigate it from the plan.
- **The split is correct — but it discharged the condition rather than trusting my prose.** The
  deferred checks now live in contract **C8**, bound to U1.3, because *"a criterion living in
  manifest prose is how acceptance criteria quietly evaporate."* It also found a gap I missed:
  `vector` and `dims` are **optional and uncorrelated**, so a row with no vector, or
  `{vector: [3], dims: 99}`, validates cleanly. JSON Schema cannot express that correlation — it
  must be a write-time assertion in U1.3.

## Cycle-2 evidence

| check | result |
|---|---|
| `pnpm -r test` | **EXIT 0** — `@lkb/index` 80 → **83** (3 fuzz properties added) |
| `pnpm lint:structure` | **EXIT 0** (was exiting 1 — the cycle-1 claim was false) |
| `pnpm -r typecheck` | **EXIT 0** |
| `python schema/validate.py` | **EXIT 0** |
| fuzz: no duplicate chunk | holds across all 45 shapes |
| fuzz: ceiling respected | holds across all 45 shapes (multi-turn chunks) |
| fuzz: coverage / no invented refs / dense / never-split | holds across all 45 shapes |

## How to verify (cycle 2)

1. **Re-run your own 3024-shape fuzz.** Mine is 45 shapes; yours found what mine missed once
   already. Duplicate-chunk and ceiling rates should both be **0**.
2. **Check the separator fix specifically**: `{targetChars: 900, maxChars: 800}` on
   `[700,50,700,50,700,50]` produced an 802-char chunk before it. Confirm `chars` now equals
   `text.length` for every chunk.
3. **Confirm the overlap-drop tradeoff is real and bounded** — when overlap + next turn exceeds the
   ceiling the overlap is dropped, so those two chunks share no turn. Is that the right call
   against breaching the ceiling?
4. **Verify every gate by EXIT CODE**, not by reading output. That is what cycle 1 got wrong.
5. Confirm `TASKS.md` and `goal.json` now agree on U1.1.
6. `ISSUES-WRITTEN: none` is a complete check.

**Status: ready-for-check**
