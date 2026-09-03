"""
ask_router/evaluator.py — CRAG-style retrieval evaluator (T-005).

Scores each candidate tree-index node against the query via an injected `score_fn`
(no vendor/model hardcoded here — a real LLM scorer, a stub, or a test double all satisfy
this seam identically). Thresholds default to the CRAG paper values (brain page
`corrective-rag-crag`): upper=0.7 ("correct"), lower=0.3 ("incorrect" below, "ambiguous"
between) — and are tunable per call via `upper` / `lower`.

`score_fn(query, node)` may return either a bare float in [0, 1] or a `(score, reason)`
tuple; a bare float gets an empty reason. Every call returns a per-candidate reason and a
top-level verdict reason so the decision is auditable (ARCHITECTURE §2.2).
"""
from __future__ import annotations

from typing import Callable, Union

UPPER_THRESHOLD = 0.7
LOWER_THRESHOLD = 0.3

ScoreResult = Union[float, tuple[float, str]]
ScoreFn = Callable[[str, dict], ScoreResult]


def _normalize(result: ScoreResult) -> tuple[float, str]:
    if isinstance(result, tuple):
        score, reason = result
        return float(score), str(reason)
    return float(result), ""


def evaluate(
    query: str,
    candidates: list[dict],
    score_fn: ScoreFn,
    upper: float = UPPER_THRESHOLD,
    lower: float = LOWER_THRESHOLD,
) -> dict:
    """
    Returns:
      {
        "scored": [{"node": <node>, "score": <float>, "reason": <str>}, ...],
        "good_docs": [<node>, ...],   # score >= lower, regardless of verdict
        "verdict": "correct" | "ambiguous" | "incorrect",
        "reason": <str>,              # why this verdict, citing the thresholds used
      }
    """
    if not 0.0 <= lower <= upper <= 1.0:
        raise ValueError(f"thresholds must satisfy 0 <= lower <= upper <= 1, got lower={lower} upper={upper}")

    scored = []
    good_docs = []
    for node in candidates:
        score, reason = _normalize(score_fn(query, node))
        scored.append({"node": node, "score": score, "reason": reason})
        if score >= lower:
            good_docs.append(node)

    scores = [s["score"] for s in scored]
    if scores and any(s >= upper for s in scores):
        verdict = "correct"
        reason = f"at least one candidate scored >= upper threshold {upper}"
    elif not scores or all(s < lower for s in scores):
        verdict = "incorrect"
        reason = (f"no candidates" if not scores
                  else f"all candidates scored < lower threshold {lower}")
    else:
        verdict = "ambiguous"
        reason = f"no candidate >= {upper} but at least one >= {lower}"

    return {"scored": scored, "good_docs": good_docs, "verdict": verdict, "reason": reason}
