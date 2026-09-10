# Contract — whatsapp-ingestion-first-slice (T-007, first slice)

> Umesh: "TOC and all wala sabb ho gyaa hai and whatsapp msg and all wale saare featues ho gyee
> hai" — the `sources/whatsapp_msg` archiver (a separate, independently governed submodule) is
> feature-complete and working (its own README: "Working end to end: live capture verified with
> messages stored and correctly attributed, zero unresolved senders"; confirmed live this unit —
> real Mongo, real captured messages, real people resolved). T-007 ("WhatsApp → claims ingestion
> review", `depends T-020`, T-020 already done) was the only remaining blocker, and that blocker
> is now the archiver actually having real data to pull from — which it does. This unit is
> T-007's first, concrete slice: get real WhatsApp messages into the Living Knowledge Base's own
> `sources`/`sessions`/`turns`, the same "ingest" step every other source kind already has.
> Drafted by the maker; /checker adopts or amends on first check.

## Scope note (disclosed, not silently dropped)

The plan's full T-007 vision (A9: topic/decision/sensitive-content detection, duplicate
flagging, an approve-before-publish review queue before anything becomes a `claim`) is
explicitly **OUT of this slice** — same disclosed-scope pattern as the Gmail meeting-candidate
unit's split from its own approval workflow. This unit only gets real messages **into** the KB as
a real session+turns, exactly as far as the URL/document adapters already go. Claim extraction,
topic detection, and any review/approval UI over WhatsApp content are separate, larger follow-up
units.

As of the 2026-09-10 amendment, the already-PASSed first-slice criteria 1–6 below remain
unchanged. The additive **Full T-007 / A9 follow-up** section after criterion 6 now governs the
review-and-publish work that this scope note originally deferred. T-007 is not complete until
those follow-up criteria pass too.

## Real data found (disclosed, not assumed)

The one currently-tracked group ("Millionaires", 50 real captured text messages, real people —
`Navnit Chaubey Vidysea`, `Himanshu Tomar`, etc.) is an internal Vidysea team/test group, not yet
a real TOC/expert-group WhatsApp thread. This unit ships the real, working ingestion pipeline;
pointing it at a genuine expert group is Umesh's own action inside `sources/whatsapp_msg`'s own
UI (which group to track is that submodule's own governance, per this repo's CLAUDE.md), not
something this unit does or needs to wait for.

## Criteria (each machine-checkable)

1. **`packages/ingest/src/sources/whatsapp.ts`** (new) — the `whatsapp` `Source` adapter (the
   interface's own doc comment already named `whatsapp` as an intended adapter slot). `detect()`
   matches `{ kind: "whatsapp", groupJid, ownerUserId }` only. `fetch()` pulls real messages via
   an injected `WhatsAppFetcher` (no database access baked into the adapter — matches every other
   adapter's convention), writes a `SourceDoc` with `kind: "whatsapp-batch"` (already in the
   schema's enum) and `captureMode: "provided"` (a WhatsApp archiver only captures a sender the
   account owner explicitly selected for tracking — a deliberate act, not silent background
   capture, D-008). `toTurns()` maps each real message to one turn: `speakerRef` = the real
   internal `personId` (traceable back to who actually said it, same as an audio turn's `spk:N`),
   `tStart`/`tEnd` = seconds elapsed since the batch's first message (both equal — a chat message
   is a point in time). The web UI's existing `speakerRef`-based unit-label switch already
   renders this correctly as "s" with zero frontend change (only `"url"`/`"document"`
   `speakerRef`s get "chars").
2. **`apps/api/src/whatsapp-store.ts`** (new) — `fetchWhatsAppMessages` (real, read-only
   connection to `sources/whatsapp_msg`'s own, separate Mongo — confirmed live at
   `mongodb://127.0.0.1:27018`/`whatsapp_msg`, its own Docker container) and `listTrackableGroups`
   (real, live-queried, never hardcoded). `createMongoWhatsAppDeps()` composes the adapter with
   these real deps and persists a real `sources`+`sessions`+`turns` set on ingest, reusing the
   already-real `GET /sessions/:id` view (no second viewer built) — same shape `ingest-store.ts`
   already does for URLs.
3. **`apps/api/src/routes/whatsapp.ts`** (new) — `GET /whatsapp/groups` (real trackable-group
   list), `POST /whatsapp/ingest` (body **`{groupJid}` only — `ownerUserId` MUST NOT be accepted
   from the client**; `ingestGroup` resolves the owner itself from the live `listTrackableGroups()`
   result, keyed only by the caller-supplied `groupJid`, so no caller can ingest on behalf of an
   owner identity it did not independently discover) → real ingest, 201 + real result; a real
   fetch/adapter failure is 502 with the real message, never a silent 500; a malformed body is 400.
   Both `requireScope("whatsapp")`. New `"whatsapp"` scope added to `scripts/seed-demo-server.mjs`
   and `apps/api/src/routes/pages.ts`'s `REAL_ROUTES`. *(Amended 2026-09-07 by /checker — see
   amendment log. The superseded text required the route to accept `ownerUserId` from the client;
   that was the exact shape of a real High-severity cross-owner exposure bug, since fixed.)*
