# Verdict — web-ask-page

**Date:** 2026-09-08
**Contract:** `qa/contracts/web-ask-page.md` (authored by this checker at this check — see its
amendment log; C8 and I3 were added by the checker, both tightenings)
**Cycle checked:** 1
**Mode:** A (event-driven unit check)
**Bound root:** `D:\KnowledgeBase`

```
VERDICT: PASS
SCOREBOARD: 8/8 criteria met, 3/3 invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: Re-ran all three verify commands myself against the final artifact state —
6/6 targeted, 46/46 full web suite, `tsc --noEmit` exit 0 — and did not take the manifest's
pasted output on trust. The two criteria carrying the product claim were mutation-tested and
both are genuinely protected: merging the citation lists into one labelled "Sources" fails the
C4 test, and removing the `<Link>` from an internal source fails it too. C8 (the concurrent XSS
fix) was mutation-tested as the maker asked — swapping `safeHttpUrl(source.url)` back to the raw
string fails the new test. I could not reproduce the disclosed C4 flake in 13 runs (10 targeted
after clearing the Vite cache, 3 full-suite), so per the dispatch it is recorded below as an open
observation with a mechanism, not filed as a defect. Two coverage notes below, neither a defect:
they are gaps in regression protection, not in behaviour.
```

## What I re-ran (my own output, not the manifest's)

```
$ pnpm --filter '*web*' exec vitest run src/pages/AskPage.test.tsx
 Test Files  1 passed (1)
      Tests  6 passed (6)

$ pnpm --filter '*web*' exec vitest run
 Test Files  11 passed (11)
      Tests  46 passed (46)

$ pnpm --filter '*web*' exec tsc --noEmit
TSC_EXIT=0
```

The manifest was submitted claiming 5 targeted / 45 full; the maker landed a security fix and a
sixth test mid-check, so the counts I reproduce are 6 / 46. Same cycle, judged on the final state.

## Criterion-by-criterion

| # | Verdict | Evidence I produced |
|---|---|---|
| C1 | met | `App.tsx` `<Route path="/ask" element={<AskPage />} />` and `NavSidebar.tsx` `NAV_ITEMS` entry `{ to: "/ask", label: "Ask" }`, both read in `git diff`. Direct code evidence; not test-asserted (see note 3). |
| C2 | met | Test asserts `toHaveBeenCalledWith("test-key", "when do applications open?")` for input `"  when do applications open?  "`. Empty-query test asserts the button is disabled and the spy uncalled; `handleSubmit` guards independently (`trimmed === "" → return`). Client uses shared `apiFetch`, no bespoke fetch. |
| C3 | met | `result.answer` rendered; asserted by the first test. |
| C4 | **met — mutation-verified** | Two separate `card`s, each with its own `section-title` count and its own empty state. **Mutation A:** replaced the internal card's title with a merged `Sources ({internal.length + web.length})` → the C4 test FAILED. The separation is genuinely load-bearing on the test, not incidental. |
| C5 | **met — link-through mutation-verified** | `<Link to={`/sessions/${encodeURIComponent(ref)}`}>`; target route confirmed real (`SessionDetailPage` reads `useParams<{id}>`). Test asserts `href="/sessions/s1"`. **Mutation B:** replaced the `Link` with a plain `<span>` → the C4/C5 test FAILED. Graceful-absence half: satisfied by `sessionRefOf` returning `null` for missing/empty `sessionRef`, so a refless source renders `<span>` and emits no link — correct by direct reading of a 4-line pure function, but see note 1. |
| C6 | met | `insufficient_coverage` renders the empty-note; the message branches on `web_used`. Test covers the "no web fallback is configured" branch; `verdict` shown in `row-meta`. See note 2. |
| C7 | met | Test asserts the literal `ApiError` message "no tree index built for this tenant yet" — which is the real string the route returns (`apps/api/src/routes/ask.ts`, 404 branch), not an invented one. |
| C8 | **met — mutation-verified** | `safeHttpUrl` parses via `new URL()` and admits only `http:`/`https:`; the new test asserts `javascript:` and `data:` citations produce no anchor **and remain visible as text**. **Mutation C8:** restored `typeof source.url === "string" ? source.url : null` → the new test FAILED. |
| I1 | holds | `git status --short`: the only files this unit touches are `apps/web/src/{App.tsx, api/types.ts, api/ask.ts, components/icons.tsx, layout/NavSidebar.tsx, pages/AskPage.tsx, pages/AskPage.test.tsx}`. `.claude/CLAUDE.md`, `docs/DECISIONS.md`, `.goal/`, `qa/`, `apps/api/src/search-store.test.ts` and `qa/evidence/.../preflight.json` are prior/parallel work, excluded by the contract's own I1 wording. |
| I2 | holds | 46/46 full suite green; `tsc --noEmit` exit 0. The 45 pre-existing tests are unchanged. |
| I3 | holds | `grep -rn "@lkb/" apps/web/src/` returns only two doc comments and the package's own name — no import of `packages/*`. The `/ask` response is declared structurally in `types.ts`, and I confirmed the declaration matches the real `AskV2Result` / `AskResult` (`packages/ask/src/ask-v2.ts:47`, `router.ts:23`) field for field. |

