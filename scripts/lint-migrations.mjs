#!/usr/bin/env node
/**
 * scripts/lint-migrations.mjs — C5: no migrate-*.{mjs,js,ts,py} anywhere outside migrations/
 * (the ERP dated-patch-script pattern). Config: structure.config.json → migrations.
 * Usage: node scripts/lint-migrations.mjs [--root <dir>]
 */
import { basename } from "node:path";
import { loadConfig, report, rootFromArgv, walk } from "./lib/walk.mjs";

export function check(root, cfg = loadConfig(root)) {
  const m = cfg.migrations;
  const re = new RegExp(m.pattern);
  const allowed = m.dir.replace(/\/?$/, "/");
  const ignore = [...cfg.ignoreDirs, ...(m.extraIgnoreDirs ?? [])];
  const violations = [];
  let scanned = 0;
  for (const { rel } of walk(root, root, ignore)) {
    scanned++;
    if (re.test(basename(rel)) && !rel.startsWith(allowed)) {
      violations.push(`${rel} (migration scripts live only under ${allowed})`);
    }
  }
  return { violations, scanned };
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const { violations, scanned } = check(rootFromArgv());
  report("lint-migrations", violations, `${scanned} file(s) scanned`);
}
