#!/usr/bin/env node
/**
 * scripts/lint-root.mjs — C3: the repo root stays small.
 *  - ≤ root.maxLooseFiles loose files (dotfiles included, directories and .gitignored files excluded)
 *  - ARCHITECTURE.md ≤ root.architectureMaxLines, any root *.md ≤ root.mdMaxLines,
 *    README.md (when present) ≤ root.readmeMaxLines. Budgets: structure.config.json.
 * Usage: node scripts/lint-root.mjs [--root <dir>]
 */
import { basename, join } from "node:path";
import { countLines, gitIgnored, loadConfig, looseFiles, report, rootFromArgv } from "./lib/walk.mjs";

export function check(root, cfg = loadConfig(root)) {
  const c = cfg.root;
  const violations = [];
  const all = looseFiles(root);
  const ignored = gitIgnored(root, all);
  const counted = all.filter((f) => !ignored.has(f));
  if (counted.length > c.maxLooseFiles) {
    violations.push(`root has ${counted.length} loose files (budget ${c.maxLooseFiles}): ${counted.join(" ")}`);
  }
  for (const f of counted) {
    if (!f.endsWith(".md")) continue;
    const lines = countLines(join(root, f));
    const budget = f === c.architectureFile ? c.architectureMaxLines
      : f === c.readmeFile ? c.readmeMaxLines : c.mdMaxLines;
    if (lines > budget) violations.push(`${f}: ${lines} lines (budget ${budget})`);
  }
  return { violations, counted: counted.length, ignored: ignored.size };
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const { violations, counted, ignored } = check(rootFromArgv());
  report("lint-root", violations, `${counted} loose root file(s), ${ignored} gitignored excluded`);
}
