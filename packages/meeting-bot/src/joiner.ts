/**
 * packages/meeting-bot/src/joiner.ts — T-024 C3. The one `Joiner` interface every
 * `joiners/*.ts` implementation satisfies (mirrors packages/ai's `Provider` /
 * packages/ingest's `Source` "one interface, several adapters" pattern).
 *
 * `MediaSource` is deliberately opaque (`unknown`) — none of the three T-024 joiners produce a
 * real media stream yet (all three are stubbed, TODO(T-024b)); the concrete shape (a file path,
 * a byte stream, a WebRTC track reference — whichever the real Vexa/Playwright/OS-audio
 * integration ends up needing) is a T-024b decision, not this unit's.
 */

export type MediaSource = unknown;

export interface JoinOpts {
  tenantId: string;
  consentNote?: string;
}

export interface JoinResult {
  sessionHandle: string;
  mediaStream: MediaSource;
}

/** One join mechanism (Vexa bot, browser-profile join, system-audio capture). */
export interface Joiner {
  readonly name: string;
  join(url: string, opts: JoinOpts): Promise<JoinResult>;
  stop(sessionHandle: string): Promise<void>;
}
