/**
 * scripts/lint.test.mjs — negative tests for the structure linters (T-017, C8).
 * Each linter is run as a child process against a temp fixture that violates its budget
 * (must exit non-zero) and against a clean fixture (must exit 0) — proving none is vacuous.
 * Run: pnpm test:lint   (= node --test scripts/lint.test.mjs)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
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
