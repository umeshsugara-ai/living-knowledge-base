// packages/db/src/collections/topics.ts — plan §10 U0.9. coll(tenantId) accessor; a call
// missing tenantId is a TS compile error (see tenantScope.typecheck-test.ts).
import type { Topics } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function topics(tenantId: string) {
  return scopedCollection<Topics>(getDb(), "topics")(tenantId);
}
