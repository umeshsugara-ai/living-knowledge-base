"""
ask_router/router.py — the CRAG-style /ask flow (T-005).

ask(query, tree, tree_search_fn, score_fn, web_fallback_fn=None) ->
  {
    "verdict": "correct" | "ambiguous" | "incorrect",
    "scored": [...],                       # audit trail: every candidate's score + reason
    "web_used": bool,
    "insufficient_coverage": bool,         # True only when verdict != correct AND no web fallback ran
    "sources": {"internal": [...], "web": [...]},   # kept separate, never merged
  }

Internal-first, web-fallback-only-when-needed (ARCHITECTURE.md §2.2 / H2). `tree_search_fn`
is expected to already have picked candidate node_ids (the LLM-reasoning step lives outside
this module, e.g. via tree_index.tree_search); this router only evaluates + routes.
"""
from __future__ import annotations

from typing import Callable, Optional

from evaluator import evaluate

TreeSearchFn = Callable[[dict, str], list[dict]]
ScoreFn = Callable[[str, dict], float]
WebFallbackFn = Callable[[str], list[dict]]


def _internal_source(node: dict) -> dict:
    src = {"node_id": node["node_id"]}
    evidence = node.get("evidence")
    if evidence:
        src["evidence"] = evidence
    return src


def ask(
    query: str,
    tree: dict,
    tree_search_fn: TreeSearchFn,
    score_fn: ScoreFn,
    web_fallback_fn: Optional[WebFallbackFn] = None,
) -> dict:
    candidates = tree_search_fn(tree, query)
    result = evaluate(query, candidates, score_fn)
    verdict = result["verdict"]

    if verdict == "correct":
        # Internal-first is enforced here, not just possible: correct verdict never
        # touches web_fallback_fn even if the caller supplied one.
        return {
            "verdict": verdict,
            "scored": result["scored"],
            "web_used": False,
            "insufficient_coverage": False,
            "sources": {
                "internal": [_internal_source(n) for n in result["good_docs"]],
                "web": [],
            },
        }

    if web_fallback_fn is None:
        return {
            "verdict": verdict,
            "scored": result["scored"],
            "web_used": False,
            "insufficient_coverage": True,
            "sources": {
                "internal": [_internal_source(n) for n in result["good_docs"]],
                "web": [],
            },
        }

    web_results = web_fallback_fn(query)
    return {
        "verdict": verdict,
        "scored": result["scored"],
        "web_used": True,
        "insufficient_coverage": False,
        "sources": {
            "internal": [_internal_source(n) for n in result["good_docs"]],
            "web": list(web_results),
        },
    }
