/**
 * packages/ingest/src/gap-tracking.ts — T-006 C3. Gives T-020's `assertProvidedFirst` warnings
 * (and any other "we know something is missing" signal — a `Joiner.join` failure, a 404 on a
 * document/URL fetch) a durable home: a `gaps` doc, per the standing-ask process
 * (docs/adr/0002-standing-ask-process.md) and `qa/contracts/recording-gap-tracking.md` C3.
 *
 * `recordGap` is pure composition — it never imports `@lkb/db` directly (mirrors `capture.ts`
 * never importing a concrete `Joiner`: the caller injects a `GapStore`, structurally satisfied
 * by `packages/db/src/collections/gaps.ts`'s exported `create`). No I/O happens here beyond
 * calling that injected store.
 */
import type { Gaps } from "@lkb/core";

/** Why a gap is being recorded — the three triggers named in contract C3. */
export type GapReason = "provided-first-warning" | "join-failure" | "fetch-not-found";

export interface GapContext {
  tenantId: string;
  kind: Gaps["kind"];
  description: string;
  /** Who the standing ask goes to (ADR-0002 decision 1) — e.g. `org:toc-bhakti`. */
  requestedFrom?: string;
  /** SLA window in days from `requestedAt` to `sla.dueAt` (ADR-0002 decision 2 default: 3). */
  slaDays?: number;
  sourceRef?: string;
  now?: () => string;
  /** Id generator — defaults to a tenant+timestamp id if the caller doesn't supply one. */
  id?: (reason: GapReason, context: GapContext) => string;
}

/** The minimal shape `recordGap` needs from a store — satisfied by `collections/gaps.ts`'s `create`. */
export interface GapStore {
  create(tenantId: string, doc: Omit<Gaps, "tenantId">): Promise<void>;
}

const DEFAULT_SLA_DAYS = 3;

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/**
 * Records one gap doc via the injected `store` and returns it. Called when `assertProvidedFirst`
 * (T-020) warns, when a `capture()` (T-024) `Joiner.join` fails, or when a document/URL fetch
 * 404s — the caller decides which `reason`/`kind` applies; this function only shapes and writes
 * the doc.
 */
export async function recordGap(reason: GapReason, context: GapContext, store: GapStore): Promise<Gaps> {
  const now = context.now ? context.now() : new Date().toISOString();
  const dueAt = addDays(now, context.slaDays ?? DEFAULT_SLA_DAYS);
  const id = context.id ? context.id(reason, context) : `gap-${context.tenantId}-${now}`;

  const doc: Gaps = {
    _id: id,
    tenantId: context.tenantId,
    kind: context.kind,
    description: `${context.description} (${reason})`,
    status: "open",
    requestedAt: now,
    sla: { dueAt },
    ...(context.requestedFrom ? { requestedFrom: context.requestedFrom } : {}),
    ...(context.sourceRef ? { sourceRef: context.sourceRef } : {}),
  };

  await store.create(context.tenantId, doc);
  return doc;
}
