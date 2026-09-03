/**
 * packages/ingest/src/registry.ts — T-020 C4. `detectSource` picks the first adapter whose
 * `detect()` returns true — a registry, not a growing if/else chain — and throws a typed
 * `NoMatchingSourceError` (never silently returns `undefined` or picks the wrong adapter).
 */
import type { Source } from "./source.js";

export class NoMatchingSourceError extends Error {
  constructor(input: unknown) {
    super(`no Source adapter matched input: ${describeInput(input)}`);
    this.name = "NoMatchingSourceError";
  }
}

function describeInput(input: unknown): string {
  if (typeof input === "string") return JSON.stringify(input);
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

/** Returns the first `adapters` entry whose `detect(input)` is true; throws otherwise. */
export function detectSource(input: unknown, adapters: Source[]): Source {
  for (const adapter of adapters) {
    if (adapter.detect(input)) return adapter;
  }
  throw new NoMatchingSourceError(input);
}
