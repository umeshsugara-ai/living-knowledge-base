# Contract — ingestion-source-seam (T-020)

> Ground truth for the ingestion adapter seam decided in plan §6c.1 ("packages/ingest/source.ts +
> sources/{recording,document,url,whatsapp,meeting-bot}.ts... downstream turns→pages→claims→tree
> never knows which adapter ran"). Drafted by the maker; /checker adopts or amends on first check.

## Scope
`packages/ingest` gains one `Source` adapter interface and two adapters (`recording`, `document`)
— the two needed to unblock T-002 (migrate 23 TOC sessions). `url`, `whatsapp`, `meeting-bot`
adapters are separate later units (T-023, T-007, T-024) implementing the same interface. No live
file I/O against real TOC files is required to PASS — adapters are testable with injected
readers/fixtures, matching the transport-injection pattern from T-019.

## Criteria (each machine-checkable)

1. **One `Source` interface** (`packages/ingest/src/source.ts`): `detect(input: unknown):
   boolean`, `fetch(input, consent: ConsentContext): Promise<{source: SourceDoc, media: MediaDoc[]}>`,
   `toTurns(source: SourceDoc): Promise<Turn[]>`. `SourceDoc`/`MediaDoc`/`Turn`/`ConsentContext`
   types imported from `packages/core/src/generated/*` (T-018's generated types) — no re-declared
   shapes.
2. **`recording` adapter** (`packages/ingest/src/sources/recording.ts`, ≤300 LOC): `detect`
   matches audio/video file extensions or a `{kind: 'recording'}` hint; `fetch` computes a content
   hash (injectable hasher) and returns a `sources` doc with `captureMode` defaulted from the
   `ConsentContext` (D-008: `provided` if explicitly marked, else caller must supply); `toTurns`
   delegates to the T-019 STT seam (`packages/ai/src/stt`) via an injected `transcribe` function —
   does not import a concrete STT adapter directly (keeps `ingest` from depending on a specific
   provider, per ARCHITECTURE §5 dependency rules: `ingest → ai, db, core` is allowed, but the
   concrete choice of STT backend stays the caller's).
3. **`document` adapter** (`packages/ingest/src/sources/document.ts`, ≤300 LOC): `detect` matches
   `.pdf/.docx/.txt/.md` extensions; `fetch` reads via an injected `reader` function (no direct
   `fs` call baked in — testable with an in-memory fixture); `toTurns` splits extracted text into
   paragraph-level turns with `tStart` = character offset (mirrors the plan's URL-adapter
   convention for T-023, established here first since document and URL share the shape).
4. **Registry, not a big if/else:** `packages/ingest/src/registry.ts` exports `detectSource(input,
   adapters: Source[]): Source` picking the first adapter whose `detect()` returns true, throwing a
   typed `NoMatchingSourceError` if none match (never silently picks the wrong adapter or returns
   undefined).
5. **Provided-first consent check (D-008, grill Q4):** `fetch()` on any adapter must accept a
   `ConsentContext` with `captureMode` and, per the contract's H8 ordering, a helper
   `assertProvidedFirst(context)` in `source.ts` that **warns** (returns a warning string, does not
   throw) when `captureMode === 'silent'` and the context does not explicitly confirm no provided/
   public alternative was checked — mirrors the "soft gate" behavior T-024's paste-a-link CLI will
   need (grill Q10). Test proves the warning fires for silent-without-confirmation and is absent
   otherwise.
6. **Tests exist and pass:** `packages/ingest/src/*.test.ts` (node --test) covering: registry picks
   the right adapter for a recording input and a document input, throws `NoMatchingSourceError` for
   neither; `recording.fetch()` computes a hash via the injected hasher and sets `captureMode`
   correctly from context; `document.toTurns()` produces paragraph turns with correct `tStart`
   offsets from a fixture text; the provided-first warning behavior from C5.
7. **No regression:** `pnpm -r typecheck`, `pnpm -r test` (full workspace, prior counts +
   ingest's new tests), `pnpm gen:types --check`, `python schema/validate.py`, `pnpm lint:structure`
   all clean.

## Non-goals for T-020
- No `url`, `whatsapp`, `meeting-bot` adapters (separate units). No live TOC file reads (T-002
  wires this seam to real data). No claim-extraction pipeline wiring (later unit).
