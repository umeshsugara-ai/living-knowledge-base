"""
ask_router/test_router.py — runnable tests for T-005 (no pytest; plain asserts + sys.exit).

Run: python ask_router/test_router.py
"""
import sys

from router import ask
from evaluator import evaluate


NODE_A = {"node_id": "toc/.../session:sess1", "title": "A", "level": "session",
          "summary": "s", "children": [], "evidence": {"sessionRef": "sess1"}}
NODE_B = {"node_id": "toc/.../session:sess2", "title": "B", "level": "session",
          "summary": "s", "children": [], "evidence": {"sessionRef": "sess2"}}


def fake_tree_search_returns(nodes):
    def _fn(tree, query):
        return nodes
    return _fn


def fake_score_fn(scores_by_node_id):
    def _fn(query, node):
        return scores_by_node_id[node["node_id"]]
    return _fn


def test_correct_verdict_never_calls_web_even_if_supplied():
    calls = []

    def web_fallback(query):
        calls.append(query)
        return [{"title": "should not be called"}]

    result = ask(
        query="what did A say",
        tree={},
        tree_search_fn=fake_tree_search_returns([NODE_A]),
        score_fn=fake_score_fn({NODE_A["node_id"]: 0.9}),
        web_fallback_fn=web_fallback,
    )
    assert result["verdict"] == "correct"
    assert result["web_used"] is False
    assert calls == [], "web_fallback_fn must NOT be called on a correct verdict"
    assert result["sources"]["web"] == []
    assert len(result["sources"]["internal"]) == 1
    assert result["sources"]["internal"][0]["node_id"] == NODE_A["node_id"]
    assert result["insufficient_coverage"] is False


def test_incorrect_verdict_uses_web_fallback_sources_kept_separate():
    def web_fallback(query):
        return [{"title": "Web result", "url": "https://example.com"}]

    result = ask(
        query="off-corpus question",
        tree={},
        tree_search_fn=fake_tree_search_returns([NODE_A, NODE_B]),
        score_fn=fake_score_fn({NODE_A["node_id"]: 0.1, NODE_B["node_id"]: 0.15}),
        web_fallback_fn=web_fallback,
    )
    assert result["verdict"] == "incorrect"
    assert result["web_used"] is True
    assert result["sources"]["internal"] == [], "no doc scored >= 0.3, good_docs must be empty"
    assert result["sources"]["web"] == [{"title": "Web result", "url": "https://example.com"}]
    assert result["insufficient_coverage"] is False


def test_ambiguous_verdict_merges_good_docs_and_web_but_keeps_them_separate():
    def web_fallback(query):
        return [{"title": "Web result"}]

    result = ask(
        query="partial coverage question",
        tree={},
        tree_search_fn=fake_tree_search_returns([NODE_A, NODE_B]),
        score_fn=fake_score_fn({NODE_A["node_id"]: 0.5, NODE_B["node_id"]: 0.1}),
        web_fallback_fn=web_fallback,
    )
    assert result["verdict"] == "ambiguous"
    assert result["web_used"] is True
    assert len(result["sources"]["internal"]) == 1, "only NODE_A scored >= 0.3"
    assert result["sources"]["internal"][0]["node_id"] == NODE_A["node_id"]
    assert result["sources"]["web"] == [{"title": "Web result"}]


def test_no_web_fallback_provided_sets_insufficient_coverage():
    result = ask(
        query="off-corpus, no web configured",
        tree={},
        tree_search_fn=fake_tree_search_returns([NODE_A]),
        score_fn=fake_score_fn({NODE_A["node_id"]: 0.1}),
        web_fallback_fn=None,
    )
    assert result["verdict"] == "incorrect"
    assert result["web_used"] is False
    assert result["insufficient_coverage"] is True
    assert result["sources"]["web"] == []


def test_reason_returned_on_every_call_including_correct():
    def scoring_with_reason(query, node):
        return (0.85, "chunk answers the query directly")

    result = ask(
        query="q",
        tree={},
        tree_search_fn=fake_tree_search_returns([NODE_A]),
        score_fn=scoring_with_reason,
    )
    assert result["verdict"] == "correct"
    assert isinstance(result["reason"], str) and result["reason"], "top-level reason required"
    assert result["scored"][0]["reason"] == "chunk answers the query directly"

    # bare-float score_fn still yields a (possibly empty) per-candidate reason + a verdict reason
    bare = evaluate("q", [NODE_A], lambda q, n: 0.1)
    assert bare["verdict"] == "incorrect"
    assert "reason" in bare["scored"][0] and bare["reason"]


def test_thresholds_are_tunable_parameters():
    scores = fake_score_fn({NODE_A["node_id"]: 0.5})
    default = evaluate("q", [NODE_A], scores)
    assert default["verdict"] == "ambiguous"

    stricter = evaluate("q", [NODE_A], scores, upper=0.9, lower=0.6)
    assert stricter["verdict"] == "incorrect", "0.5 < lower=0.6 must be incorrect"
    assert stricter["good_docs"] == []

    looser = evaluate("q", [NODE_A], scores, upper=0.4, lower=0.2)
    assert looser["verdict"] == "correct", "0.5 >= upper=0.4 must be correct"

    via_ask = ask("q", {}, fake_tree_search_returns([NODE_A]), scores, upper=0.4, lower=0.2)
    assert via_ask["verdict"] == "correct", "ask() must pass thresholds through"

    try:
        evaluate("q", [NODE_A], scores, upper=0.2, lower=0.6)
        raise AssertionError("expected ValueError for lower > upper")
    except ValueError:
        pass


TESTS = [
    test_correct_verdict_never_calls_web_even_if_supplied,
    test_incorrect_verdict_uses_web_fallback_sources_kept_separate,
    test_ambiguous_verdict_merges_good_docs_and_web_but_keeps_them_separate,
    test_no_web_fallback_provided_sets_insufficient_coverage,
    test_reason_returned_on_every_call_including_correct,
    test_thresholds_are_tunable_parameters,
]


def main() -> int:
    failures = 0
    for test in TESTS:
        try:
            test()
            print(f"PASS: {test.__name__}")
        except AssertionError as e:
            failures += 1
            print(f"FAIL: {test.__name__} — {e}")
    print()
    if failures:
        print(f"FAIL: {failures}/{len(TESTS)} test(s) failed.")
        return 1
    print(f"PASS: {len(TESTS)}/{len(TESTS)} test(s) passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
