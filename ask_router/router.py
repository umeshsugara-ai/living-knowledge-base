"""
ask_router/router.py — the CRAG-style /ask flow (T-005).

ask(query, tree, tree_search_fn, score_fn, web_fallback_fn=None, upper=0.7, lower=0.3) ->
  {
    "verdict": "correct" | "ambiguous" | "incorrect",
    "reason": str,                         # why that verdict (thresholds cited)
    "scored": [{node, score, reason}],     # audit trail: every candidate's score + reason
    "web_used": bool,
    "insufficient_coverage": bool,         # True only when verdict != correct AND no web fallback ran
    "sources": {"internal": [...], "web": [...]},   # kept separate, never merged
  }

Internal-first, web-fallback-only-when-needed (ARCHITECTURE.md §2.2 / H2). `tree_search_fn`
is expected to already have picked candidate nodes (the LLM-reasoning step lives outside
this module); this router only evaluates + routes.
"""
from __future__ import annotations

from typing import Callable, Optional

try:  # package import (import ask_router.router) …
    from .evaluator import evaluate, ScoreFn, UPPER_THRESHOLD, LOWER_THRESHOLD
except ImportError:  # … or script-style import (python ask_router/test_router.py)
    from evaluator import evaluate, ScoreFn, UPPER_THRESHOLD, LOWER_THRESHOLD

TreeSearchFn = Callable[[dict, str], list[dict]]
WebFallbackFn = Callable[[str], list[dict]]


def _internal_source(node: dict) -> dict:
    src = {"node_id": node["node_id"]}
    evidence = node.get("evidence")
    if evidence:
        src["evidence"] = evidence
    return src


def _result(evaluation: dict, web_used: bool, insufficient: bool, web_results: list) -> dict:
    return {
        "verdict": evaluation["verdict"],
        "reason": evaluation["reason"],
        "scored": evaluation["scored"],
        "web_used": web_used,
        "insufficient_coverage": insufficient,
        "sources": {
            "internal": [_internal_source(n) for n in evaluation["good_docs"]],
            "web": list(web_results),
        },
    }


def ask(
    query: str,
    tree: dict,
    tree_search_fn: TreeSearchFn,
    score_fn: ScoreFn,
    web_fallback_fn: Optional[WebFallbackFn] = None,
    upper: float = UPPER_THRESHOLD,
    lower: float = LOWER_THRESHOLD,
) -> dict:
    candidates = tree_search_fn(tree, query)
    evaluation = evaluate(query, candidates, score_fn, upper=upper, lower=lower)

    if evaluation["verdict"] == "correct":
        # Internal-first is enforced here, not just possible: a correct verdict never
        # touches web_fallback_fn even if the caller supplied one.
        return _result(evaluation, web_used=False, insufficient=False, web_results=[])

    if web_fallback_fn is None:
        return _result(evaluation, web_used=False, insufficient=True, web_results=[])

    return _result(evaluation, web_used=True, insufficient=False,
                   web_results=web_fallback_fn(query))
