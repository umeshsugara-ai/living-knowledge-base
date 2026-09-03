# Manifest — T-005-ask-router
**Contract:** qa/contracts/ask-router.md
**Goal task:** T-005
**Date:** 2026-09-03
**Fix cycle:** 1 of max 3
**Issues addressed:** none

## What changed
- `ask_router/evaluator.py` — new: `evaluate(query, candidates, score_fn)` — CRAG threshold
  logic (upper=0.7 → correct, lower=0.3 → incorrect, between → ambiguous), `good_docs` = every
  candidate scoring >= 0.3 regardless of verdict (the documented CRAG gotcha)
- `ask_router/router.py` — new: `ask(query, tree, tree_search_fn, score_fn, web_fallback_fn=None)` —
  routes to internal-only on `correct` (never calls `web_fallback_fn` even if supplied), to
  web-fallback on `ambiguous`/`incorrect`, keeps `sources.internal` / `sources.web` as separate
  lists, sets `insufficient_coverage: True` when verdict != correct and no web fallback is wired
- `ask_router/test_router.py` — new: 4 runnable tests covering all 4 verdict/fallback paths

## How to verify (commands + expected)
- `cd D:\KnowledgeBase && python ask_router/test_router.py` → expected: exit 0,
  "PASS: 4/4 test(s) passed."

## Actual outputs (from maker's own run)
```
$ python ask_router/test_router.py
PASS: test_correct_verdict_never_calls_web_even_if_supplied
PASS: test_incorrect_verdict_uses_web_fallback_sources_kept_separate
PASS: test_ambiguous_verdict_merges_good_docs_and_web_but_keeps_them_separate
PASS: test_no_web_fallback_provided_sets_insufficient_coverage

PASS: 4/4 test(s) passed.
exit: 0
```

## Status: ready-for-check
