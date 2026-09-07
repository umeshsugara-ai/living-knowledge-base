# Verdict — bom-and-unreadable-evidence

**Manifest:** qa/manifests/bom-and-unreadable-evidence.md
**Cycle checked: 1**
**Date:** 2026-09-07
**Checker:** fresh subagent, Mode A, bound to `D:/KnowledgeBase`
**Mode:** independent re-execution — every number below was produced by this checker, not read
from the manifest.

```
VERDICT: PASS
SCOREBOARD: fix_direction matches ISS-040 · diff matches manifest claims · 21/21 tests green ·
mutation test independently reproduced (20/21, only the BOM test reddens) · score unchanged ·
lint:structure and lint:score both clean
FAILURES: none
```

## 1. Ledger cross-check

`qa/issues.jsonl` ISS-040 `fix_direction`: "Strip a leading BOM before JSON.parse, and print a
one-line warning naming any live-* candidate that could not be parsed instead of continuing in
silence." Matches the manifest's "What changed" section exactly.

## 2. Diff re-read (not trusted from the manifest)

`git diff -- scripts/lib/evidence.mjs scripts/catalogue-score.mjs scripts/catalogue.test.mjs`,
read in full by me:

- `scripts/lib/evidence.mjs`, `loadCollectionCounts`: leading UTF-8 BOM (`String.fromCharCode(0xfeff)`)
  stripped via regex before `JSON.parse`. The `catch` block now does
  `unreadable.push({ rel, reason: err.message }); continue;` instead of a bare `continue`.
  `unreadable` is returned on all three code paths — `!existsSync(dir)`, `runs.length === 0`, and
  the normal return. Confirmed present, matches the claim.
- `scripts/catalogue-score.mjs`: destructures `unreadable` from `loadCollectionCounts` and maps it
  into a `> **UNREADABLE EVIDENCE — ...**` line rendered into the same warnings list as existing
  trust warnings. Confirmed.
- `scripts/catalogue.test.mjs`: two new tests present — "a BOM-prefixed preflight.json is parsed,
  not skipped (ISS-040)" and "a genuinely malformed preflight.json is reported, not silently
  skipped (ISS-040)". Confirmed, both assert the behavior described (BOM file parses to
  `unreadable: []`; malformed file lands in `unreadable` with a `/JSON/i` message while a sibling
  good run still scores).

## 3. Full suite, run by me

```
$ node --test scripts/catalogue.test.mjs
✔ a BOM-prefixed preflight.json is parsed, not skipped (ISS-040) (48.1...ms)
✔ a genuinely malformed preflight.json is reported, not silently skipped (ISS-040) (42.4...ms)
...
ℹ tests 21
ℹ pass 21
ℹ fail 0
```
21/21, matching the claim. Both ISS-040-named tests present and green.

## 4. Independent mutation test (not trusted, reproduced from scratch)

Backed up `scripts/lib/evidence.mjs` to scratchpad first. Then reverted the BOM-strip line in
`loadCollectionCounts` back to `pre = JSON.parse(readFileSync(abs, "utf8"));` (removing the
`.replace(new RegExp(...), "")` step), leaving the `unreadable`-push `catch` in place. Confirmed
via `git diff -- scripts/lib/evidence.mjs` that the file content had genuinely changed before
running anything.

Re-ran the suite:

```
✖ a BOM-prefixed preflight.json is parsed, not skipped (ISS-040) (2.8ms)
  TypeError: Cannot read properties of null (reading 'chunks')
✔ a genuinely malformed preflight.json is reported, not silently skipped (ISS-040) (33.8ms)
ℹ tests 21
ℹ pass 20
ℹ fail 1
```

Exactly the BOM-parsing test reddened — a `TypeError` on `counts.chunks` because with the BOM
un-stripped the file is again unparseable and `counts` reverts to `null`, matching the pre-fix
failure mode. No other test was affected. This proves the test genuinely exercises the fix rather
than passing vacuously.

Restored the file from the scratchpad backup and confirmed byte-for-byte correctness by
re-running `git diff -- scripts/lib/evidence.mjs`, which reproduced the exact same diff hunk
captured in step 2 above (identical `+`/`-` lines, nothing extra, nothing missing). Re-ran the
suite: back to 21/21 green.

```
$ git status --porcelain -- scripts/lib/evidence.mjs
 M scripts/lib/evidence.mjs   (matches the pre-existing ready-for-check state; not a leftover
                                mutation — see the diff comparison above)
```

## 5. Score stability

```
$ node scripts/catalogue-score.mjs
wrote docs/PROGRESS.md — 20.2% adjusted / 28.9% machine-derived, 57 features
$ git diff --stat -- docs/PROGRESS.md
(no output — no diff)
```
Confirmed: this unit does not move today's score, only the failure-mode behavior for evidence
that doesn't exist in the repo's current `qa/evidence/` directory.

## 6. Broader lint gates

Checked `package.json` scripts directly rather than assuming:

```
$ pnpm lint:structure
lint-loc: OK (218 file(s) within budget)
lint-dirsize: OK (74 dir(s) within budget)
lint-root: OK (15 loose root file(s), 1 gitignored excluded)
lint-dupes: OK (242 unique export(s), 24 unique schema $id(s))
lint-migrations: OK (1091 file(s) scanned)
OK: docs/SNAPSHOT.md matches a fresh regeneration (115 lines, budget 200)
✔ no dependency violations found (242 modules, 712 dependencies cruised)

$ pnpm lint:score
OK: docs/PROGRESS.md is current (20.2% of 57 features)
```
Both clean. No regression elsewhere.

## Conclusion

All five claims in the manifest — fix_direction match, diff content, 21/21 suite, mutation-test
isolation, no score movement — were independently reproduced. PASS.
