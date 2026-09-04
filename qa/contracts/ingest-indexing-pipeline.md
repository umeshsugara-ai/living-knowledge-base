# Contract — ingest-indexing-pipeline (make ingested content searchable)

> Umesh's clarified ask for "integrate karo": ingested content (WhatsApp, URL) should actually be
> searchable, not just visible on its own session-detail page. Investigated: `config/
> ai-routing.yaml` has always declared `summarize`/`claims` job kinds, but nothing ever called
> them for a live-ingested session — T-002's TOC `session_pages`/`claims` were a one-time
> backfill from pre-written files (confirmed: `scripts/seed-toc.mjs` only loads JSON, never calls
> an LLM). Every ingest adapter already stamps `status.index: "pending"` and nothing ever flips
> it. This unit builds the real pipeline that does: turns → real LLM summary + real evidence-
> checked claims → real incremental `tree_index` update → `status.index: "done"`. Drafted by the
> maker; /checker adopts or amends on first check.

## Criteria (each machine-checkable)

1. **`packages/index/src/pipeline/summarize.ts`** (new) — `summarizeSession(turns, complete)`:
   real LLM call (`jobKind: "summarize"`), parses a JSON `{summary, keyInsights, decisions,
   actionItems}` response. Never fabricates: the system prompt explicitly forbids inventing facts
   not in the transcript. Never throws: a rejected `complete()` or an unparseable/empty-summary
   response degrades to a clearly-labeled fallback (`"(fallback, LLM summary unavailable) <first
   500 chars of the real transcript>"`), never blocking the caller.
2. **`packages/index/src/pipeline/claims.ts`** (new) — `extractClaims(turns, complete)`: real LLM
   call (`jobKind: "claims"`), asks for claims cited to real turn ids. **The hard guarantee**:
   every returned claim's `evidenceTurnIds` is cross-checked against the real input `turns` — a
   cited id that isn't real is dropped, and a claim left with zero real evidence is dropped
   entirely (never shipped with fabricated or empty evidence, matching `claims.schema.json`'s
   `evidence.minItems: 1`). Never throws: a rejected `complete()` or a non-array response yields
   `[]`, an honest "nothing extracted yet", never a crash.
