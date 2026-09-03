# DECISIONS.md — append-only history (Lab Protocol v1.1 semantics)

> The ONLY write path is `scripts/append_decision.ps1`. Direct edits are denied by the
> PreToolUse guard. See `D:/ai_os/templates/lab-protocol/DECISIONS.schema.md` for the schema.

## D-000 | 2026-09-03 | type: decision | status: ACTIVE
**What:** Adopted the Lab Protocol for `D:\KnowledgeBase` at the root level. Accepted three
documents as the canonical basis for this project: `goal.md` (the CEO-call transcript — source
of truth for the vision), the "Knowledge Base" Google Slides deck (64 slides / 58 real product
screens — the target product surface, screenshots archived at `reference/kb-deck-screens/`),
and `Living-Knowledge-Base-Architecture.html` (the already-piloted TOC-slice ingest→index→
query→maintain architecture). `TOC/` and `whatsapp_msg/` are established as knowledge *sources*
feeding one root knowledge base, not separate products — `TOC/` folds directly into this repo's
governance; `whatsapp_msg/` keeps its own separate Lab Protocol repo (own `.git`,
ARCHITECTURE.md, DECISIONS.md) since it was already governed independently, and is referenced
from here rather than duplicated.
**Why:** The CEO's stated goal (an AI counsellor that beats top human counsellors, run as a
public AI-vs-human championship) requires a knowledge base disciplined enough to trust as the
counsellor's memory. Umesh confirmed mid-session that the competition/championship framing IS
the long-range plan for this directory (not out of scope as first assumed), that "brain kind of
stuff, properly set up in the database and hosted" is the required foundation, and that work
here should run maker-checker style (`/maker` + `/goal`) rather than ad-hoc.
**Result:** Root `ARCHITECTURE.md`, this file, `contracts/` (empty), `TASKS.md`, repo-committed
enforcement hooks, and `.claude/CLAUDE.md` scaffolded. `git init` run at root (fresh repo, no
prior history). Full feature inventory (60+ maker work units across Learn/Remember/Reason/
Improve/Platform/Operations) captured in the approved plan file
`C:\Users\Lenovo\.claude\plans\thik-hai-and-you-nested-cat.md`.
**Links:** plan file above; genesis commit (this commit).

## D-001 | 2026-09-03 | type: session | status: ACTIVE
**What:** Backfilled project history prior to Lab Protocol adoption (interview deferred to
T-000, answered inline instead of a separate `/init-lab resume` round since the context was
already gathered this session). Key prior decisions: (1) built
`Living-Knowledge-Base-Architecture.html` as a hybrid vectorless-tree + CRAG design for the TOC
slice, piloted end-to-end on the 27th-August-In-Focus session only; (2) chose Gemini
(`gemini-3.5-transcribe` + `gemini-3.7-flash`) as the primary transcription/diarization
pipeline with local `/transcribe` (faster-whisper) kept as fallback, after the local pipeline
hit a real `cublas64_12.dll` dependency failure on the original 23-session run; (3) built
`whatsapp_msg/` as a separately-governed, read-only, multi-tenant WhatsApp archiver, not yet
pointed at any TOC/expert group; (4) manually built `KNOWLEDGE-BANK.md` (240-line synthesis of
all 23 TOC sessions) and a by-month Google Sheet before any of this was automated.
**Why:** Preserve the reasoning behind pre-protocol choices so future sessions don't relitigate
them from scratch.
**Result:** Recorded here; no code changed.
**Links:** `TOC/TOC-Materials/KNOWLEDGE-BANK.md`, `Living-Knowledge-Base-Architecture.html`,
`whatsapp_msg/docs/DECISIONS.md` (that repo's own independent decision log).