## Open observation — the disclosed C4 flake (not filed, not closed)

The maker disclosed that "cites internal and web sources in separate lists" failed once on a cold
run, then passed four times unchanged, and explicitly asked me not to close it on their say-so.

**I could not reproduce it:** 10 consecutive targeted runs after `rm -rf apps/web/node_modules/.vite`
(a genuinely cold Vite cache) plus 3 full-suite runs — 13/13 green. Per the checker rule that only
findings defensible at >80% confidence go under FAILURES, and per this repo's D-013 rule against
manufacturing backlog rows, this is recorded here rather than filed as an issue.

**Most plausible mechanism, offered so the maker can act if it recurs:** this test is the heaviest
in the file and its assertions run behind `waitFor`, whose default timeout is 1000 ms. I measured
this specific test at **1277 ms** during one mutation run and the file's first test at 679 ms on a
warm cache; on a cold transform the C4 test's `waitFor` window is plausibly the one that gets
squeezed past 1 s. If it recurs, the cheap and correct fix is an explicit timeout on that
`waitFor` (or `findByText`), not a retry — a bare `retry: n` would hide exactly the regression C4
exists to catch. **This observation stays open**: if a second occurrence is seen, it becomes a real
medium-severity test-reliability defect and should be filed then.

## Notes (low severity — deliberately not ledger issues, per `.claude/CLAUDE.md` D-013)

1. **C5's graceful-absence branch has no regression test.** I mutated `sessionRefOf` to return
   `""` instead of `null` — which would render an internal source with no `sessionRef` as a link
   to `/sessions/`, i.e. exactly the broken link C5 forbids — and **all 6 tests still passed**. The
   shipped code is correct, so C5 is met; but that half of the criterion is unprotected against a
   future edit. A one-line addition to the existing C4/C5 test (a second internal source with no
   `evidence`, asserting `queryByRole("link", { name: "n2" })` is null) would close it. Worth
   folding into whichever unit next touches this file.
2. **C6's `web_used: true` branch is untested.** The test covers only "no web fallback is
   configured"; the "and fell back to the web" wording is rendered but never asserted. Same
   remedy class as note 1.
3. **C1 rests on code reading, not a test.** No test mounts `App` and asserts the `/ask` route or
   the nav entry resolves. The two-line diff is unambiguous and I judged it met, but the routing
   wiring is the kind of thing a rename silently breaks.

None of these is a defect of U3.1 and none should become a work unit.

## On the manifest's four disclosed gaps

All four are correctly scoped out by the contract's "Out of scope / ignore" section and none is a
defect: (1) no live browser/Mongo run — component tests satisfy this contract, a live check is
Mode C; (2) `auditLog`/`scored` fetched but unrendered — an operator view, deliberately deferred;
(3) no streaming — acceptable; (4) defensive reading of web source titles — which the maker's own
concurrent C8 fix has now hardened further. Disclosure was accurate in every case, and the
manifest's counts were superseded by the maker's own mid-check improvement rather than by any
overclaim.

## Process note (no verdict impact)

`AskPage.tsx` and `AskPage.test.tsx` were edited by the maker **after** the manifest reached
`ready-for-check` and while this check was running. I detected it mid-mutation, and in restoring
my own mutation I briefly overwrote the maker's newer version from a stale backup; I reconstructed
it exactly and confirmed the artifact is byte-identical to the maker's version
(`md5 1b41f5a85a211b0e255ee509ac00e2d2`) before running the final verification. Every result above
is from that final state. This is not charged against the unit — the edit improved it — but a
live-edited artifact under check is a race that could easily have produced a verdict against code
nobody shipped. Preferred handling next time: land the fix, then re-submit at `Fix cycle: 2`.

