#!/usr/bin/env node
/**
 * scripts/demo-live.mjs — the HUMAN half of the plan §9 Phase-0 validation protocol.
 *
 * `live-verify.mjs` proves the bytes; this proves them to a person. It opens the operator's OWN
 * installed browser (not an automation-controlled one) on every page of the running app and
 * prints the reconcile checklist, so "it works" is something Umesh sees himself in ~3 minutes
 * rather than something he has to take on trust from a transcript or an agent's screenshot.
 *
 * Deliberately does NOT start the servers: spawning detached cross-platform servers from a
 * throwaway script leaves orphans behind, which is worse than one printed instruction. If they
 * are not up, this says exactly how to start them and exits non-zero.
 *
 * Usage: pnpm demo:live   (or: node scripts/demo-live.mjs [--web http://localhost:5173])
 */
import { execFile } from "node:child_process";
import { platform } from "node:process";

const argOf = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const WEB = argOf("web", "http://localhost:5173");
const API = argOf("api", "http://localhost:3300");

const PAGES = [
  ["/", "Dashboard — stat tiles must equal the collection counts in live-verify's summary.md"],
  ["/sessions", "Sessions — list length must equal the `sessions` count"],
  ["/brain", "Brain — graph renders from tree_index; topics/speakers/decisions are EMPTY by design today"],
  ["/calendar", "Calendar — real past sessions; upcoming is honestly empty without a connected calendar"],
  ["/sources", "Sources — rows must match GET /sources"],
  ["/ingest", "Ingest — URL-only today; no file/recording upload path exists yet"],
  ["/whatsapp", "WhatsApp — real tracked group(s); 'View it' opens the real chat transcript"],
  ["/meeting-bot", "Meeting Bot — MUST self-label as not real; every joiner is still a stub"],
  ["/settings", "Settings — real API keys, masked"],
];

async function isUp(url) {
  try {
    await fetch(url, { method: "GET" });
    return true;
  } catch {
    return false;
  }
}

const webUp = await isUp(WEB);
const apiUp = await isUp(`${API}/sessions`); // 401 without a key is still "up"

if (!webUp || !apiUp) {
  console.error(`Not running: ${!apiUp ? `api (${API}) ` : ""}${!webUp ? `web (${WEB})` : ""}\n`);
  console.error("Start them in two terminals, then re-run:");
  console.error("  cd apps/api && PORT=3300 pnpm dev");
  console.error("  cd apps/web && pnpm dev");
  process.exit(1);
}

// `start` on Windows, `open` on macOS, `xdg-open` elsewhere — the user's default browser, so
// what they see is a real browser session, not an automation-flagged one.
const opener = platform === "win32" ? ["cmd", ["/c", "start", ""]] : platform === "darwin" ? ["open", []] : ["xdg-open", []];

console.log(`Opening ${PAGES.length} pages in your default browser…\n`);
for (const [path] of PAGES) {
  const [cmd, args] = opener;
  execFile(cmd, [...args, `${WEB}${path}`], () => {});
  await new Promise((r) => setTimeout(r, 350)); // stagger so the browser keeps tab order
}

console.log("Check each page against the live-verify evidence (qa/evidence/live-*/summary.md):\n");
for (const [path, expect] of PAGES) console.log(`  ${path.padEnd(14)} ${expect}`);
console.log(`
A page is only PASS if its numbers reconcile with that summary.md.
A blank panel whose collection is genuinely empty is a MISSING feature, not a bug —
a blank panel whose collection has documents is a real FAIL.
`);
