/**
 * packages/meeting-bot/src/joiners/system-audio-joiner.ts — T-024 C3. System-audio-capture
 * joiner — the universal fallback (strategy.ts: `unknown` platforms, per the grill's blindspot
 * resolution: "koi aur platform ho to bhi kaam karna chahiye").
 *
 * TODO(T-024b): this is a STUB. `startCapture`/`stopCapture` are injected OS-audio-capture
 * functions rather than a real implementation — no actual OS audio device is opened here. Real
 * implementation (platform-specific loopback/virtual-device capture, e.g. WASAPI loopback on
 * Windows or a PulseAudio/PipeWire monitor source on Linux) is explicitly follow-up work, not
 * this unit's.
 */
import type { Joiner, JoinOpts, JoinResult } from "../joiner.js";

/** Injected OS-audio-capture start hook — never a real device/process call in this file. */
export type SystemAudioStart = (url: string, opts: JoinOpts) => Promise<JoinResult>;
/** Injected OS-audio-capture stop hook. */
export type SystemAudioStop = (sessionHandle: string) => Promise<void>;

export interface SystemAudioJoinerDeps {
  startCapture: SystemAudioStart;
  stopCapture: SystemAudioStop;
}

export function createSystemAudioJoiner(deps: SystemAudioJoinerDeps): Joiner {
  return {
    name: "system-audio",

    async join(url: string, opts: JoinOpts): Promise<JoinResult> {
      return deps.startCapture(url, opts);
    },

    async stop(sessionHandle: string): Promise<void> {
      await deps.stopCapture(sessionHandle);
    },
  };
}
