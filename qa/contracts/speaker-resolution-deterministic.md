# Contract — speaker-resolution-deterministic

**Status:** active
**Owner:** checker (this file is checker-owned; the maker never edits it)
**North star link:** Phase 1 exit — "speaker+timestamp-cited internal answers".
Catalogue **B3** (speaker identity resolution) / **B10** (speaker profiles), goal task U2.4.
**Created:** 2026-09-08 (cycle 1 of `speaker-resolution-deterministic`)

## Scope

The **deterministic** half of speaker resolution: turning positional diarization labels
(`spk:N`) into named identities using only evidence present in turn text, with no model call.
The LLM `extractFn` half, and any unit that *persists* identities, are separate units under
their own contracts.

## Acceptance criteria

- **[C1]** A positional `spk:N` label that explicitly self-declares a name in its own turn text
  is bound to that name.
- **[C2]** **(binding rule)** Every returned `displayName` appears **verbatim** — exact substring,
  no normalisation, no re-spelling — in the text of **every** turn cited as its evidence. No
  identity may be sourced from a summary, a generated page, or any artifact other than turn text.
- **[C3]** Evidence cites real `turnId`s drawn from the input, each paired with that turn's own
  `sessionId`, deduplicated, in transcript order.
- **[C4]** `personId` is a stable derived identifier (a `person:`-prefixed slug), never a bare
  display name (`speakers.schema.json` H4).
- **[C5]** Verb-phrase and place-description openings (`I'm going to…`, `I am excited…`,
  `This is our campus`) produce **no** speaker.
- **[C6]** A third-party mention (`"Prasanti, what do you think?"`) never resolves a speaker —
  hearing a name is not evidence of who is speaking.
- **[C7]** A label that self-declares **two different** names is left **unresolved**, never
  arbitrarily picked. Contradiction is reported, not settled.
- **[C8]** Turns already carrying a real (non-positional) speaker name are untouched; only
  `spk:N` labels are in scope.
- **[C9]** *(checker-added, cycle 1)* Unresolved positional labels are returned **explicitly**,
  so a caller cannot mistake silence or an empty `resolved` list for success.
- **[C10]** *(checker-added, cycle 1)* The measured resolution yield stated in the unit's
  documentation must be reproducible by running the module over the real corpus. A yield claim
  that cannot be re-derived is a failed criterion, not a rounding difference.

## Invariants

- **[I1]** Pure and synchronous — no network, no provider, no filesystem, no clock, no RNG. The
  module cannot partially fail and cannot fabricate.
- **[I2]** Nothing outside `packages/index/src/` (plus this unit's own qa/ paperwork) is modified.
- **[I3]** Pre-existing tests continue to pass.
- **[I4]** *(checker-added, cycle 1)* This unit **persists nothing** — no `speakers` document is
  written and no `turns.speakerRef` is mutated. Applying identities is a separate, separately
  checked unit because it mutates real data.

## Out of scope / ignore

- Coverage of the ~84% of positional turns the deterministic pass cannot name. Low coverage is a
  *disclosed property* of this approach, not a defect — C2 outranks recall, always.
- `org` / `role` extraction (B10 profiles), `confidence` scoring, non-English (Hindi/Hinglish)
  self-introduction patterns.
- Persisting identities, writing the `speakers` collection, flipping catalogue B3/B10.
- Naming style, comment volume, and other cosmetics.

## Amendment log

- 2026-09-08 · routine · Initial contract authored by the checker from the maker's proposed
  criteria C1–C8 / I1–I3, as the manifest requested (no prior contract existed). ·
  *Why:* first unit for U2.4; the maker's proposed criteria were sound and are adopted verbatim.
- 2026-09-08 · routine · **Added C9, C10, I4.** · *Why:* the maker's own manifest makes three
  commitments its proposed criteria did not pin — explicit `unresolved` reporting (gap 1),
  a reproducible 15.8% yield (the central factual claim), and persisting nothing (gap 2). A
  commitment nobody can fail is not a commitment. All three are *tightenings*; each was
  independently verified as already met in cycle 1, so no artifact was softened to fit.
