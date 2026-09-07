// packages/db/src/lib/tenantScope.ts — T-018 C6. One shared definition of the
// tenant-scoping accessor pattern (ARCHITECTURE §5: "no handler accepts a tenant id from
// the client — session/auth-derived only"; every knowledge-layer row carries tenantId).
//
// scopedCollection(db, name) returns a function whose signature FORCES a tenantId argument
// at every call site — `coll(tenantId).find(filter)` — so a tenant-less query is a TS
// compile error, not a runtime bug. Every packages/db/src/collections/<coll>.ts file
// wraps this once; it is the only place the tenant-scoping logic itself is written.
import type { Collection, Db, Filter, OptionalUnlessRequiredId } from "mongodb";

export type TenantId = string;

/** Merges `{ tenantId }` into a filter so a caller can never omit it, even by accident. */
export function withTenant<T extends { tenantId: string }>(
  tenantId: TenantId,
  filter: Filter<T> = {},
): Filter<T> {
  return { ...filter, tenantId } as Filter<T>;
}

/**
 * Returns a `coll(tenantId): TenantScopedCollection<T>` accessor for one Mongo collection.
 * The returned object exposes only tenant-safe read/write helpers — never the raw
 * `Collection<T>` — so every query is pre-scoped and a tenant-less call cannot compile.
 */
export function scopedCollection<T extends { tenantId: string; _id: string }>(
  db: Db,
  name: string,
) {
  const raw: Collection<T> = db.collection<T>(name);

  return function coll(tenantId: TenantId) {
    if (!tenantId) throw new Error(`scopedCollection(${name}): tenantId is required`);
    return {
      find: (filter: Filter<T> = {}) => raw.find(withTenant<T>(tenantId, filter)),
      findOne: (filter: Filter<T> = {}) => raw.findOne(withTenant<T>(tenantId, filter)),
      insertOne: (doc: Omit<T, "tenantId">) =>
        raw.insertOne({ ...doc, tenantId } as OptionalUnlessRequiredId<T>),
      insertMany: (docs: Omit<T, "tenantId">[]) =>
        raw.insertMany(docs.map((doc) => ({ ...doc, tenantId })) as OptionalUnlessRequiredId<T>[]),
      /** Tenant-merged delete. Added for ISS-060: `indexSession` reached `claims` and
       * `session_pages` through the RAW handle for its delete/insert half and carried the
       * tenantId by hand, so removing it from the filter compiled, passed every test, and
       * live destroyed a second tenant's claims. A write that can erase another tenant's rows
       * must not be the one operation this accessor makes people go around it for. */
      deleteMany: (filter: Filter<T> = {}) => raw.deleteMany(withTenant<T>(tenantId, filter)),
      raw,
    };
  };
}
