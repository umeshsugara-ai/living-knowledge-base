# U3.1 live Ask proof — evidence summary (2026-09-21)

## Chain proven, live (CDP-driven real Chrome at localhost:5173, work DB lkb_codex_work_20260909)
1. API-key minted via documented flow (`scripts/mint-key.mjs --tenant toc`, label u31-proof-20260921).
2. Browser seeded with the key in localStorage; SPA loaded /ask authenticated.
3. Question typed into the REAL input and the REAL Ask button clicked:
   "What did speakers say about UK student visas?"
4. **ANSWER rendered in the live browser:** "The speakers discussed UKVI's tightened Basic
   Compliance Assessment." — verdict: correct (>= 0.7 upper threshold).
5. INTERNAL SOURCES (1): toc/year:2026/month:08/session:2026-08-03-uk-beyond-offer-letters —
   rendered as a LINK to /sessions/2026-08-03-uk-beyond-offer-letters. WEB SOURCES (0):
   "None — answered from the knowledge base alone." (sources cited separately — the U3.1 core UI condition).
6. Citation click-through: navigating the link renders the REAL session detail (UK: Beyond Offer
   Letters, 2026-08-03, TOC) whose overview text contains the same UKVI Basic Compliance
   Assessment content the answer cites — the citation resolves to the source material.
7. Server-side cross-check (ask-response.json): POST /ask 200, sources.internal[0].node_id
   matches, sources.web = [].
8. HTTP-level parity (clickthrough-session-detail.json): /sessions 200 (23 sessions, cited id
   present), /sessions/:id 200 (46 turns, 2 claims), /citations/:claimId 200.

## Files
- ask-response.json — raw POST /ask response
- ask-answer-cdp.png — live browser screenshot of the answer + citation link
- session-detail-cdp.png — live browser screenshot of the click-through session detail
- clickthrough-session-detail.json — HTTP session detail (46 turns, 2 claims)
- citations.json — /citations/2026-08-03-uk-beyond-offer-letters-c01 response
- cdp-drive.mjs / cdp-probe.mjs / cdp-clickthrough.mjs — the one-off CDP drivers (re-runnable)

## Egress scope honored
Exactly ONE generic Ask question + its internal tree/retrieved candidate context went to Gemini
(egress gate Option A). No other model call. No jobs writes; work DB only.
