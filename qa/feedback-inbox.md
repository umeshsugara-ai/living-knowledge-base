# Feedback inbox — verbatim user feedback, timestamped. Any session may append; checker folds in.

## 2026-09-03 — Umesh (chat, mid-session, verbatim intent) — folded 2026-09-03 (partial: design-first→T-016 via monorepo-restructure.md amendment log; bot/URL/seam await contracts T-017..T-025)
- "AUR SABSE important iska schema essaa rakhna jo scalable ho and system design ko bhi phle plan krr le properly ... DRY principle use ho ... ERP me schema aur system design decide nahi hua tha, cloud code itne zyada tokens kharch hota hai just for holding the context, code repeated hai, human engineer control nahi le paata — aisa nahi hona chahiye." → design-first gate (plan §6a), monorepo + CI budgets (§6c.1).
- "live meeting join karne ke liye meeting ka bot hoga ... meeting ka URL daalu, dedicated system ke paas apna chrome browser ho, mere via / user as a user join kare, apne aap calendar dekh ke directly join kare, meeting khud record kare ... hum paid member hain ... recording provide nahi karte to hum apne liye rakh rahe hain taaki manual review ho sake" → meeting bot + calendar + vault (A10/A11, T-024/T-025).
- "URLs daalein to wahan se data properly aa jaye" → URL ingestion (T-023).
- "market me free products hain to unko API ke through integrate karein" → market scan done (§6c.2).
- "AI API-based hoga ya cloud code hamara Max subscription ke through — dono ka system day one se integrate karega" → provider seam (T-019).
- DECISIONS (AskUserQuestion answers): consent = **silent full capture** with full diarization + who/when provenance so team can follow up with the expert; recordings purged after processing (purge design deferred). Stack = **TS pnpm monorepo, Python ML workers**. Bot = **self-host Vexa + Whisper, pluggable STT so a Gemini 3.5-transcribe key can be preferred**. Backend = **Gemini-first (purchased tokens, Google-side budget), Claude via the `claude` CLI OAuth email→OTP login flow, Anthropic API optional/droppable; no budget-guard work now — features first.**

## 2026-09-03 (later) — Umesh, mid-session + /grill outcomes — folded 2026-09-03 (sweep, no commit needed: TOC/whatsapp_msg-as-sources already covered by qa/contracts/ingestion-source-seam.md naming a future `whatsapp` adapter + TASKS.md T-002/T-007; A13/Watched Sources already present as T-027 in TASKS.md)
- "TOC wali directory, WhatsApp wali directory — ye sab as a feature aayenge right?" → yes: raw/TOC = recording/document adapters + T-002; sources/whatsapp_msg = A8/A9 + T-007.
- "Google search bhi hoga… important websites bookmark kar paayen, update hone par track ho ke knowledge pool update ho jaye — reputed websites ka content gold hai; headers / landing pages bhi" → A13 Watched Sources, T-027 (depends T-023).
- "Meeting link Zoom / Google Meet / koi aur platform — sab ke hisaab se bana paayega? system dynamic, use-case wise" → T-024 platform-adapter layer (Vexa for Meet/Teams; browser-profile join for Zoom/others; system-audio universal fallback). Flags: verify Vexa Zoom support; Zoom web-client bot join spike.
- Grill decisions (see brainstorms/2026-09-03-lkb-counsellor-assumptions.md): "beat" = blind head-to-head panel-scored; configurable panel w/ credibility tier; Pathlynks questions approved anonymised (D-007); provided-first capture, silent = last resort, gated purge + evidence clips (D-008); five providers + listModels dropdown, user-editable chain (D-008); D-006 approved; first demo = paste-a-link capture on any platform; eval harness (internal tier) alongside first /ask; copilot for in-house counsellors first (C12/C2 before C14).

## 2026-09-03 (later) — Umesh, scope correction on T-012/T-014 (compete screen) + priority — folded 2026-09-03 (sweep, no contract to amend: no T-012 contract exists yet, so TASKS.md's wording — commit b489089 — is the source of truth for now; correctly reflects the re-scope and T-009-before-T-010/T-028 priority)
- "Ye sab tho manually hoga naa iske liye — ek screen bana denge jahan counsellor details milegi.
  Dont take it too much. Ek screen mein hogi 'compete wali' aur usme counsellor basic details
  daal ke start kar payenge." → the eval-harness/championship UI is scoped WAY down: ONE simple
  manual-entry screen (counsellor name/basic details -> start a compete run), NOT a platform.
  No self-serve counsellor onboarding, no fancy panel management UI right now.
- "Main cheez ye dekh abhi ki knowledge base kaise banega, aur phir developers ko API deni hogi
  for virtual counsellor and all — vo log API hit karenge. Baad mein counsellor ka user
  management karenge, tho baad mein dekh lenge." → priority order restated: (1) knowledge base
  build (current work) (2) Developer API so external devs/the counsellor client can hit it
  (3) counsellor user-management/accounts — explicitly deferred, not now.

## 2026-09-03T11:02:09Z — Umesh, mid-session (GEMINI_API_KEY fix) — reinforces existing design, no new build needed
- "aur humko tho system adaptive banana hai naa, like langchain ki koi bhi api key chal jaaye
  ya phir anthropic ho toh sab chal jaaye easy fallback se" → system should be adaptive: any
  provider's API key should work, with easy fallback if e.g. Anthropic fails. This is ALREADY
  the design (D-008/T-019): five provider adapters (gemini/anthropic/openai/ollama/claude-code)
  behind one `Provider` interface, `config/ai-routing.yaml`'s per-jobKind ORDERED chain, and
  `packages/ai/src/router.ts`'s `complete()` tries each provider in order, records every attempt
  to the `jobs` ledger, only throws `AllProvidersFailedError` if every provider in the chain
  fails. No contract amendment needed — confirms the existing fallback architecture is the right
  call, not a new requirement.
