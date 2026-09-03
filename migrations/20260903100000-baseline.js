// migrations/20260903100000-baseline.js — T-018 C5. The ONLY place collection/index shape
// changes for this schema generation (ARCHITECTURE §4). Creates the 18 knowledge-layer
// Mongo collections (10 pre-existing + 8 new from T-018) and applies schema/index.json's
// declared indexes. Idempotent: createCollection/createIndex are both safe to re-run.
const { readFileSync } = require("fs");
const { join } = require("path");

const COLLECTIONS = [
  "orgs", "sources", "sessions", "turns", "session_pages", "topics", "claims", "speakers",
  "decisions",
  "programs", "media", "chunks", "graph_edges", "jobs", "tenants", "api_keys",
  "consent_policies",
];

function loadIndexes() {
  const path = join(__dirname, "..", "schema", "index.json");
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  delete parsed.$comment;
  return parsed;
}

module.exports = {
  async up(db) {
    const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
    for (const name of COLLECTIONS) {
      if (!existing.has(name)) await db.createCollection(name);
    }

    const indexes = loadIndexes();
    for (const [collection, specs] of Object.entries(indexes)) {
      for (const spec of specs) {
        const options = { ...spec };
        delete options.keys;
        await db.collection(collection).createIndex(spec.keys, options);
      }
    }
  },

  async down(db) {
    for (const name of COLLECTIONS) {
      await db.collection(name).drop().catch(() => {});
    }
  },
};
