# Living Knowledge Base -> AI counsellor assumptions — grill notes — Living Knowledge Base → AI counsellor (load-bearing assumptions)

**Date:** 2026-09-03
**Goal of session:** stress-test the assumptions the plan rides on — north star measurability, silent
capture, Gemini-first, monorepo, sources, championship — before the maker builds on them.
**Disciplines on:** strict-mode · critical-analysis · blindspot-analysis
**Status:** completed 2026-09-03 — 13 Qs · 2 blindspot probes (1 confirmed: multi-platform join) ·
2 contradictions resolved (D-002/Q4, D-005/Q6 → D-008) · pre-mortem + devil's advocate done
**Capture location:** this plan file (plan mode; `brainstorms/` copy to be made when plan mode lifts)

### Baseline / current understanding
> Starting hypothesis, not ground truth.
- North star = "beat all living top counsellors" (CEO). No measurable definition of "beat" yet; judges unknown (Q3 open).
- Capture = silent full capture, provenance mandatory, purge later (D-002).
- Backend = Gemini-first, Claude via OAuth, Anthropic optional (D-005).
- Stack = TS monorepo, Python workers (D-003). Sources = TOC, WhatsApp, URLs, meeting bot, watched sites.
- Phase-1 exit = `POST /ask` over 23 TOC sessions with speaker+timestamp citations.

### Summary / key decisions
1. **"Beat" = blind head-to-head, panel-scored, per-counsellor majority over 100+ real questions** (Q1).
2. **Panel is configurable per run** (independent humans / internal / LLM-judges, any mix); only
   independent-human runs count as a public championship result — credibility tier on every run (Q2).
3. **Question bank = TOC Q&A + anonymised Pathlynks questions (APPROVED, PII-stripped, human-reviewed,
   hash-frozen) + counsellor-submitted hard questions** (Q3) → D-007.
4. **Capture is provided-first; silent capture is the last resort**, never the default for sources
   that already share recordings (Q4) → D-008 supersedes D-002's flat wording.
5. **Provider chain is a user-editable ordered list, any length ≥1; Ollama included** (Q5).
6. **Five adapters from day one (Gemini, Anthropic API+OAuth, OpenAI, Ollama, Claude Code), each
   with `listModels()` → per-provider model dropdown; user picks provider+model** (Q6) → D-008 also
   supersedes D-005's "may drop Anthropic API".
7. **D-006 approved: auto-continue maker-checker wiring** (Q7).

### Q&A log

#### Q1 — what "beat" means
- **Asked:** what is compared when the AI beats a counsellor; recommended blind head-to-head on the same
  real student questions, panel-scored on accuracy/completeness/actionability/safety, win = preferred
  >50% per counsellor over 100+ questions.
- **Captured:**
  - **Definition accepted** — blind head-to-head, panel-scored, per-counsellor majority over 100+ Qs.
  - Student-outcome tracking, speed/coverage, and public perception are NOT the win condition
    (they may be secondary metrics).
- **Pushback (pending Q2):** load-bearing assumption = "a panel exists that both sides accept as fair."
  If the counsellors dispute the judges, the win is meaningless. Who is the panel?
- **Flags:** resolved in Q2 (panel is configurable; credibility tier per run).

#### Q2 — who judges / who nominates competitors
- **Asked:** recommended mixed independent panel (2 non-competing senior counsellors + 1 admissions
  officer + calibrated LLM-judge), competitors nominated by a third party.
- **Captured:**
  - **Panel composition is CONFIGURABLE per eval run** — any combination of: mixed independent
    panel · Vidysea internal · one or more LLM-judge models. Not fixed to one design.
  - Design consequence for T-012: `eval_runs.panel = [{kind: human-independent|human-internal|
    llm-judge, ref, weight}]`; results are reported **with the panel config attached**.
