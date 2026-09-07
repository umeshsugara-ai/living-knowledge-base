// packages/db/src/collections/decisions.ts — plan §10 U0.9. coll(tenantId) accessor; a call
// missing tenantId is a TS compile error (see tenantScope.typecheck-test.ts).
import type { Decisions } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function decisions(tenantId: string) {
  return scopedCollection<Decisions>(getDb(), "decisions")(tenantId);
}
