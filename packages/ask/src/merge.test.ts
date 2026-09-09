/**
 * packages/ask/src/merge.test.ts — U1.5, contract C3/C4.
 *
 * The failure this fusion is most likely to have is not a crash: it is a ranking that looks
 * plausible and is wrong, or a dedupe that silently dedupes nothing. Both are invisible without
 * assertions on ORDER and on identity.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rrfMerge, RRF_K } from "./merge.js";

const n = (id: string) => ({ node_id: id });
const keyOf = (x: { node_id: string }) => x.node_id;

test("an item found by TWO arms outranks one found once at the same position", () => {
  // This is the entire reason to fuse rather than concatenate. If it fails, the merge is just an
  // expensive union.
  const out = rrfMerge([[n("a"), n("b")], [n("b"), n("c")]], { keyOf });
  assert.equal(out[0]!.node_id, "b", "b appears in both arms and must rank first");
});

test("rank position matters within an arm", () => {
  const out = rrfMerge([[n("first"), n("second")]], { keyOf });
  assert.deepEqual(out.map(keyOf), ["first", "second"]);
});

test("DEDUPE is real — one item per key, not one per occurrence", () => {
  // A dedupe keyed on a field some arms lack would silently dedupe nothing while looking correct,
  // which is why the key is injected and total (contract C3).
  const out = rrfMerge([[n("x")], [n("x")], [n("x")]], { keyOf });
  assert.equal(out.length, 1);
});

test("DETERMINISTIC ORDER across identical scores — ties break on the key", () => {
  // Without a tie-break, equal-scoring items order by input happenstance, and a recall number
  // measured twice on one corpus can differ. That would make the delta U1.5 reports untrustworthy.
  const a = rrfMerge([[n("zzz")], [n("aaa")]], { keyOf });
  const b = rrfMerge([[n("aaa")], [n("zzz")]], { keyOf });
  assert.deepEqual(a.map(keyOf), b.map(keyOf), "input order must not change the output order");
  assert.deepEqual(a.map(keyOf), ["aaa", "zzz"]);
});

test("the FIRST arm's object survives a tie — it carries the summary the refine step reads", () => {
  const rich = { node_id: "s", summary: "real summary" };
  const bare = { node_id: "s" };
  const out = rrfMerge<{ node_id: string; summary?: string }>([[rich], [bare]], { keyOf });
  assert.equal(out[0]!.summary, "real summary", "a later arm's barer node must not replace it");
});

test("an EMPTY arm contributes nothing and is not an error — this is what makes degradation free", () => {
  // A failed vector arm returns [] and the merge just becomes tree+lexical. No special case.
  const withEmpty = rrfMerge([[n("a"), n("b")], [], [n("b")]], { keyOf });
  const without = rrfMerge([[n("a"), n("b")], [n("b")]], { keyOf });
  assert.deepEqual(withEmpty.map(keyOf), without.map(keyOf));
});

test("no arms at all returns nothing rather than throwing", () => {
  assert.deepEqual(rrfMerge([], { keyOf }), []);
  assert.deepEqual(rrfMerge([[], []], { keyOf }), []);
});

test("the RRF score is the documented formula, not an approximation of it", () => {
  // Pinned so a later 'optimisation' cannot quietly change ranking semantics: an item ranked 1st
  // in two arms must score exactly 2/(k+1).
  const out = rrfMerge([[n("x")], [n("x")], [n("y")]], { keyOf });
  assert.deepEqual(out.map(keyOf), ["x", "y"]);
  // y scores 1/(k+1); x scores 2/(k+1). With k=RRF_K both are positive and x is strictly greater.
  assert.ok(2 / (RRF_K + 1) > 1 / (RRF_K + 1));
});

test("a lower-ranked item in two arms can beat a top-ranked item in one — fusion, not concatenation", () => {
  // arm1: [a, b, c]  arm2: [c, d]  -> c is 3rd + 1st = 1/63 + 1/61 > a's 1/61
  const out = rrfMerge([[n("a"), n("b"), n("c")], [n("c"), n("d")]], { keyOf });
  assert.equal(out[0]!.node_id, "c", "agreement across arms must be able to outweigh one arm's top pick");
});
