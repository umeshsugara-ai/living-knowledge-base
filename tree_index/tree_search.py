"""
tree_index/tree_search.py — retrieval half of the vectorless tree pattern (T-004).

`tree_search` is a plain tree-walk lookup by node_id. It performs NO reasoning and NO LLM
call itself — in the full CRAG/PageIndex flow, an LLM reads the tree, reasons over it, and
returns the node_ids it thinks are relevant; this function is what resolves those ids back
to full node objects (with their summaries) for the next stage (evaluator / answer generation).
"""
from __future__ import annotations


def _walk(node: dict):
    yield node
    for child in node.get("children", []):
        yield from _walk(child)


def tree_search(tree: dict, node_ids: list[str]) -> list[dict]:
    """
    `tree` is a single root node (e.g. one tenant's root from build_tree's output dict).
    Returns the nodes whose node_id is in `node_ids`, in the order found by a depth-first
    walk. Unknown ids are simply absent from the result (never an error).
    """
    wanted = set(node_ids)
    return [node for node in _walk(tree) if node["node_id"] in wanted]