## CYCLE 2 — INDEPENDENT CHECK

**Date:** 2026-09-10
**Contract:** `qa/contracts/web-ask-page.md`
**Cycle checked:** 2
**Mode:** A (event-driven unit check)
**Bound root:** `D:\KnowledgeBase`
**Submitted commits:** `725f94c72a142c8ff50f6f8e93dc746ca99f73a5` (test-only artifact) and `c59436d0f8887065bb7863c782b425a54ff8caa0` (cycle-2 manifest)

```text
VERDICT: PASS
SCOREBOARD: 8/8 criteria met, 3/3 invariants hold
FAILURES (if any): none
LIVE-BROWSER: not-applicable (cycle-2 changed path is test-only: apps/web/src/pages/AskPage.test.tsx)
ISSUES-WRITTEN: none
EXPLANATION: The focused AskPage suite, full @lkb/web suite, and web typecheck all pass from the root-bound dependency tree. The new C5 assertion is non-vacuous: mutating the missing-sessionRef branch to emit a link makes exactly that test fail, while the source restores byte-identically and the explicit C4 wait remains bounded at 3,000 ms with no retries.
```

### Commands and independently reproduced results

```text
D:\KnowledgeBase\apps\web> .\node_modules\.bin\vitest.CMD run src/pages/AskPage.test.tsx --cache=false
Test Files  1 passed (1)
Tests       7 passed (7)

D:\KnowledgeBase> corepack pnpm --filter @lkb/web test -- --cache=false
Test Files  11 passed (11)
Tests       47 passed (47)

D:\KnowledgeBase> corepack pnpm --filter @lkb/web typecheck
tsc --noEmit -p tsconfig.json
TYPECHECK_EXIT=0

D:\KnowledgeBase> git diff-tree --no-commit-id --name-status -r 725f94c
M  apps/web/src/pages/AskPage.test.tsx
```

### Criterion and invariant evidence

| Item | Result | Independent evidence |
|---|---|---|
| C1 | met | `App.tsx` binds the first `/ask` route to `AskPage`; `NavSidebar.tsx` carries the persistent `/ask` Ask entry. |
| C2 | met | `handleSubmit` trims and refuses empty/loading submissions; `ask.ts` delegates to shared `apiFetch`; tests assert the trimmed call and a real form submission with whitespace produces no call. |
| C3 | met | `result.answer` is rendered and asserted by the focused suite. |
| C4 | met | Runtime has distinct Internal/Web cards, labels, counts, and empty states. The changed wait is `{ timeout: 3_000 }`; neither the test nor `vitest.config.ts` defines retries. |
| C5 | met | Runtime URL-encodes real `sessionRef` values and otherwise renders plain text. The new missing-ref test was mutation-proven as detailed below. |
| C6 | met | `insufficient_coverage`, both web-fallback messages, and `verdict` are rendered; the no-fallback branch is asserted. |
| C7 | met | The focused suite asserts that an `ApiError`'s literal message is rendered. |
| C8 | met | `safeHttpUrl` admits only HTTP(S); the focused suite asserts unsafe schemes stay visible but inert. |
| I1 | holds | Commit `725f94c` changes only `apps/web/src/pages/AskPage.test.tsx`. |
| I2 | holds | Full web suite 47/47 and web TypeScript check exit 0. |
| I3 | holds | No application import/export in `apps/web/src` references `@lkb/*`; `AskResponse` remains structurally declared in `apps/web/src/api/types.ts`. |

### C5 mutation probe and cleanup

The probe temporarily changed the missing-ref return from `null` to `"missing"`, under a hard
30-second child-process timeout and an in-memory byte backup restored in `finally`. Result:

```text
MUTATION_TIMEOUT=False
MUTATION_TEST_EXIT=1
FAIL: renders an internal source without a sessionRef as plain text, never as a broken link
AssertionError: expected <a href="/sessions/missing"></a> to be null
RESTORE_SHA256=EC60594AAD528F41C66CBDBAB6B6AA4DA2D682E1F7CAA4715DECA34EC0D512D7
RESTORE_BYTE_IDENTICAL=True
MUTATIONS CLEAN: none outstanding
VITE_CACHE_PRESENT=False
```

ISS-246 therefore moves `open → fixed`; it is not verified. U3.1 remains `in_progress` and was
not edited or closed by this test-only check.
