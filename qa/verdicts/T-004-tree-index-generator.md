# Verdict — T-004-tree-index-generator
**Date:** 2026-09-03
**Cycle checked:** 1
**Checker:** Mode A unit check (fresh subagent, re-ran all evidence itself)

## Re-run evidence
- `python tree_index/test_build_tree.py` → re-ran: all 4 tests PASS, exit 0
  (`PASS: 4/4 test(s) passed.`) — matches manifest claim.
- `grep -riE "embed|cosine" tree_index/build_tree.py tree_index/tree_search.py` → re-ran:
  no matches (grep exit 1 = no matches found) — matches manifest claim.
- `python -c "...jsonschema Draft202012Validator.check_schema..."` → re-ran: no exception,
  schema valid — matches manifest claim.

## Criteria judged
1. [C1] PASS — `schema/tree_index.schema.json` exists, Draft 2020-12, required fields
   `node_id, title, level, summary, children`; `level` enum includes tenant/year/month/
   session/topic; `evidence.sessionRef` present as optional property.
2. [C2] PASS — `tree_index/build_tree.py` exports `build_tree(sessions, session_pages,
   summarize=None) -> dict`, returns one root node per tenant (`roots[tenant_id]`).
3. [C3] PASS — grep for `embed|cosine` in both module files returns no matches.
4. [C4] PASS — code groups by tenant → year → month → session; test
   `test_grouping_and_nesting` builds a 3-session/3-month fixture and confirms all 3 leaves
   reachable via `tree_search` walking from the tenant root.
5. [C5] PASS — every session node built with `evidence={"sessionRef": session["_id"]}`
   (build_tree.py:91); `test_evidence_on_every_session_node` confirms for all 3 sessions.
6. [C6] PASS — `summarize` is an optional injected callable (build_tree.py:43,81-84);
   fallback to `page["summary"]` or `""` when absent, no network/LLM code path;
   `test_summarize_injection_and_fallback` covers both the fallback and injected-override
   cases.
7. [C7] PASS — `tree_index/tree_search.py` exports `tree_search(tree, node_ids) -> list[dict]`,
   plain depth-first walk, no LLM call inside it.
8. [C8] PASS — `python tree_index/test_build_tree.py` exits 0, 4/4 tests pass, covering all
   four required sub-cases (a)-(d) as re-run above.

## Invariants
- No embeddings/vector math (vectorless-rag rule) — held (grep clean).
- No live LLM/MongoDB/HTTP calls in this unit (non-goals) — held; module is pure, tests run
  with in-memory fixtures only, no imports of network/DB libraries observed in build_tree.py
  or tree_search.py.

## Issues addressed
Manifest claims "none" — no ledger entries to check against.

VERDICT: PASS
SCOREBOARD: 8/8 criteria met, 2/2 invariants hold
FAILURES (if any): none
ISSUES-WRITTEN: none
EXPLANATION: All three verify commands were re-run independently and matched the manifest's
claims exactly. Code inspection confirms grouping/nesting logic, injectable summarize with
correct fallback, evidence.sessionRef on every session node, and a pure tree_search lookup
with no reasoning/LLM/network code anywhere in the module. Tests exercise all required
sub-cases. No embeddings or similarity code present.