- **Pushback (critical lens: cost of being wrong):** configurability hides the credibility question —
  an internal-only or LLM-only panel produces a result that is useful for *training* but is NOT a
  public "win". Proposed rule, captured as recommendation: every run carries a **credibility tier**
  (`internal` / `calibrated-llm` / `independent-human`) and only `independent-human` runs may be
  called a championship result. Umesh's answer did not object; treat as accepted-by-default, to
  confirm at final pass.
- **Flags:** who nominates the "top counsellors" was not answered → stays open.

#### Q3 — question bank sources + student-data approval
- **Asked:** recommended (a) TOC/webinar Q&A segments, (b) anonymised Pathlynks session questions
  with explicit approval + PII stripping, (c) 20 hard questions submitted by each competing counsellor.
- **Captured:**
  - **All three sources approved.** **Pathlynks student questions are APPROVED for the eval bank,
    conditional on anonymisation** — this is the explicit per-use approval the AIOS rules require;
    to be recorded as a DECISIONS entry (D-007 candidate) with the PII-stripping rule attached.
  - Synthetic LLM-generated questions rejected as the primary bank.
- **Pushback (critical lens: hidden dependency):** "anonymised" is doing heavy lifting — a question
  like "my daughter got 78% in CBSE and wants Ashoka, will the Pathlynks scholarship cover it" is
  identifying even with the name removed. Rule to write into D-007: strip names, schools, exact
  scores/dates → bucketed ranges; a human reviews the bank once before it is frozen; the frozen
  bank gets a content hash so results are comparable across runs.
- **Flags:** who owns the one-time human review of the bank (Umesh? counsellor team?) — open.

#### Q4 — ban scenario / when silent capture is used at all
- **Asked:** recommended per-community kill switch (purge media, keep derived claims), CEO owns the
  relationship, never silently record an existential community (TOC) until an alternative source exists.
- **Captured (Umesh, near-verbatim):** "Hum kabhi bhi claim nahi lenge jo TOC and all already
  recording provide kar rahe hain… agar alternative source se recording mil rahi hai to hum extra
  effort nahi maarenge — **silent capture should be our final possible weapon / last root**. Agar
  alternative method se saara data mil raha hai to alternative method hi use karna chahiye. TOC proper
  recording de raha hai to hum kyon apne tokens waste karein."
  - **Rule (load-bearing, REFINES D-002):** capture mode is **provided-first**: (1) organizer-provided
    recording → ingest; (2) public/YouTube → ingest; (3) attendee notes/live transcript; (4) **silent
    capture only when no alternative exists**. Silent capture is a per-source fallback, never the
    default path for TOC.
  - Design consequence: `consent_policies` default stays `silent-full` as the *capability*, but the
    **source adapter's `fetch()` must try provided/public paths first and log which path was used**;
    `sources.captureMode ∈ {provided, public, notes, silent}` becomes a required field.
- **Pushback (critical lens: internal consistency):** D-002 as written says "silent full capture" flat.
  Umesh's answer makes it a fallback → **D-002 needs a superseding entry (D-008 candidate)** stating
  provided-first + fallback, not a silent edit. Logged in Contradictions tracker.
- **Flags:** kill-switch / purge-media-keep-claims on discovery was not explicitly confirmed — carry as
  recommended default, confirm at final pass. Who is the "existential community" list owner — open.

#### Q5 — provider fallback when Gemini runs dry
- **Asked:** recommended fixed chain gemini → claude-code → park-as-gap-row, never silent drop, daily
  tokens-remaining notice.
- **Captured (Umesh):** "Fallback **dynamic** hona chahiye — main apne hisaab se kuch bhi laga paaun
  (Ollama laga diya, uske baad Claude Code…). It should not be 1, 2 fixed. Kya pata main bas ek hi
  laga raha hoon, mujhe pata hai aaj mere paas tokens already rahenge."
  - **Rule:** the provider chain is a **user-editable ordered list**, not hardcoded — `config/
    ai-routing.yaml` per `jobKind`: `providers: [gemini, ollama, claude-code, …]`, length 1..n; adding a
    provider = adding an adapter file + a list entry, no code change elsewhere. **Ollama (local
    models) is a required adapter** from the outset, not "later".
  - Umesh did not object to "never silently drop → park as gap row" → carried as default.
