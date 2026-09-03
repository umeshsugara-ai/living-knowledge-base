/**
 * packages/meeting-bot/src/profile/user-profile.ts — T-011 C1. Deterministic, isolation-safe
 * per-user browser-profile directory resolution — the primitive Phase-B's "system-owned browser
 * profile joins as the user" design needs, underneath whatever real Playwright launcher
 * eventually consumes the resolved path. No filesystem I/O here — `resolveProfileDir` only
 * computes a path string; creating the directory is the real launcher's concern.
 */
import { join, relative, isAbsolute } from "node:path";

/** Rejects a `tenantId`/`userId` that could escape `baseDir` via path traversal (e.g. `../../etc`)
 * or an absolute-path injection — never silently sanitizes, always throws so a caller notices. */
function assertSafeSegment(value: string, label: string): void {
  if (value.length === 0) throw new Error(`resolveProfileDir: ${label} must not be empty`);
  // Checked on the RAW value, before any normalize() — normalize() can silently collapse a
  // traversal sequence (e.g. "toc/../other" -> "other"), which would hide the very thing this
  // check exists to catch. A single path segment must never itself contain a separator or "..".
  if (value.includes("/") || value.includes("\\") || value === ".." || isAbsolute(value)) {
    throw new Error(`resolveProfileDir: ${label} "${value}" is not a safe path segment`);
  }
}

/**
 * `baseDir` — the system-owned profiles root (never user-controlled). Returns
 * `<baseDir>/<tenantId>/<userId>`, guaranteed to stay inside `baseDir` (checked, not assumed) and
 * guaranteed distinct for every distinct `(tenantId, userId)` pair.
 */
export function resolveProfileDir(tenantId: string, userId: string, baseDir: string): string {
  assertSafeSegment(tenantId, "tenantId");
  assertSafeSegment(userId, "userId");

  const resolved = join(baseDir, tenantId, userId);

  // Defense in depth: even after per-segment validation, confirm the joined path never climbs
  // back out of baseDir (join() itself already collapses "..", but this makes the invariant
  // explicit and independently checkable rather than relying solely on join()'s behavior).
  const rel = relative(baseDir, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`resolveProfileDir: resolved path escapes baseDir for tenantId="${tenantId}" userId="${userId}"`);
  }

  return resolved;
}
