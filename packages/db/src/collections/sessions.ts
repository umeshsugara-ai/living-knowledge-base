// packages/db/src/collections/sessions.ts — T-018 C6. coll(tenantId) accessor; a call
// missing tenantId is a TS compile error (see tenantScope.typecheck-test.ts).
import type { Sessions } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function sessions(tenantId: string) {
  return scopedCollection<Sessions>(getDb(), "sessions")(tenantId);
}