3a. **Idempotency.** `source._id` (and the derived `sessionId`) are stable per
   `(groupJid, ownerUserId)`, never derived from message count or position; every write to
   `sources`/`sessions`/`turns` is an upsert (`replaceOne`/`bulkWrite` with `upsert: true`, never a
   bare `insertOne`/`insertMany`); each turn's `_id` is derived from the real, upstream-unique
   WhatsApp `messageId`. A re-ingest of an unchanged group leaves the corpus byte-identical; a
   re-ingest with N new messages adds exactly N new turns, never a duplicate-key failure and never
   a full-history duplication. *(Added 2026-09-07 by /checker — see amendment log. This invariant
   was absent from the original contract and its absence is exactly how a Critical-severity
   non-idempotent-ingest bug shipped inside a "checked" unit.)*
3b. **Speaker attribution.** Each turn carries a real `speakerLabel` (the resolved WhatsApp
   display name) whenever the fetcher returns one, alongside `speakerRef` (the raw `personId`) —
   a turn is never left showing only an opaque id when a real name was available.
   *(Added 2026-09-07 by /checker — see amendment log.)*
4. **No regression.** `pnpm --filter @lkb/ingest typecheck`, `pnpm --filter @lkb/api typecheck`,
   `pnpm -r test`, `pnpm lint:structure` all exit 0.
5. **Real unit-test coverage** (fixtures/fakes for HTTP-route tests, since the main app Mongo is
   real infra — see disclosed limitation below): `whatsapp.test.ts` (adapter, 6 tests) +
   `whatsapp.test.ts` (route, 6 tests).
6. **Real, live, end-to-end data verification** (not a fixture): a standalone script imports the
   actual shipped `whatsapp-store.ts` + `createWhatsAppSource` and runs the full real pipeline
   (`listTrackableGroups` → `fetch` → `toTurns`) against the real, currently-running
   `whatsapp_msg` Mongo — no mocks, the real database. See Real evidence below.

## Full T-007 / A9 follow-up (additive; criteria 1–6 stay in force)

The remaining A9 flow is: detect topics, decisions, files/attachments, sensitive content,
duplicates and personal/excluded material → persist reviewable **candidates** → explicitly
approve or reject each candidate → publish only approved knowledge. “Candidate” is a quarantine
state, not a softer spelling of “already searchable”. Raw WhatsApp `sources`/`sessions`/`turns`
may be persisted immediately and displayed to an authorised reviewer, but they are source
material, not trusted/citable knowledge until the review transition below succeeds.

The current baseline makes this boundary necessary rather than hypothetical: `indexSession()`
immediately writes `needs-review` `claims`, `session_pages`, `chunks`, promoted entities and a
replacement `tree_index`; `/ask` then reads that tree plus vector chunks and lexical turns without
a WhatsApp review predicate. A `needs-review` label therefore does not currently quarantine the
content. The criteria below allow candidate artifacts to be stored, but forbid any unapproved
artifact from influencing a trusted reader or aggregate.

7. **Schema-backed candidate and review lifecycle.** There is one canonical, schema-defined
   representation for a WhatsApp-derived review candidate, keyed by a stable natural identity and
   carrying `tenantId`, its source/group and session reference, candidate kind, proposed content,
   non-empty turn-level evidence, flags, and review state. The review states distinguish at least
   `needs-review`, `approved` and `rejected`; an approval/rejection records who decided and when.
   Topic, decision, claim/knowledge-chunk and file/attachment candidates use this same lifecycle
   (or an explicitly linked schema-defined review record), rather than inferring trust from
   `status.index: "done"`, LLM confidence, or mere presence in `claims`/`session_pages`. Generated
   types and schema drift checks remain green.
