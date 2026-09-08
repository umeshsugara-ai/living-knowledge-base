# Contract — web-ask-page (U3.1)

**Status:** active
**North star:** ARCHITECTURE §1 — the knowledge base answers questions from indexed sessions
first, falls back to the web only when internal coverage is insufficient, and **always cites its
sources separately**. `POST /ask` (`apps/api/src/routes/ask.ts`, checker-PASSed at T-009) is the
route that implements that claim; this contract governs the **web UI that exposes it**.

**Scope.** The `apps/web` Ask page and its client. No backend behaviour is in scope here — the
route's own correctness is governed by `ask-router.md` / `ask-router-v2.md` /
`ask-web-fallback-tavily.md`, and this contract must never be used to re-litigate them.

Authored by the checker on 2026-09-08 from the criteria proposed in
`qa/manifests/web-ask-page.md`, amended as noted in the amendment log below.

## Acceptance criteria

- **[C1] Reachable.** A `/ask` client-side route renders the page, and a persistent nav entry
  links to it. The endpoint is reachable from the running app without typing a URL.
- **[C2] Real call, trimmed query, no empty request.** The page calls `POST /ask` through the
  shared `apiFetch` wrapper (not bespoke fetch logic), sending the **trimmed** query. An empty or
  whitespace-only query issues **no** request.
- **[C3] Answer rendered.** `answer` from the response is displayed to the user.
- **[C4] Citations separated.** Internal and web sources are rendered in **separate,
  separately-labelled, separately-counted** lists and are never merged into one. This is the
  criterion that carries the product claim; a design that concatenates them fails regardless of
  how the items are individually styled. Each list states its own count and its own empty state.
- **[C5] Provenance link-through, and graceful absence.** An internal source carrying
  `evidence.sessionRef` links through to the real `/sessions/:id` detail route (URL-encoded). An
  internal source **without** one renders as plain text and **must not** emit a link — a citation
  that navigates nowhere is worse than a citation that does not claim to.
- **[C6] Low confidence is not dressed as confidence.** `insufficient_coverage` is surfaced in
  the UI alongside the answer, and the message distinguishes *web fallback was used* from *no web
  fallback is configured*. The router's `verdict` is shown.
- **[C7] Real errors.** An `ApiError` renders its own message (e.g. the route's 404 "no tree index
  built for this tenant yet"), not a generic failure string.
- **[C8] Untrusted citation URLs are never made executable.** `WebSource` is an open
  index-signature type populated by an external search provider, so `url` is untrusted text. Only
  `http:`/`https:` may become an `href`; any other scheme (`javascript:`, `data:`, …) renders as
  inert text and is **not silently dropped** — the citation stays visible.
  *(Added by the checker; see amendment log. A citation list that renders provider-supplied URLs
  as anchors is an XSS sink, and no proposed criterion covered it.)*

## Invariants

- **[I1] Blast radius.** No file outside `apps/web/src/` is modified by this unit. (Governance
  surfaces — `.claude/CLAUDE.md`, `docs/DECISIONS.md`, `qa/`, `.goal/` — and files dirty from a
  prior unit are not part of this unit and are not I1 violations.)
- **[I2] No regression.** The pre-existing `apps/web` suite passes unchanged, and
  `tsc --noEmit` is clean for the workspace.
- **[I3] No new coupling.** `apps/web` gains no build-time dependency on `packages/*`; the `/ask`
  response shape is declared structurally in `apps/web/src/api/types.ts`. (Inherited from
  `web-app-shell-brain-calendar.md` criterion 1; restated because this unit adds a type that
  mirrors a `packages/ask` interface.)

## Out of scope / ignore

- **The operator trail.** `auditLog` and `scored` may be fetched and typed without being
  rendered — the per-query cost/provider trail is an operator view, not a counsellor's. Not a
  defect of this unit.
- **Streaming / partial output.** A single awaited request with a pending state is acceptable.
- **Live end-to-end validation against real Mongo + a real LLM.** Component tests with the `ask`
  module spied satisfy this contract. A live check belongs to Mode C, not here.
- Styling, copy wording, icon choice, and any visual polish.

## Amendment log

- 2026-09-08 · **initial** · Contract created at first check of unit `web-ask-page`, from the
  criteria proposed in the manifest (maker-proposed criteria are a draft; the checker owns this
  file).
- 2026-09-08 · **routine (tighten)** · Added **[C8]** (untrusted citation URL scheme guard) and
  **[I3]** (no new `packages/*` coupling). Why: C8 — the maker's own manifest disclosed that
  `WebSource` is an open index-signature type whose real shape is not statically guaranteed, which
  makes `url` attacker-influenceable data flowing into an `href`; no proposed criterion covered
  that, and it is a security property, not polish. I3 — the unit adds a hand-mirrored copy of a
  `packages/ask` interface, so the existing no-coupling rule needed to be stated where it can be
  checked. Both are tightenings; neither weakens a proposed criterion, and no criterion was
  softened to accommodate the artifact.