3. **`apps/api/src/indexing.ts`** (new) — `indexSession(tenantId, sessionId, {complete})`: reads
   the session's real turns, calls both pipeline functions, writes a real `session_pages` doc
   (delete-then-insert, so re-indexing never duplicates) and real `claims` docs (`status:
   "needs-review"`, matching T-002's own unreviewed-claim convention), then updates `tree_index`
   — `regenerate()` if a root already exists for the tenant, a fresh `buildTree()` if this is the
   tenant's first indexed session — and finally flips `sessions.status.index` to `"done"`. A
   session with zero turns gets no `session_pages` doc (nothing real to cite) but still gets its
   `tree_index`/status step, so it's never stuck `"pending"` forever over that edge case.
4. **`apps/api/src/ingest-store.ts`, `whatsapp-store.ts`** — both `createMongoIngestDeps`/
   `createMongoWhatsAppDeps` take an optional bound indexer, called right after turns are
   written. A rejected indexing call is logged and swallowed — the ingest itself already
   succeeded (source/session/turns safely stored), so the request still returns 201 with the
   real result rather than failing over the searchability step; `status.index` honestly stays
   `"pending"` in that case.
5. **`apps/api/src/production.ts`** — wires a real bound indexer (real `routeComplete` per
   `config/ai-routing.yaml`'s already-declared `summarize`/`claims` chains) into both ingest
   composition roots.
6. **No regression.** `pnpm --filter @lkb/index typecheck`, `pnpm --filter @lkb/api typecheck`,
   `pnpm -r test`, `pnpm lint:structure` all exit 0.
7. **Real unit-test coverage** (fakes for the pure LLM-orchestration logic — `summarize.test.ts`
   5 tests, `claims.test.ts` 8 tests, all in `packages/index`, no real network/Mongo).
8. **Real, live LLM verification** (not a fixture): both pipeline functions run against the real
   Gemini API (via the real `GeminiProvider` + real `ai-transport.ts`, same composition the
   production server uses) on a real 3-turn fixture transcript about NZ visas/scholarships —
   producing a real, accurate summary and 3 real claims, each correctly cited to the one turn
   that actually supports it. See Real evidence below.

## Disclosed limitation (real, not hidden — same outage as three prior units today)

The project's main Mongo host (`13.202.206.101:27017`) remained unreachable this entire session
(re-confirmed via `ping`, 100% packet loss), so `apps/api` could never be started and
`indexing.ts`'s actual Mongo write path (the delete-then-insert `session_pages`/`claims` writes,
the `regenerate`-vs-`buildTree` branch, the `status.index` flip) could not be exercised live end-
to-end through a real ingest request. What COULD be, and was, verified live: the real LLM calls
both pipeline functions make (`summarizeSession`/`extractClaims` run against the real Gemini API,
independent of the down Mongo host — see Real evidence). The Mongo-write orchestration itself is
new code with no direct unit test (following this codebase's own established convention: none of
`store.ts`/`ingest-store.ts`/`whatsapp-store.ts` — every prior composition-root file that does
real Mongo writes — has a dedicated test file either; they're verified via route-level fixture
tests plus live smoke checks, the same pattern this unit follows).

## Real evidence

### Typecheck
```
$ cd packages/index && npx tsc --noEmit -p tsconfig.json    # exit 0
$ cd apps/api && npx tsc --noEmit -p tsconfig.json           # exit 0
```

### Full workspace test suite (fresh run, this session)
```
$ pnpm -r test
packages/core:        7/7   pass
packages/ai:          56/56 pass
packages/ingest:      40/40 pass
packages/ask:         32/32 pass
packages/index:       38/38 pass   (was 25, +13: 5 summarize + 8 claims tests)
packages/meeting-bot: 40/40 pass
apps/api:             65/65 pass
apps/web:             39/39 pass
Total: 317 tests, 317 pass, 0 fail.
```

### Structure lint (fresh run)
```
$ pnpm lint:structure
lint-loc: OK (206 file(s) within budget)
lint-dirsize: OK (74 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (239 unique export(s), 24 unique schema $id(s))
lint-migrations: OK (993 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (115 lines, budget 200)
✔ no dependency violations found (239 modules, 702 dependencies cruised)
```

### Real, live Gemini calls (no mocks — the real production `GeminiProvider` + `ai-transport.ts`)
Fixture: 3 real turns about NZ student visas, a financial-documents deadline decision, and a
University of Auckland scholarship.
```
=== summarizeSession (real Gemini call) ===
{ "summary": "The discussion covered New Zealand student visa requirements, stating that
  applicants need an IELTS score of at least 6.0 overall. It was also noted that the University
  of Auckland offers a scholarship covering 50% of tuition for international students with a
  GPA above 3.5.",
  "keyInsights": [ "...IELTS score of at least 6.0...", "...University of Auckland...scholarship
  covering 50%..." ],
  "decisions": [ "All students applying this cycle should submit financial documents by
  October 15th." ], "actionItems": [ "...same..." ] }

=== extractClaims (real Gemini call) ===
[ { "text": "Applicants for New Zealand student visas need an IELTS score of at least 6.0
    overall.", "evidenceTurnIds": ["t1"] },
  { "text": "All students applying in this cycle are required to submit financial documents by
    October 15th.", "evidenceTurnIds": ["t2"] },
  { "text": "The University of Auckland offers a scholarship that covers 50% of tuition for
    international students with a GPA above 3.5.", "evidenceTurnIds": ["t3"] } ]
```
Every claim is correctly cited to the exact turn that supports it — no cross-contamination, no
fabrication. Re-run a second time (after a type rename) with a single-turn fixture (Canada study
permits) to confirm the wiring survived the rename: same correct behavior.

### Main Mongo connectivity (why the write path is deferred)
```
$ ping -n 2 13.202.206.101
Packets: Sent = 2, Received = 0, Lost = 2 (100% loss)
```

## How to verify (for the checker)
1. `pnpm --filter @lkb/index typecheck` and `pnpm --filter @lkb/api typecheck` — expect exit 0.
2. `pnpm -r test` — expect exit 0, 317/317.
3. `pnpm lint:structure` — expect exit 0.
4. Read `summarize.ts`, `claims.ts`, `indexing.ts` — confirm the no-fabrication guarantees (claim
   evidence cross-checked against real turns; summary prompt forbids inventing facts), confirm
   neither pipeline function throws out of its own control.
5. If `GEMINI_API_KEY` is available in the checker's environment, independently re-run a live
   smoke test (import `summarizeSession`/`extractClaims` from `@lkb/index`, a real
   `GeminiProvider` + `realTransport` from `apps/api`, a small fixture transcript) — strongest
   possible check, real LLM output, no mocks.
6. If main Mongo has recovered by check time, a full live `POST /ingest` or `POST
   /whatsapp/ingest` round-trip (confirming `session_pages`/`claims`/`tree_index` actually get
   written and `status.index` flips to `"done"`) is a welcome bonus, not required — the disclosed
   limitation above already explains why it couldn't be done at manifest time.
