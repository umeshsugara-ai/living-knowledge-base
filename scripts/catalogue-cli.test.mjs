/**
 * scripts/catalogue-cli.test.mjs — BEHAVIOURAL cover for the progress scorer's CLI gates.
 *
 * Split out of catalogue.test.mjs, which had reached 278/300 LOC (extract, don't append). The
 * split is also the right seam: catalogue.test.mjs unit-tests pure scoring functions, this file
 * runs the real CLI against the real repo and asserts what it DOES.
 *
 * That distinction is the whole point. A previous version of these gates was "tested" by asserting
 * the CLI's source text matched /process\.exit\(2\)/ — worthless, because the regex matched other
 * exits in the same file, so flipping the gate's own exit(2) to exit(0) left every test green while
 * --check passed at a 39.5% headline (ISS-038). A gate is pinned by its exit status or not at all.
 *
 * No fixture repo is needed: THIS repo is the fixture. Every test tampers with a tracked file and
 * restores it in a `finally`, then puts docs/PROGRESS.md back in step.
 * Run: node --test scripts/catalogue-cli.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const CLI = fileURLToPath(new URL("./catalogue-score.mjs", import.meta.url));
const DOC = join(REPO, "docs", "PROGRESS.md");

const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: REPO, encoding: "utf8" });

/**
 * Corrupt a tracked file, run `fn`, then restore BOTH it and the generated doc.
 *
 * The doc restore lives inside the finally deliberately: it used to sit after the assertions, so a
 * throwing test left an inflated docs/PROGRESS.md behind with a banner and --check exit 1 — a test
 * suite that dirties what it measures (ISS-046).
 */
function whileTampered(relPath, mutate, fn) {
  const abs = join(REPO, relPath);
  const original = readFileSync(abs);
  const originalDoc = existsSync(DOC) ? readFileSync(DOC) : null;
  try {
    writeFileSync(abs, mutate(original.toString("utf8")));
    return fn();
  } finally {
    writeFileSync(abs, original);
    if (originalDoc) writeFileSync(DOC, originalDoc);
  }
}

const inflateCounts = (text) => {
  const d = JSON.parse(text);
  d.collections = Object.fromEntries(Object.entries(d.collections).map(([k, v]) => [k, v === 0 ? 4242 : v]));
  return JSON.stringify(d, null, 2);
};

