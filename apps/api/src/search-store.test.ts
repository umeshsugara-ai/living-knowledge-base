/**
 * apps/api/src/search-store.test.ts — ISS-076. Asserts the FILTER OBJECT `createMongoSearchDeps`
 * actually sends to Mongo, captured through an injected db handle.
 *
 * Why this file exists rather than a fourth string assertion: `search-prefilter-single-source.test.ts`
 * constrains the SOURCE TEXT of `search-store.ts`, and a checker demonstrated three bypasses that
 * satisfy every one of its assertions while corrupting the query —
 *   (a) build the filter correctly, then mutate it (`prefilter.$or = prefilter.$or.slice(0, 1)`);
 *   (b) launder it through a wrapper module the pin does not know about;
 *   (c) break `buildTurnPrefilter` itself in a direction the example-based property test misses.
 * All three left typecheck clean and all 99 tests green; (c) silently lost 6 of 20 real hits
 * against production. A source pin can only pin the previous attack's syntax, so it loses that
 * race by construction. This asserts on the object that reaches `find()` instead, which is what
 * every one of those bypasses has to corrupt in order to do damage.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lexicalSearchTurns } from "@lkb/index";
import { createMongoSearchDeps } from "./search-store.js";
import { prefilterMatches, type TurnPrefilter } from "./search-prefilter.js";

const CORPUS = [
  { _id: "t1", tenantId: "toc", sessionId: "s1", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "New Zealand student visa approval rates for the 2026 intake." },
  { _id: "t2", tenantId: "toc", sessionId: "s2", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "Education loan interest rates and forex markups of 2.5% at banks." },
  { _id: "t3", tenantId: "toc", sessionId: "s1", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "Completely unrelated small talk about the weather today." },
  { _id: "t4", tenantId: "toc", sessionId: "s3", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "AI is reshaping counselling workflows in 2026." },
  { _id: "t5", tenantId: "toc", sessionId: "s3", speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "Is it ok to go without a bank statement?" },
];
const SESSION = { _id: "s1", tenantId: "toc", sourceId: "src1", title: "Fixture", date: "2026-01-01", status: { transcribe: "done", index: "done" } };

/** A db handle that records every filter `find()` receives, then answers from the fixture corpus.
 * `scopedCollection` merges `tenantId` in on top, so the captured object is exactly what Mongo
 * would have been sent. */
function capturingDb() {
  const filters: Record<string, unknown>[] = [];
  const db = {
    collection: (name: string) => ({
      find: (filter: Record<string, unknown>) => {
        if (name === "turns") filters.push(filter);
        return { toArray: async () => (name === "turns" ? CORPUS : []) };
      },
      findOne: async () => (name === "sessions" ? SESSION : null),
    }),
  };
  return { db: db as never, filters };
}

/** The $or branch of a captured filter, as `prefilterMatches` expects it. */
function asPrefilter(captured: Record<string, unknown>): TurnPrefilter {
  return { $or: captured.$or as TurnPrefilter["$or"] };
}

// ISS-077: the query set is DERIVED from the corpus rather than hard-coded, so classes the author
// did not think of (numeric tokens, decimals, short words) arise on their own. The previous
// example-based test used six fixed queries containing no numeric token, and a defect that dropped
// exactly those survived it while losing real hits in production.
function derivedQueries(): string[] {
  const words = [...new Set(CORPUS.flatMap((t) => t.text.toLowerCase().split(/\W+/).filter(Boolean)))];
  const singles = words.map((w) => w);
  const pairs = words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`);
  return [...singles, ...pairs];
}

test("the filter sent to Mongo is a superset of what the scorer can score — over queries DERIVED from the corpus", async () => {
  const queries = derivedQueries();
  assert.ok(queries.length > 40, `expected a real generated query set, got ${queries.length}`);
  assert.ok(queries.some((q) => /\d/.test(q)), "the corpus must contribute numeric tokens — that is the class ISS-077 was lost on");

  for (const q of queries) {
    const { db, filters } = capturingDb();
    await createMongoSearchDeps({ db }).search("toc", q, 10);
    const scored = lexicalSearchTurns(q, CORPUS, CORPUS.length);
    if (scored.length === 0) continue;

    assert.equal(filters.length, 1, `"${q}" must issue exactly one turns query`);
    const filter = asPrefilter(filters[0]!);
    assert.ok(Array.isArray(filter.$or), `"${q}" sent no $or to Mongo — every scored hit would be missed`);

    for (const hit of scored) {
      const turn = CORPUS.find((t) => t._id === hit.turnId)!;
      assert.ok(
        prefilterMatches(filter, turn.text),
        `"${q}" scores turn ${hit.turnId} at ${hit.score}, but the filter SENT TO MONGO does not match its text — this hit is silently lost`,
      );
    }
  }
});

test("a query with no usable tokens issues no database query at all", async () => {
  const { db, filters } = capturingDb();
  const hits = await createMongoSearchDeps({ db }).search("toc", "!!! ???", 10);
  assert.deepEqual(hits, []);
  assert.equal(filters.length, 0, "an unmatchable query must not scan the collection");
});

test("results still resolve through the injected handle end to end", async () => {
  const { db } = capturingDb();
  const hits = await createMongoSearchDeps({ db }).search("toc", "visa", 10);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.turnId, "t1");
  assert.equal(hits[0]?.turn?.text, CORPUS[0]!.text);
  assert.equal(hits[0]?.session?.title, "Fixture");
});
