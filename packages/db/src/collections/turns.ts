// packages/db/src/collections/turns.ts — T-018 C6. coll(tenantId) accessor; a call
// missing tenantId is a TS compile error (see tenantScope.typecheck-test.ts).
import type { Turns } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function turns(tenantId: string) {
  return scopedCollection<Turns>(getDb(), "turns")(tenantId);
}
