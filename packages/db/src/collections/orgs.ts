// packages/db/src/collections/orgs.ts — plan §10 U0.9. coll(tenantId) accessor; a call
// missing tenantId is a TS compile error (see tenantScope.typecheck-test.ts).
import type { Orgs } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function orgs(tenantId: string) {
  return scopedCollection<Orgs>(getDb(), "orgs")(tenantId);
}
