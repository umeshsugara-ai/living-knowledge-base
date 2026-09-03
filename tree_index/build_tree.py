"""
tree_index/build_tree.py — vectorless tree-index generator (T-004).

Builds a hierarchical JSON tree (tenant -> year -> month -> session) from `sessions` and
`session_pages` documents (see schema/sessions.schema.json, schema/session_pages.schema.json).

No dense-vector math, no similarity search, no network calls by default. This mirrors the
operating-brain's own INDEX.md router shape and the PageIndex vectorless-RAG pattern:
structure IS the index; an LLM (or, for tests, a plain fallback) supplies each node's summary.

`summarize` is an injectable seam — pass a callable to have an LLM write node summaries;
omit it and the session_page's own `summary` field is used verbatim (network-free, testable).
"""
from __future__ import annotations

from typing import Callable, Optional


def _node(node_id: str, title: str, level: str, summary: str = "",
          evidence: Optional[dict] = None) -> dict:
    node = {
        "node_id": node_id,
        "title": title,
        "level": level,
        "summary": summary,
        "children": [],
    }
    if evidence is not None:
        node["evidence"] = evidence
    return node


def _session_page_for(session_id: str, session_pages: list[dict]) -> Optional[dict]:
    for page in session_pages:
        if page.get("sessionId") == session_id:
            return page
    return None


def build_tree(
    sessions: list[dict],
    session_pages: list[dict],
    summarize: Optional[Callable[[dict, Optional[dict]], str]] = None,
) -> dict:
    """
    Returns a dict: {tenantId: <root tree node>} — one root per distinct tenant found in
    `sessions`. Each root nests year -> month -> session nodes underneath it.

    `summarize(session, session_page)` -> str, if provided, produces the summary text for a
    session node. If omitted, falls back to `session_page["summary"]` (or "" if no page
    exists for that session yet).
    """
    roots: dict[str, dict] = {}

    for session in sessions:
        tenant_id = session["tenantId"]
        date = session["date"]  # "YYYY-MM-DD"
        year, month = date[0:4], date[5:7]

        root = roots.setdefault(
            tenant_id, _node(f"tenant:{tenant_id}", tenant_id, "tenant")
        )

        year_node = next(
            (c for c in root["children"] if c["node_id"] == f"{tenant_id}/year:{year}"),
            None,
        )
        if year_node is None:
            year_node = _node(f"{tenant_id}/year:{year}", year, "year")
            root["children"].append(year_node)

        month_node_id = f"{tenant_id}/year:{year}/month:{month}"
        month_node = next(
            (c for c in year_node["children"] if c["node_id"] == month_node_id), None
        )
        if month_node is None:
            month_node = _node(month_node_id, month, "month")
            year_node["children"].append(month_node)

        page = _session_page_for(session["_id"], session_pages)
        if summarize is not None:
            summary = summarize(session, page)
        else:
            summary = page["summary"] if page else ""

        session_node = _node(
            node_id=f"{month_node_id}/session:{session['_id']}",
            title=session["title"],
            level="session",
            summary=summary,
            evidence={"sessionRef": session["_id"]},
        )
        month_node["children"].append(session_node)

    return roots
