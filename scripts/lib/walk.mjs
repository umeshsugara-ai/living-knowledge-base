/**
 * scripts/lib/walk.mjs — the ONE shared helper for the structure linters (T-017).
 * Config loading, recursive file walking, LOC counting, git-ignore filtering and the
 * common "print violations and exit" tail. Windows-safe: every path handed to callers or
 * printed is POSIX-style relative to the root.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const CONFIG_FILE = "structure.config.json";
const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

/** POSIX form of a path (forward slashes) so regexes and output are OS-independent. */
export function posix(p) {
  return p.split(sep).join("/");
}

/**
 * Resolves the root to lint: `--root <dir>` on the CLI, else the repo root (parent of
 * scripts/). Tests point `--root` at temp fixtures.
 */
export function rootFromArgv(argv = process.argv, fallback = REPO_ROOT) {
  const i = argv.indexOf("--root");
  return i !== -1 && argv[i + 1] ? resolve(argv[i + 1]) : fallback;
}

export function loadConfig(root) {
  return JSON.parse(readFileSync(join(root, CONFIG_FILE), "utf8"));
}

/**
 * Yields every file under `dir` (recursively) as { abs, rel } where rel is POSIX and
 * relative to `root`. Directories whose basename is in `ignoreDirs` are not entered.
 * Missing dirs yield nothing (a root such as apps/ may not exist in a fixture).
 */
export function* walk(root, dir, ignoreDirs = []) {
  const skip = new Set(ignoreDirs);
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      if (!skip.has(e.name)) yield* walk(root, abs, ignoreDirs);
    } else if (e.isFile()) {
      yield { abs, rel: posix(relative(root, abs)) };
    }
  }
}

/** Files directly inside `dir` (non-recursive), excluding directories. */
export function looseFiles(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/** Non-blank line count. */
export function countLoc(abs) {
  return readFileSync(abs, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "").length;
}

/** Total line count (as `wc -l` would report, plus a final unterminated line). */
export function countLines(abs) {
  const text = readFileSync(abs, "utf8");
  if (text === "") return 0;
  const lines = text.split(/\r?\n/);
  return lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

/**
 * Returns the subset of `relPaths` that git ignores in `root`. A root that is not a git
 * work tree (temp fixtures) ignores nothing. Uses `git check-ignore --stdin`.
 */
export function gitIgnored(root, relPaths) {
  if (relPaths.length === 0) return new Set();
  const r = spawnSync("git", ["-C", root, "check-ignore", "--stdin"], {
    input: relPaths.join("\n") + "\n",
    encoding: "utf8",
  });
  // 0 = some ignored, 1 = none ignored, 128/ENOENT = not a repo or no git → nothing ignored
  if (r.error || r.status !== 0) return new Set();
  return new Set(r.stdout.split(/\r?\n/).filter(Boolean).map(posix));
}

export function isDir(abs) {
  try {
    return statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Common tail: prints `name: OK (...)` or one violation per line and exits non-zero.
 * `violations` is an array of strings.
 */
export function report(name, violations, okNote = "") {
  if (violations.length === 0) {
    console.log(`${name}: OK${okNote ? ` (${okNote})` : ""}`);
    return;
  }
  console.error(`${name}: FAIL — ${violations.length} violation(s)`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
