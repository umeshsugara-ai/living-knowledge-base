// Checker-authored, READ-ONLY live probe for search-store-rank-assertion (ISS-083/ISS-084).
// Independently recomputes lexicalSearchTurns over the real `toc` corpus and checks that each
// ranked hit's (turnId, sessionId) pair is the one the real corpus says it is, and that scores
// are the scorer's own (not a constant). No writes.
import { MongoClient } from "../node_modules/.pnpm/mongodb@7.6.0/node_modules/mongodb/lib/index.js";
import { lexicalSearchTurns } from "../packages/index/src/index.ts";

const uri = process.env.MONGODB_URL;
if (!uri) { console.log("UNVERIFIED: MONGODB_URL not set"); process.exit(0); }
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? "lkb");
  const turns = await db.collection("turns").find({ tenantId: "toc" }).toArray();
  console.log("live turns(toc):", turns.length);
  const docs = turns.map((t) => ({ _id: t._id, sessionId: t.sessionId, text: t.text }));
  const bySession = new Map(turns.map((t) => [t._id, t.sessionId]));
  for (const q of ["visa student university funding", "2026 intake", "counselling"]) {
    const scored = lexicalSearchTurns(q, docs, 10);
    let badPair = 0;
    for (const h of scored) if (bySession.get(h.turnId) !== h.sessionId) badPair++;
    const distinctScores = new Set(scored.map((s) => s.score)).size;
    console.log(`q="${q}" hits=${scored.length} mismatchedPairs=${badPair} distinctScores=${distinctScores} scores=[${scored.map((s) => s.score.toFixed(4)).join(",")}]`);
  }
} catch (e) {
  console.log("UNVERIFIED: live probe failed:", e.message);
} finally {
  await client.close().catch(() => {});
}
