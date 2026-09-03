/**
 * packages/ask/src/ask-v2.ts — T-005b C4. Composes `selectNodes -> evaluate (via T-005's
 * existing `ask()`) -> refine -> answer`, logging every external call (selectNodes' LLM call,
 * each refine strip call, the answer call, and the evaluator's per-candidate score_fn call) via
 * T-019's `recordJob`. Does NOT replace `./evaluator.ts` / `./router.ts` — `ask()` stays the
 * lower-level primitive this builds on; imported and called, never reimplemented.
 */
import type { TreeIndexNode } from "@lkb/core";
import type { WriteJobFn } from "@lkb/ai";
import { recordJob } from "@lkb/ai";

import { ask, type AskResult, type WebFallbackFn, type WebSource } from "./router.js";
import { LOWER_THRESHOLD, UPPER_THRESHOLD, type ScoreFn } from "./evaluator.js";
import { selectNodes, type CompleteFn, type NodeSearchFn } from "./select-nodes.js";
import { refine, type RefinableDoc } from "./refine.js";
import { answer as generateAnswer } from "./answer.js";

export interface AuditEntry {
  jobKind: string;
  step: string;
  provider?: string;
  model?: string;
  costUsd?: number;
}

export interface AskV2Deps {
  complete: CompleteFn;
  scoreFn: ScoreFn;
  /** `@lkb/index`'s `treeSearch` — injected, never imported (see select-nodes.ts module doc). */
  treeSearchFn: NodeSearchFn;
  webFallbackFn?: WebFallbackFn;
  write: WriteJobFn;
  tenantId: string;
  upper?: number;
  lower?: number;
}

export interface AskV2Result extends AskResult {
  answer: string;
  /** append-only per-query audit trail — one entry per external (LLM/score) call this run made. */
  auditLog: AuditEntry[];
}

function webDocText(source: WebSource): string {
  return ["title", "snippet", "content", "text"]
    .map((key) => source[key])
    .filter((v): v is string => typeof v === "string")
    .join(". ");
}

export async function askV2(query: string, tree: TreeIndexNode, deps: AskV2Deps): Promise<AskV2Result> {
  const { complete, scoreFn, treeSearchFn, webFallbackFn, write, tenantId } = deps;
  const upper = deps.upper ?? UPPER_THRESHOLD;
  const lower = deps.lower ?? LOWER_THRESHOLD;
  const auditLog: AuditEntry[] = [];

  const loggingComplete = (step: string): CompleteFn => async (job) => {
    const completion = await complete(job);
    await recordJob(
      { tenantId, kind: `ask.${step}`, status: "done", provider: completion.provider, model: completion.model },
      write,
    );
    auditLog.push({
      jobKind: `ask.${step}`,
      step,
      provider: completion.provider,
      model: completion.model,
      costUsd: completion.costUsd,
    });
    return completion;
  };

  const candidates = await selectNodes(query, tree, loggingComplete("select_nodes"), treeSearchFn);
  // ask() re-scores `candidates` via `scoreFn` internally (T-005's evaluate()) — reused here, not
  // duplicated. Each candidate's node comes back on `scored[].node`, still the full node object
  // selectNodes/treeSearch resolved (with `summary`), so refine below needs no second lookup.
  const askResult = await ask(query, tree, () => candidates, scoreFn, webFallbackFn, upper, lower);

  for (const s of askResult.scored) {
    await recordJob({ tenantId, kind: "ask.score", status: "done" }, write);
    auditLog.push({ jobKind: "ask.score", step: "score" });
  }

  const goodDocNodes: TreeIndexNode[] = askResult.scored
    .filter((s) => s.score >= lower)
    .map((s) => s.node);

  let refinedContext: string;
  if (askResult.verdict === "correct") {
    // Internal-first guarantee holds through askV2 too: no refine, no web, on a correct verdict.
    refinedContext = goodDocNodes.map((n) => n.summary).join(" ");
  } else {
    const docs: RefinableDoc[] = [
      ...goodDocNodes.map((n) => ({ text: n.summary })),
      ...askResult.sources.web.map((w) => ({ text: webDocText(w) })),
    ];
    refinedContext = await refine(docs, query, loggingComplete("refine"));
  }

  const answerResult = await generateAnswer(query, refinedContext, askResult.sources, loggingComplete("answer"));

  return { ...askResult, answer: answerResult.text, auditLog };
}
