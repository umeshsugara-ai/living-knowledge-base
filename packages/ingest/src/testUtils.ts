/**
 * packages/ingest/src/testUtils.ts — shared fixture helpers for every `*.test.ts` file in this
 * package (mirrors `packages/ai/src/testUtils.ts`'s "one shared fake, not one per test" pattern).
 * No real file I/O anywhere — every fake reader/hasher/transcribe here is in-memory.
 */
import type { ConsentContext } from "./source.js";

export const TENANT = "tenant-1";
export const FIXED_NOW = "2026-09-03T00:00:00.000Z";

export function baseConsent(overrides: Partial<ConsentContext> = {}): ConsentContext {
  return {
    captureMode: "provided",
    given: true,
    recordedBy: "org:toc",
    ...overrides,
  };
}

/** In-memory byte reader: `path -> Uint8Array`, throws on an unknown path (never returns junk). */
export function fakeBytesReader(files: Record<string, Uint8Array>) {
  return async (path: string): Promise<Uint8Array> => {
    const bytes = files[path];
    if (!bytes) throw new Error(`fakeBytesReader: no fixture for ${path}`);
    return bytes;
  };
}

/** In-memory text reader: `path -> string`, throws on an unknown path. */
export function fakeTextReader(files: Record<string, string>) {
  return async (path: string): Promise<string> => {
    const text = files[path];
    if (text === undefined) throw new Error(`fakeTextReader: no fixture for ${path}`);
    return text;
  };
}

/** Deterministic fake hasher — length-prefixed so different content never collides in tests. */
export function fakeHasher(input: Uint8Array | string): string {
  const length = typeof input === "string" ? input.length : input.byteLength;
  const sample = typeof input === "string" ? input.slice(0, 8) : Array.from(input.slice(0, 8)).join(",");
  return `fake-hash-${length}-${sample}`;
}
