// Checker-authored READ-ONLY live probe for search-store-rank-assertion (ISS-083 / ISS-084).
// No writes.
//
// ===========================================================================================
// CORRECTED 2026-09-09 (ISS-202 item 1). THE ORIGINAL PROBE COULD NOT FAIL.
// ===========================================================================================
// It called `lexicalSearchTurns(q, docs, 10)` directly and then checked each hit's pair against
// `bySession`, a Map built from THE SAME `turns` array `docs` was derived from. `lexicalSearchTurns`
// emits `{ turnId: turn._id, sessionId: turn.sessionId }` off those very objects, so
// `bySession.get(h.turnId) !== h.sessionId` was false by construction: `mismatchedPairs=0` was
// arithmetic, not evidence.
//
// Worse, ISS-083/084 are defects in `createMongoSearchDeps` — the store that joins turns to
// sessions — and the probe never called it. It was evidence for a claim it structurally could not
// support, and it reported that claim as verified.
//
// Two things changed, per the recorded fix direction:
//   1. it now runs the REAL store, `createMongoSearchDeps({ db })`, which is where the defects live;
//   2. the oracle is an INDEPENDENT re-read of `turns` by `_id`, not the array the hits came from,
//      so a wrong pair is expressible.
// It also refuses to report success on an empty result: no hits means nothing was checked.
import { MongoClient } from "../../node_modules/.pnpm/mongodb@7.6.0/node_modules/mongodb/lib/index.js";
import { createMongoSearchDeps } from "../../apps/api/src/search-store.ts";

const uri = process.env.MONGODB_URL;
if (!uri) { console.log("UNVERIFIED: MONGODB_URL not set"); process.exit(0); }
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
let anyChecked = false;
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? "lkb");
  const store = createMongoSearchDeps({ db });

  for (const q of ["visa student university funding", "2026 intake", "counselling"]) {
    const hits = await store.search("toc", q, 10);
    if (hits.length === 0) {
      console.log(`q="${q}" hits=0 -> NOTHING CHECKED (not a pass)`);
      continue;
    }
    anyChecked = true;

    // INDEPENDENT oracle: re-read each hit's turn by _id straight from the collection.
    let badPair = 0, missingTurn = 0, badJoin = 0;
    for (const h of hits) {
      const truth = await db.collection("turns").findOne({ _id: h.turnId, tenantId: "toc" });
      if (!truth) { missingTurn++; continue; }
      if (truth.sessionId !== h.sessionId) badPair++;
      // ISS-080's shape: the joined documents must be the hit's OWN turn and session.
      if (h.turn?._id !== h.turnId || (h.session && h.session._id !== h.sessionId)) badJoin++;
    }
    const distinctScores = new Set(hits.map((s) => s.score)).size;
    console.log(
      `q="${q}" hits=${hits.length} mismatchedPairs=${badPair} unresolvableTurns=${missingTurn} ` +
      `mismatchedJoins=${badJoin} distinctScores=${distinctScores} ` +
      `scores=[${hits.map((s) => s.score.toFixed(4)).join(",")}]`,
    );
  }
  if (!anyChecked) console.log("UNVERIFIED: every query returned 0 hits — the probe asserted nothing");
} catch (e) {
  console.log("UNVERIFIED: live probe failed:", e.message);
} finally {
  await client.close().catch(() => {});
}
