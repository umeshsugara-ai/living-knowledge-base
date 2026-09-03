"""
ask_router/evaluator.py — CRAG-style retrieval evaluator (T-005).

Scores each candidate tree-index node against the query via an injected `score_fn`
(no vendor/model hardcoded here — a real LLM scorer, a stub, or a test double all satisfy
this seam identically). Thresholds match the CRAG paper defaults (brain page
`corrective-rag-crag`): upper=0.7 ("correct"), lower=0.3 ("incorrect" below, "ambiguous"
between).
"""
from __future__ import annotations

from typing import Callable

UPPER_THRESHOLD = 0.7
LOWER_THRESHOLD = 0.3

ScoreFn = Callable[[str, dict], float]


def evaluate(query: str, candidates: list[dict], score_fn: ScoreFn) -> dict:
    """
    Returns:
      {
        "scored": [{"node": <node>, "score": <float>, }, ...],
        "good_docs": [<node>, ...],   # score >= LOWER_THRESHOLD, regardless of verdict
        "verdict": "correct" | "ambiguous" | "incorrect",
      }
    """
    scored = []
    good_docs = []
    for node in candidates:
        score = score_fn(query, node)
        scored.append({"node": node, "score": score})
        if score >= LOWER_THRESHOLD:
            good_docs.append(node)

    scores = [s["score"] for s in scored]
    if scores and any(s >= UPPER_THRESHOLD for s in scores):
        verdict = "correct"
    elif not scores or all(s < LOWER_THRESHOLD for s in scores):
        verdict = "incorrect"
    else:
        verdict = "ambiguous"

    return {"scored": scored, "good_docs": good_docs, "verdict": verdict}
