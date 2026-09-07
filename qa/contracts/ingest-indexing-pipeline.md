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
1a. **The labelled fallback is for a session that has no good summary yet — it may not overwrite
   one that does.** On a re-index where `summarizeSession` degraded, an existing `session_pages`
   doc for that session is left as it is; the fallback is written only when there is no existing
   page. *(Added 2026-09-07 by /checker, ruling on the maker's own disclosure that `summarize.ts`
   has the same shape as the ISS-056 claims bug and was left unchanged "because the contract
   explicitly requires that fallback". The maker was right not to change it unilaterally and
   right that it is the same shape. The contract required the fallback to EXIST; it never
   required it to REPLACE a good page. This clause removes the ambiguity the maker correctly
   refused to resolve on its own. Not in scope for the claims-degradation-honesty unit — see
   ISS-059.)*
2. **`packages/index/src/pipeline/claims.ts`** (new) — `extractClaims(turns, complete)`: real LLM
   call (`jobKind: "claims"`), asks for claims cited to real turn ids. **The hard guarantee**:
   every returned claim's `evidenceTurnIds` is cross-checked against the real input `turns` — a
   cited id that isn't real is dropped, and a claim left with zero real evidence is dropped
   entirely (never shipped with fabricated or empty evidence, matching `claims.schema.json`'s
   `evidence.minItems: 1`). **Never throws** — but a failure is never reported as an empty
   extraction. `extractClaims` returns a discriminated result `{ claims, degraded }`:
   `degraded` carries a reason for a rejected `complete()` and for a non-array response, and is
   `null` whenever extraction genuinely ran — **including when the transcript yields nothing and
   when every candidate claim was dropped by the evidence check**, both of which are successful
   extractions that must remain able to clear stale claims. *(Amended 2026-09-07 by /checker —
   see amendment log. The superseded text blessed a bare `[]` as "an honest 'nothing extracted
   yet'". It was not honest and it was not safe: the caller deleted before inserting, so an
   indistinguishable `[]` destroyed real data. Proven live, not argued — see C2a.)*
2a. **`apps/api/src/indexing.ts` must not replace data it could not recompute.** When
   `extractClaims` reports `degraded`, the session's existing `claims` are left exactly as they
   are — no `deleteMany`, no `insertMany` — and the reason is logged. The delete and the insert
   are governed by the **same** condition; a conditional insert paired with an unconditional
   delete is the defect this criterion exists to forbid. A non-degraded extraction still replaces
   the session's claims (delete-then-insert), including with an empty set, so stale claims always
   remain clearable.
