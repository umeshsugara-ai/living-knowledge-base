# Real-browser check — 2026-09-09

Run because Umesh asked directly whether the maker/checker loop was actually being validated in a
browser. **The honest answer was no** — this session had shipped ~19 units verified by unit tests,
mutation testing and live Mongo driver probes, and had not opened a browser once. Plan §9 asks for
visible-browser validation and it had not been happening.

Servers: `apps/api` on :3300 (PORT=3300, CORS_ORIGINS=http://localhost:5173), `apps/web` on :5173.

## Found immediately, and only findable this way

**The API defaults to :3000 while `apps/web/.env.development` points at :3300.** Started the normal
way, every dashboard call fails `ERR_CONNECTION_REFUSED` and the page reads
*"failed to load dashboard data"*. 9 console errors. No unit test sees this — both sides are
individually correct.

## After binding the API to :3300 — 0 console errors

| page | result |
|---|---|
| `/` Dashboard | REAL: 26 sessions, 26 sources, 3 API keys, 0 gaps — matches the live Mongo counts exactly. Recent-sessions list shows real titles. |
| `/ask` | REAL end to end. "What did speakers say about UK student visas?" returned a substantive answer (UKVI Basic Compliance Assessment, Enroly CAS Shield, a named speaker's "gym membership" analogy), `verdict: correct`, **1 internal citation to a real session** (`2026-08-03-uk-beyond-offer-letters`), 0 web sources. |
| `/brain` | REAL: radial graph over the actual `tree_index` — session and topic nodes, solid membership edges, dashed inferred edges. |

`ask-answer.png` is the important one: it is the retrieval work of this whole session arriving in a
browser as a cited answer.

## What this does NOT show

- Only 3 of ~10 pages were opened. Sessions, Calendar, Sources, Ingest, Meeting Bot, WhatsApp,
  Settings were not checked.
- No two-tenant browser check.
- The hybrid arms (U1.5 part 2) were NOT exercised here — this ran against the API as configured,
  and the hybrid path's own measurement is a separate, still-open question (ISS-170).
