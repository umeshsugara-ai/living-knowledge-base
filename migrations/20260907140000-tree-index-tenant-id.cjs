// migrations/20260907140000-tree-index-tenant-id.cjs — ISS-062. `schema/tree_index.schema.json`
// now requires a real `tenantId` field on the ROOT document (see packages/index/src/tree/
// build.ts's treeIndexRootFilter doc comment for why: the field previously did not exist at
// all, so a tenant's whole knowledge tree was separated only by the `tenant:<id>` string prefix
// inside `node_id`). Application code (apps/api/src/indexing.ts) stamps this field on every root
// it writes FROM NOW ON — this migration backfills any document written before that change.
//
// Idempotent, safe to re-run: only touches documents where `tenantId` is genuinely absent, and
// derives the value from the existing `node_id` prefix (`tenant:<id>`) rather than guessing —
// the same convention `treeIndexRootFilter` has always encoded.
module.exports = {
  async up(db) {
    const collection = db.collection("tree_index");
    const missing = await collection.find({ tenantId: { $exists: false } }).toArray();
    for (const doc of missing) {
      const match = /^tenant:(.+)$/.exec(doc.node_id ?? "");
      if (!match) {
        // A row whose node_id doesn't follow the convention at all is a pre-existing data
        // problem this migration cannot safely guess at — skip and let it surface on the next
        // audit rather than writing a wrong tenantId.
        console.warn(`tree-index-tenant-id: skipping _id=${doc._id ?? "(none)"} — node_id "${doc.node_id}" does not match the tenant:<id> convention`);
        continue;
      }
      await collection.updateOne({ _id: doc._id }, { $set: { tenantId: match[1] } });
    }
  },

  async down(db) {
    // Reversible in principle ($unset), but deliberately a no-op: application code now REQUIRES
    // tenantId to find a tenant's root at all (treeIndexRootFilter's filter matches on it), so
    // rolling this back would make every tenant's tree invisible to the app, not just revert a
    // schema decoration. If this migration needs undoing, it should be a deliberate follow-up
    // commit that also reverts the application code, not an automatic $unset here.
  },
};
