/**
 * apps/api/src/search-prefilter.test.ts — ISS-072. Pins the pre-filter the STORE actually sends
 * to Mongo.
 *
 * `packages/index`'s `lexical.test.ts` already pins `lexicalQueryTokens`. That was not enough: a
 * checker reintroduced the exact `length > 2` defect in `search-store.ts` — the file that ships
 * the filter — and all 148 tests stayed green, because nothing tested the CONSUMPTION of the
 * tokenizer, only the tokenizer. These tests assert against the real filter object.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lexicalSearchTurns } from "@lkb/index";
import { buildTurnPrefilter, prefilterMatches, escapeRegex } from "./search-prefilter.js";

const CORPUS = [
  { _id: "t1", sessionId: "s1", text: "New Zealand student visa approval rates and processing times." },
  { _id: "t2", sessionId: "s2", text: "Education loan interest rates and forex remittance markups." },
  { _id: "t3", sessionId: "s1", text: "Completely unrelated small talk about the weather today." },
  { _id: "t4", sessionId: "s3", text: "AI is reshaping counselling workflows in 2026." },
  { _id: "t5", sessionId: "s3", text: "Is it ok to go without a bank statement?" },
  { _id: "t6", sessionId: "s4", text: "Costs run to 2.5% at banks -- C++ tooling is irrelevant here." },
];

const QUERIES = [
  "visa student university funding",
  "AI in counselling",   // short tokens — the case that silently lost 8 of 10 real hits
  "is it ok to go",      // ALL tokens short — previously produced an empty $or, which Mongo rejects
  "UK visa",
  "c++",                 // regex metacharacters
  "rates",
];

test("PROPERTY: the filter the store actually builds is a superset of what the scorer can score", () => {
  // This is the test whose absence ISS-072 records. It runs against the REAL filter object, so
  // reintroducing a token filter anywhere in the construction path fails here — which asserting
  // on `lexicalQueryTokens` alone did not.
  for (const q of QUERIES) {
    const filter = buildTurnPrefilter(q);
    const scored = lexicalSearchTurns(q, CORPUS, CORPUS.length);
    if (scored.length > 0) {
      assert.ok(filter !== null, `"${q}" scores ${scored.length} turn(s) but the pre-filter is null — every one would be missed`);
    }
    for (const hit of scored) {
      const turn = CORPUS.find((t) => t._id === hit.turnId)!;
      assert.ok(
        prefilterMatches(filter!, turn.text),
        `"${q}" scored turn ${hit.turnId} at ${hit.score}, but the filter Mongo receives does not match its text — this hit would be silently lost`,
      );
    }
  }
});

test("every query token survives into the filter — no length filter, however short", () => {
  const filter = buildTurnPrefilter("AI in counselling");
  assert.equal(filter?.$or.length, 3, "ai / in / counselling must all reach Mongo");
  const patterns = filter!.$or.map((c) => c.text.$regex).sort();
  assert.deepEqual(patterns, ["ai", "counselling", "in"]);
});

test("an all-short-token query still builds a real filter, never an empty $or", () => {
  const filter = buildTurnPrefilter("is it ok to go");
  assert.ok(filter !== null);
  assert.equal(filter!.$or.length, 5);
  assert.ok(filter!.$or.every((c) => c.text.$regex.length > 0), "Mongo rejects $or: [] — every branch must be real");
});

test("a query with no tokens returns null, matching the scorer's own empty-query contract", () => {
  assert.equal(buildTurnPrefilter(""), null);
  assert.equal(buildTurnPrefilter("   "), null);
  assert.equal(buildTurnPrefilter("!!! ??? ..."), null);
  assert.deepEqual(lexicalSearchTurns("", CORPUS, 10), [], "the scorer returns [] for the same input");
});

test("escapeRegex neutralises every metacharacter Mongo's dialect would interpret", () => {
  assert.equal(escapeRegex("c++"), "c\\+\\+");
  assert.equal(escapeRegex("a.b*c"), "a\\.b\\*c");
  assert.equal(escapeRegex("(x)[y]{z}"), "\\(x\\)\\[y\\]\\{z\\}");
  assert.equal(escapeRegex("^a$"), "\\^a\\$");
  // A pattern that would otherwise match everything must match only its literal self.
  assert.ok(new RegExp(escapeRegex(".*")).test("literal .* here"));
  assert.ok(!new RegExp(escapeRegex(".*")).test("no dot star"));
});

test("escaping is defence-in-depth: tokenization already strips every metacharacter first", () => {
  // Worth pinning explicitly, because it is easy to believe escapeRegex is what makes a query
  // like "c++" safe. It is not — `tokenize` splits on \W+, so metacharacters never survive into
  // a token at all: "c++" arrives as ["c"], and "a.c" as ["a","c"] (which is why "a.c" DOES
  // legitimately match "abc" — two separate single-letter tokens, not one literal).
  // escapeRegex therefore protects a path the current tokenizer cannot reach. It stays because
  // the day tokenization changes to preserve punctuation, it becomes load-bearing with no other
  // warning.
  for (const q of ["c++", "a.c", "^start$", "(paren)", "back\\slash", "50%"]) {
    for (const clause of buildTurnPrefilter(q)?.$or ?? []) {
      assert.match(
        clause.text.$regex, /^[A-Za-z0-9_]+$/,
        `token "${clause.text.$regex}" from query "${q}" reached Mongo with a non-word character`,
      );
    }
  }
});

test("the filter is case-insensitive, matching the scorer's lowercasing", () => {
  const filter = buildTurnPrefilter("VISA")!;
  assert.ok(prefilterMatches(filter, "New Zealand student visa approval"));
});
