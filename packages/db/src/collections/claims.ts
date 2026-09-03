// packages/db/src/collections/claims.ts — T-018 C6. coll(tenantId) accessor; a call
// missing tenantId is a TS compile error (see tenantScope.typecheck-test.ts).
import type { Claims } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function claims(tenantId: string) {
  return scopedCollection<Claims>(getDb(), "claims")(tenantId);
}
