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

test("T-004c C1: a session that moved year is cleaned up from its old year, present in the new one", () => {
  const sessOld: Sessions = { _id: "sessMover", tenantId: "toc", sourceId: "srcMover",
    title: "Mover-Session", date: "2026-04-21", status: { transcribe: "done", index: "done" } };
  const original = buildTree([sessOld], [])["toc"]!;
  assert.ok(original.children.some((y) => y.title === "2026"), "fixture sanity: starts in 2026");

  // Session moves to 2027 — no OTHER changed session remains in 2026, so the old naive
  // implementation would have left a stale 2026 node forever.
  const moved: Sessions = { ...sessOld, date: "2027-01-15" };
  const result = regenerate(original, ["sessMover"], [moved], []);

  const year2026 = result.children.find((y) => y.title === "2026");
  assert.equal(year2026, undefined, "2026 had only the moved session, so it must vanish entirely");

  const year2027 = result.children.find((y) => y.title === "2027");
  assert.ok(year2027, "2027 must now exist");
  const sessNode = year2027!.children.flatMap((m) => m.children)
    .find((s) => s.node_id.endsWith("session:sessMover"));
  assert.ok(sessNode, "moved session must be present under its new year");
});

test("T-004c C1: old year survives (rebuilt, not vanished) when it still has other sessions", () => {
  const stays: Sessions = { _id: "sessStays", tenantId: "toc", sourceId: "srcStays",
    title: "Stays-2026", date: "2026-03-01", status: { transcribe: "done", index: "done" } };
  const mover: Sessions = { _id: "sessMover2", tenantId: "toc", sourceId: "srcMover2",
    title: "Mover-Session-2", date: "2026-04-21", status: { transcribe: "done", index: "done" } };
  const original = buildTree([stays, mover], [])["toc"]!;

  const moved: Sessions = { ...mover, date: "2027-06-01" };
  const result = regenerate(original, ["sessMover2"], [stays, moved], []);

  const year2026 = result.children.find((y) => y.title === "2026");
  assert.ok(year2026, "2026 must survive — sessStays is still there");
  const stillThere = year2026!.children.flatMap((m) => m.children)
    .find((s) => s.node_id.endsWith("session:sessStays"));
  assert.ok(stillThere, "sessStays must still be present in the rebuilt 2026");
  const goneFrom2026 = year2026!.children.flatMap((m) => m.children)
    .find((s) => s.node_id.endsWith("session:sessMover2"));
  assert.equal(goneFrom2026, undefined, "moved session must not linger in the rebuilt old year");
});

test("T-004c C3: a touched year's topic node picks up cross-year sessionRefs from an untouched year", () => {
  const s2026: Sessions = { _id: "s2026", tenantId: "toc", sourceId: "src2026",
    title: "2026 NZ Session", date: "2026-03-01", status: { transcribe: "done", index: "done" } };
  const s2027: Sessions = { _id: "s2027", tenantId: "toc", sourceId: "src2027",
    title: "2027 NZ Session", date: "2027-03-01", status: { transcribe: "done", index: "done" } };
  const pages: SessionPages[] = [
    { _id: "p2026", tenantId: "toc", sessionId: "s2026",
      summary: "New Zealand post-study visas explained.", evidence: [{ turnId: "t1", sessionId: "s2026" }] },
    { _id: "p2027", tenantId: "toc", sessionId: "s2027",
      summary: "New Zealand scholarship deadlines.", evidence: [{ turnId: "t2", sessionId: "s2027" }] },
  ];
  const original = buildTree([s2026, s2027], pages)["toc"]!;

  // Retitle s2026 only — 2027 (with s2027) is untouched.
  const updated = [{ ...s2026, title: "2026 NZ Session (retitled)" }, s2027];
  const result = regenerate(original, ["s2026"], updated, pages);

  const year2026 = result.children.find((y) => y.title === "2026")!;
  const topicNode = year2026.children.flatMap((m) => m.children)
    .flatMap((s) => s.children).find((c) => c.level === "topic" && /New Zealand/i.test(c.title));
  assert.ok(topicNode, "expected a New Zealand topic node under the rebuilt 2026 session");
  const sessionRefs = topicNode!.evidence?.sessionRefs as string[] | undefined;
  assert.ok(sessionRefs?.includes("s2027"),
    "touched year's topic node must include the untouched year's session in sessionRefs");

  const year2027 = result.children.find((y) => y.title === "2027")!;
  assert.equal(year2027, original.children.find((y) => y.title === "2027"),
    "2027 must remain untouched (=== to the input)");
});
