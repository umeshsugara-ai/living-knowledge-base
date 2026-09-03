# Verdict — T-005-ask-router

**Date:** 2026-09-03
**Contract:** qa/contracts/ask-router.md
**Manifest:** qa/manifests/T-005-ask-router.md (Status: ready-for-check, Fix cycle: 2 of max 3)
**Cycle checked: 2**
**Checker:** /checker Mode A, fresh subagent, bound to D:\KnowledgeBase (default coding adapter — no qa/adapter.json). Artifact commit: 8d2fd37.
**Prior:** cycle 1 FAIL (ISS-001, ISS-002, ISS-003) — this cycle claims all three fixed.

## Re-run (my own execution, not the maker's paste)
- `python ask_router/test_router.py` → exit 0, `PASS: 6/6 test(s) passed.` — matches manifest.
- `python -c "import ask_router.router"` from project root → exit 0, no ModuleNotFoundError (ISS-003 refuted).
- `inspect.signature(evaluate)` → `(query, candidates, score_fn, upper: float = 0.7, lower: float = 0.3) -> dict` (ISS-001 refuted).
- `inspect.signature(ask)` → `(..., web_fallback_fn=None, upper=0.7, lower=0.3)` — pass-through present.
- Independent probe (not in maker's tests): scores {a:0.95, b:0.5, c:0.1} with web supplied → verdict `correct`, `sources.internal` = [a, b] (sub-0.3 doc c excluded, 0.5 doc kept — the C2 gotcha holds), `sources.web` = [], result keys include `reason` (ISS-002 refuted). Internal source for `a` carries `evidence.sessionRef`. Web list identity-preserved (`is` check True) → verbatim per C5. Empty candidates → `incorrect` with reason "no candidates". `upper=1.5` → ValueError.

## Criteria
| # | Criterion | Result | Evidence |
|---|---|---|---|
| C1 | evaluator.py exports evaluate(query, candidates, score_fn) → {scored, good_docs, verdict} | MET | evaluator.py:32-71; positional 3-arg call still works (test_router.py:118, 125) |
| C2 | CRAG defaults 0.7/0.3, good_docs >= 0.3 regardless of verdict, tunable via parameters | MET | evaluator.py:36-37 kwargs, :48-49 validation, :56-69 logic; test_router.py:123-142 (default/stricter/looser/via ask/invalid); my gotcha probe above |
| C3 | router.py ask(...) : tree_search → evaluate → internal-only on correct / web on ambiguous+incorrect, sources split | MET | router.py:53-74, _result :39-50; tests 1-3 |
| C4 | No web_fallback_fn + verdict != correct → insufficient_coverage: True | MET | router.py:70-71; test 4 |
| C5 | sources.internal carry node_id (+ evidence when present); sources.web verbatim | MET | router.py:31-36, :48 `list(web_results)` — items untouched (identity probe); tests 1-3 |
| C6 | Verdict + score + reason always returned, incl. correct | MET | evaluator.py:55 per-candidate reason, :60-71 verdict reason; router.py:41-43 surfaces both; test_router.py:103-120 |
| C7 | test_router.py exits 0 covering (a)(b)(c)(d) | MET | Re-run exit 0, 6/6; tests :30-100 map 1:1 to (a)-(d), incl. call-count assertion for (a) |

Invariants: contract declares none (0/0).

## Issues addressed (manifest claims ISS-001, ISS-002, ISS-003)
- ISS-001 → **verified** (signature + tests + pass-through re-derived above).
- ISS-002 → **verified** (`reason` at top level and per scored entry on a `correct` call, re-derived).
- ISS-003 → **verified** (package import from project root exits 0; script-style run still works).
Ledger rows flipped `open → verified` with verified_date 2026-09-03 (single-cycle flip: the cycle-1 checker never recorded `fixed`; the maker's fix commit 8d2fd37 + this re-check together constitute fix + verification).

Note (not a finding): working tree shows `qa/manifests/T-005-ask-router.md` modified after commit dc4f156 — maker's surface, judged as on disk.

## Verdict block
```
VERDICT: PASS
SCOREBOARD: 7/7 criteria met, 0/0 invariants hold
FAILURES: none
ISSUES-WRITTEN: none
EXPLANATION: All three manifest verify commands reproduce exactly under my own run (6/6 tests, package import OK, parameterised signature). The two cycle-1 contract gaps — tunable thresholds and a reason on every call — are now present in code and asserted by tests, and an independent probe confirms the CRAG sub-0.3 exclusion on a correct verdict plus verbatim web sources. ISS-001/002/003 closed as verified.
```
