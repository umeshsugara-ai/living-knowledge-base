# Verdict — index-skip-surfacing

**Date:** 2026-09-08
**Mode:** A (unit check)
**Bound root:** `D:\KnowledgeBase`
**Contract:** `qa/contracts/ingest-indexing-pipeline.md`
**Manifest:** `qa/manifests/index-skip-surfacing.md`
**Cycle checked: 1**
**HEAD at check:** `958223a`

---

## VERDICT: PASS

**SCOREBOARD:** 11/11 criteria met (C6 with a documented, pre-existing exception), 3/3 relevant
invariants hold.

---

## What I re-ran myself (nothing below is copied from the manifest)

| Command | My result |
|---|---|
| `pnpm --filter @lkb/api typecheck` | exit 0 |
| `pnpm --filter @lkb/api test` | exit 0 — `tests 124 · pass 124 · fail 0` |
| `pnpm -r typecheck` | exit 0 |
| `pnpm -r test` | exit 0, no `✖` lines anywhere in the log |
| all 8 `lint:structure` gates individually, by exit code | 7/8 exit 0; `tracker-audit --gate g1` exit 1 (see C6) |
| mutation A (the maker's claimed one) | `pass 122 · fail 2` — reproduced exactly |
| mutation B (my own, on the operator surface) | `pass 124 · fail 0` — see ISS-118 |
| `mutate.mjs assert-clean` + `git diff --quiet HEAD` on all three mutated files | clean, restored byte-identical |

---

## The three things the dispatch asked me to press

### 1. Disclosure #2 — is a `console.warn` an honest operator surface? **Ruling: it is enough for
this unit, and NOT enough for the pipeline. PASS, with ISS-118 opened at high.**

I am ruling explicitly because the maker explicitly invited a FAIL, and it deserves a reasoned
answer rather than a reflex either way.

**Why not a FAIL.**

- The sweep's queue row 1 says, verbatim: *"Surface `skipped` where an operator **or** a test can
  read it."* That is a disjunction, and the test half is not merely present — I mutation-killed it
  myself (mutation A below). The literal ask is discharged.
- No criterion in `ingest-indexing-pipeline.md` requires a durable record. C3 governs what
  `indexSession` writes; C4 governs the ingest paths and asks only that a failed indexing call be
  *"logged and swallowed"* — which is what both paths now do, with strictly more information than
  before. Failing a unit against a rule the contract does not contain would be me inventing a
  criterion at verdict time, which is precisely what the "never decide a rule beside a pending
  verdict" clause exists to stop.
- The **defect named in ISS-116 is actually closed.** The concealment was that `indexSession`'s
  own caller could not distinguish a session with vectors from one without: the value was
  *discarded at the call site*. It no longer is. That is a structural fix, not a cosmetic one, and
  it is the half that a durable row would have to be built on top of anyway.
- The maker's reason for stopping is sound and I checked it rather than accepting it: `gaps`,
  `jobs` and a `sessions.status.vector` field each require a schema decision, and `lint-migrations`
  + the `schema/` contract make that a governed change. Smuggling a schema change into a
  concealment fix would have been the worse outcome.

**Why it is nevertheless not sufficient, and why I am not letting it evaporate.**

I ran my own mutation on the half the maker called weak, and it is weaker than "weak": I replaced
`if (res.chunks.skipped)` with `if (false && res.chunks.skipped)` in **both**
`apps/api/src/ingest-store.ts:71` and `apps/api/src/whatsapp-store.ts:169` simultaneously, and the
suite stayed at **124 pass / 0 fail**. The entire operator-facing surface of this unit can be
deleted by anyone, at any time, and nothing in this repo notices. Combined with the fact that
ISS-116 was found by the sweep *querying `chunks` directly* — not from a log line that had been
printing all along — the honest statement is: the loss is now *inspectable in code and asserted in
tests*, and still *not auditable by an operator after the fact*.

So: **ISS-118, severity high**, naming the `gaps` row the maker itself said it would build next,
and requiring that the record be asserted against the injected fake db so it is mutation-killable
the way the return value now is. That is the next unit, not a re-run of this one. Round cap is not
in play: this is the first PASS on this seam and the finding is coverage-class, not security-class,
so it is filed and queued rather than forced into a round 2 of the same unit.

### 2. `BoundIndexer` widened from `Promise<void>` to `Promise<IndexSessionResult>` — **no silent
consumer. Confirmed.**

Repo-wide grep (`.ts`/`.tsx`/`.mjs`, node_modules excluded) finds exactly four references outside
`indexing.ts`: a type-only import + parameter position in `ingest-store.ts:17,33`, the same pair in
`whatsapp-store.ts:15,101`, and the single producer in `production.ts:70`. No union member, no
callback position, no test double typed as `BoundIndexer`, no script consumer. The direction of the
widening is the safe one for the producer, and the parameter positions are *contravariant* — a
caller still supplying a `Promise<void>` function would now fail to compile rather than pass
silently, and `pnpm -r typecheck` is green across all nine packages. Disclosure #1 is discharged.

One residue: `apps/api/src/production.ts:67` still says the composition roots *"only ever call
`(tenantId, sessionId) => Promise<void>`"*, immediately above the binding this unit widened. Filed
low as **ISS-119** — ledger entry only, never a pulled unit.

### 3. The mutation proof, including the third test's staying green — **verified, and the maker's
reasoning is correct.**

I did not accept the pasted block. I armed `apps/api/src/indexing.ts` via
`node scripts/lib/mutate.mjs apply`, forced `skipped` to `null` in `indexSession`'s returned
object, and got **`tests 124 · pass 122 · fail 2`**, the two failures being exactly:

- `indexSession SURFACES an embedding failure in its return — a skip must not look like success`
- `indexSession reports 'no-embedder' distinctly from a failure — an install without embeddings is not broken`

The third new test — *"reports a real chunk write, so success is positively evidenced"* — asserts
`res.chunks.skipped === null` **and** `res.chunks.written > 0`. Forcing `skipped` to `null` makes
its first assertion trivially true, and the mutation does not touch `written`, so it correctly stays
green. That is not a hole; a mutation that reddened all three would mean all three were asserting
the same proposition. The maker stating this rather than claiming 3/3 is the right call and I am
recording that it survived independent re-derivation.

Restore verified: `mutate.mjs restore` reported byte-identical to HEAD, `assert-clean` reported no
outstanding mutations, and `git diff --quiet HEAD -- apps/api/src/indexing.ts` was clean afterwards
for all three files I touched.

### 4. ISS-117 / `tracker-audit --gate g1` — **pre-existing and correctly disclaimed, but ISS-117
alone will not turn the gate green.**

`node scripts/tracker-audit.mjs --gate g1` exits 1 at HEAD with **three** lines, not two:

```
G1 status:  U2.4 uses unknown status "partial" in TASKS.md
G1 row-set: in goal.json but not TASKS.md — U1.0
G1 status:  U2.4 is "pending" in goal.json but "partial" in TASKS.md
```

Both conditions predate this unit — I checked rather than assumed: `git show 39e9149:TASKS.md`
already carries `U2.4 | partial` and has no `U1.0` row, and `git show 39e9149:.goal/goal.json`
already carries the `U1.0` task. The only working-tree change to `.goal/goal.json` is a timestamp
and a velocity decimal. So nothing in this unit's diff contributes to the red gate, and the
manifest's disclosure #4 is accurate. The U1.0 row-set line is not covered by ISS-117's text —
filed as **ISS-120** (medium) so that closing ISS-117 is not mistaken for turning the gate green.

---

## Criterion-by-criterion

| # | Verdict | Evidence |
|---|---|---|
| C1 / C1a | met (untouched, re-verified) | `indexing.ts:197-215` — degraded summary still checks `existingPage` before touching `session_pages`; suite green. |
| C2 / C2a | met (untouched, re-verified) | `indexing.ts:222-239` — delete and insert still governed by the same `!claimsDegraded` condition; the ISS-056 shape is not reintroduced by the return-value change. |
| C3 | met | `indexSession` still writes `session_pages`, `claims`, `tree_index`, and flips `status.index` to `"done"`; the new return is appended at `indexing.ts:271` after all of it, changing no write decision. Zero-turn edge case still skips the page and still runs the tree/status step. |
| C3a | met | Every collection except `tree_index` still reached via `scopedCollection` (`indexing.ts:171-174`, `102`); `tree_index` still via the shared `treeIndexRootFilter` with no `deleteMany` — the disclosed interim exception's two conditions both hold. The standing per-call tenant-confinement test (`indexing.test.ts:167`) passes. |
| C4 | met | `ingest-store.ts:68-82` and `whatsapp-store.ts:166-180` — the indexing call is still `try`-wrapped and swallowed, the ingest still returns its real result, `status.index` honestly stays `"pending"` on a throw. The new `if (res.chunks.skipped)` warn sits inside the same try and cannot itself fail the ingest. |
| C5 | met | `production.ts:70-80` — real `routeComplete`, conditional real `routeEmbed`, wired into both roots; typechecks under the widened type. |
| C6 | **met with a documented exception** | 7 of 8 gates exit 0 individually; `pnpm -r typecheck` and `pnpm -r test` exit 0. `lint:structure` as a whole is red *only* on `tracker-audit --gate g1`, proven above to be pre-existing at `39e9149` and owned by another lane (ISS-117 + ISS-120). I am not charging this unit for a gate it did not break. |
| C7 | met | 3 new tests at `indexing.test.ts:304-327`, one per outcome (failed / no-embedder / real write); 2 of 3 mutation-killed, the third correctly not, for the reason verified above. |
| C8 | not claimed, not credited | Manifest disclosure #3 correctly disclaims corpus re-verification; nothing here changes stored data. C8 remains discharged by `chunk-backfill`'s own live evidence, not by this unit. |

**Issues addressed check.** The manifest claims ISS-116's second (concealment) defect. That claim
holds: the discard at the old `indexing.ts:224-225` is gone and the value reaches both live callers.
ISS-116's ledger row stays `fixed` (its cause half was already fixed by `chunk-backfill`); its
`verified_date` stays null — a later re-check moves it, not this one.

---

## ISSUES-WRITTEN

- **ISS-118** (high) — no durable operator-readable record of a vector-index skip; the only operator
  surface is a console.warn that my mutation proves is untested and deletable. Fix direction: the
  `gaps` row, asserted against the injected fake db.
- **ISS-119** (low) — stale `Promise<void>` comment at `production.ts:67`. Ledger only.
- **ISS-120** (medium) — second `tracker-audit --gate g1` failure (U1.0 in goal.json, absent from
  TASKS.md) not covered by ISS-117.

## EXPLANATION

PASS. Every command in the manifest was re-run by me and every number reproduced, including the
122/2 mutation split and the specific two tests that redden. The maker's explanation for the third
test staying green is correct, not a rationalisation. The widened `BoundIndexer` has exactly three
consumers, all updated, and the contravariant parameter positions mean a stale consumer would fail
to compile rather than pass silently. On the invited FAIL: I decline it, because the queue row asked
for an operator **or** a test and the test half is now mutation-proven, because no contract criterion
requires a durable record, and because the concealment named in ISS-116 — a discarded return value —
is genuinely gone. But the maker's self-assessment was, if anything, too generous to itself: I
deleted the `console.warn` from both ingest paths at once and the suite did not notice, so the
operator half is not merely weak, it is unguarded. That is ISS-118 at high severity with the `gaps`
row named as the fix — the next unit, on a seam at its first PASS, not another round of this one.

*Written and committed by /checker before returning. Read-only toward all code, manifests, TASKS.md,
`.goal/goal.json`, and the concurrent lane's `speaker-*` files — none were touched.*
