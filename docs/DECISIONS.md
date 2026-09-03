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

## D-002 | 2026-09-03 | type: decision | status: ACTIVE
**What:** Meeting/webinar capture mode = SILENT FULL CAPTURE (Option B of the product brief), not announced-bot (A) or notes-only tiered (C). Every captured fact must be diarized and cited with who said it, when, and in which session, so the team can return to that expert for guidance. Recordings are to be purged after processing to a defined level; the purge design is explicitly deferred (T-026).
**Why:** Founder's stated requirement: organizers often do not provide recordings; Vidysea attends as a paid member and wants its own copy for manual review and to feed the counsellor brain. Provenance is what makes the resulting knowledge defensible and actionable.
**Result:** Legal/reputational exposure noted once and accepted by the Approver: India DPDP Act 2023 notice obligation for identifiable audio/video; platform T&Cs commonly prohibit recording; two-party-consent jurisdictions abroad; discovery risks bans from the communities that form the moat. Mitigations designed in: consent_policies row exists (default silent-full, switchable), provenance is a frozen invariant (no turn without speakerRef, no claim without evidence), retention field added now so purge is a migration later.
**Changes-authorized:** ARCHITECTURE Â§3 (H3 provenance becomes the basis for a future frozen contract; add H8 capture-mode hypothesis); ARCHITECTURE Â§6 (Q4 resolved, Q6 purge level added)
**Approved-by:** Umesh
**Links:** T-024, T-011, T-026; plan file section 6c.0

## D-003 | 2026-09-03 | type: decision | status: ACTIVE
**What:** Stack = TypeScript pnpm monorepo (packages/{core,db,ai,ingest,index,ask,meeting-bot}, apps/, workers/), Python only in isolated ML workers. Existing Python units (tree_index/, ask_router/) are ported to TS with tests first; schema/ JSON Schemas remain the single source of truth with TS types generated from them. whatsapp_msg/ becomes a workspace source (submodule), not the product shell.
**Why:** Designed against the D:\erp failure audit: two checkouts, 5k-line god-files, 32 schemas in one file with dated patch migrations, a 1,105-line duplication map, 6k lines of onboarding prose. Baileys and Playwright are Node-native; a single service language plus generated types removes hand-copied field lists.
**Result:** Hard CI budgets adopted: 300 LOC per file (tests 400), 30 files per dir, root <= 15 loose files, one exported symbol per concept, ARCHITECTURE.md <= 150 lines, migrations only via migrate-mongo.
**Changes-authorized:** ARCHITECTURE Â§4 (directory map replaced by the monorepo tree); ARCHITECTURE Â§5 (add file/size/dependency budgets); ARCHITECTURE Â§6 (Q2 resolved)
**Links:** T-016, T-017, T-018; plan file section 6c.1

## D-004 | 2026-09-03 | type: decision | status: ACTIVE
**What:** Meeting-bot and transcription vendor = self-hosted Vexa (Apache-2.0) with Whisper diarization as the default, behind a pluggable STT seam (packages/ai/stt) so an API key for an advanced model such as gemini-3.5-transcribe can be supplied and preferred. Recall.ai rejected.
**Why:** Corpus must not transit a third party; open-source keeps control and cost near zero; the seam preserves the option to use the better diarization already validated on the 27th-August pilot.
**Result:** Market scan recorded in plan section 6c.2 (Recall, Vexa, Meeting BaaS, Deepgram, AssemblyAI, Jina, Firecrawl, Tavily; Fireflies/Otter/Onyx rejected).
**Changes-authorized:** ARCHITECTURE Â§3 (add H9 pluggable STT); ARCHITECTURE Â§6 (vendor question closed)
**Links:** T-024, T-019; plan file section 6c.2

## D-005 | 2026-09-03 | type: decision | status: ACTIVE
**What:** AI backend = Gemini-first (purchased Gemini API tokens carry 80-90% of the load; Google-side monthly budget is the cap). Claude is used through the same OAuth login flow as the claude CLI (email -> OTP), i.e. Claude Code / Agent SDK under the Max subscription, not API keys. Anthropic Messages API is optional behind a feature flag (off by default) and may be dropped. No budget-guard / throttling work now; a jobs ledger with per-job maxCost only.
**Why:** Founder does not want to manage a second metered budget; Gemini tokens are already purchased; the OAuth flow is how the team already logs in.
**Result:** Routing matrix in plan section 6c.3 re-mapped: Gemini Flash for cheap/many stages, Gemini Pro for claims/answers, Claude Code for agentic/bulk/dev-loop; parity contract test runs Gemini vs Claude Code.
**Changes-authorized:** ARCHITECTURE Â§3 (add H10 provider routing); ARCHITECTURE Â§6 (budget question closed)
**Links:** T-019; plan file section 6c.0 and 6c.3

