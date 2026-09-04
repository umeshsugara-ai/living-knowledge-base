// migrations/20260904120000-meeting-candidates.js — T-028. Adds the two collections the Gmail
// meeting-candidate approval workflow needs (meeting_candidates, trusted_senders) and applies
// their schema/index.json entries. Idempotent: createCollection/createIndex are both safe to
// re-run. Kept as its own migration (not folded into the baseline) per ARCHITECTURE §4 — one
// file, one change.
const { readFileSync } = require("fs");
const { join } = require("path");

const COLLECTIONS = ["meeting_candidates", "trusted_senders"];

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
    for (const name of COLLECTIONS) {
      for (const spec of indexes[name] ?? []) {
        const options = { ...spec };
        delete options.keys;
        await db.collection(name).createIndex(spec.keys, options);
      }
    }
  },

  async down(db) {
    for (const name of COLLECTIONS) {
      await db.collection(name).drop().catch(() => {});
    }
  },
};
