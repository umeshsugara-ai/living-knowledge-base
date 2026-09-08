# Contract — speaker-apply-write (U2.4 apply step)

> Ground truth for the first unit in the speaker seam that can **write identities**. Authored by
> /checker at cycle 1 of `qa/manifests/speaker-apply-write.md` (the maker correctly declined to
> author its own). Governing decisions: D-017 (supersedes D-016). Related contracts:
> `speaker-resolution-deterministic.md`, `speaker-resolution-llm.md`,
> `sync-real-turns-to-mongo.md` (the precedent this unit mirrors).

## Why this contract is stricter than its four predecessors

Everything upstream could only ever **refuse** to name someone; a false negative there costs
coverage. This seam **asserts identity**, and a false positive here — two different human beings
recorded as one `personId` — silently corrupts every citation that identity ever carries. The
contract is therefore written around the write, not around the extraction.

## Scope

`buildSpeakerDocs()` (pure) + `scripts/sync-speakers.mjs` (the entrypoint, dry-run and live),
plus the `dirsize.overrides` mechanism D-017 authorizes. Out of scope: rewriting
`turns.speakerRef`; extracting `org`/`role`; wiring `extractSpeakers`; the actual execution of a
live write (separately approved) — but **not** the correctness of the live-write code path, which
is in scope the moment it is shipped.

## Criteria

1. **[C1] The decision is separable from the act.** `buildSpeakerDocs` is pure and synchronous,
   imports nothing that touches Mongo, the network, the filesystem, or a clock, and is
   deterministic (identical input → byte-identical output, including ordering).
2. **[C2] No document is ever emitted with empty `evidence`.** A resolved speaker carrying no
   surviving evidence is dropped, not written. `speakers.schema.json` sets `minItems: 1`;
   satisfying it by construction, not by luck, is the requirement.
3. **[C3] Every emitted document validates against `schema/speakers.schema.json`** — the real
   file, not a restatement of its shape. Verified over the live corpus AND over generated inputs.
4. **[C4] Same session, same name → one person. Different names → never merged**, even inside one
   session. Diarization splitting one voice across `spk:N` labels is the expected case.
5. **[C5] Cross-session merge is permitted but never silent.** A `personId` claimed by evidence
   from more than one session is (a) returned to the caller as an explicit collision alongside the
   documents, and (b) given a confidence strictly lower than a single-session document. A caller
   must not be able to report a clean write over an ambiguous one.
6. **[C6] No disambiguator is invented.** The code never manufactures a distinction
   (`person:ruby-2` or similar) it has no evidence for. Fabricating a distinction is as wrong as
   fabricating an identity, and an ordinal suffix is additionally unstable under corpus growth.
7. **[C7] `--dry-run` performs no network activity of any kind** — not a DNS lookup, not a socket.
   Verified by instrumenting the runtime, not by reading the control flow.
8. **[C8] Deterministic only.** The entrypoint reaches `resolveSpeakers` and never
   `extractSpeakers`; no module transitively reachable from it contacts a provider. No
   model-proposed human name can reach the database through this unit.
9. **[C9] The live-write path executes the write it describes.** Every Mongo operation the script
   invokes exists on the tenant-scoped accessor it invokes it on; a cross-session collision blocks
   the write unless `--allow-collisions` is passed; the write is an upsert, so a re-run is
   idempotent. A shipped write path that cannot run is not "deferred to the approval step" — the
   approval step is permission to run it, not a place to discover it was never wired.
10. **[C10] The declared verify suite reproduces exactly** for a third party: `pnpm --filter
    '@lkb/index' test`, `node --test scripts/lint.test.mjs`, `pnpm -r typecheck`,
    `pnpm lint:structure`, and `node scripts/sync-speakers.mjs --dry-run`.
11. **[C11] The directory-size override is scoped.** `dirsize.maxFiles` is unchanged; only
    explicitly named directories receive a different budget; a test proves an *unlisted* sibling
    still fails at the global cap. An override that could act globally is a failed criterion, not
    a stylistic preference.
12. **[C12] D-016 is not executed.** D-017 supersedes it; applying both would compound the error
    D-017 corrects.

## Invariants

- **[I1] `tenantId` is never dropped from a persisted speaker document.** If the writer strips it,
  the accessor it writes through must re-inject it, and that must be demonstrable.
- **[I2] The persisted corpus is never wider than the evidence.** Every alias and every evidence
  entry on a document traces to a turn actually resolved from a real transcript.
- **[I3] No model output reaches the `speakers` collection through this unit.**
- **[I4] Ambiguity survives the pipeline.** A merge made on a name match alone is visible to
  whoever consumes the result, at every stage it passes through.
- **[I5] No existing budget, guarantee, or checker-PASSed artifact is weakened to let this unit
  land.**
- **[I6] Read-only toward anything already written.** This unit adds speaker documents; it does
  not rewrite `turns`.

## Out of scope / ignore

Catalogue B3/B10 status (they cannot flip before a live write, and B10 should not flip on a
non-empty-collection probe alone — see the verdict); the 15.8 % deterministic coverage ceiling,
which is a stated and accepted limitation of this unit, not a defect; naming, comment style, and
the length of the module docstrings.

## Amendment log

- 2026-09-08 · START · initial contract authored by /checker at cycle 1, on the maker's request
  (the manifest names no contract). Criterion [C9] and invariant [I1] are written deliberately to
  cover the live-write *code path* while excluding its *execution*, because the unit ships the
  former and defers only the latter.