3. **`apps/api/src/indexing.ts`** (new) — `indexSession(tenantId, sessionId, {complete})`: reads
   the session's real turns, calls both pipeline functions, writes a real `session_pages` doc
   (delete-then-insert, so re-indexing never duplicates) and real `claims` docs (`status:
   "needs-review"`, matching T-002's own unreviewed-claim convention), then updates `tree_index`
   — `regenerate()` if a root already exists for the tenant, a fresh `buildTree()` if this is the
   tenant's first indexed session — and finally flips `sessions.status.index` to `"done"`. A
   session with zero turns gets no `session_pages` doc (nothing real to cite) but still gets its
   `tree_index`/status step, so it's never stuck `"pending"` forever over that edge case.
3a. **Every query `indexSession` issues is confined to one tenant.** Criterion 3 describes the
   writes without requiring them to be tenant-confined, which is exactly why ISS-060 could exist
   while this contract read as satisfied: the claims `deleteMany` reached the raw
   `db.collection()` handle, carried its `tenantId` by hand, and stripping it compiled, passed the
   whole suite, and live destroyed a second tenant's claims. Therefore: `turns`, `sessions`,
   `session_pages` and `claims` are reached through `scopedCollection` — which merges the
   `tenantId` itself, so a caller cannot omit one — and never through the raw handle. **The
   `tenantId` merged by the accessor always wins over any caller-supplied one** (`withTenant`
   spreads it last). **`tree_index` is the one disclosed exception**: `schema/
   tree_index.schema.json` declares no `tenantId` property, so its rows are separated only by the
   `tenant:<id>` prefix inside `node_id` — a convention the compiler cannot enforce. That
   exception is permitted here as an interim boundary **only** while (i) every `tree_index` access
   goes through a single shared filter definition, and (ii) no destructive multi-document
   operation (`deleteMany`) is ever issued against `tree_index`. Whether the schema should gain a
   real `tenantId` field is tracked as ISS-062, not settled by this criterion.
   *(Added 2026-09-07 by /checker, ruling on the maker's explicit request in
   `qa/manifests/tenant-scoped-writes.md`: "no criterion currently covers tenant scoping in
   `indexSession` … I have NOT added one (contracts are checker-owned)." That was the correct
   call, and the gap is real — a contract that never required the boundary is what let a
   cross-tenant delete sit inside a passing unit. Tightening only, no criterion weakened, so
   routine under the criticality gate. Satisfied by the unit under check, verified by mutation +
   a checker-authored live two-tenant run.)*
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

## Amendment log (append-only)

| Date | Kind | What | Why |
|---|---|---|---|
| 2026-09-07 | adoption | /checker **adopts** this contract, which was drafted and committed by the maker in `3a998d3` and has carried no amendment log until now. Content re-read in full against `summarize.ts`, `claims.ts`, `indexing.ts` and the ingest composition roots. | Closes the `ingest-indexing-pipeline` share of the reopened **ISS-006** (maker-authored ground truth never adopted) and of **ISS-055** (no amendment log). The file invited adoption — "Drafted by the maker; /checker adopts or amends on first check" — and no checker had recorded one. Adopted as faithful **except** criteria 1 and 2, amended below in the same pass; adopting text I was simultaneously overturning would have been a rubber stamp. |
| 2026-09-07 | routine (tighten) | **AMENDED criterion 2** — a failed `complete()` may no longer be reported as an empty extraction; `extractClaims` returns `{claims, degraded}`, with `degraded: null` reserved for extractions that genuinely ran (including genuinely-empty and all-dropped-by-evidence-check). **ADDED criterion 2a** — the caller's claims delete and insert must be governed by the same condition. | The superseded wording called a bare `[]` "an honest 'nothing extracted yet'". It was neither honest nor safe, and this is measured, not argued: driving the pre-fix code path against the real database (checker-authored script, scratch tenant, 2026-09-07) took a session's claims from **1 → 0**, destroying a claim carrying human review status `"verified"`, and wrote nothing back. The unconditional `deleteMany` paired with a conditional `insertMany` made any transient provider outage during a re-index a silent data-loss event. **Tightening only — a data-safety invariant is added, none weakened**, so this is a routine amendment under the criticality gate rather than a human-gated one. Decided on the pre-fix evidence, independently of the pending verdict: the rule was wrong before this unit existed. Raised by the maker (`qa/manifests/claims-degradation-honesty.md`), which flagged the contradiction and pointedly did **not** edit this file — the ISS-006 behaviour to generalise. ISS-056. |
| 2026-09-07 | routine (tighten) | **ADDED criterion 3a** — every query `indexSession` issues must be tenant-confined, via `scopedCollection` rather than the raw handle, with the accessor's `tenantId` winning over any caller-supplied one; `tree_index` is a disclosed, conditional interim exception. | The contract described `indexSession`'s writes but never required them to stay inside a tenant, so ISS-060 — a cross-tenant `deleteMany` that survived the entire suite and `tsc` and live destroyed a second tenant's claims — was a defect the contract could not have caught. Raised by the maker, which flagged the gap and pointedly did **not** add the criterion itself ("contracts are checker-owned") — the ISS-006 behaviour, correctly generalised for the second time. Verified before adoption, not asserted: I re-ran the manifest's four mutations myself with occurrence counts asserted 1→0 (api 70/71, db 7/8, db 5/8 + api 69/71, db 7/8 — all matching), and wrote my OWN live two-tenant script against the real database (`lkb`, scratch tenants `chk060-*`), which took tenant B's human-`verified` claim 1→0 under the mutation and left it intact on the fixed code. Tightening only — a data-safety invariant added, none weakened. ISS-060. |
| 2026-09-07 | routine (tighten) | **ADDED criterion 1a** — a degraded `summarizeSession` may not overwrite an existing good `session_pages` doc; the labelled fallback is for sessions that have no page yet. | Same shape as the ISS-056 defect, one file over, and disclosed by the maker rather than quietly left: a degraded re-index replaces a real summary with a 500-char transcript slice. The maker declined to act because "the contract explicitly requires that fallback" — correct reading, and the correct escalation. But the contract required the fallback to **exist**, never to **replace**. Lower severity than the claims defect (it is labelled, carries no human-curated state, and is regenerable from turns), hence a filed unit rather than a verdict failure. Tightening only. ISS-059. |
| 2026-09-07 | routine | **Reconfirmation, no content change.** Re-checked as part of the contract-adoption-backfill sweep (ISS-006/ISS-055 remedy) that swept all four maker-drafted contracts named in the reopened ISS-006. This contract already carried a genuine adoption entry (above) explicitly naming ISS-006, plus three substantive tightening amendments (ISS-056, ISS-059, ISS-060/3a) each backed by a live, independently-reproduced mutation — the strongest standard of the four contracts in this sweep. No further gap found: re-verified `summarize.ts`, `claims.ts`, `indexing.ts` still match criteria 1/1a/2/2a/3/3a as written, and `qa/verdicts/ingest-indexing-pipeline.md`'s cycle-1 PASS still stands against the current code. Logged so this contract's compliance with ISS-006/ISS-055 is independently re-derived by this sweep, not merely carried forward by assumption. |