8. **A9 detection is visible and falsifiable.** WhatsApp indexing emits reviewable detections for
   topics and decisions; surfaces file/attachment metadata when present; flags sensitive content;
   flags duplicates against both the same import and already-known tenant knowledge; and marks
   personal/excluded material so it cannot be proposed for publication. Every flag includes the
   evidence/reason the reviewer needs to judge it. Standing positive and negative fixtures cover
   each class, including a same-text/different-tenant non-duplicate, and mutation probes prove the
   assertions fail if topic detection, decision detection, sensitive/personal exclusion, duplicate
   flagging, or evidence attachment is removed. Sensitive, personal/excluded, or duplicate status
   never causes silent auto-approval.
9. **Quarantine covers every trusted read path.** Before approval, and after rejection,
   WhatsApp-derived candidate text/evidence contributes to none of: the trusted `tree_index` or
   its parent/topic/org summaries; `/ask` tree candidates; `/ask` vector candidates; `/ask`
   lexical candidates; trusted `/search`, `/graph`, entity-promotion, or public citation results.
   It is acceptable to persist candidate `session_pages`, `claims`, `chunks` or candidate-tree
   material early only if the trust boundary excludes it before aggregation and retrieval. Tests
   plant unique answer-bearing text in an unapproved WhatsApp session and prove each tree, vector
   and lexical arm would select it when the guard is removed, while the real `/ask` response
   neither uses nor cites it. The same text becomes answerable with a resolvable internal citation
   only after approval, and remains unavailable after rejection. An unapproved child must also be
   unable to leak through a precomputed parent summary.
10. **Explicit tenant-scoped review API and atomic publish.** Authenticated, scope-protected API
    routes list pending candidates, return one candidate with its evidence, and explicitly approve
    or reject it. `tenantId` comes only from the verified key; a client-supplied tenant is ignored
    or rejected, and another tenant receives no existence disclosure. Review is per candidate:
    approving one candidate never publishes its unreviewed siblings. Approval atomically makes
    only that candidate eligible for trusted materialisation/retrieval and records the audit
    decision; if materialisation fails, the candidate remains non-trusted and the API reports the
    failure. Rejection preserves the candidate, decision and evidence for audit while keeping it
    non-citable. Retries are idempotent, and concurrent approve/reject attempts cannot both win.
11. **Review state survives ingest and re-index.** Re-ingesting an unchanged group creates zero
    duplicate candidates; new messages create only their new/changed candidates. Re-indexing must
    not delete an approved/rejected decision and recreate it as `needs-review`, nor may it publish
    a previously rejected candidate. Duplicate identity is tenant-namespaced, and all candidate,
    review, evidence and publish reads/writes include the authenticated `tenantId`. Cross-tenant
    route, direct-store and same-natural-id tests prove both confidentiality and write isolation.
12. **Provenance opens to the exact source evidence.** Candidate and approved-knowledge responses
    expose resolvable evidence containing the WhatsApp session and exact turn/message reference,
    real speaker attribution, and real occurrence time. The reviewer can open that evidence from
    the candidate to the matching session transcript with the cited turn visibly identified; an
    approved `/ask` citation opens through the normal citation/session surfaces to the same text.
    Missing or tenant-mismatched source/turn references are surfaced as errors, never replaced by
    fabricated evidence or silently omitted.
13. **Shipped UI completes the review loop.** The WhatsApp/session-detail experience shows the
    pending-review count and, in the main content region, each candidate’s kind, trust state,
    sensitive/duplicate/personal-exclusion flags, evidence link, and explicit Approve and Reject
    controls when action is permitted. A successful action updates the visible state and the
    trusted-read behavior without a manual reload; loading, empty, forbidden, conflict and failed-
    publish states are honest and actionable. Mode-D verification uses the shipped Vite UI and
    real API routes to run group → ingest → review candidate → open exact evidence → approve and
    separately reject → verify `/ask`; it asserts zero console/page errors. The 2026-09-10
    in-memory live run is baseline evidence only: it reached session detail and visibly rendered a
    `needs-review` claim plus attributed transcript with zero console errors, but had **zero**
    main-region approve/reject controls and **zero** main-region links of any kind (including
    evidence links), so it does not satisfy this criterion.
