# Contract — developer-api (T-009)

> Ground truth for the Developer API, promoted 2026-09-03 by Umesh: "developers ko API deni hogi
> for virtual counsellor, vo log hit karenge." Drafted by the maker; /checker adopts or amends on
> first check. Per plan §2.4 (`/sources /sessions /search /ask /citations` + scoped keys) and the
> deck's Developer API screen — scoped down here to the one endpoint that actually has a working
> pipeline behind it today: `/ask` (T-005b). Other routes are stubs returning `501 Not Implemented`
> with a clear message, not silently absent — honest about what's real.

## Scope
`apps/api` (empty placeholder since T-016) becomes a real Express server: `POST /ask` wired to
`packages/ask`'s `askV2` + `packages/index`'s real `treeSearch` (the composition root allowed to
depend on both, per ARCHITECTURE §5 — this is where T-005b's injected `treeSearchFn` finally gets
its real implementation). API-key auth via `schema/api_keys.schema.json` (T-018). No live Mongo
required to PASS — the server's DB-backed routes (key lookup, tree loading) accept an injected
store, same pattern as every prior unit, tested with an in-memory fake; a real Mongo-backed store
is wired at `apps/api`'s actual startup but not required for the test suite to pass.

## Criteria (each machine-checkable)

1. **`apps/api/src/server.ts`** (≤80 LOC per ARCHITECTURE §4's own budget note) — Express app,
   JSON body parsing, mounts routes from `src/routes/`, starts on `process.env.PORT ?? 3000`,
   exported as `createServer(deps)` (injectable deps: key store, tree store, ask deps) so tests
   never bind a real port unless they choose to (use an ephemeral port or supertest-style in-
   process request, whichever `apps/api`'s devDependencies already support — check before adding
   a new one).
2. **API-key auth middleware** (`apps/api/src/auth.ts`): reads `Authorization: Bearer <key>`,
   looks up via an injected `ApiKeyStore.verify(key): Promise<{tenantId, scopes} | null>` (matches
   `schema/api_keys.schema.json`'s `keyHash`/`scopes`/`revokedAt` fields — verify against a hash,
   never compare raw keys), 401s on missing/invalid/revoked, 403s if the route's required scope
   isn't in the key's `scopes`. No real hashing library added if `node:crypto`'s built-in
   `scrypt`/`sha256` suffices — check before adding a dependency.
3. **`POST /ask`** (`apps/api/src/routes/ask.ts`, requires scope `ask`): body `{query: string}`,
   calls `packages/ask`'s `askV2` with a real `treeSearchFn` sourced from `packages/index`'s
   `treeSearch` (the actual wiring T-005b deferred to a composition root — this IS that root) and
   an injected `tree` (from an `TreeStore.load(tenantId): Promise<TreeIndexNode>` interface, tested
   with a fake, no live Mongo needed), returns `askV2`'s `AskResult` as JSON. On the LLM `complete`
   dependency: inject T-019's real provider `complete` function (routed via `config/ai-routing.yaml`
   for `jobKind: 'ask'`) — tests use a fake `complete`, never a real API call.
4. **Stub routes, honestly labeled:** `GET /sources`, `GET /sessions`, `GET /search`, `GET
   /citations/:claimId` each return `501 {error: 'not_implemented', message: '<route> is planned,
   not yet built — see TASKS.md'}` with the correct scope-check still applied (so a caller learns
   "you're authorized but this isn't built" vs "you're not authorized" — the two are different
   information and must not be conflated).
5. **Webhooks stub, honestly labeled:** `POST /webhooks/register` returns `501` the same way — no
   webhook delivery logic built yet (T-009's scope is `/ask` first, webhooks are a documented
   follow-up, not silently promised).
6. **Rate limiting:** a simple per-key in-memory token-bucket or fixed-window limiter (reuse
   `express-rate-limit` if that's an easy add, or the pattern `whatsapp_msg` already uses — check
   `sources/whatsapp_msg/src` first, it's a submodule with its own `express-rate-limit` dependency
   already, per its `package.json` — DO NOT hand-roll if a proven pattern already exists in this
   codebase) — returns `429` with a `Retry-After` header when exceeded.
7. **Tests exist and pass:** `apps/api/src/*.test.ts` (node --test, in-process requests — no real
   network bind unless unavoidable) covering: valid key + `ask` scope → 200 with an `AskResult`
   shape; missing/invalid key → 401; valid key missing `ask` scope hitting `/ask` → 403; valid key
   hitting a stub route → 501 (not 403, not 200); rate limit trips after N requests → 429.
8. **No regression:** `pnpm -r typecheck`, `pnpm -r test` (existing + new), `pnpm gen:types
   --check`, `python schema/validate.py`, `pnpm lint:structure` (incl. the `apps → packages/
   {ask,ingest,index,ai,db,core}` dependency rule — `apps/api` importing both `@lkb/ask` and
   `@lkb/index` is exactly what the rule allows and this unit needs) all clean.

## Non-goals for T-009
- No real webhook delivery. No `/sources`/`/sessions`/`/search`/`/citations` implementation
  (each is its own later unit once the underlying data access exists). No live server deployment.
  No real API key issuance UI (T-012's compete screen or a later admin surface generates test
  keys directly into the DB/fixtures for now).
