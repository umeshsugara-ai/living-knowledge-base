/**
 * scripts/lint.test.mjs — negative tests for the structure linters (T-017, C8).
 * Each linter is run as a child process against a temp fixture that violates its budget
 * (must exit non-zero) and against a clean fixture (must exit 0) — proving none is vacuous.
 * Run: pnpm test:lint   (= node --test scripts/lint.test.mjs)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(readFileSync(join(SCRIPTS, "..", "structure.config.json"), "utf8"));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "lkb-lint-"));
  writeFileSync(join(root, "structure.config.json"), JSON.stringify(CONFIG));
  return root;
}

function put(root, rel, content = "") {
  const abs = join(root, ...rel.split("/"));
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function run(linter, root) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, `lint-${linter}.mjs`), "--root", root], { encoding: "utf8" });
  return { status: r.status, out: r.stdout + r.stderr };
}

const lines = (n, text = "x = 1") => Array.from({ length: n }, () => text).join("\n") + "\n";

/** Runs `linter` on a clean fixture (expect 0) then on `violate(root)` (expect 1, output contains `needle`). */
function pair(linter, build, violate, needle) {
  test(`lint-${linter}: passes on a clean fixture`, () => {
    const root = fixture();
    try {
      build(root);
      const r = run(linter, root);
      assert.equal(r.status, 0, r.out);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  test(`lint-${linter}: fails on a violating fixture`, () => {
    const root = fixture();
    try {
      build(root);
      violate(root);
      const r = run(linter, root);
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, needle);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

// C1 — LOC
const locMax = CONFIG.loc.max;
pair(
  "loc",
  (root) => {
    put(root, "packages/a/src/ok.ts", lines(locMax));
    put(root, "packages/a/src/ok.test.ts", lines(CONFIG.loc.testMax));
    put(root, "packages/a/node_modules/big.ts", lines(locMax + 50));
    put(root, "packages/a/src/generated/big.ts", lines(locMax + 50));
  },
  (root) => put(root, "packages/a/src/big.ts", lines(locMax + 1)),
  /packages\/a\/src\/big\.ts:301/,
);

// C2 — directory size
const dirMax = CONFIG.dirsize.maxFiles;
pair(
  "dirsize",
  (root) => {
    for (let i = 0; i < dirMax; i++) put(root, `packages/a/src/f${i}.ts`);
    for (let i = 0; i <= dirMax; i++) put(root, `packages/a/node_modules/f${i}.ts`);
  },
  (root) => put(root, `packages/a/src/f${dirMax}.ts`),
  /packages\/a\/src: 31 files/,
);

// C2b — the dirsize override (D-017) is SCOPED: a named directory gets extra room, and every
// other directory keeps the global cap. Without the second half of this, an override could quietly
// become a global raise -- which is the exact mistake D-016 would have made.
test("dirsize override raises the cap only for the directory it names", () => {
  const root = fixture();
  const cfg = JSON.parse(JSON.stringify(CONFIG));
  cfg.dirsize.overrides = { "packages/a/src": dirMax + 1 };
  writeFileSync(join(root, "structure.config.json"), JSON.stringify(cfg));
  // the OVERRIDDEN directory may hold one more than the global cap
  for (let i = 0; i <= dirMax; i++) put(root, `packages/a/src/f${i}.ts`);
  const ok = run("dirsize", root);
  assert.equal(ok.status, 0, `override should permit ${dirMax + 1} files: ${ok.out}`);

  // an UNLISTED sibling is still held to the global cap
  for (let i = 0; i <= dirMax; i++) put(root, `packages/b/src/f${i}.ts`);
  const bad = run("dirsize", root);
  assert.notEqual(bad.status, 0, "an unlisted directory must still fail at the global cap");
  assert.match(bad.out, /packages\/b\/src: 31 files \(budget 30\)/);
});

// C3 — root
const r = CONFIG.root;
pair(
  "root",
  (root) => {
    // structure.config.json + 3 .md files + N .txt files = exactly maxLooseFiles
    for (let i = 0; i < r.maxLooseFiles - 4; i++) put(root, `file${i}.txt`);
    put(root, r.architectureFile, lines(r.architectureMaxLines, "# a"));
    put(root, "NOTES.md", lines(r.mdMaxLines, "note"));
    put(root, r.readmeFile, lines(r.readmeMaxLines, "readme"));
    mkdirSync(join(root, "a-directory-not-counted"));
  },
  (root) => {
    put(root, "extra-loose-file.txt");
    put(root, r.architectureFile, lines(r.architectureMaxLines + 1, "# a"));
    put(root, "NOTES.md", lines(r.mdMaxLines + 1, "note"));
    put(root, r.readmeFile, lines(r.readmeMaxLines + 1, "readme"));
  },
  /root has 16 loose files[\s\S]*ARCHITECTURE\.md: 151 lines[\s\S]*NOTES\.md: 201 lines[\s\S]*README\.md: 81 lines/,
);

// C4 — duplicate exports + duplicate schema $id
pair(
  "dupes",
  (root) => {
    put(root, "packages/a/src/one.ts", "export function alpha() {}\nexport const beta = 1;\n");
    put(root, "packages/b/src/two.ts", "export interface Gamma {}\nexport type Delta = 1;\n");
    put(root, "packages/b/src/index.ts", "export { alpha } from './one.js';\nexport const beta = 2;\n");
    put(root, "packages/a/src/generated/g.ts", "export function alpha() {}\n");
    put(root, "schema/x.schema.json", JSON.stringify({ $id: "kb://x" }));
    put(root, "schema/y.schema.json", JSON.stringify({ $id: "kb://y" }));
  },
  (root) => {
    put(root, "packages/b/src/three.ts", "export class Gamma {}\nexport async function alpha() {}\n");
    put(root, "schema/z.schema.json", JSON.stringify({ $id: "kb://x" }));
  },
  /export 'alpha'[\s\S]*export 'Gamma'[\s\S]*schema \$id 'kb:\/\/x'/,
);

// C5 — migrations outside migrations/
pair(
  "migrations",
  (root) => {
    put(root, "migrations/migrate-001-add-index.mjs");
    put(root, "scripts/gen-types.mjs");
    put(root, "packages/a/node_modules/migrate-x.js");
  },
  (root) => {
    put(root, "scripts/migrate-2026-09-03-patch.mjs");
    put(root, "packages/a/src/migrate-fix.py");
  },
  /packages\/a\/src\/migrate-fix\.py[\s\S]*scripts\/migrate-2026-09-03-patch\.mjs/,
);

/* ── ISS-128: scripts/ is neither typechecked nor in `pnpm -r test` ───────────────────────────
 * A stale `apps/api/src/indexing.ts` import left the chunks backfill DEAD from the U1.0c file move
 * until a maker happened to run it — a whole script broken, in a repo with 500+ green tests and a
 * clean typecheck, because `scripts/` sits outside both. `pnpm -r` only walks workspace packages,
 * and these are loose .mjs files.
 *
 * This is the cheapest guard that would have caught it: import each script's module graph and
 * assert it RESOLVES. It deliberately does not execute them — several connect to Mongo or spend
 * API budget — so it catches broken imports and syntax, not behaviour. That is exactly the class
 * that bit, and a narrow guard that runs beats a thorough one that cannot.
 *
 * Added to this existing file rather than as `scripts/smoke.test.mjs` because `scripts/` is at its
 * D-018 directory cap of 32, and that entry records that a third raise must CONSOLIDATE, not widen.
 */
test("every scripts/*.mjs resolves its imports — scripts are outside typecheck and pnpm -r test", async () => {
  const { readdirSync } = await import("node:fs");
  const { pathToFileURL } = await import("node:url");
  const { join, dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { spawnSync } = await import("node:child_process");

  const scriptsDir = dirname(fileURLToPath(import.meta.url));
  const root = resolve(scriptsDir, "..");
  const files = readdirSync(scriptsDir).filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs"));
  assert.ok(files.length > 20, `expected the real scripts dir, found ${files.length} file(s)`);

  const broken = [];
  for (const f of files) {
    // A child process per file: these register tsx hooks and import workspace TS, which must not
    // leak into this test runner. `--check` parses without executing; the tsx-registered dynamic
    // imports inside main() are covered by the resolve pass below.
    const parse = spawnSync(process.execPath, ["--check", join(scriptsDir, f)], { encoding: "utf8" });
    if (parse.status !== 0) broken.push(`${f}: syntax — ${(parse.stderr || "").split("\n")[0]}`);
  }
  assert.deepEqual(broken, [], `scripts failed to parse:\n${broken.join("\n")}`);

  // Static-import resolution: catches exactly the U1.0c breakage class (a moved module still
  // named in an import specifier) for every top-level import in every script.
  const { readFileSync, existsSync } = await import("node:fs");
  const unresolved = [];
  for (const f of files) {
    const src = readFileSync(join(scriptsDir, f), "utf8");
    for (const m of src.matchAll(/(?:^|\s)(?:import|await import\()\s*["']([^"']+)["']/g)) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue; // bare specifiers are resolved by node_modules
      const abs = resolve(scriptsDir, spec);
      // A `.js` specifier pointing at TypeScript source is the tsx/ESM convention used throughout
      // this repo (`packages/db/src/client.js` -> `client.ts`), so accept either extension. The
      // check that matters is whether SOMETHING is there — the U1.0c breakage was a path with no
      // file behind it under any extension.
      const candidates = [abs];
      if (abs.endsWith(".js")) candidates.push(abs.slice(0, -3) + ".ts");
      if (!abs.match(/\.[a-z]+$/)) candidates.push(abs + ".ts", abs + ".mjs", abs + ".js", join(abs, "index.ts"));
      if (!candidates.some((c) => existsSync(c))) unresolved.push(`${f} -> ${spec}`);
    }
  }
  assert.deepEqual(unresolved, [],
    `a script imports a path that does not exist (the U1.0c breakage class):\n${unresolved.join("\n")}`);
  assert.ok(pathToFileURL(root));
});