14. **Verification and real persistence gate.** Focused API/store/indexing/UI tests cover criteria
    7–13, then the affected package typechecks, full workspace tests, schema/type drift check and
    `pnpm lint:structure` pass. T-007 completion also requires a live main-Mongo run (not only an
    in-memory store): ingest creates quarantined candidates; a process restart and unchanged
    re-ingest preserve their ids and decisions; approval makes only approved knowledge retrievable
    with evidence; rejection stays excluded; and a second tenant cannot read or mutate the first
    tenant’s candidates. The current remote main Mongo (`13.202.206.101:27017`) is unreachable and
    local Docker could not be started, so this required persistence proof remains pending and is
    not waived by the successful in-memory UI run.

## Disclosed limitation (real, not hidden)

The project's own remote main Mongo host (`13.202.206.101:27017`) remained unreachable this
session (same outage disclosed in the prior `ask-web-fallback-tavily` unit — confirmed still
down via `ping`), so the full `apps/api` server could not be started and a real HTTP
`POST /whatsapp/ingest` round-trip (which needs the main Mongo for the API-key store and for
writing `sources`/`sessions`/`turns`) could not be exercised end-to-end through the live server.
What COULD be, and was, verified live: the entire real-data pipeline up to persistence —
`listTrackableGroups()`, `fetchWhatsAppMessages()`, and the full adapter (`fetch()` +
`toTurns()`) — all run against the real `whatsapp_msg` database, no mocks. Only the final
Mongo-insert step (already covered by unit tests with a fake, and byte-identical to the
already-shipped, checker-PASSed `ingest-store.ts` pattern for URLs) is unverified live, pending
the main Mongo host recovering.

## Real evidence

### Typecheck
```
$ cd packages/ingest && npx tsc --noEmit -p tsconfig.json    # exit 0
$ cd apps/api && npx tsc --noEmit -p tsconfig.json            # exit 0
```

### Full workspace test suite (fresh run, this session)
```
$ pnpm -r test
packages/core:        7/7   pass
packages/index:       25/25 pass
packages/ai:          56/56 pass
packages/ingest:      40/40 pass   (was 34, +6 whatsapp adapter tests)
packages/ask:         32/32 pass
packages/meeting-bot: 40/40 pass
apps/api:             65/65 pass   (was 59, +6 whatsapp route tests)
apps/web:             34/34 pass
Total: 299 tests, 299 pass, 0 fail.
```

### Structure lint (fresh run)
```
$ pnpm lint:structure
lint-loc: OK (200 file(s) within budget)
lint-dirsize: OK (73 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (233 unique export(s), 24 unique schema $id(s))
lint-migrations: OK (974 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (115 lines, budget 200)
✔ no dependency violations found (231 modules, 668 dependencies cruised)
```

### Real, live, end-to-end run against the real `whatsapp_msg` database (no mocks)
```
$ npx tsx wa-verify-module.mjs   # imports the REAL shipped whatsapp-store.ts
listTrackableGroups(): [ { groupJid: '120363405936621456@g.us', ownerUserId:
  '6a8d0c692fcc75f0e911b878', subject: 'Millionaires', trackedPersonCount: 3 } ]
fetchWhatsAppMessages() returned 50 messages
first 3 (with resolved displayName): [
  { personId: '...2360', displayName: 'Navnit Chaubey Vidysea', text: 'Harshita jeb kaato',
    ts: '2026-08-25T09:43:21.000Z' },
  { personId: '...2361', displayName: 'Himanshu Tomar', text: 'helooe',
    ts: '2026-08-25T09:43:43.000Z' }, ... ]

$ npx tsx wa-verify-adapter.mjs  # imports the REAL createWhatsAppSource + real fetcher together
source: { _id: 'b610fd...', tenantId: 'toc', kind: 'whatsapp-batch', captureMode: 'provided',
  path: '120363405936621456@g.us', ownerUserId: '6a8d0c69...', ... }
toTurns() produced 50 real turns
first 3 turns: [
  { speakerRef: '...2360', tStart: 0, tEnd: 0, text: 'Harshita jeb kaato' },
  { speakerRef: '...2361', tStart: 22, tEnd: 22, text: 'helooe' },
  { speakerRef: '...2361', tStart: 24, tEnd: 24, text: 'eheloww' } ]
```
The `tStart` offsets (0, 22, 24 seconds) match the real message timestamps
(09:43:21, 09:43:43, 09:43:45) exactly.

