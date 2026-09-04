# Contract — web-settings-keys (plan §8b, phase 4 — final phase of T-010)

> Real self-serve API key management: list, create, revoke — the last remaining phase of the
> `apps/web` SPA plan (§8b). Explicitly called out in that plan as "a genuine security-sensitive
> feature in its own right, careful review, not an afternoon add-on." Drafted by the maker;
> /checker adopts or amends on first check.

## Criteria (each machine-checkable)

1. **`schema/api_keys.schema.json`** gains a typed `label` field (human-readable name; previously
   only reachable via `additionalProperties: true`). `pnpm gen:types` regenerates
   `packages/core/src/generated/api_keys.ts` with `label?: string`. Verify: read the generated
   file; `pnpm --filter @lkb/core typecheck` (if applicable) or a full `pnpm -r test` stays green.
2. **`apps/api/src/routes/keys.ts`** (new) — `GET /keys` (list, MASKED: never returns `keyHash`
   or a raw key), `POST /keys` (body `{label, scopes}`, `scopes` must be non-empty, mints a real
   key, returns `{id, key}` with the raw value — the ONLY place it is ever returned), `DELETE
   /keys/:id` (revoke). All three behind `requireScope("keys")`. Tenant isolation is structural:
   every operation is scoped to `req.auth.tenantId` (from the CALLER's own already-verified key),
   never from the request body/params — a key can only ever see/create/revoke within its own
   tenant. Verify: `keys.test.ts` (7 tests) — raw key returned once on create; list never
   serializes `keyHash` or a raw key; a tenant cannot see another tenant's keys; revoke sets
   `revokedAt` and stops the key showing as active; cross-tenant DELETE returns 404 and does NOT
   revoke the other tenant's key; empty `scopes` array rejected with 400; missing `keys` scope
   rejected with 403.
3. **`apps/api/src/store.ts`** — `createMongoKeysDeps()`: real Mongo-backed impl, mints
   `lkb_<48-hex-char>` raw keys (distinct prefix from the demo-seed script's `demo_` keys, so a
   production-minted key is visually distinguishable from a seed/demo one), hashes via the
   existing `sha256Hex`, never stores or logs the raw value after the single `createKey` return.
   `listKeys` explicitly projects out `keyHash` field-by-field (does not rely on the caller to
   remember to omit it).
4. **`apps/web/src/pages/SettingsPage.tsx`** (new) — real key management UI: existing-keys list
   (label, scopes, created date, active/revoked badge, Revoke button on active keys only), a
   create form (label input + scope checkboxes, `AVAILABLE_SCOPES` matching the real scopes the
   API actually checks), and a dismissible "copy it now" banner showing a newly-created raw key
   exactly once (cleared from component state on dismiss — never persisted, never re-fetchable).
   Verify: `SettingsPage.test.tsx` (4 tests) — masked list rendering, create-then-banner-then-
   dismiss flow, revoke calls the real API and refreshes the list, a failed create shows a real
   error message (never silently swallowed). Real browser evidence
   (`qa/evidence/spa-settings-create.png`): a real key minted live, shown once, then the
   Existing-keys list updates to include it; a live revoke click flips its badge to "revoked" and
   removes its Revoke button.
5. **Nav + routing** — `NavSidebar.tsx` gains a `/settings` entry; `App.tsx` routes it to
   `SettingsPage`. Verify: real browser navigation (evidenced by the screenshot above, taken via
   the sidebar's own Settings link).
6. **No regression.** `pnpm -r test` (whole workspace) and `pnpm lint:structure` both exit 0.
7. **`TASKS.md`'s T-010** marked `done` (all 4 planned phases now shipped and checker-PASSed);
   Ingest/Meeting-Bot pages explicitly noted as separate, not-yet-started follow-up work (never
   part of T-010's own scope).

## Non-goals (disclosed, not hidden)
- No key-rotation UI (create a new one, revoke the old one manually — no combined "rotate"
  action). No expiry/TTL on keys. No audit log of key usage. All real, deliberate scope cuts for
  a first version — not needed for what's actually being used today (one demo-server key plus
  whatever a real integrator self-serves).
- Ingest and Meeting-Bot pages remain out of scope for T-010 (always were, per the plan) — they
  become their own future unit.
