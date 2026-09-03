# Contract — browser-profile-privacy (T-011)

> Ground truth for Phase-B's per-user browser profile bot + live monitor, per plan §4c A10/A11.
> Depends T-024 (done). Drafted by the maker; /checker adopts or amends on first check.

## Scope, and an honest scope-down disclosed up front
Real Playwright browser automation (launching a persistent per-user profile, actual join-page
automation) is explicitly out of scope — `browser-joiner.ts`'s own doc comment already defers this
("TODO(T-024b)... not this unit's"), and building a real browser launcher needs no new contract,
just an implementation of the existing injected `BrowserLauncher` type. This unit builds the two
**pure decision functions** Phase-B's two headline requirements actually need underneath any real
browser wiring: (1) a deterministic, isolation-safe per-user profile directory resolver (so two
users' sessions can never collide), and (2) the live-monitor "exclude private segment" function
(plan A11) — turns falling inside a marked private window are stripped before anything downstream
sees them, which is the actual privacy mechanism D-002/D-008 depend on, not a UI concern.

## Criteria (each machine-checkable)

1. **`packages/meeting-bot/src/profile/user-profile.ts`**: `resolveProfileDir(tenantId, userId,
   baseDir): string` — pure, deterministic (same inputs → same path always), joins `baseDir` with
   a tenant+user-scoped subpath (e.g. `<baseDir>/<tenantId>/<userId>`) using `node:path`-safe
   joining (no raw string concatenation that could allow a `userId` containing `../` to escape
   `baseDir` — validate and reject path-traversal attempts, throwing rather than silently
   returning an escaped path). Two distinct `(tenantId, userId)` pairs must never resolve to the
   same directory.
2. **`packages/meeting-bot/src/live-monitor.ts`**: `excludePrivateSegments(turns: Turn[],
   privateWindows: {tStart: number; tEnd: number}[]): Turn[]` — pure. Drops any turn whose time
   range overlaps ANY private window (partial overlap counts — a turn straddling a private
   window's boundary is still excluded, never partially truncated). Returns a NEW array (does not
   mutate the input). Empty `privateWindows` returns the input unchanged (by value, not
   necessarily reference).
3. **Tests exist and pass**: `packages/meeting-bot/src/profile/user-profile.test.ts` — distinct
   users get distinct dirs; the same `(tenantId, userId)` always resolves identically; a `userId`
   containing `../../etc` (or similar) throws rather than escaping `baseDir`. `packages/meeting-
   bot/src/live-monitor.test.ts` — a turn fully inside a private window is dropped; a turn fully
   outside every window survives; a turn partially overlapping a window's edge is dropped (not
   truncated); an empty `privateWindows` array is a no-op; multiple non-overlapping private
   windows each correctly exclude their own turns.
4. **No regression**: `pnpm -r typecheck`, `pnpm -r test`, `pnpm gen:types --check`,
   `python schema/validate.py`, `pnpm lint:structure` all clean.

## Non-goals for T-011
- No real Playwright browser launch, no real persistent-profile creation on disk (that's
  `BrowserLauncher`'s real implementation, a separate follow-up needing no new contract). No live
  monitor UI (deck's Live Meeting Bot Monitor screen). No wiring of `excludePrivateSegments` into
  `capture.ts` or any real-time "mark private now" control — this unit is the privacy-filter
  primitive a future live-monitor UI/worker would call.
