/**
 * packages/meeting-bot/src/testUtils.ts — shared fixture helpers for every `*.test.ts` in this
 * package (mirrors packages/ingest's `testUtils.ts` "one shared fake, not one per test" pattern).
 */
import type { ConsentContext, Source, SourceDoc, MediaDoc, Turn } from "@lkb/ingest";
// Reuses packages/ingest's fixture constants/helper (not a re-declaration — lint-dupes flags a
// second `export const TENANT` etc.); @lkb/ingest has no "exports" map, so this subpath import of
// its non-re-exported testUtils.ts resolves via plain Node package resolution.
import { TENANT, FIXED_NOW, baseConsent } from "@lkb/ingest/src/testUtils.js";
import type { Joiner, JoinResult } from "./joiner.js";
import type { JoinStrategy } from "./strategy.js";

export { TENANT, FIXED_NOW, baseConsent };

/** A fake `Joiner` that always returns `handle` and records join/stop calls. */
export function fakeJoiner(name: string, handle = "fixture-handle"): Joiner & { calls: { joined: string[]; stopped: string[] } } {
  const calls = { joined: [] as string[], stopped: [] as string[] };
  return {
    name,
    calls,
    async join(url: string): Promise<JoinResult> {
      calls.joined.push(url);
      return { sessionHandle: handle, mediaStream: undefined };
    },
    async stop(sessionHandle: string): Promise<void> {
      calls.stopped.push(sessionHandle);
    },
  };
}

export function fakeJoiners(
  handle = "fixture-handle",
): Record<JoinStrategy, Joiner & { calls: { joined: string[]; stopped: string[] } }> {
  return {
    vexa: fakeJoiner("vexa", handle),
    browser: fakeJoiner("browser", handle),
    "system-audio": fakeJoiner("system-audio", handle),
  };
}

/** A minimal fake `Source` (ingest adapter shape) — `fetch`/`toTurns` never touch real I/O. */
export function fakeIngestSource(turns: Turn[] = [{ speakerRef: "spk:0", tStart: 0, tEnd: 1, text: "hi" }]): Source {
  return {
    name: "fake-recording",
    detect: () => true,
    async fetch(input: unknown, consent: ConsentContext): Promise<{ source: SourceDoc; media: MediaDoc[] }> {
      const path = typeof input === "object" && input !== null ? (input as { path?: string }).path : undefined;
      const source: SourceDoc = {
        _id: `src-${path ?? "unknown"}`,
        tenantId: TENANT,
        kind: "recording",
        captureMode: consent.captureMode,
        path,
        hash: "fake-hash-00000000",
        consent: { given: consent.given, recordedBy: consent.recordedBy, note: consent.note },
        createdAt: FIXED_NOW,
      };
      return { source, media: [] };
    },
    async toTurns(): Promise<Turn[]> {
      return turns;
    },
  };
}
