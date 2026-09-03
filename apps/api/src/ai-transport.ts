/**
 * apps/api/src/ai-transport.ts — T-009 C3. The real `Transport` (T-019's `provider.ts` seam):
 * `fetch` for `kind: "http"` adapters (gemini), `child_process.spawn` for `kind: "cli"` adapters
 * (claude-code). No implementation of this seam exists anywhere else in the workspace yet (T-019
 * shipped the seam + adapters but every test uses `packages/ai/src/testUtils.ts`'s fake) — this
 * is the composition root wiring it for real, once, for production startup only. Tests never
 * import this file.
 */
import { spawn } from "node:child_process";
import type { Transport, TransportRequest, TransportResponse } from "@lkb/ai";

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function httpTransport(req: TransportRequest): Promise<TransportResponse> {
  const res = await fetch(req.url!, {
    method: req.method ?? "GET",
    headers: req.headers,
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: tryParseJson(text), text };
}

function cliTransport(req: TransportRequest): Promise<TransportResponse> {
  return new Promise((resolve, reject) => {
    const child = spawn(req.command!, req.args ?? [], { shell: process.platform === "win32" });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ status: code ?? 1, body: tryParseJson(stdout), text: stdout }));
    child.stdin.end(req.stdin ?? "");
  });
}

export const realTransport: Transport = (req) => (req.kind === "cli" ? cliTransport(req) : httpTransport(req));
