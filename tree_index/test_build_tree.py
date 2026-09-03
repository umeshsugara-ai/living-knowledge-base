"""
tree_index/test_build_tree.py — runnable tests for T-004 (no pytest dependency; plain
asserts + sys.exit so /checker can re-run this exact command headlessly).

Run: python tree_index/test_build_tree.py
"""
import sys

from build_tree import build_tree
from tree_search import tree_search


SESSIONS = [
    {"_id": "sess1", "tenantId": "toc", "sourceId": "src1",
     "title": "21st-April-Visa-Blueprint", "date": "2026-04-21",
     "status": {"transcribe": "done", "index": "done"}},
    {"_id": "sess2", "tenantId": "toc", "sourceId": "src2",
     "title": "8th-May-Funding-Dreams", "date": "2026-05-08",
     "status": {"transcribe": "done", "index": "done"}},
    {"_id": "sess3", "tenantId": "toc", "sourceId": "src3",
     "title": "27th-August-In-Focus", "date": "2026-08-27",
     "status": {"transcribe": "done", "index": "done"}},
]

SESSION_PAGES = [
    {"_id": "pg1", "tenantId": "toc", "sessionId": "sess1",
     "summary": "NZ visa blueprint: 8 universities, FTA pending.",
     "evidence": [{"turn_id": "t1", "session_id": "sess1"}]},
    {"_id": "pg2", "tenantId": "toc", "sessionId": "sess2",
     "summary": "Funding: FRR Forex markup ~1%, LRS cap $250k/yr.",
     "evidence": [{"turn_id": "t2", "session_id": "sess2"}]},
    # sess3 deliberately has NO session_page yet — tests the "" fallback
]


def test_grouping_and_nesting():
    tree = build_tree(SESSIONS, SESSION_PAGES)
    assert "toc" in tree, "expected a root node for tenant 'toc'"
    root = tree["toc"]
    assert root["level"] == "tenant"

    year_ids = {c["node_id"] for c in root["children"]}
    assert year_ids == {"toc/year:2026"}, f"expected single 2026 year node, got {year_ids}"

    year_node = root["children"][0]
    month_ids = {c["node_id"] for c in year_node["children"]}
    assert month_ids == {
        "toc/year:2026/month:04",
        "toc/year:2026/month:05",
        "toc/year:2026/month:08",
    }, f"expected 3 distinct months, got {month_ids}"

    # every session leaf reachable by walking children from tenant root
    all_nodes = list(tree_search(root, [
        "toc/year:2026/month:04/session:sess1",
        "toc/year:2026/month:05/session:sess2",
        "toc/year:2026/month:08/session:sess3",
    ]))
    assert len(all_nodes) == 3, f"expected all 3 session leaves reachable, got {len(all_nodes)}"


def test_evidence_on_every_session_node():
    tree = build_tree(SESSIONS, SESSION_PAGES)
    root = tree["toc"]
    session_nodes = [
        n for n in tree_search(root, [
            f"toc/year:2026/month:{m}/session:{sid}"
            for m, sid in (("04", "sess1"), ("05", "sess2"), ("08", "sess3"))
        ])
    ]
    assert len(session_nodes) == 3
    for node in session_nodes:
        assert "evidence" in node, f"session node {node['node_id']} missing evidence"
        assert node["evidence"]["sessionRef"] in {"sess1", "sess2", "sess3"}


def test_tree_search_known_and_unknown():
    tree = build_tree(SESSIONS, SESSION_PAGES)
    root = tree["toc"]
    found = tree_search(root, ["toc/year:2026/month:04/session:sess1"])
    assert len(found) == 1
    assert found[0]["title"] == "21st-April-Visa-Blueprint"

    missing = tree_search(root, ["does-not-exist"])
    assert missing == [], f"expected empty result for unknown id, got {missing}"


def test_summarize_injection_and_fallback():
    tree = build_tree(SESSIONS, SESSION_PAGES)
    root = tree["toc"]
    sess1_node = tree_search(root, ["toc/year:2026/month:04/session:sess1"])[0]
    assert sess1_node["summary"] == "NZ visa blueprint: 8 universities, FTA pending.", \
        "expected fallback to session_page.summary when no summarize callable is passed"

    sess3_node = tree_search(root, ["toc/year:2026/month:08/session:sess3"])[0]
    assert sess3_node["summary"] == "", \
        "expected empty-string fallback when no session_page exists for the session"

    def fake_summarize(session, page):
        return f"MOCK SUMMARY for {session['title']}"

    tree_with_llm = build_tree(SESSIONS, SESSION_PAGES, summarize=fake_summarize)
    sess1_node_llm = tree_search(tree_with_llm["toc"], ["toc/year:2026/month:04/session:sess1"])[0]
    assert sess1_node_llm["summary"] == "MOCK SUMMARY for 21st-April-Visa-Blueprint", \
        "expected injected summarize() callable to override the fallback"


TESTS = [
    test_grouping_and_nesting,
    test_evidence_on_every_session_node,
    test_tree_search_known_and_unknown,
    test_summarize_injection_and_fallback,
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
