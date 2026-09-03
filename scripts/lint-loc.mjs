#!/usr/bin/env node
/**
 * scripts/lint-loc.mjs — C1: no source file over the LOC budget (non-blank lines).
 * Budgets: structure.config.json → loc.max (tests: loc.testMax). Usage: node scripts/lint-loc.mjs [--root <dir>]
 */
import { basename, join } from "node:path";
import { countLoc, loadConfig, report, rootFromArgv, walk } from "./lib/walk.mjs";

export function check(root, cfg = loadConfig(root)) {
  const { extensions, max, testMax, testPatterns } = cfg.loc;
  const testRes = testPatterns.map((p) => new RegExp(p));
  const violations = [];
  let scanned = 0;
  for (const r of cfg.roots) {
    for (const { abs, rel } of walk(root, join(root, r), cfg.ignoreDirs)) {
      if (!extensions.some((ext) => rel.endsWith(ext))) continue;
      scanned++;
      const isTest = testRes.some((re) => re.test(basename(rel)));
      const budget = isTest ? testMax : max;
      const loc = countLoc(abs);
      if (loc > budget) violations.push(`${rel}:${loc} (budget ${budget})`);
    }
  }
  return { violations, scanned };
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const root = rootFromArgv();
  const { violations, scanned } = check(root);
  report("lint-loc", violations, `${scanned} file(s) within budget`);
}
