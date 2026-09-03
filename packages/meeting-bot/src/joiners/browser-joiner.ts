/**
 * packages/meeting-bot/src/joiners/browser-joiner.ts — T-024 C3. Browser-profile join joiner
 * (for platforms without native Vexa support — currently just Webex, see strategy.ts).
 *
 * TODO(T-024b): this is a STUB. `launch` is injected as a Playwright-shaped function
 * (`(url, opts) => Promise<{sessionHandle, mediaStream}>`) rather than importing `playwright`
 * directly — no real browser is launched here. Real implementation (persistent browser profile,
 * actual join-page automation, audio-track capture from the browser tab) is explicitly
 * follow-up work per ARCHITECTURE §4's `packages/meeting-bot/{profile,join,record,consent}.ts`
 * sketch, not this unit's.
 */
import type { Joiner, JoinOpts, JoinResult } from "../joiner.js";

/** Playwright-shaped launcher, injected — never a direct `playwright` import in this file. */
export type BrowserLauncher = (url: string, opts: JoinOpts) => Promise<JoinResult>;
/** Injected stop hook — closes whatever the launcher opened for `sessionHandle`. */
export type BrowserStopper = (sessionHandle: string) => Promise<void>;

export interface BrowserJoinerDeps {
  launch: BrowserLauncher;
  stop?: BrowserStopper;
}

export function createBrowserJoiner(deps: BrowserJoinerDeps): Joiner {
  return {
    name: "browser",

    async join(url: string, opts: JoinOpts): Promise<JoinResult> {
      return deps.launch(url, opts);
    },

    async stop(sessionHandle: string): Promise<void> {
      if (deps.stop) await deps.stop(sessionHandle);
    },
  };
}
