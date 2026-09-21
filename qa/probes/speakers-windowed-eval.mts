import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// qa/probes/speakers-windowed-eval.mts — U2.4 phase 3: the frozen local qwen3:8b digest over
// segment-aware windows, NO Mongo, NO job writer, three runs for determinism. Direct Ollama HTTP,
// same request shape the ollama adapter emits (think:false + temperature 0 + seed).
const BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const MODEL = "qwen3:8b";
const SYSTEM = [
  "You identify who each anonymous speaker in a transcript actually is. Each line is one turn,",
  "prefixed with its real turn id and its anonymous speaker label, e.g. [id:t12] [spk:0] ...",
  "Some speakers introduce themselves, are greeted by name, or are handed over to by name.",
  'Respond with ONLY a JSON array: [{"speakerRef": "<the EXACT spk:N label including the spk: prefix>",',
  '"displayName": "<the person\'s name EXACTLY as it is spelled in the transcript>",',
  '"turnIds": ["<turn ids that show this person is that speaker>"]}, ...].',
  "Copy the name character-for-character from the transcript -- never correct, normalise or",
  "complete a spelling, and never supply a name the transcript does not contain. Copy every",
  "turnId exactly from the [id:...] prefixes. If you cannot tell who a speaker is, leave them out",
  "entirely -- an unnamed speaker is correct, a guessed one is a serious error. If no speaker can",
  "be identified, respond with an empty array [].",
].join(" ");

async function complete(messages) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, stream: false, messages, think: false, options: { temperature: 0, seed: 42, num_predict: 300 } }),
    });
    if (res.ok) {
      const j = await res.json();
      return j.message?.content ?? "";
    }
    if (attempt === 3) throw new Error(`ollama ${res.status} after 3 attempts`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  return "";
}

const SESSION = process.argv[2] || "2026-04-21-visa-blueprint-part2-italy-france-nz";
const turns = JSON.parse(readFileSync(join("data/toc-migrated", SESSION, "turns.json"), "utf8"));
const POSITIONAL = /^spk:\d+$/;
const blocks = [];
let cur = null;
turns.forEach((t, i) => {
  const ref = t.speakerRef || "";
  if (POSITIONAL.test(ref)) {
    if (cur && cur.label === ref) cur.end = i;
    else { if (cur) blocks.push(cur); cur = { label: ref, start: i, end: i }; }
  } else if (cur) { blocks.push(cur); cur = null; }
});
if (cur) blocks.push(cur);
console.log(`session: ${SESSION} | turns: ${turns.length} | positional: ${turns.filter((t) => POSITIONAL.test(t.speakerRef || "")).length} | blocks: ${blocks.length}`);

const windows = [];
let prevEnd = -1;
for (const b of blocks) {
  const from = Math.max(0, b.start - 3, prevEnd + 1);
  for (let s = b.start; s <= b.end; s += 8) {
    const to = Math.min(b.end, s + 7);
    windows.push({ label: b.label, start: b.start, end: b.end, text: turns.slice(from, to + 1).map((t) => `[id:${t._id}] [${t.speakerRef}] ${t.text}`).join("\n") });
    prevEnd = to;
  }
}
console.log(`windows: ${windows.length}`);

for (let run = 1; run <= 3; run++) {
  const perLabel = new Map();
  const t0 = Date.now();
  for (const w of windows) {
    const out = await complete([
      { role: "system", content: SYSTEM },
      { role: "user", content: w.text },
    ]);
    let arr;
    try { arr = JSON.parse(out); } catch { continue; }
    if (!Array.isArray(arr)) continue;
    for (const e of arr) {
      if (!e || typeof e.speakerRef !== "string" || typeof e.displayName !== "string") continue;
      const ref = e.speakerRef.startsWith("spk:") ? e.speakerRef : `spk:${e.speakerRef}`;
      if (!w.text.includes(ref)) continue;
      const name = e.displayName.trim();
      if (!name) continue;
      const byName = perLabel.get(ref) || new Map();
      const list = byName.get(name) || [];
      for (const id of Array.isArray(e.turnIds) ? e.turnIds : []) {
        if (typeof id !== "string" || !w.text.includes(`[id:${id}]`)) continue;
        if (!list.includes(id)) list.push(id);
      }
      byName.set(name, list);
      perLabel.set(ref, byName);
    }
  }
  const ms = Date.now() - t0;
  console.log(`run ${run} (${ms}ms): ${perLabel.size} label(s) named`);
  for (const [label, byName] of [...perLabel.entries()].sort()) {
    for (const [name, ids] of byName) {
      console.log(`  ${label} -> "${name}" (${ids.length} turn(s))`);
    }
  }
}
