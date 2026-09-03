# Verdict — T-024 meeting-bot-capture

**Date:** 2026-09-03
**Cycle checked:** 1
**Checked by:** /checker (Mode A unit check, fresh context)

## Judgment calls

**(A) C2 Vexa platform-support correction — VERIFIED ACCURATE, contract amended.**
Independently fetched `github.com/Vexa-ai/vexa` (WebFetch, not trusting the maker's paste).
Confirmed: the repo description and README document native bot-join support for Google Meet,
Microsoft Teams, and Zoom (`platform` enum `google_meet | teams | zoom | jitsi`; Jitsi flagged
"offline-proven, live validation pending"). Webex does not appear anywhere in Vexa's
supported-platform list. This matches the maker's finding exactly — the original contract's C2
guess ("vexa for meet/teams... browser for zoom/webex") was wrong on Zoom. Applied a routine
amendment to `qa/contracts/meeting-bot-capture.md` C2 (routing table corrected + amendment log
entry added) — this is a "record edge case verified against source" amendment, not a
criticality-gated one (no safety/data invariant weakened, no goal reversed).

**(B) C5 packages/ai wiring via wire-shape mirror instead of static import — ACCEPTED as
genuine, not a hollow shim.** Read `.dependency-cruiser.cjs` directly: the `meeting-bot-only-
ingest-core` rule (line 52-57) genuinely restricts `packages/meeting-bot` to `ingest|core` only —
confirmed by re-running `depcruise --config .dependency-cruiser.cjs packages apps workers`
clean (98 modules, 245 deps, no violations), which would fail loudly if `cli.ts` statically
imported `@lkb/ai`. Compared `cli.ts`'s `defaultTranscribe()` (lines 116-129) against
`packages/ai/src/stt/whisper.ts`'s `createWhisperAdapter` (lines 16-38): both POST to
`{baseUrl}/transcribe` with `content-type: application/octet-stream`, both send
`{audio: Array.from(audio), diarize}` in the body, both parse `res.ok`/status-range into a thrown
error and otherwise return `body.turns ?? []`. This is a faithful, real-HTTP mirror of the
canonical adapter's wire contract — not a fake that always returns canned data (the CLI's
`--fake-transcribe` path is the explicitly-labeled fake; the default path genuinely throws if no
worker answers, which was reproducible behavior, not swallowed). Given the dependency-cruiser
wall is real and enforced, and the mirror reaches the actual documented `workers/transcribe/`
HTTP contract rather than short-circuiting it, this satisfies C5's intent. No contract amendment
needed — C5's text ("wires real packages/ai") is loose enough to read either way; the manifest's
explanation is accepted as the intended reading given the architectural constraint, and is now on
record in the manifest for future units to reference.

## Re-run verify commands (all re-executed by /checker, not trusted from the manifest)

- `node --test --import tsx src/platform.test.ts` → 7/7 pass (matches manifest)
- `node --test --import tsx src/strategy.test.ts` → 3/3 pass (matches manifest)
- `node --test --import tsx src/joiners/joiners.test.ts` → 4/4 pass (matches manifest)
- `node --test --import tsx src/capture.test.ts` → 5/5 pass (matches manifest)
- `depcruise --config .dependency-cruiser.cjs packages apps workers` → no dependency violations
  found, 98 modules, 245 dependencies cruised (matches manifest)
- CLI end-to-end, default consent (`npx tsx src/cli.ts capture "https://meet.google.com/abc-defg-hij"
  --consent-note "T-024 fixture demo run" --fake-transcribe`) → output byte-identical to manifest's
  claim (`sessionId: 332ff6...-session`, `capture mode: provided`, `turn count: 1`,
  `warnings: (none)`)
- CLI end-to-end, silent mode (`npx tsx src/cli.ts capture "https://acme.webex.com/j/12345"
  --capture-mode silent --fake-transcribe`) → output byte-identical to manifest's claim, D-008
  warning text matches verbatim
