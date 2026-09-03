#!/usr/bin/env node
/**
 * scripts/lint-dupes.mjs — C4: one exported symbol per concept.
 *  - two files under packages/ must not export the same declared name
 *    (export function|const|class|type|interface <Name>); generated/ and index.ts re-exports excluded
 *  - two schema/*.schema.json must not share a $id
 * Config: structure.config.json → dupes. Usage: node scripts/lint-dupes.mjs [--root <dir>]
 */
import { basename, join } from "node:path";
import { readFileSync } from "node:fs";
import { loadConfig, report, rootFromArgv, walk } from "./lib/walk.mjs";

function collectExports(root, cfg) {
  const d = cfg.dupes;
  const re = new RegExp(d.exportPattern, "gm");
  const byName = new Map();
  for (const { abs, rel } of walk(root, join(root, d.root), cfg.ignoreDirs)) {
    if (!d.extensions.some((e) => rel.endsWith(e)) || d.excludeFiles.includes(basename(rel))) continue;
    const src = readFileSync(abs, "utf8");
    for (const m of src.matchAll(re)) {
      const name = m[1];
      if (!byName.has(name)) byName.set(name, new Set());
      byName.get(name).add(rel);
    }
  }
  return byName;
}

function collectSchemaIds(root, cfg) {
  const d = cfg.dupes;
  const byId = new Map();
  for (const { abs, rel } of walk(root, join(root, d.schemaDir), cfg.ignoreDirs)) {
    if (!rel.endsWith(d.schemaSuffix)) continue;
    let id;
    try {
      id = JSON.parse(readFileSync(abs, "utf8")).$id;
    } catch {
      continue;
    }
    if (typeof id !== "string") continue;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(rel);
  }
  return byId;
}

export function check(root, cfg = loadConfig(root)) {
  const violations = [];
  const exportsByName = collectExports(root, cfg);
  for (const [name, files] of exportsByName) {
    if (files.size > 1) violations.push(`export '${name}' declared in ${[...files].join(", ")}`);
  }
  const ids = collectSchemaIds(root, cfg);
  for (const [id, files] of ids) {
    if (files.length > 1) violations.push(`schema $id '${id}' shared by ${files.join(", ")}`);
  }
  return { violations, symbols: exportsByName.size, schemas: ids.size };
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const { violations, symbols, schemas } = check(rootFromArgv());
  report("lint-dupes", violations, `${symbols} unique export(s), ${schemas} unique schema $id(s)`);
}
