# HUMAN_GATE — two maker loops, one ledger, divergent issue ids

**Opened:** 2026-09-08
**Blocks:** nothing today. Every finding survived and master is green. It blocks *trust in the
audit trail*, which is the thing the ledger exists to provide.

## The question, in one line

Two concurrent maker loops allocate issue ids from the same sequence in `qa/issues.jsonl`. **Should
they share a ledger at all**, and if so, how are ids allocated so two loops cannot claim the same
number?

## What happened (observed, not inferred)

Separate `git worktree`s were adopted precisely to stop concurrent loops colliding. They work for
files. They do **nothing** for a shared counter.

| # | Occurrence | Resolution |
|---|---|---|
| 1 | Both loops allocated **ISS-100** for different findings | mine renumbered to ISS-101 |
| 2 | Both loops allocated **ISS-102 and ISS-103** for different findings | mine renumbered to ISS-114/115 |
| 3 | The same findings carry **different ids in each loop** | unresolved — see below |

The third is the one that matters. The speaker-seam findings my lane filed as ISS-093/095/097/098
exist on master as **ISS-104 / ISS-106 / ISS-108+111 / ISS-109** — the other loop's checker had
independently re-filed them while working its own lane. Nothing was lost. But every manifest,
verdict and commit message produced in `lane/a-speakers` cites the **lane's** numbering, and those
ids now name entirely different defects in the canonical ledger:

| Cited in my artifacts | What that id means on master | Where my finding actually lives |
|---|---|---|
| ISS-093 (the 20-case fabrication corpus) | golden-set pin criterion | **ISS-104** |
| ISS-095 ("Not" missing from the denylist) | golden-set-build import drop | **ISS-106** |
| ISS-097 ("English speaking students") | `router.embed()` doc comment | **ISS-108 / ISS-111** |
| ISS-098 (ten recall regressions) | `buildChunks` duplicate chunks | **ISS-109** |

So a reader following `qa/manifests/speaker-denylist-ledger-corpus.md` to ISS-093 lands on someone
else's golden-set issue. **D-015 requires a fix to be measured against its issue's own recorded
reproductions — and that rule is only as good as the id resolving to the right row.**

## Why this needs a human

It is a decision about how the pair is *operated*, not a defect to patch. Reasonable options:

- **One ledger, allocation lock** — an id is reserved by writing the row before work starts, or the
  id is derived from something unique per loop (branch + counter). Keeps one canonical ledger.
- **Per-lane ledgers, merged on land** — each worktree owns `qa/issues.<lane>.jsonl`; ids are
  namespaced (`ISS-A-001`); the sweep reads all of them. No collisions by construction.
- **Only one loop may file issues** — the second runs read-only against the ledger. Simplest,
  least parallel.
- **Stop running two loops.** The concurrency has now produced a mutation left in production
  source, two id collisions and a divergent audit trail in one day.

## Not fixed unilaterally

Renumbering my rows to match master would rewrite ids the other loop's artifacts may also cite, and
`qa/issues.jsonl` is the canonical record — quietly rewriting it to make my own manifests look
right is exactly the kind of edit that should need a person. The mapping table above is recorded so
the trail is followable in the meantime.

**Related:** `qa/gates/concurrent-maker-sessions.md` (the file-level half of this problem, already
open).
