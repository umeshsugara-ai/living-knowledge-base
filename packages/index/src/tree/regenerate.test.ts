/**
 * packages/index/src/tree/regenerate.test.ts — T-004b contract C3.
 * Builds a 3-session tree (same fixtures as tree.test.ts), regenerates with one session changed,
 * and checks the untouched N-1 sessions' year subtrees are deep-equal (in fact `===`) to the
 * original, while the touched year is rebuilt to reflect the change.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { SessionPages, Sessions } from "@lkb/core";
import { buildTree } from "./build.js";
import { regenerate } from "./regenerate.js";

const SESSIONS: Sessions[] = [
  { _id: "sess1", tenantId: "toc", sourceId: "src1", title: "21st-April-Visa-Blueprint",
    date: "2026-04-21", status: { transcribe: "done", index: "done" } },
  { _id: "sess2", tenantId: "toc", sourceId: "src2", title: "8th-May-Funding-Dreams",
    date: "2026-05-08", status: { transcribe: "done", index: "done" } },
  { _id: "sess3", tenantId: "toc", sourceId: "src3", title: "27th-August-In-Focus",
    date: "2026-08-27", status: { transcribe: "done", index: "done" } },
];

const SESSION_PAGES: SessionPages[] = [
  { _id: "pg1", tenantId: "toc", sessionId: "sess1",
    summary: "NZ visa blueprint: 8 universities, FTA pending.",
    evidence: [{ turnId: "t1", sessionId: "sess1" }] },
  { _id: "pg2", tenantId: "toc", sessionId: "sess2",
    summary: "Funding: FRR Forex markup ~1%, LRS cap $250k/yr.",
    evidence: [{ turnId: "t2", sessionId: "sess2" }] },
];

test("regenerate rebuilds the touched year to reflect the session change", () => {
  // All 3 fixture sessions share year 2026, so this exercises the rebuild path itself; the
  // next test below exercises the "untouched year stays ===" path with a second year.
  const original = buildTree(SESSIONS, SESSION_PAGES)["toc"]!;
  assert.equal(original.children.length, 1, "fixture sanity: all 3 sessions share year 2026");

  const updatedSessions: Sessions[] = SESSIONS.map((s) =>
    s._id === "sess2" ? { ...s, title: "8th-May-Funding-Dreams (retitled)" } : s);

  const result = regenerate(original, ["sess2"], updatedSessions, SESSION_PAGES);

  const sess2Node = result.children[0]!.children
    .flatMap((month) => month.children)
    .find((s) => s.node_id.endsWith("session:sess2"));
  assert.equal(sess2Node?.title, "8th-May-Funding-Dreams (retitled)",
    "expected the touched year's rebuild to reflect the session change");
});

test("regenerate keeps an untouched year's subtree === to the input (different years)", () => {
  // sess1 -> 2026, sessOther -> 2027: two distinct years so one can stay untouched.
  const sessOther: Sessions = { _id: "sessOther", tenantId: "toc", sourceId: "srcOther",
    title: "Other-Year-Session", date: "2027-01-15",
    status: { transcribe: "done", index: "done" } };
  const sessions = [SESSIONS[0]!, sessOther];
  const pages = [SESSION_PAGES[0]!];

  const original = buildTree(sessions, pages)["toc"]!;
  const original2026 = original.children.find((y) => y.node_id === "toc/year:2026")!;

  const updatedSessions = sessions.map((s) =>
    s._id === "sessOther" ? { ...s, title: "Other-Year-Session (retitled)" } : s);

  const result = regenerate(original, ["sessOther"], updatedSessions, pages);
  const result2026 = result.children.find((y) => y.node_id === "toc/year:2026")!;

  assert.equal(result2026, original2026, "untouched 2026 subtree must be the same object reference");
  assert.deepEqual(result2026, original2026, "untouched 2026 subtree must be deep-equal to the input");

  const result2027 = result.children.find((y) => y.node_id === "toc/year:2027")!;
  const retitled = result2027.children[0]!.children
    .find((s) => s.node_id.endsWith("session:sessOther"))?.title;
  assert.equal(retitled, "Other-Year-Session (retitled)",
    "expected the touched 2027 year to reflect the session change");
});

test("regenerate is a no-op when changedSessionIds don't touch this tenant's tree", () => {
  const original = buildTree(SESSIONS, SESSION_PAGES)["toc"]!;
  const result = regenerate(original, ["does-not-exist"], SESSIONS, SESSION_PAGES);
  assert.equal(result, original, "no matching changed session should return the same tree reference");
});