/** The evidence file the scorer will actually choose. */
function currentEvidenceRel() {
  const doc = readFileSync(DOC, "utf8");
  const m = doc.match(/Collection counts from `([^`]+)`/);
  assert.ok(m, "the generated doc must name its evidence file");
  return m[1];
}

test("baseline: `--check` exits 0 on a clean tree", () => {
  const r = run("--check");
  assert.equal(r.status, 0, `expected clean --check, got: ${r.stderr || r.stdout}`);
});

test("`--check` EXITS 2 on evidence that no longer matches HEAD", () => {
  // ISS-038. Asserted by running the CLI, never by reading its source.
  const status = whileTampered(currentEvidenceRel(), inflateCounts, () => run("--check").status);
  assert.equal(status, 2);
});

test("`--check` EXITS 2 when the CATALOGUE is tampered (probes repointed, downgrades nulled)", () => {
  // ISS-041, +42.1 points. Neither prior guard could see this: the probe fingerprint is printed by
  // the same run that regenerates it, and DELETING a downgrade is not an upgrade.
  const tamper = (text) => {
    const d = JSON.parse(text);
    for (const f of d.features) {
      if (!f.probes || Object.keys(f.probes).length === 0) f.probes = { collections: ["claims"] };
      f.manual = null;
    }
    return JSON.stringify(d, null, 2);
  };
  const { status, stderr } = whileTampered(".goal/catalogue.json", tamper, () => run("--check"));
  assert.equal(status, 2);
  assert.match(stderr, /catalogue\.json is not what the repository holds/);
});

test("`--check` EXITS 2 when SCRAPED SOURCE is uncommitted — the input set is derived, not listed", () => {
  // ISS-047, the seventh layer: the route/page/package scrapers read source with no trust check, so
  // uncommitted edits bought +10.5 points with every gate green and no banner. Also a live hazard —
  // anyone on a feature branch would otherwise commit a score measuring their working tree.
  const addRoutes = (text) =>
    text.replace("            </Routes>", '              <Route path="/ask" element={<DashboardPage />} />\n            </Routes>');
  const { status, stderr } = whileTampered("apps/web/src/App.tsx", addRoutes, () => run("--check"));
  assert.equal(status, 2, "an uncommitted scraped source file must fail the gate");
  assert.match(stderr, /App\.tsx is not what the repository holds/);
});

test("`--check` EXITS 2 on a GITIGNORED scraped file — `git status` says nothing about ignored files", () => {
  // The blind spot behind the trust check: `git status --porcelain --untracked-files=all` reports
  // ignored files zero times, and .gitignore is not itself a scraped input, so adding a line to it
  // was free. Membership in `git ls-files` is the check that does not depend on status output.
  const ghost = join(REPO, "apps", "api", "src", "routes", "ghost.ts");
  const gitignore = join(REPO, ".gitignore");
  const originalIgnore = readFileSync(gitignore);
  try {
    writeFileSync(gitignore, `${originalIgnore.toString("utf8")}\napps/api/src/routes/ghost.ts\n`);
    writeFileSync(ghost, 'import { Router } from "express";\nexport const ghost = Router();\nghost.get("/topics", (_q, s) => s.json([]));\n');
    const seenByStatus = spawnSync("git", ["status", "--porcelain", "--untracked-files=all", "--", "apps/api/src/routes/ghost.ts"],
      { cwd: REPO, encoding: "utf8" }).stdout.trim();
    assert.equal(seenByStatus, "", "precondition: the file must be invisible to git status");
    const { status, stderr } = run("--check");
    assert.equal(status, 2, "a scraped file that git status cannot see must still fail the gate");
    assert.match(stderr, /ghost\.ts is not what the repository holds/);
  } finally {
    rmSync(ghost, { force: true });
    writeFileSync(gitignore, originalIgnore);
    run();
  }
});

test("`--check` EXITS 2 on a manual UPGRADE, and says which feature", () => {
  // ISS-044: the upgrade refusal had no behavioural test — `if (score.upgrades.length > 0)`
  // could be changed to `if (false)` with every test still green.
  const upgrade = (text) => {
    const d = JSON.parse(text);
    const target = d.features.find((f) => f.probes?.collections?.includes("chunks")) ?? d.features[0];
    target.manual = { verdict: "REAL", reason: "test" };
    return JSON.stringify(d, null, 2);
  };
  const { status, stderr } = whileTampered(".goal/catalogue.json", upgrade, () => run("--check"));
  assert.equal(status, 2);
  assert.match(stderr, /UPGRADE a derived verdict/);
});

test("`--check` EXITS 2 on a dropped feature (denominator)", () => {
  const drop = (text) => {
    const d = JSON.parse(text);
    d.features.pop();
    return JSON.stringify(d, null, 2);
  };
  const { status, stderr } = whileTampered(".goal/catalogue.json", drop, () => run("--check"));
  assert.equal(status, 2);
  assert.match(stderr, /denominator drifted/);
});

test("`--check` EXITS 1 (stale), not 2, when only the generated doc is out of date", () => {
  // The staleness gate must stay distinguishable from the trust refusals.
  const original = readFileSync(DOC);
  try {
    writeFileSync(DOC, `${original.toString("utf8")}\ntampered\n`);
    assert.equal(run("--check").status, 1);
  } finally { writeFileSync(DOC, original); }
});

test("`--check` tolerates CRLF in the committed doc — no false STALE on a fresh checkout", () => {
  // ISS-045: the lf() normalisation shipped for ISS-043 was load-bearing but unpinned — deleting it
  // left every test green while --check went STALE on an untouched clone under core.autocrlf=true.
  const original = readFileSync(DOC);
  try {
    writeFileSync(DOC, original.toString("utf8").replace(/\r?\n/g, "\r\n"));
    assert.equal(run("--check").status, 0, "CRLF materialisation must not read as stale");
  } finally { writeFileSync(DOC, original); }
});

test("write mode still produces the doc from untrusted input, but announces it", () => {
  const out = whileTampered(currentEvidenceRel(), inflateCounts, () => {
    run();
    return readFileSync(DOC, "utf8");
  });
  assert.match(out, /EDITED SINCE COMMIT/);
});

test("EVERY scraper reads through the recorder — dropping one from generate() must fail", async () => {
  // ISS-048 / contract I14's own test clause, which the previous cycle shipped without.
  // The derived-input mechanism is only as good as its coverage: changing ONE call from
  // `reachablePackages(root, reader.read)` back to `reachablePackages(root)` — an entirely
  // plausible refactor — survived all 44 tests and lint:structure while silently dropping ~460 of
  // 472 files out of the trust check, so a modified packages/ file scored with exit 0 and no
  // banner. Asserting a count is not enough; each scraper's own territory must be represented.
  const { generate } = await import("./catalogue-score.mjs");
  const files = generate(REPO).score.scrapedFiles;

  const territories = {
    "route scraper (apps/api/src/routes/)": (f) => f.startsWith("apps/api/src/routes/"),
    "page scraper (apps/web/src/App.tsx)": (f) => f === "apps/web/src/App.tsx",
    "package scraper (packages/)": (f) => f.startsWith("packages/"),
    "package scraper (apps/, non-route)": (f) => f.startsWith("apps/api/src/") && !f.startsWith("apps/api/src/routes/"),
  };
  for (const [name, matches] of Object.entries(territories)) {
    assert.ok(files.some(matches), `${name} did not read through the recorder — its files are untrusted`);
  }
  // The package scraper walks the whole workspace, so it dominates the count (measured: 228 total
  // — 22 route files, 43 under apps/web, 21 other apps/api, 142 under packages/). A collapse below
  // this floor means a scraper stopped recording even though every territory still had one
  // representative. Threshold set from the measured value with headroom, NOT from memory: the
  // first draft asserted >300 on a hand-carried "472" that was simply wrong, and this test caught
  // it — the fourth number I have mis-stated in this instrument's history.
  assert.ok(files.length > 150, `expected the scrapers to read hundreds of files, recorded only ${files.length}`);
});

test("the suite leaves the repo clean — no tracked file is left modified", () => {
  // ISS-046 in assertion form: if any test above failed to restore, this catches it.
  const dirty = spawnSync("git", ["status", "--porcelain", "--", "docs/PROGRESS.md", ".goal/catalogue.json", "apps/web/src/App.tsx"],
    { cwd: REPO, encoding: "utf8" }).stdout.trim();
  const contentChanged = spawnSync("git", ["diff", "--quiet", "HEAD", "--", ".goal/catalogue.json", "apps/web/src/App.tsx"],
    { cwd: REPO }).status;
  assert.equal(contentChanged, 0, `tests left tracked input files modified:\n${dirty}`);
});