- **Pushback (critical lens: counterexample):** a single-provider chain with a stale key at 2 a.m.
  during a 23-session backfill = the whole run parks. Acceptable to Umesh ("mujhe pata hai tokens
  rahenge") — captured as an accepted operational risk, mitigated by the gap-row + notice, not by
  forcing a second provider.
- **Flags:** whether Ollama-served models are quality-adequate for claim extraction — untested; goes
  to the parity test in T-019 (Gemini ↔ Claude Code ↔ Ollama on 3 fixture sessions).

#### Q6 — (blindspot probe, operational) unattended jobs + who runs it
- **Asked:** who re-logs in when Claude Code's OAuth expires at 2 a.m.; who runs the system day-to-day;
  recommended Claude Code interactive-only, unattended work on key-based providers.
- **Captured (Umesh):** "Sirf ek AI pe dependency mat banao — fallback method chahiye. Claude Code
  bhi rakhna hai **aur** API-key-driven system bhi (Gemini SDK / Anthropic SDK / OpenAI / Ollama —
  whatever you find best). Koi bhi AI tool sirf ek model se nahi chalega. Gemini, OpenAI, Ollama API,
  Anthropic Max login — **rotate kar paayen**. Aur jis provider ko choose kiya, **dropdown mein uske
  saare models ke versions aa jaayen** (Anthropic login → Anthropic ke models; Gemini → Gemini ke
  saare models) aur user choose kare kaunsa model run karna hai."
  - **Rules (load-bearing, EXTENDS D-005):** (1) `packages/ai` ships **five** adapters from the
    start — `gemini`, `anthropic` (API key **and** OAuth/Claude-Code modes), `openai`, `ollama`,
    `claude-code`; D-005's "Anthropic optional/off by default" becomes "**present, selectable**".
    (2) Each adapter exposes `listModels()` (live from the provider where an API exists; static
    manifest for Claude Code) so the UI/CLI can render a **model dropdown per provider**. (3) User-
    level provider+model selection persists as a preference; per-`jobKind` defaults live in
    `config/ai-routing.yaml`. (4) Rotation = editing the ordered list (Q5).
- **Pushback (critical lens: internal consistency):** D-005 said Anthropic API "optional / may be
  dropped"; Q6 says every provider must be present and rotatable. Resolution: D-005's *Gemini-first
  default* stands; the "may drop Anthropic API" clause is superseded (goes into the same D-008
  supersession as Q4). Logged in Contradictions tracker.
- **Blindspot status:** the *who-runs-it* half was **not answered** (Umesh answered the dependency
  half). Carry as open flag; recommended default (Claude Code interactive-only, unattended work on
  key-based providers) stands until he says otherwise.
- **Flags:** ☐ day-to-day operator + OTP mailbox owner · ☐ OpenAI account exists? (no key in .env)

#### Q7 — D-006: maker-checker auto-continue wiring (enforcement path)
- **Asked:** approve D-006 so sessions opening this repo with pending qa/ state resume the loop
  automatically (session-start directive + PreToolUse commit guard + CLAUDE.md block).
- **Captured:** **APPROVED — "Approve D-006 — install auto-continue wiring"**, full option (directive
  + commit guard). To be written via `scripts/append_decision.ps1` with `Approved-by: Umesh` and
  `Changes-authorized: .claude/CLAUDE.md, .claude/hooks/*, .claude/settings.json` once plan mode
  lifts; then `/maker init` repair (idempotent) installs it. Closes ISS-005.
- **Pushback (critical lens: reversibility):** hooks that auto-fire on every session start are a
  one-line change to remove (`/maker pause` writes `qa/.paused`; deleting the settings entry disables
  the directive) — reversible. No further probe needed.
- **Flags:** none.

#### Q8 — (stakeholder probe) Vidysea's own counsellors
- **Asked:** are in-house counsellors users, panel, competitors, or the ones replaced; recommended
  copilot-first + internal panel, external counsellors compete.
- **Captured:** **Copilot first, internal panel; external counsellors compete.** The AI is not
  positioned to replace the in-house function; the in-house team is the first adopter and the
  feedback loop.
  - Design consequence: the first user-facing surfaces are the *counsellor-facing* ones — Meeting
    Preparation Brief (C12), `/ask` during a session (C2/C3), speaker follow-up ("who said this →
    contact") — before any student-facing avatar (C14). Reorders Phase 3/5 priorities: **C12 + C2
    move ahead of C13/C14.**
- **Pushback (critical lens: second-order):** if the copilot makes in-house counsellors visibly
  better-cited, the external "top counsellors" have less incentive to enter a public contest they
  may lose. Mitigation to note for the championship design: entry incentive (prize, co-branding,
  "AI + you" hybrid category) — parked as an open flag for the event plan (T-014).
- **Flags:** ☐ championship entry incentive for external counsellors.

#### Q9 — first milestone
- **Asked:** recommended `/ask` over 23 TOC sessions, cited, in ~2 weeks, before bot/URL/UI.
- **Captured:** **"Meeting bot recording a live session first."** The capture wow-factor leads; the
  brain follows. Deadline not stated.
  - **Resequencing consequence (material):** T-024 (Vexa bot) moves from "Phase A" to the **first
    feature unit after the foundation**, ahead of T-002/T-004b/T-005b. Its true dependencies are
    only the STT seam (T-019, audio part) + the `recording` source adapter (T-020) + the schema fields
    it writes (T-018: `sources.captureMode`, `media.retention`). The design-first gate (T-016/T-017)
    still holds — the bot is built *inside* the monorepo, not as a side script.
  - Minimum demo path: **T-016 → T-017 → T-018 (bot-relevant fields only) → T-019 (STT seam +
    Gemini/Whisper adapters) → T-020 (recording adapter) → T-024 (Vexa join + record + diarize →
    turns in DB)**. `/ask` (T-005b) comes after.
- **Pushback (critical lens: internal consistency with Q4):** Q4 says silent capture is the *last
  resort* and TOC already provides recordings → the first live-capture demo must target a community
  that does **not** provide recordings (e.g. Guiding Teens), or a Vidysea-internal meeting, **not a
  TOC session**. Otherwise the demo itself violates the provided-first rule. Raised as Q10.
- **Flags:** ☐ deadline for the first live capture · ☐ target community/meeting for it.

#### Q10 — first live-capture target + deadline
- **Asked:** recommended internal meeting first (~10 days after foundation), then Guiding Teens; not TOC.
- **Captured:** **"Any meeting link I paste, when it's ready."** No fixed target, no fixed date —
  the acceptance test is *ad hoc*: Umesh pastes a link, the bot joins, records, diarizes, turns land
  in the DB with speaker + timestamp.
  - Design consequence: T-024's exit test = a **paste-a-link CLI** (`lkb capture <meeting-url>`)
    producing `sources` + `sessions` + `turns` rows with `captureMode` logged, verified on any
    platform Vexa supports (Meet/Zoom/Teams). No calendar (T-025) needed for the demo.
- **Pushback (critical lens: consistency with Q4):** "any link" includes TOC links. Rule carried
  from Q4 stands: the adapter checks `provided-first` — if the source is a community that provides
  recordings, the CLI **warns and asks to confirm** before joining silently (a soft gate, not a
  block, since Umesh explicitly wants freedom). Vague deadline captured as a flag, not a resolution.
- **Flags:** ☐ no deadline — strict-mode note: "when it's ready" cannot be scheduled; foundation
  ETA (T-016→T-020) is the de-facto clock.

- **D-005 vs Q6:** D-005 "Anthropic API optional, may be dropped" vs Q6 "every provider present and
  rotatable, incl. Anthropic SDK". Resolution: Gemini-first default stays; drop-clause superseded in
  D-008; adapters for all five providers are in scope for T-019.

### Blindspot probes
#### Blindspot probe — operational (after Q5)
- **Probed:** who re-logs in at 2 a.m. when the OAuth token expires; who runs the system day-to-day.
- **User's response:** answered the *single-provider dependency* risk decisively (multi-provider
  rotation + model dropdown); did not name an operator.
- **Resolution:** dependency half → design rules in Q6. Operator half → **open flag**, default =
  Umesh interactive-only for Claude Code, key-based providers for unattended jobs.

#### Blindspot probe — edge cases / hidden dependency (raised by Umesh after Q11)
- **Probed (Umesh):** "Meeting link Zoom ho sakta hai, Google Meet, ya koi aur platform — sab ke
  hisaab se bana paayega? System itna dynamic aur use-case-wise hona chahiye."
- **User's response:** the requirement itself — platform-agnostic join.
- **Resolution — Blindspot confirmed (it was implicit, not designed):** T-024 gets a **platform
  adapter layer**: `detectPlatform(url) → {meet, zoom, teams, webex, unknown}` → join strategy:
  (1) **Vexa** for the platforms it natively supports (Google Meet, Microsoft Teams — verified from
  its docs; **Zoom support must be verified before T-024's contract is written — open flag**);
  (2) **generic web-client join** via the system-owned Playwright persistent profile for Zoom/
  Webex/unknown links that expose a browser join page; (3) **universal fallback = local system-audio
  capture** of whatever is playing (works for any platform, no join automation, weakest
  diarization). Every capture logs `platform` + `joinStrategy` on `sources`. Contract criterion for
  T-024: at least Meet + one non-Vexa platform demonstrated via the paste-a-link CLI.
- **Flags:** ☐ verify Vexa Zoom support · ☐ Zoom web-client join reliability with a bot profile
  (Zoom often forces the desktop app) — spike before contracting.

### Contradictions tracker
- **D-002 vs Q4:** D-002 records "silent full capture" as THE mode; Q4 says it is the last resort behind
  provided/public/notes. Resolution: D-002 stands as the *capability* decision; a superseding D-008
  records the **provided-first ordering** as policy. Both written by Umesh; no re-litigation needed.

### Blindspot probes
(see entries appended below the Q&A log)

### Contradictions tracker
(see entries appended below the Q&A log)

### Open flags
- ☐ Q3: who are the "top counsellors" and who judges?
- ☐ Purge-after-processing level (deferred by Umesh)
- ☐ Product name

### Pre-mortem
- **Umesh (Q11, verbatim):** "all of the above" — capture dried up · answers not trusted · built too
  much / shipped too little · one-person dependency. Strict-mode note: unranked; treated as four
  co-equal failure modes, each needing a named mitigation in the plan:
  1. Capture dries up → provided-first + watched sources + gap rows keep the intake visible (T-006,
     T-027); "sources fed this week" becomes a dashboard KPI (D1).
  2. Answers not trusted → no fact without `turnId`; review queue; citations open-rate as KPI (C4, C7).
  3. Built too much → Q9/Q10 already cut the first demo to paste-a-link capture; hard rule: **no
     unit starts without a user-facing exit test**.
  4. One-person dependency → D-006 auto-continue + SNAPSHOT (§6d) + runbook flag from Q6.
- **Grill's two failure modes NOT in Umesh's list (surfaced Q12):**
  - **F5 — the verifier never gets calibrated.** No independent panel is assembled, the LLM-judge
    never reaches MAE ≤ 0.5, so "winning" is never provable and the championship never happens —
    the project succeeds as a copilot and fails at its north star.
  - **F6 — provenance rot via purge.** Recordings are purged (D-002) *before* claims are verified;
    later, a disputed claim cannot be traced to audio → the "who said what, when" promise breaks
    exactly when it matters (an expert disputes a quote).
- **Q12 — Umesh (after a plain-language explanation): "Haan, dono ilaaj lagao."** Both mitigations
  ACCEPTED:
  - **F5 →** T-012 (eval harness) moves **into Phase 1b, alongside the first `/ask`**; first panel =
    in-house counsellors (Q8); a small daily scorecard, not a one-off event. Unblocks T-012 from Q3
    (judges) for the *internal* tier — external panel still needed for a public result.
  - **F6 →** purge is **gated**: media may be deleted only when every claim citing it has status
    `verified`; and an **evidence clip (±15 s) per cited turn is retained permanently** in `media`
    with `kind: evidence-clip`. Goes into T-018 (`media.retention` + `media.kind`) and T-026's
    definition. D-002's "purge after processing" is refined accordingly (D-008).

**Devil's advocate (Q13) — attack on the north star:** "the public championship is a benchmark stunt;
Goodhart risk (AI learns to please judges), no entry incentive for rivals, judge not calibrated (F5),
public loss burns the communities that feed the brain — keep the copilot + an internal bar."
**Defense (Umesh): "Market proof / brand — it's the CEO's moat claim."** A public, verifiable win is
what makes students, parents and universities trust the AI over any human counsellor; an internal
bar convinces nobody outside. **Holds.** Captured constraints that survive the attack: (a) the win
must be *verifiable* → independent-human credibility tier (Q2) is non-negotiable for the public run;
(b) Goodhart guard → the rubric is owned by the panel, not by Vidysea, and the question bank is
frozen + hashed before the AI sees it (Q3); (c) internal winning streak is a *gate* to going public,
not a substitute for it.

### Next moves (execute when plan mode lifts, in this order)
1. **DECISIONS entries via `append_decision.ps1`** (pure ASCII): **D-006** auto-continue wiring
   (`Approved-by: Umesh`, Changes-authorized = enforcement paths) · **D-007** Pathlynks questions
   approved for the eval bank with the PII-stripping + human-review + hash-freeze rule · **D-008**
   supersedes D-002 wording ("provided-first; silent capture = last resort; purge gated on verified
   claims + ±15 s evidence clips retained") and D-005's "may drop Anthropic API" clause (five
   adapters, user-editable chain, `listModels()` dropdown).
2. **`/maker init` repair** → installs the D-006 wiring (idempotent).
3. **Re-dispatch checker** for ISS-004 (+ sweep scribe) — now unblocked.
4. **Copy this Grill log** to `D:\KnowledgeBase\brainstorms\2026-09-03-lkb-counsellor-assumptions.md`
   (the skill's canonical path) and reference it from `docs/DECISIONS.md` D-008 **Links**.
5. **Re-sequence TASKS.md / goal.json** per Q9/Q10/Q12: after foundation (T-016→T-020), **T-024
   paste-a-link capture** (with platform-adapter layer + provided-first soft gate) is the first
   feature unit; **T-012 eval harness (internal tier)** runs alongside T-005b; C12/C2 ahead of C14.
   T-019 scope: five provider adapters + `listModels()` + STT seam.
6. **Spikes before contracts:** Vexa Zoom support · Zoom web-client bot join · Ollama quality on
   claim extraction.
7. **Open flags to close with Umesh (not blocking):** who nominates external top counsellors ·
   who reviews the frozen question bank · day-to-day operator + OTP mailbox · OpenAI account ·
   championship entry incentive · first-capture deadline · product name.
8. Re-grill in ~4 weeks (after T-024 demo) — Q9/Q10 answers are the most likely to move.

