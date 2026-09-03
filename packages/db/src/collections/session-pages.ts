// packages/db/src/collections/session-pages.ts — T-002 follow-up. coll(tenantId) accessor,
// identical shape to sources.ts/sessions.ts/turns.ts/claims.ts. Fills the gap seed-toc.mjs
// disclosed: session_pages had no accessor, so real seed runs silently skipped it.
import type { SessionPages } from "@lkb/core";
import { getDb } from "../client.js";
import { scopedCollection } from "../lib/tenantScope.js";

export function sessionPages(tenantId: string) {
  return scopedCollection<SessionPages>(getDb(), "session_pages")(tenantId);
}
