// packages/db/src/collections/speakers.ts — plan §10 U0.9. coll(tenantId) accessor; a call
// missing tenantId is a TS compile error (see tenantScope.typecheck-test.ts).
import type { Speakers } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function speakers(tenantId: string) {
  return scopedCollection<Speakers>(getDb(), "speakers")(tenantId);
}
