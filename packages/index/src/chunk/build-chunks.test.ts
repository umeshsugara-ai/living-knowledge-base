/**
 * packages/index/src/chunk/build-chunks.test.ts — U1.2.
 *
 * The cases below are the ways a chunker corrupts a vector index QUIETLY. None of them throw in
 * production; they just make some of the corpus unfindable, which a search cannot distinguish from
 * "nothing relevant exists". So each is asserted rather than assumed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChunks, coversAllTurns, type ChunkableTurn, type ChunkOptions } from "./build-chunks.js";

const turn = (id: string, chars: number, fill = "a"): ChunkableTurn => ({
  _id: id,
  text: fill.repeat(chars),
});

test("every turn lands in at least one chunk — silently dropping corpus is the worst failure here", () => {
  const turns = Array.from({ length: 25 }, (_, i) => turn(`t${i}`, 120));
  const plans = buildChunks(turns);
  assert.ok(coversAllTurns(turns, plans), "some turn is unreachable from any chunk");
  // And nothing invented: every ref must be a real turn id.
  const ids = new Set(turns.map((t) => t._id));
  for (const p of plans) for (const r of p.turnRefs) assert.ok(ids.has(r), `unknown turnRef ${r}`);
});

test("chunkIndex is dense and ordered from 0 — a re-index can be verified complete without re-deriving text", () => {
  const plans = buildChunks(Array.from({ length: 12 }, (_, i) => turn(`t${i}`, 150)));
  assert.deepEqual(plans.map((p) => p.chunkIndex), plans.map((_, i) => i));
});

test("consecutive chunks OVERLAP, so an answer straddling a boundary is reachable from both", () => {
  // The real failure this prevents: a question in turn N and its answer in turn N+1, split apart,
  // leaves neither chunk able to answer it.
  const plans = buildChunks(Array.from({ length: 9 }, (_, i) => turn(`t${i}`, 200)), {
    targetChars: 400,
    overlapTurns: 1,
  });
  assert.ok(plans.length >= 2, "fixture should produce multiple chunks");
  for (let i = 1; i < plans.length; i++) {
    const prev = new Set(plans[i - 1]!.turnRefs);
    assert.ok(
      plans[i]!.turnRefs.some((r) => prev.has(r)),
      `chunk ${i} shares no turn with chunk ${i - 1}`,
    );
  }
});

test("a turn is NEVER split across chunks — turnRefs must honestly describe the content", () => {
  // Each turn id may repeat across chunks (that is overlap), but a chunk's text is always whole
  // turns joined, so its length is a sum of whole turn lengths.
  const turns = [turn("t0", 100), turn("t1", 250), turn("t2", 100)];
  const plans = buildChunks(turns, { targetChars: 200, maxChars: 400 });
  const byId = new Map(turns.map((t) => [t._id, t.text.length]));
  for (const p of plans) {
    const expected = p.turnRefs.reduce((n, r) => n + byId.get(r)!, 0) + (p.turnRefs.length - 1);
    assert.equal(p.text.length, expected, "chunk text is not exactly its whole turns joined");
  }
});

test("a single turn longer than maxChars becomes its own chunk rather than being dropped", () => {
  // An over-long chunk costs money; a dropped one loses evidence. Splitting it would break the
  // never-split-a-turn rule. So it ships whole, alone.
  const plans = buildChunks([turn("t0", 50), turn("huge", 5000), turn("t2", 50)], { maxChars: 800 });
  const owning = plans.filter((p) => p.turnRefs.includes("huge"));
  assert.ok(owning.length >= 1, "the over-long turn was dropped");
  assert.ok(
    owning.some((p) => p.turnRefs.length === 1),
    "the over-long turn should occupy a chunk alone rather than dragging neighbours past maxChars",
  );
});

test("empty and whitespace-only turns are excluded, not emitted as empty chunks", () => {
  // An empty chunk embeds to a zero-ish vector that matches nothing while looking populated —
  // the same degenerate shape ISS-096 guards against at the provider.
  const turns = [turn("t0", 100), { _id: "blank", text: "   " }, { _id: "empty", text: "" }];
  const plans = buildChunks(turns);
  const refs = plans.flatMap((p) => p.turnRefs);
  assert.ok(!refs.includes("blank") && !refs.includes("empty"));
  for (const p of plans) assert.ok(p.text.trim().length > 0, "emitted an empty chunk");
});

test("no chunks at all from an empty or all-blank session, rather than one empty chunk", () => {
  assert.deepEqual(buildChunks([]), []);
  assert.deepEqual(buildChunks([{ _id: "a", text: "  " }]), []);
});

test("the final turns are emitted — the tail is not lost to the overlap carry", () => {
  // Regression guard for the subtlest bug in this file: after the last flush, `current` holds
  // carried-over overlap. Emitting it unconditionally duplicates a chunk; skipping it
  // unconditionally loses the tail. Only genuinely new turns should produce a final chunk.
  const turns = Array.from({ length: 7 }, (_, i) => turn(`t${i}`, 150));
  const plans = buildChunks(turns, { targetChars: 300, overlapTurns: 1 });
  assert.ok(coversAllTurns(turns, plans));
  assert.ok(plans.at(-1)!.turnRefs.includes("t6"), "the last turn never made it into a chunk");
  // No chunk is a duplicate of its predecessor.
  for (let i = 1; i < plans.length; i++) {
    assert.notDeepEqual(plans[i]!.turnRefs, plans[i - 1]!.turnRefs, `chunk ${i} duplicates ${i - 1}`);
  }
});

test("overlapTurns: 0 disables overlap without losing coverage", () => {
  const turns = Array.from({ length: 8 }, (_, i) => turn(`t${i}`, 200));
  const plans = buildChunks(turns, { targetChars: 400, overlapTurns: 0 });
  assert.ok(coversAllTurns(turns, plans));
  const seen = plans.flatMap((p) => p.turnRefs);
  assert.equal(new Set(seen).size, seen.length, "no turn should repeat when overlap is disabled");
});

/**
 * FUZZ — added at cycle 2. My nine hand-picked cases missed two real defects that a checker's 3024
 * generated shapes found immediately (ISS-098 duplicate chunks, ISS-099 ceiling breach). Hand-built
 * fixtures test the shapes you already imagined; the bugs live in the ones you did not. So the
 * properties are now asserted over a generated space rather than over examples.
 */
