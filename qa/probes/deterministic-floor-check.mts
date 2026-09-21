// qa/probes/deterministic-floor-check.mts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveSpeakers } from "../../packages/index/src/pipeline/speakers.js";

const SESSION = process.argv[2] || "2026-04-21-visa-blueprint-part2-italy-france-nz";
const turns = JSON.parse(readFileSync(join("data/toc-migrated", SESSION, "turns.json"), "utf8"));
const r = resolveSpeakers(turns);
console.log("DETERMINISTIC ONLY:");
for (const s of r.resolved) console.log(`  ${s.speakerRef} -> "${s.displayName}" (${s.evidence.map((e) => e.turnId).join(",")}) blocks: ${JSON.stringify(s.blocks)}`);
console.log(`  unresolved: ${r.unresolved.join(", ")}`);