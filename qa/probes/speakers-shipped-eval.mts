import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { register } from "tsx/esm/api";
register();

// Post-filter measurement: the REAL shipped extractSpeakers (with its verbatim + shape + discourse +
// introduction-cue filters) over the real Ollama chain. No Mongo, no writes.
const { extractSpeakers } = await import("../../packages/index/src/pipeline/speakers-llm.ts");
const BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const MODEL = "qwen3:8b";

async function complete(job) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, stream: false, messages: job.messages, think: false, options: { temperature: 0, seed: 42, num_predict: 300 } }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const j = await res.json();
  return { text: j.message?.content ?? "", json: undefined, usage: { inputTokens: j.prompt_eval_count ?? 0, outputTokens: j.eval_count ?? 0 }, provider: "ollama", model: MODEL, costUsd: 0 };
}

const SESSION = process.argv[2] || "2026-04-21-visa-blueprint-part2-italy-france-nz";
const turns = JSON.parse(readFileSync(join("data/toc-migrated", SESSION, "turns.json"), "utf8"));
const t0 = Date.now();
const r = await extractSpeakers(turns, complete);
console.log(`${SESSION} in ${Date.now() - t0}ms | degraded: ${r.degraded ? r.degraded.reason : "no"}`);
for (const s of r.resolved) {
  console.log(`  ACCEPTED ${s.speakerRef} -> "${s.displayName}" evidence: ${s.evidence.map((e) => e.turnId).join(",")} blocks: ${JSON.stringify(s.blocks)}`);
}
console.log(`  unresolved: ${r.unresolved.join(", ")}`);
