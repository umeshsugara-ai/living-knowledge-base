// @lkb/api — T-009. Production entrypoint: connect Mongo, wire real deps, start listening.
// `createServer`/`startServer` (server.ts) stay importable+injectable on their own for tests.
import { pathToFileURL } from "node:url";
import { connect } from "@lkb/db";
import { startServer } from "./server.js";
import { buildProductionDeps } from "./production.js";

export { createServer, startServer, type ServerDeps } from "./server.js";

async function main(): Promise<void> {
  await connect(process.env.MONGO_URL ?? "mongodb://localhost:27017", process.env.MONGO_DB ?? "lkb");
  const server = startServer(buildProductionDeps());
  server.on("listening", () => {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    console.log(`@lkb/api listening on :${port}`);
  });
}

// Only run when executed directly (`node dist/index.js` / `tsx src/index.ts`), never on import.
// Real bug found live on Windows (2026-09-04): hand-building the `file://` URL for comparison
// drops the leading slash Windows absolute paths need (`file://D:/...` instead of the correct
// `file:///D:/...`), so the guard always evaluated false and `main()` silently never ran, even
// though the process itself exited 0 with no error. `pathToFileURL` produces the correct form
// on every platform.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("@lkb/api failed to start:", err);
    process.exitCode = 1;
  });
}