### Main Mongo connectivity (why the full HTTP round-trip is deferred)
```
$ ping -n 2 13.202.206.101
Packets: Sent = 2, Received = 0, Lost = 2 (100% loss)
```

## How to verify (for the checker)
1. `pnpm --filter @lkb/ingest typecheck` and `pnpm --filter @lkb/api typecheck` — expect exit 0.
2. `pnpm -r test` — expect exit 0, 299/299.
3. `pnpm lint:structure` — expect exit 0.
4. Read `whatsapp.ts` (adapter), `whatsapp-store.ts`, `routes/whatsapp.ts` — confirm no
   fabricated data, confirm `captureMode` is always `"provided"` never inferred `"silent"`,
   confirm `toTurns()`'s offset math and `fetchWhatsAppMessages`'s deleted/media-only exclusion.
5. If `whatsapp_msg`'s Mongo (`127.0.0.1:27018`) is reachable in the checker's environment, an
   independent re-run of `wa-verify-module.mjs`-style code (import the real module, call it) is
   the strongest verification — real data, no mocks. If the main Mongo (`13.202.206.101`) has
   recovered by check time, a full live `curl -X POST http://localhost:3300/whatsapp/ingest` is a
   bonus, not required — the disclosed limitation above already explains why it couldn't be done
   at manifest time.

## Amendment log
- 2026-09-10 · routine additive tightening · Added the full remaining T-007/A9 review contract as
  criteria 7–14 without changing or weakening the checker-PASSed first-slice criteria 1–6. The
  amendment makes the candidate/quarantine boundary explicit because the current implementation
  writes `needs-review` claims plus `session_pages`/chunks/tree material during `indexSession()`
  and every `/ask` arm can consume that material before review. It preserves the original A9
  semantics (topic/decision/file/sensitive detection, duplicate and personal-exclusion flags,
  explicit per-candidate approve/reject, publish only after approval), plus the project’s H3
  provenance and tenancy rules, and turns the observed no-controls/no-evidence-links UI into a
  recorded failing baseline rather than implied completion. Real main-Mongo persistence remains a
  required gate; the 2026-09-10 infrastructure outage is disclosed, not converted into a pass.
- 2026-09-07 · significant · Contract ADOPTED-WITH-AMENDMENT by /checker on the
  contract-adoption-backfill sweep (ISS-006/ISS-055 remedy). Governs the unit checker-PASSed
  cycle 1 (`qa/verdicts/whatsapp-ingestion-first-slice.md`, commit `b549f37`). Read the contract
  in full against the CURRENT `packages/ingest/src/sources/whatsapp.ts`,
  `apps/api/src/whatsapp-store.ts` and `apps/api/src/routes/whatsapp.ts` (all since patched by the
  later `post-review-fixes-2026-09-06` unit) rather than against the code as it stood at
  cycle-1-check time. Found the contract had drifted from the now-correct implementation in two
  ways worth fixing, not rubber-stamping: **(1)** criterion 3 literally required `POST
  /whatsapp/ingest` to accept `{groupJid, ownerUserId}` from the client — that is the exact shape
  of the High-severity cross-owner-exposure bug `post-review-fixes-2026-09-06` fixed (Finding 3);
  amended so the ground truth no longer mandates the insecure shape. **(2)** the original contract
  named no idempotency invariant at all, which is exactly how a Critical-severity non-idempotent
  re-ingest bug (Finding 2 of the same later unit) shipped inside a unit this contract had already
  called checked; added criterion 3a codifying the now-fixed stable-id/upsert/messageId-keyed
  behaviour so a regression here is contract-visible next time. Also added 3b for the
  `speakerLabel` attribution fix (Finding 6/live-observed, lower severity, disclosed rather than
  silently dropped). Adopted otherwise as faithful to D-008 (`docs/DECISIONS.md` D-008,
  provided-first capture mode) and to plan T-007's first-slice scope note.
