# ARCHITECTURE — current ground truth (as of: 2026-09-03, last change: D-000)

<!-- Lab Protocol STATE file. Mutable, but SURGICALLY: only sections listed in an
     authorizing DECISIONS entry's Changes-authorized field may change, and only
     during /landplane. Section numbering matters: the session-start hook injects
     sections 1-3 + 6. -->

## 1. System in one paragraph

**Living Knowledge Base** is a hosted, database-backed "brain" — the same router shape as
Vidysea's own `/brain` (operating-brain `INDEX.md` → deep pages → raw transcripts), moved from
markdown-on-disk into MongoDB with an API. It ingests session recordings, documents, and
messages (starting with TOC community webinars, then WhatsApp expert groups), transcribes and
attributes every fact to a speaker + timestamp, indexes them as a vectorless tree (structured
sessions) plus a vector index (unstructured chat), and answers questions through a CRAG-style
router that trusts internal knowledge first and falls back to the web only when internal
coverage is insufficient, always citing sources separately. Input = recordings, documents,
spreadsheets, WhatsApp messages, live meetings. Output = a queryable, cited knowledge base
served via a Developer API, and ultimately an **AI virtual counsellor** built as a client of that
API — with the explicit long-range goal of matching and then beating top human counsellors in
head-to-head evaluation.

## 2. FROZEN CONTRACTS (machine-checked — do not edit here)
The authoritative versions live in contracts/contracts.json and are enforced by
contracts/verify_contracts.py. This section only lists them:

- *(none — research-first project, starts empty; hypotheses live in §3 until they meet
  the graduation gate)*

## 3. WORKING HYPOTHESES (current best understanding; may change via /landplane)

- **H1 — Two indexes, not one.** Structured sessions (recordings/docs with real section
  boundaries) get a **vectorless LLM tree index** (PageIndex pattern — no embeddings, LLM
  reasons over a JSON tree, returns a navigation path + citations). Unstructured text
  (WhatsApp threads, notes) gets a **vector index** (chunk + embed), because tree-index
  degrades on content with no logical boundaries. Held since D-000.
- **H2 — Internal-first, web-fallback, CRAG-shaped.** Every answer runs tree-search →
  retrieval evaluator (score per candidate, verdict correct/ambiguous/incorrect) →
  internal-only answer on `correct`, else query-rewrite → web search → refine (both
  internal and web docs) → merged answer with web sources cited separately from internal
  ones. Held since D-000.
- **H3 — No fact without provenance.** Every claim written to the knowledge layer carries
  `evidence[]` pointing back to a `turn_id` (raw transcript segment, speaker, timestamp).
  LLMs write knowledge; deterministic code validates schema before it lands (PageIndex
  rule: LLM = judgment, code = schema enforcement). Held since D-000.
- **H4 — Speaker identity is alias-based, never a single string.** Mirrors
  `whatsapp_msg/src/wa/identity.ts`'s LID/PN alias pattern: a `speakers` collection holds
  a stable person id with aliases, and a name is never guessed when it was never stated.
  Held since D-000.
- **H5 — MongoDB, matching the existing stack.** `whatsapp_msg/` already runs Node +
  Express + MongoDB with per-tenant scoping; `TOC/.env` already carries `MONGODB_URL`.
  New collections extend that stack rather than introducing a second database. Held
  since D-000. Revisit if a vector-search requirement outgrows Mongo Atlas Vector Search.
- **H6 — Sub-projects are sources, not separate products.** `TOC/` (23 community
  sessions) and `whatsapp_msg/` (its own governed Lab Protocol repo) are ingestion
  sources feeding one root knowledge base — not independent deliverables. Held since
  D-000.
- **H7 — The counsellor is a client of the API, not a separate brain.** Voice/avatar/chat
  surfaces call `POST /ask` and friends; they hold no knowledge of their own. Held since
  D-000.

## 4. Directory map & file responsibilities

| Path | Owns | Must NOT contain |
|---|---|---|
| `goal.md` | Source-of-truth vision transcript (CEO call) — immutable reference, not edited | Anything else |
| `Living-Knowledge-Base-Architecture.html` | The piloted TOC-slice architecture (ingest→index→query→maintain), consistent with this file | — |
| `reference/kb-deck-screens/` | Screenshots of the "Knowledge Base" product-vision deck (64 slides / 58 real screens) — the target product surface | — |
| `TOC/` | First concrete knowledge source: 23 community webinar sessions, `KNOWLEDGE-BANK.md` synthesis, transcripts | Application/API code (that belongs in the eventual `src/` once built) |
| `whatsapp_msg/` | Second knowledge source: its own governed Lab Protocol repo (separate `.git`, separate ARCHITECTURE.md/DECISIONS.md) — read-only WhatsApp archiver | Nothing shared with root repo's git history (kept out via `.gitignore`) |
| `qa/` | Maker-checker manifests + issues ledger for this repo (created on first `/maker` run) | — |
| `contracts/` | Frozen, machine-checked invariants (starts empty) | Hypotheses (those live in §3) |
| `docs/DECISIONS.md` | Append-only decision history | Anything but decision entries |

**Not yet built** (see plan `C:\Users\Lenovo\.claude\plans\thik-hai-and-you-nested-cat.md` §4c
for the full feature catalogue): the Mongo schema, the tree-index generator, the CRAG `/ask`
router, the product shell, the counsellor eval harness. These are `/maker` work units, not
yet directories on disk.

## 5. Cross-cutting rules

- **Tenancy:** every knowledge-layer row (once the DB exists) carries `tenantId`. No handler
  ever accepts a tenant id from the client — session/auth-derived only (mirrors
  `whatsapp_msg/`'s `ownerUserId` rule).
- **Idempotency:** all knowledge writes are upserts keyed on stable natural ids (session id,
  claim id) — re-ingesting the same source must not duplicate rows.
- **Never silently drop:** a source that fails transcription/parsing is logged as a gap row,
  never discarded. Seen-vs-processed counters must reconcile (mirrors `whatsapp_msg/`'s
  seen-vs-stored rule).
- **No fact without a citation** (H3) — enforced at the schema-validator layer, not just by
  convention.
- **Layering (once code exists):** UI/voice/avatar clients → API layer → knowledge-service
  layer → DB. No upward imports.
- **Consent before capture:** recording or ingesting anyone's session/message requires a
  stated consent policy (open question Q4) before it ships past a pilot.

## 6. OPEN QUESTIONS (deliberately undecided — the agent must NOT resolve these
unilaterally; they resolve only through /checkpoint verdicts)

- **Q1:** Product name — keep "Living Knowledge Base" (from the deck) or rename?
- **Q2:** Phase-3 hosting stack — extend `whatsapp_msg/`'s Node/Express/Mongo app, or start a
  fresh service? (Leaning extend — tenancy + Mongo + Lab Protocol discipline already exist
  there — but not decided.)
- **Q3:** Who are the "top counsellors" for the eventual championship, and who judges? Needed
  before the eval-harness work (T-012) starts.
- **Q4:** Consent rule for recording/ingesting others' webinars and WhatsApp groups — the
  product deck has consent screens; the CEO flagged real reputational/ban risk. Needs an
  explicit written policy before Phase 2/4 ship.
- **Q5:** Does the vector index need a dedicated vector DB (Atlas Vector Search, Chroma,
  FAISS) or does Mongo Atlas Vector Search suffice at this scale?
