# Verdict — ask-body-tenant-override-guard

**Date:** 2026-09-09
**Mode:** A (unit check)
**Contract:** `qa/contracts/hybrid-retrieval.md` C6 and I5
**Manifest:** `qa/manifests/ask-body-tenant-override-guard.md`
**Cycle checked: 1** (matches `Fix cycle: 1 of max 3`)
**Bound to:** `D:/KnowledgeBase`
**Dual check:** no

```
VERDICT: PASS
SCOREBOARD: 1/1 criteria met, 1/1 invariants hold
FAILURES: none
LIVE-BROWSER: not-applicable (apps/api/src/ask-arms.test.ts only; no UI or shipped route behavior changed)
ISSUES-WRITTEN: ISS-188 moved open -> fixed (not verified)
EXPLANATION: The real HTTP request authenticates as tenant A while carrying a hostile body-level
tenantId for tenant B, then proves both the binding and invocation remain ordered as tenant A followed
by tenant B. The exact body-preference mutation changed the observed bindings to tenant B twice and
reddened the named test; after byte-identical restoration all focused, full, typecheck, and structure
checks passed.
```

## Independent evidence

| Check | Result |
|---|---|
| Focused baseline `node --test --import tsx --test-name-pattern="arms are bound PER REQUEST" src/ask-arms.test.ts` | PASS, 1/1 |
| Exact body-override mutation, same focused command | FAIL, 0/1: actual `["tenant-b","tenant-b"]`, expected `["tenant-a","tenant-b"]` |
| Post-restore focused command | PASS, 1/1 |
| Full API `node --test --import tsx "src/**/*.test.ts"` | PASS, 173/173 |
| API typecheck `node_modules/.bin/tsc.cmd --noEmit -p apps/api/tsconfig.json` | exit 0 |
| `npm run lint:structure` | PASS: 288 files, 78 directories, fresh snapshot, tracker G1/G4, zero dependency violations across 305 modules |
| `git diff --check -- apps/api/src/ask-arms.test.ts apps/api/src/routes/ask.ts qa/manifests/ask-body-tenant-override-guard.md` | exit 0 |

The repository's `pnpm` wrapper attempted an automatic dependency reinstall and stopped at its
non-TTY purge prompt before executing the suite. I therefore ran the package scripts' underlying
Node and TypeScript commands directly through the already-installed binaries; both completed.

## C6 / I5 inspection

`apps/api/src/ask-arms.test.ts:204` extends the existing `askAs` helper with an optional body while
preserving its original query-only default. At line 229, the first real HTTP request authenticates
with `key-a` but sends `{ query: "topic one", tenantId: "tenant-b" }`. Lines 234-235 require the
factory binding and the invoked retrieval arm to remain exactly `["tenant-a","tenant-b"]` across
the hostile key-A request and the ordinary key-B request. The HTTP 200 assertions and ordered call
records make the check non-vacuous.

The shipped route remains bound to the verified credential at `apps/api/src/routes/ask.ts:43`:
`const tenantId = req.auth!.tenantId`. The same value loads the tree and is passed into
`extraCandidateArmsFor(tenantId)` at line 53, so tenant scoping is enforced at the request binding
site rather than delegated to caller discipline.

## Mutation replay and restore

I temporarily changed `apps/api/src/routes/ask.ts:43` to:

```ts
const tenantId = ((req.body as any)?.tenantId as string) ?? req.auth!.tenantId;
```

The named focused test failed with `one binding per request, in order`: actual
`["tenant-b","tenant-b"]`, expected `["tenant-a","tenant-b"]`. I restored the original line and
confirmed both `git hash-object apps/api/src/routes/ask.ts` and
`git rev-parse HEAD:apps/api/src/routes/ask.ts` equal
`43b43fe302fe2625b8a1a7c567f7621ccbadcc1f`.

No UI path changed, so Mode D is not applicable. ISS-188 moves to `fixed`, not `verified`.
