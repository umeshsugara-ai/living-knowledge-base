/**
 * apps/api/src/testUtils.ts — shared test helper. No supertest-style in-process request library
 * exists in this workspace yet (checked: no `package.json` anywhere lists one) and Express 5's
 * app isn't directly fetch-able without a bound listener, so per the contract's documented
 * fallback this starts the real app on an ephemeral OS-assigned port (`listen(0)`, loopback
 * only) for the lifetime of one test, then closes it — the minimal unavoidable network bind.
 */
import type { Server } from "node:http";
import { createServer, type ServerDeps } from "./server.js";

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(deps: ServerDeps): Promise<TestServer> {
  const server: Server = createServer(deps).listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve());
    server.once("error", reject);
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