function* shapes(): Generator<{ turns: ChunkableTurn[]; opts: ChunkOptions; label: string }> {
  const lengths: Record<string, number[]> = {
    "all-tiny": Array.from({ length: 20 }, () => 5),
    "one-enormous": [5, 5, 5000, 5, 5],
    alternating: [700, 50, 700, 50, 700, 50],
    "at-threshold": [400, 400, 800, 800, 400],
    "just-over": [401, 801, 399],
    single: [300],
    pair: [700, 500],
    "pair-huge": [900, 900],
    ramp: [50, 150, 300, 600, 1200],
  };
  const optionSets: ChunkOptions[] = [
    {},
    { overlapTurns: 0 },
    { overlapTurns: 3 },
    { targetChars: 100, maxChars: 200 },
    { targetChars: 900, maxChars: 800 }, // target > max: contradictory, must still not corrupt
  ];
  for (const [label, lens] of Object.entries(lengths)) {
    for (const opts of optionSets) {
      yield {
        label: `${label} ${JSON.stringify(opts)}`,
        turns: lens.map((n, i) => turn(`t${i}`, n)),
        opts,
      };
    }
  }
}

test("FUZZ: no chunk is ever byte-identical to its predecessor (ISS-098)", () => {
  for (const { turns, opts, label } of shapes()) {
    const plans = buildChunks(turns, opts);
    for (let i = 1; i < plans.length; i++) {
      assert.notDeepEqual(plans[i]!.turnRefs, plans[i - 1]!.turnRefs, `${label}: chunk ${i} duplicates ${i - 1}`);
    }
  }
});

test("FUZZ: every chunk respects maxChars unless it is a single over-long turn (ISS-099)", () => {
  for (const { turns, opts, label } of shapes()) {
    const max = opts.maxChars ?? 800;
    const plans = buildChunks(turns, opts);
    for (const p of plans) {
      if (p.turnRefs.length === 1) continue; // a lone over-long turn is allowed through by design
      assert.ok(p.text.length <= max, `${label}: chunk of ${p.turnRefs.length} turns is ${p.text.length} > ${max}`);
    }
  }
});

test("FUZZ: coverage, no invented refs, dense ordering, never-split — across every shape", () => {
  for (const { turns, opts, label } of shapes()) {
    const plans = buildChunks(turns, opts);
    assert.ok(coversAllTurns(turns, plans), `${label}: a turn is unreachable`);
    const ids = new Set(turns.map((t) => t._id));
    const byId = new Map(turns.map((t) => [t._id, t.text.length]));
    plans.forEach((p, i) => {
      assert.equal(p.chunkIndex, i, `${label}: chunkIndex not dense`);
      for (const r of p.turnRefs) assert.ok(ids.has(r), `${label}: invented turnRef ${r}`);
      const expected = p.turnRefs.reduce((n, r) => n + byId.get(r)!, 0) + (p.turnRefs.length - 1);
      assert.equal(p.text.length, expected, `${label}: a turn was split`);
    });
  }
});
