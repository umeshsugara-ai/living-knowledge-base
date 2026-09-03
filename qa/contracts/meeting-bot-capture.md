# Contract — meeting-bot-capture (T-024)

> Ground truth for the first demo unit (grill Q9/Q10: "meeting link paste karu, jo bhi platform ho
> — Zoom, Meet, koi aur — sab ke hisaab se bana paayega... system dynamic, use-case wise hona
> chahiye"). Drafted by the maker; /checker adopts or amends on first check. Per D-004 (self-hosted
> Vexa + Whisper, pluggable STT) and D-008 (provided-first capture, silent = last resort with a
> soft warn-gate — already built in T-020's `assertProvidedFirst`).

## Scope
A CLI (`lkb capture <meeting-url>`) that: detects the platform from the URL, picks a join strategy
(Vexa for natively-supported platforms; a browser-profile join stub for others; a system-audio
capture stub as universal fallback — per the blindspot probe in the grill log), runs the
provided-first soft gate (T-020), and — once "joined" — produces `sources`/`sessions`/`turns` rows
via the existing `packages/ingest` `recording` adapter (T-020) and STT seam (T-019). **No live
Vexa account, no real browser automation, no real audio capture are required to PASS** — this unit
builds the orchestration + platform-detection + adapter-wiring layer behind injectable
join/record implementations (matching every prior unit's transport-injection pattern), with the
Vexa/Playwright/system-audio integrations themselves stubbed and clearly marked `TODO(T-024b)` for
a follow-up unit once real credentials/environment exist. This keeps the demo's *pipeline* real and
testable while being honest that the network/audio parts are not live yet.

## Criteria (each machine-checkable)

1. **`packages/meeting-bot/src/platform.ts`**: `detectPlatform(url: string): 'meet' | 'teams' |
   'zoom' | 'webex' | 'unknown'` — pattern-matches real URL shapes for each (e.g.
   `meet.google.com`, `teams.microsoft.com`, `zoom.us/j/`, `webex.com`). Pure function, no I/O.
2. **`packages/meeting-bot/src/strategy.ts`**: `selectJoinStrategy(platform): 'vexa' | 'browser' |
   'system-audio'` — per the grill's blindspot resolution and Vexa's actually-documented native
   support (verified 2026-09-03 against github.com/Vexa-ai/vexa's README/repo description: Vexa
   natively supports Google Meet, Microsoft Teams, and Zoom, with Jitsi "offline-proven, live
   validation pending"; Webex is not in its supported-platform list): `vexa` for `meet`/`teams`/
   `zoom`, `browser` for `webex`/anything without native Vexa support, `system-audio` as the
   ultimate fallback for `unknown`. Cite the actual Vexa docs/README in a code comment, not
   invented. Pure function.
3. **Three `Joiner` implementations**, one interface (`packages/meeting-bot/src/joiner.ts`:
   `join(url, opts): Promise<{sessionHandle: string, mediaStream: MediaSource}>`,
   `stop(sessionHandle): Promise<void>`): `vexa-joiner.ts` (calls an injected Vexa API transport —
   mirrors T-019's transport-injection pattern, no hardcoded Vexa base URL or real HTTP call in
   tests), `browser-joiner.ts` (calls an injected Playwright-shaped launcher — stubbed, not a real
   browser launch; comment marks the real implementation as T-024b follow-up work), `system-audio-
   joiner.ts` (calls an injected OS-audio-capture function — stubbed same way). Each file ≤300 LOC.
4. **`packages/meeting-bot/src/capture.ts`**: `capture(url, opts, deps): Promise<CaptureResult>` —
   composes `detectPlatform → selectJoinStrategy → Joiner.join → T-020's recording adapter's
   fetch/toTurns (reusing packages/ingest, not reimplementing) → T-020's assertProvidedFirst soft
   gate (runs BEFORE join, using `opts.consent`) → returns `{source, session, turns, warnings}`.
   `deps` injects the three joiners + the ingest adapter + STT `transcribe` — no direct imports of
   concrete implementations inside `capture.ts` (keeps `meeting-bot → ingest(source interface),
   core` per ARCHITECTURE §5, verified by `pnpm lint:structure`'s dependency-cruiser run).
5. **CLI entry** (`apps/cli/src/capture.ts` or `packages/meeting-bot/src/cli.ts` — pick the
   location that fits the existing `apps/` vs `packages/` split, document the choice in the
   manifest): `lkb capture <url> [--consent-note <text>]` wires real dependencies (still using
   injected fakes for Vexa/browser/system-audio per C3's TODO, but real `packages/ingest` +
   `packages/ai`) and prints a summary (`sessionId`, `capture mode`, `turn count`, any provided-
   first warning). Running it against a **fixture URL** (a Meet-shaped test URL) end-to-end with
   fake joiners produces real `sources`/`sessions`/`turns`-shaped output — this IS the demo path,
   just not against a live meeting yet.
6. **Tests exist and pass:** `packages/meeting-bot/src/*.test.ts` covering: `detectPlatform` on
   ≥6 real-shaped URLs across all 4 platform buckets incl. `unknown`; `selectJoinStrategy` maps
   correctly for each; `capture()` end-to-end with fake joiners + fake ingest deps produces a
   result with non-empty `turns` and the correct `warnings` array when `consent.captureMode ===
   'silent'` without confirmation (reusing T-020's `assertProvidedFirst` test pattern).
7. **No regression:** `pnpm -r typecheck`, `pnpm -r test` (existing + new), `pnpm gen:types
   --check`, `python schema/validate.py`, `pnpm lint:structure` all clean.

## Non-goals for T-024
- No real Vexa account/API key wired (T-024b, once you have credentials). No real Playwright
  browser launch (T-024b, Phase B per plan). No real OS audio capture (T-024b). No Google
  Calendar integration (T-025). This unit is the **orchestration skeleton + platform routing +
  pipeline wiring** — real join implementations are explicitly a follow-up, documented as such in
  code comments and the manifest, not silently pretended-complete.

## Amendment log
- 2026-09-03 · routine · C2 corrected: `zoom` routes to `vexa` (not `browser`), `webex` routes to
  `browser` · maker's T-024 pre-check independently re-verified by /checker (WebFetch of
  github.com/Vexa-ai/vexa) against the original contract's unverified guess — Vexa's README/repo
  description confirms native support for Google Meet, Microsoft Teams, and Zoom (Jitsi
  offline-proven pending validation); Webex does not appear in its supported-platform list.