## D-006 | 2026-09-03 | type: decision | status: ACTIVE
**What:** Install the maker-checker auto-continue enforcement wiring in this repo: project .claude/CLAUDE.md block (on session start, if qa/ shows pending state, run /maker continue before anything else; /checker sweep as manual override), session-start hook printing the AUTO-CONTINUE directive when pending state exists, and the PreToolUse commit guard, via /maker init (idempotent repair).
**Why:** Sweep finding ISS-005: without it the loop advances only when a session explicitly invokes /maker continue; a session opening this repo with pending qa/ state would silently idle. Reversible (/maker pause writes qa/.paused; removing the settings entry disables the directive).
**Result:** Approved by the Approver during the 2026-09-03 grill (Q7). Wiring to be installed by the next /maker init run.
**Changes-authorized:** .claude/CLAUDE.md (maker-checker block); .claude/hooks/* (add mc session-start + commit guard); .claude/settings.json (register the two hooks) -- each is the minimal enforcement addition the maker skill's enforcement-wiring reference specifies.
**Approved-by:** Umesh
**Links:** ISS-005; grill log Q7 in the plan file; T-016 (wiring lands before the restructure unit starts)

## D-007 | 2026-09-03 | type: decision | status: ACTIVE
**What:** The counsellor evaluation question bank draws from three sources: (a) questions asked in TOC/webinar Q&A segments, (b) anonymised questions from Pathlynks counselling sessions, (c) hard questions submitted by each competing counsellor. Pathlynks student data is APPROVED for this single use, conditional on the anonymisation rule below.
**Why:** A realistic bank of real student confusion is the raw material for the head-to-head harness (grill Q1-Q3). Synthetic LLM-generated questions were rejected as the primary bank because they test what a model thinks students ask.
**Result:** Anonymisation rule: strip names, schools, exact scores and dates (bucket to ranges); a human reviews the bank once before it is frozen; the frozen bank carries a content hash so results are comparable across runs. Bank owner for the one-time review: open flag. This entry is the explicit per-use approval the AIOS rules require before any Pathlynks / student-applicant data is touched.
**Approved-by:** Umesh
**Links:** T-012, T-021; grill log Q3

## D-008 | 2026-09-03 | type: decision | status: ACTIVE
**What:** Capture policy is PROVIDED-FIRST and the AI backend is MULTI-PROVIDER. (1) Capture ordering per source: organizer-provided recording -> public recording -> attendee notes/live transcript -> silent capture ONLY when no alternative exists; silent capture remains a supported capability (default policy row silent-full) but is the last resort, never the default path for sources that already share recordings (e.g. TOC). Media purge is GATED: a recording may be deleted only when every claim citing it is marked verified, and a +/-15 s evidence clip per cited turn is retained permanently. (2) AI backend: five provider adapters from day one (gemini, anthropic API key and OAuth/Claude Code modes, openai, ollama, claude-code), each exposing listModels() so the UI/CLI renders a per-provider model dropdown; the provider chain per jobKind is a user-editable ordered list of any length >= 1. Gemini stays the default first provider.
**Supersedes:** D-002, D-005 -- D-002 recorded silent full capture as the flat mode and purge-after-processing without a gate; the grill (Q4, Q12) established that the founder wants provided sources used first (no wasted effort/tokens where recordings are already given) and that ungated purge breaks the who-said-what promise the moment an expert disputes a quote, so provided-first ordering plus a verified-claims gate and retained evidence clips replace it. D-005 recorded that the Anthropic API was optional and might be dropped; the grill (Q5, Q6) established a hard no-single-AI-dependency rule with rotation across Gemini/OpenAI/Ollama/Anthropic and a per-provider model dropdown, so the drop clause is removed while Gemini-first as the default is kept.
**Why:** Founder's explicit rules from the 2026-09-03 grill: silent capture is the final possible weapon, not the daily tool; no AI tool should run on one model; evidence must survive disputes.
**Result:** Design consequences: sources.captureMode in {provided, public, notes, silent} required; media.kind incl. evidence-clip and media.retention added in schema v2 (T-018); packages/ai ships five adapters + listModels() + STT seam (T-019); paste-a-link capture CLI warns before silently joining a provided-recording community (T-024).
**Changes-authorized:** ARCHITECTURE section 3 (H8 capture-mode hypothesis reworded to provided-first; H10 provider routing reworded to multi-provider chain); ARCHITECTURE section 6 (purge level question restated as gated-purge design task)
**Approved-by:** Umesh
**Links:** T-018, T-019, T-024, T-026; grill log Q4, Q5, Q6, Q12; brainstorms/2026-09-03-lkb-counsellor-assumptions.md

## D-009 | 2026-09-03 | type: decision | status: ACTIVE
**What:** Register .claude/hooks/features-snapshot-session-end.ps1 as a second SessionEnd hook in .claude/settings.json, alongside the existing lab-session-end.ps1 entry. On graceful session end, if docs/FEATURES.jsonl changed during the session, it runs node scripts/snapshot.mjs to regenerate docs/SNAPSHOT.md so the next session's snapshot is never stale by more than one session. Always exits 0, fails open on error, same posture as lab-session-end.ps1.
**Why:** T-017b (checker verdict qa/verdicts/T-017b-snapshot-features-ledger.md, cycle 1) FAILed criterion 6a because this specific hook was not covered by D-006's grant (which named only mc-sessionstart.ps1 and mc-precommit.ps1). The script itself was already written and hand-tested by the maker; only the settings.json registration was withheld pending this approval.
**Result:** Approved by the Approver. The pnpm lint:structure staleness gate (criterion 6b, already PASSed) remains the enforcement backstop regardless of whether this hook fires.
**Changes-authorized:** .claude/settings.json (add a second SessionEnd hooks entry for features-snapshot-session-end.ps1, merged alongside the existing lab-session-end.ps1 entry, never overwriting it)
**Approved-by:** Umesh
**Links:** T-017b, ISS-013; qa/contracts/snapshot-features-ledger.md criterion 6a