- `node --test --import tsx "src/**/*.test.ts"` → 19/19 pass (matches manifest)
- `pnpm -r typecheck` → all 9 workspace projects Done, 0 errors (matches manifest)
- `pnpm -r test` → meeting-bot 19/19, ai 23/23, ask 18/18, ingest 15/15, index 4/4 — every count
  matches the manifest's claimed running total
- `pnpm gen:types --check` → OK: 19 generated type file(s) + index.ts match schema/
- `python schema/validate.py` → PASS: 19 collection schema(s) validated correctly
- `pnpm lint:structure` → lint-loc/dirsize/root/dupes/migrations OK, snapshot OK, depcruise clean
  (migrations scanned count drifted 493→494 file, a harmless +1 from time passing, not a
  regression)
- File-size budget re-measured via `wc -l` on all 14 listed files: every line count matches the
  manifest's table exactly (capture.ts 93, cli.ts 188, joiner.ts 29, platform.ts 33, strategy.ts
  37, testUtils.ts 64, browser-joiner.ts 36, system-audio-joiner.ts 36, vexa-joiner.ts 75,
  joiners.test.ts 68, index.ts 12, plus the three .test.ts files) — all within the 300/400 LOC
  budgets.

## Criteria judged on evidence (read platform.ts, strategy.ts, joiner.ts, all three joiner stubs,
capture.ts, cli.ts in full)

- **C1** — MET. `detectPlatform` is pure (no I/O), matches real hostname shapes for all four
  platforms plus `unknown`, never throws (try/catch around `new URL`).
- **C2** — MET (as amended above). Pure function, cites the verified Vexa finding in the file
  header, routing verified independently.
- **C3** — MET. Three `Joiner` implementations behind one interface, each stub takes an injected
  transport/launcher/capture-fn (no real network/browser/audio call in any of them — confirmed by
  reading all three files), each ≤300 LOC (75/36/36), each carries a `TODO(T-024b)` comment.
- **C4** — MET. `capture.ts` imports only from `@lkb/core` and `@lkb/ingest` (confirmed by reading
  the import block — no concrete joiner import, no `@lkb/ai` import), composes
  `assertProvidedFirst` (before join) → `detectPlatform` → `selectJoinStrategy` →
  `deps.joiners[strategy].join` → `ingestSource.fetch`/`toTurns` → result, and the dependency-
  cruiser run confirms the rule is actually enforced, not just aspirational.
- **C5** — MET (judgment call B above). CLI lives at `packages/meeting-bot/src/cli.ts` with a
  documented, dependency-cruiser-grounded reason for not being in `apps/cli`. Wires a real
  `@lkb/ingest` `createRecordingSource` with real SHA-256/file-reader, and three real joiner
  factories. End-to-end fixture run against a Meet-shaped URL produces genuine
  `sources`/`sessions`/`turns`-shaped output, verified byte-for-byte via direct re-run.
- **C6** — MET. 19 tests total, all re-run and passing; `detectPlatform` covered on 7 real-shaped
  URLs across all 4 buckets (exceeds the ≥6 bar); `selectJoinStrategy` mapping tested for all
  cases; `capture()` end-to-end covers success, unknown-platform routing, silent-without-
  confirmation warning, silent-with-confirmation no-warning, and stop-on-throw.
- **C7** — MET. All five regression commands re-run clean by /checker.

## Ledger

No new issues found — nothing to write to `qa/issues.jsonl`. No open issues in the ledger name
this feature/unit, so no "Issues addressed" claim to cross-check.

```
VERDICT: PASS
SCOREBOARD: 7/7 criteria met, 0/0 invariants hold (contract defines no separate [I*] invariants)
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: All 7 criteria independently verified — every test suite, the CLI end-to-end demo
(both consent paths), and the full repo regression set were re-run by /checker and matched the
manifest byte-for-byte. Both flagged judgment calls checked out: the Vexa zoom/webex correction
is accurate per an independent WebFetch of the real Vexa repo (contract C2 amended, routine), and
the packages/ai wiring is a genuine wire-shape-matching HTTP mirror forced by a real, enforced
dependency-cruiser rule — not a hollow shim.
```
