/**
 * packages/ask/src/testUtils.ts — shared fake `complete`/`write` helpers for T-005b's
 * *.test.ts files (mirrors `packages/ai/src/testUtils.ts`'s fake-transport pattern), so no test
 * file re-declares its own fake completion/job-write plumbing.
 */
import type { CompleteResult, Job, JobEntry, WriteJobFn } from "@lkb/ai";
import type { TreeIndexNode } from "@lkb/core";
import type { NodeSearchFn } from "./select-nodes.js";

export interface FakeComplete {
  (job: Job): Promise<CompleteResult>;
  calls: Job[];
}

function completeResult(overrides: Partial<CompleteResult> = {}): CompleteResult {
  return {
    text: "",
    usage: { inputTokens: 0, outputTokens: 0 },
    provider: "fake",
    model: "fake-model",
    costUsd: 0,
    ...overrides,
  };
}

/**
 * Returns a fake `complete` that records every job and answers from `responses` in order (the
 * last response repeats once the queue is exhausted, mirroring `fakeTransport`). A response may
 * be a partial `CompleteResult` (merged over sane defaults) or a function of the job for cases
 * that must vary by call (e.g. keep one refine strip, drop another).
 */
export function fakeComplete(
  ...responses: (Partial<CompleteResult> | ((job: Job) => Partial<CompleteResult>))[]
): FakeComplete {
  const calls: Job[] = [];
  const fn = (async (job: Job) => {
    calls.push(job);
    const idx = Math.min(calls.length - 1, responses.length - 1);
    const answer = responses[idx];
    if (!answer) return completeResult();
    return completeResult(typeof answer === "function" ? answer(job) : answer);
  }) as FakeComplete;
  fn.calls = calls;
  return fn;
}

export interface FakeWrite extends WriteJobFn {
  writes: (JobEntry & { createdAt: string })[];
}

/** Records every `recordJob` write in `.writes`, resolving each call immediately. */
export function fakeWrite(): FakeWrite {
  const writes: (JobEntry & { createdAt: string })[] = [];
  const fn = (async (entry) => {
    writes.push(entry);
  }) as FakeWrite;
  fn.writes = writes;
  return fn;
}

/**
 * Same-shape fake of `@lkb/index`'s `treeSearch(tree, nodeIds)` (depth-first id lookup) —
 * `packages/ask` cannot import `@lkb/index` itself (ARCHITECTURE §5), so tests exercising the
 * DI seam use this instead of the real thing.
 */
export const fakeTreeSearch: NodeSearchFn = (tree, nodeIds) => {
  const wanted = new Set(nodeIds);
  const found: TreeIndexNode[] = [];
  const walk = (n: TreeIndexNode): void => {
    if (wanted.has(n.node_id)) found.push(n);
    for (const c of n.children) walk(c);
  };
  walk(tree);
  return found;
};
