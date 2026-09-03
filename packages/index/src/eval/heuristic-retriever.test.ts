/**
 * packages/index/src/eval/heuristic-retriever.test.ts — T-021 C5 (retriever half). Builds a small
 * synthetic tree (fixture sessions with distinct summaries) and proves `createHeuristicRetriever`
 * ranks a keyword-matching session above a non-matching one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { SessionPages, Sessions } from "@lkb/core";
import { buildTree } from "../tree/build.js";
import { createHeuristicRetriever } from "./heuristic-retriever.js";

const SESSIONS: Sessions[] = [
  { _id: "sessNZ", tenantId: "toc", sourceId: "srcNZ", title: "NZ Visas", date: "2026-04-21",
    status: { transcribe: "done", index: "done" } },
  { _id: "sessFunding", tenantId: "toc", sourceId: "srcFunding", title: "Funding", date: "2026-05-08",
    status: { transcribe: "done", index: "done" } },
];

const PAGES: SessionPages[] = [
  { _id: "pgNZ", tenantId: "toc", sessionId: "sessNZ",
    summary: "New Zealand student visa approval rate and proof-of-funds rules explained in depth.",
    evidence: [{ turnId: "t1", sessionId: "sessNZ" }] },
  { _id: "pgFunding", tenantId: "toc", sessionId: "sessFunding",
    summary: "Education loan interest rates and forex remittance markups for study abroad.",
    evidence: [{ turnId: "t2", sessionId: "sessFunding" }] },
];

test("ranks a matching session above a non-matching one", () => {
  const tree = buildTree(SESSIONS, PAGES)["toc"]!;
  const retrieve = createHeuristicRetriever(tree);

  const results = retrieve("New Zealand student visa approval rate", 2);
  assert.equal(results[0], "sessNZ", "the visa question must rank sessNZ first");
  // sessFunding has zero keyword overlap with this question and is filtered out entirely (a
  // zero-signal candidate is never fabricated into a ranked top-k list).
  assert.deepEqual(results, ["sessNZ"]);
});

test("respects k, truncating the ranked list", () => {
  const tree = buildTree(SESSIONS, PAGES)["toc"]!;
  const retrieve = createHeuristicRetriever(tree);
  const results = retrieve("visa", 1);
  assert.equal(results.length, 1);
  assert.equal(results[0], "sessNZ");
});

test("an empty question returns no crash and an empty/low-signal ranking", () => {
  const tree = buildTree(SESSIONS, PAGES)["toc"]!;
  const retrieve = createHeuristicRetriever(tree);
  const results = retrieve("", 5);
  assert.equal(results.length, 0, "empty question has no tokens to overlap, nothing should rank above 0");
});
