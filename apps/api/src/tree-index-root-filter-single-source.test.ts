/**
 * apps/api/src/tree-index-root-filter-single-source.test.ts — ISS-063: the `tenant:<id>` node_id
 * convention that separates tenants in `tree_index` (the collection `scopedCollection` cannot
 * reach — see `treeIndexRootFilter`'s doc comment in `@lkb/index`) used to be hand-written in
 * THREE places: `indexing.ts`, and TWO call sites in `store.ts`. One of the `store.ts` copies had
 * already been caught wrong once, live, on 2026-09-04.
 *
 * `store.ts` calls `getDb()` directly with no injectable handle (unlike `indexSession`, which
 * gained one for ISS-056), so its two call sites cannot be pinned by exercising real behaviour
 * without a live Mongo. This is a source-text regression pin instead — deliberately narrow: it
 * proves the specific defect (a hand-rolled copy of the filter reappearing) can't reappear
 * silently, not that `tree_index` access is correct in general. `treeIndexRootFilter` itself is
 * exercised with real assertions in `packages/index/src/tree/tree.test.ts`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const HAND_WRITTEN_FILTER = /node_id:\s*`tenant:\$\{/;

function read(relPath: string): string {
  return readFileSync(`${HERE}${relPath}`, "utf8");
}

test("indexing.ts imports treeIndexRootFilter and does not re-derive the tenant: prefix", () => {
  const src = read("indexing.ts");
  assert.match(src, /import\s*\{[^}]*\btreeIndexRootFilter\b[^}]*\}\s*from\s*"@lkb\/index"/, "must import the shared filter");
  assert.doesNotMatch(src, HAND_WRITTEN_FILTER, "must not hand-write the node_id shape again");
});

test("store.ts imports treeIndexRootFilter and both its tree_index call sites use it, not a hand-written copy", () => {
  const src = read("store.ts");
  assert.match(src, /import\s*\{[^}]*\btreeIndexRootFilter\b[^}]*\}\s*from\s*"@lkb\/index"/, "must import the shared filter");
  assert.doesNotMatch(src, HAND_WRITTEN_FILTER, "must not hand-write the node_id shape again");
  const usages = src.match(/treeIndexRootFilter\(/g) ?? [];
  assert.equal(usages.length, 2, "both createMongoTreeStore.load and createMongoGraphReadDeps.loadGraph must call it — a count of 1 means one of the two regressed back to a hand-written filter");
});
