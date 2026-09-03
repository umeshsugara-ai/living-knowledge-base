# Contract — url-adapter (T-023)

> Ground truth for the `url` ingestion source adapter (plan §4c A-cluster item, `qa/contracts/
> ingestion-source-seam.md`'s own doc comment: "document and URL content share the same
> 'extracted text -> paragraph turns' shape"). Umesh's explicit ask, grill capture: "URL
> ingestion: paste any URL → content extracted into the same pipeline." Drafted by the maker;
> /checker adopts or amends on first check.

## Scope
A fourth `Source` adapter, `packages/ingest/src/sources/url.ts`, alongside `recording.ts`/
`document.ts` (T-020) — reuses `document.ts`'s exported `splitIntoParagraphTurns` (its own doc
comment predicted this reuse) rather than reimplementing paragraph splitting. Content extraction
(Jina Reader / Firecrawl — per the plan's build-vs-integrate market scan, §6c.2) is an injected
`UrlFetcher` seam, same "real-by-default-but-fakeable" pattern as every prior adapter — no live
network call required to satisfy this contract, and no specific vendor hardcoded (a caller wires
Jina, Firecrawl, or a test double interchangeably). `schema/sources.schema.json`'s `kind` enum
gains `"url"` and a new optional `url` string field (both additive — `additionalProperties: true`
already allowed extra fields, so this is a genuine widening, not a breaking change).

## Criteria (each machine-checkable)

1. **`schema/sources.schema.json`**: `kind` enum includes `"url"`; new `url: { type: "string" }`
   property. `pnpm gen:types --check` and `python schema/validate.py` (still 21/21 collections,
   existing `sources` fixtures untouched and still valid) both pass.
2. **`detect(input)`**: true for a bare `http://`/`https://` string, or a `{ kind: "url", url:
   string }` hint object (mirrors `document.ts`'s `isDocumentHint` pattern) — false for anything
   else, including a document-hint or a plain non-URL string.
3. **`fetch(input, consent)`**: requires `tenantId` (throws if missing, matching `document.ts`'s
   own C-criterion — never silently defaults tenancy); calls the injected `UrlFetcher(url):
   Promise<string>` to get extracted text, hashes it via the injected `hasher` (same seam shape
   as `document.ts`'s `DocumentHasher`), and returns `{ source: { kind: "url", url, hash,
   captureMode: consent.captureMode, consent: {...}, createdAt }, media: [] }` (no media —
   extracted text has no separate binary artifact, matching `document.ts`'s own `media: []`).
4. **`toTurns(source)`**: requires `source.url` (throws if missing); re-fetches via the SAME
   injected `UrlFetcher` (not a second seam) and pipes the result through `document.ts`'s
   `splitIntoParagraphTurns` — genuinely imported and reused, not duplicated. Per-turn
   `speakerRef` is `"url"` (matching `document.ts`'s `"document"` convention for non-diarized
   text sources).
5. **`registry.ts`/`index.ts` wiring**: `@lkb/ingest`'s `index.ts` re-exports `./sources/url.js`
   alongside `recording`/`document` (one more line, same shape). A registry test proves
   `detectSource` picks the `url` adapter for a URL input ahead of/without conflicting with the
   `document`/`recording` adapters (an `http://...pdf` URL is still a URL-shaped input, not a
   local document path — `document.ts`'s `hasDocumentExtension` check is on a *local path*, not a
   URL, so no ambiguity is expected; the test proves this rather than assuming it).
6. **Tests exist and pass**: `packages/ingest/src/sources/url.test.ts` (new file, mirrors
   `document.test.ts`'s existing structure if one exists, else `document.ts`'s own inline test
   style) covering: `detect` true/false cases; `fetch` computes hash via the injected hasher and
   sets `captureMode`/`url` correctly; `fetch` throws when `tenantId` missing; `toTurns` produces
   paragraph turns with `speakerRef: "url"` via the injected fetcher, without a live network call.
7. **No regression**: `pnpm -r typecheck`, `pnpm -r test`, `pnpm gen:types --check`,
   `python schema/validate.py`, `pnpm lint:structure` all clean.

## Non-goals for T-023
- No real Jina/Firecrawl HTTP call wired to production yet (that's `apps/api`'s or a worker's
  composition-root job, a follow-up once this seam exists — same "seam first, real wiring later"
  pattern T-019's provider adapters and T-020's recording/document adapters both followed).
  No HTML-to-markdown conversion logic here — `UrlFetcher`'s implementation (real or fake) owns
  that; this adapter only consumes whatever text string it returns. No de-dup/re-fetch/diff
  logic (that's T-027 Watched Sources, a separate later unit that builds ON this adapter).
