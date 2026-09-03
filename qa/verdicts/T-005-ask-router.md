# Verdict — T-005-ask-router

**Date:** 2026-09-03
**Contract:** qa/contracts/ask-router.md
**Manifest:** qa/manifests/T-005-ask-router.md (Status: ready-for-check)
**Cycle checked: 1**
**Checker:** /checker Mode A, fresh subagent, bound to D:\KnowledgeBase (default coding adapter — no qa/adapter.json)

## Re-run (my own execution, not the maker's paste)
- `python ask_router/test_router.py` → exit 0, `PASS: 4/4 test(s) passed.` — matches manifest.
- `python -c "import ask_router.router"` from project root → `ModuleNotFoundError: No module named 'evaluator'` (extra probe, see ISS-003).
- `inspect.signature(evaluate)` → `(query, candidates, score_fn)` — no threshold parameters.
- `ask('q', {}, ..., score 0.9)` result keys → `insufficient_coverage, scored, sources, verdict, web_used`; `scored` entries = `{node, score}` — no `reason`.

## Criteria
| # | Criterion | Result | Evidence |
|---|---|---|---|
| C1 | evaluator.py exports evaluate(query, candidates, score_fn) → {scored, good_docs, verdict} | MET | evaluator.py:20-45 |
| C2 | CRAG defaults (0.7 / 0.3), good_docs >= 0.3 regardless of verdict, **tunable via parameters** | **NOT MET** | Threshold logic correct (evaluator.py:34-43, incl. empty→incorrect). But thresholds are module constants (lines 14-15); neither `evaluate` nor `ask` accepts them. "Tunable via parameters" is unevidenced. ISS-001 |
| C3 | router.py ask(...) : tree_search → evaluate → internal-only on correct / web on ambiguous+incorrect, sources.internal + sources.web separate | MET | router.py:43-83; tests 1-3 |
| C4 | No web_fallback_fn + verdict != correct → insufficient_coverage: True | MET | router.py:61-71; test 4 |
| C5 | sources.internal carry node_id (+ evidence when present); sources.web verbatim | MET | router.py:28-33, 81 (`list(web_results)` — untouched items); tests 1-3 |
| C6 | Verdict + score + **reason** always returned | **NOT MET** | No `reason` field anywhere in result or scored entries; router.py:7 docstring promises it but code never produces it. ISS-002 |
| C7 | test_router.py exits 0 covering (a)(b)(c)(d) | MET | Re-run exit 0; test_router.py:29-99 maps 1:1 to (a)-(d), incl. call-count assertion for (a) |

Invariants: contract declares none (0/0).
Issues addressed claimed: none — consistent with empty ledger.

## Verdict block
```
VERDICT: FAIL
SCOREBOARD: 5/7 criteria met, 0/0 invariants hold
FAILURES:
- [C2] thresholds hardcoded as module constants, not parameters · add `upper=0.7, lower=0.3` kwargs to evaluate() (and pass-through on ask()) keeping C1's positional signature intact · issue: ISS-001
- [C6] no `reason` returned on any call · attach a per-candidate reason (e.g. let score_fn return float or (float, reason), or derive "score 0.9 >= upper 0.7") to each scored entry and a top-level verdict reason; add an assertion in tests · issue: ISS-002
ISSUES-WRITTEN: ISS-001, ISS-002, ISS-003
EXPLANATION: The routing logic itself is correct and the 4 tests reproduce cleanly under my own run — internal-first is enforced, sources stay split, insufficient_coverage fires. Two auditability/tunability clauses the contract states explicitly (parameterised thresholds, a reason on every call) are simply absent from the code, so this cannot PASS. ISS-003 (non-package import) is a low-severity heads-up for T-009, not a contract failure.
```
