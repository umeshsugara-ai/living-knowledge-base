// packages/db/src/collections/sources.ts — T-018 C6. coll(tenantId) accessor; a call
// missing tenantId is a TS compile error (see tenantScope.typecheck-test.ts).
import type { Sources } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function sources(tenantId: string) {
  return scopedCollection<Sources>(getDb(), "sources")(tenantId);
}
