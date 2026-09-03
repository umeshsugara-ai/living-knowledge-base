#!/usr/bin/env node
/**
 * scripts/lint-dirsize.mjs — C2: no directory under the roots holds more than
 * structure.config.json → dirsize.maxFiles files (non-recursive count).
 * Usage: node scripts/lint-dirsize.mjs [--root <dir>]
 */
import { basename, join, relative } from "node:path";
import { readdirSync } from "node:fs";
import { isDir, loadConfig, looseFiles, posix, report, rootFromArgv } from "./lib/walk.mjs";

function* dirs(root, dir, ignoreDirs) {
  if (!isDir(dir)) return;
  yield dir;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !ignoreDirs.includes(e.name)) yield* dirs(root, join(dir, e.name), ignoreDirs);
  }
}

export function check(root, cfg = loadConfig(root)) {
  const { maxFiles } = cfg.dirsize;
  const violations = [];
  let scanned = 0;
  for (const r of cfg.roots) {
    for (const dir of dirs(root, join(root, r), cfg.ignoreDirs)) {
      scanned++;
      const n = looseFiles(dir).length;
      if (n > maxFiles) violations.push(`${posix(relative(root, dir)) || "."}: ${n} files (budget ${maxFiles})`);
    }
  }
  return { violations, scanned };
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const { violations, scanned } = check(rootFromArgv());
  report("lint-dirsize", violations, `${scanned} dir(s) within budget`);
}
