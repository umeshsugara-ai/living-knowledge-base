// qa/probes/rank-probe.mjs — READ-ONLY live probe for the search store's rank assertions
// (ISS-083 / ISS-084 / ISS-080). No writes: `find` and `findOne` only, through `scopedCollection`.
//
// WHY THIS LIVES HERE AND NOT IN qa/evidence/ (ISS-213). A file under `qa/evidence/` named for a
// date is a RESULT — an immutable record of what ran that day, cited by verdicts. This is an
// INSTRUMENT: it is meant to be re-run and improved. Conflating the two is what let
// `live-rank-probe-2026-09-08.mjs` be rewritten in place, silently repointing two checker-owned
// verdicts at code their authors never saw. That artifact is now restored and marked void; this is
// its replacement.
//
// WHAT THE ORIGINAL GOT WRONG (ISS-202 item 1). It compared each hit's `(turnId, sessionId)` pair
// against a Map built from THE SAME array the hits were derived from, so `mismatchedPairs=0` was
// arithmetic, not a measurement — and it never called `createMongoSearchDeps`, which is where the
// defects it cited actually live. Two things changed: it runs the real store, and the oracle is an
// INDEPENDENT re-read of each hit's turn by `_id`.
//
// Run: npx tsx --env-file=.env qa/probes/rank-probe.mjs
import { MongoClient } from "../../node_modules/.pnpm/mongodb@7.6.0/node_modules/mongodb/lib/index.js";
import { createMongoSearchDeps } from "../../apps/api/src/search-store.ts";

const QUERIES = ["visa student university funding", "2026 intake", "counselling"];

const uri = process.env.MONGODB_URL;
if (!uri) { console.log("UNVERIFIED: MONGODB_URL not set"); process.exit(0); }
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
let anyChecked = false;
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? "lkb");
  const store = createMongoSearchDeps({ db });

  for (const q of QUERIES) {
    const hits = await store.search("toc", q, 10);
    if (hits.length === 0) {
      console.log(`q="${q}" hits=0 -> NOTHING CHECKED (not a pass)`);
      continue;
    }

    // ISS-212. A pairing defect is only OBSERVABLE when the hits span more than one session:
    // mis-pairing among rows that all carry the same `sessionId` produces an identical result, so
    // `mismatchedPairs=0` is uninformative there. Measured: under an ISS-084-shaped mutation this
    // probe reports 6 / 0 / 2 across the three queries, and the 0 is exactly the single-session
    // query. The limitation was previously disclosed only in a manifest the reader of this output
    // never sees — so the probe now refuses in its own words, the same way it already refuses on
    // zero hits.
    const distinctSessions = new Set(hits.map((h) => h.sessionId)).size;
    if (distinctSessions < 2) {
      console.log(
        `q="${q}" hits=${hits.length} distinctSessions=${distinctSessions} -> ` +
        `INCONCLUSIVE for pairing: all hits share one session, so a mis-pairing is unobservable`,
      );
      continue;
    }
    anyChecked = true;

    // INDEPENDENT oracle: re-read each hit's turn by _id straight from the collection, rather than
    // from anything the store handed back.
    let badPair = 0, missingTurn = 0, badJoin = 0;
    for (const h of hits) {
      const truth = await db.collection("turns").findOne({ _id: h.turnId, tenantId: "toc" });
      if (!truth) { missingTurn++; continue; }
      if (truth.sessionId !== h.sessionId) badPair++;
      // ISS-080's shape: the joined documents must be the hit's OWN turn and session.
      if (h.turn?._id !== h.turnId || (h.session && h.session._id !== h.sessionId)) badJoin++;
    }
    console.log(
      `q="${q}" hits=${hits.length} distinctSessions=${distinctSessions} mismatchedPairs=${badPair} ` +
      `unresolvableTurns=${missingTurn} mismatchedJoins=${badJoin} ` +
      `distinctScores=${new Set(hits.map((s) => s.score)).size} ` +
      `scores=[${hits.map((s) => s.score.toFixed(4)).join(",")}]`,
    );
  }
  if (!anyChecked) console.log("UNVERIFIED: no query produced a checkable result — the probe asserted nothing");
} catch (e) {
  console.log("UNVERIFIED: live probe failed:", e.message);
} finally {
  await client.close().catch(() => {});
}
