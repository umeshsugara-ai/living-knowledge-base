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

---

**Answered:** 2026-09-08 — **option 2, "per-lane ledgers, merged on land"** — recorded as **D-019**
in `docs/DECISIONS.md`, `status: ACTIVE`, `**Approved-by:** Umesh`, committed `05b93cc`. Ids are
namespaced per worktree (`qa/issues.<lane>.jsonl`, `ISS-<LANE>-NNN`), readers take the union, and
**no existing row is renumbered** — D-019 states explicitly that "the divergence already recorded in
`qa/gates/ledger-id-divergence.md` stays as it is, with its mapping table, as the historical record
of what the shared counter cost."

_Scribed onto this gate by the Mode B sweep of 2026-09-08T17:46Z, not by the answering session_ —
this file had no `Answered:` line at all while D-019 named it in `Links`. Filed as **ISS-131**.

**⚠ The mapping table above is no longer accurate, and this sweep did not correct it** (correcting
the historical record is not a checker's call to make unilaterally). Re-derived from
`qa/issues.jsonl` on 2026-09-08 — see **ISS-132**:

- `ISS-097 → ISS-108 / ISS-111` is **wrong**: `ISS-108` is the gazetteer-reachability residue, an
  unrelated finding. The mapping is `ISS-097 → ISS-111` alone.
- `ISS-101` and `ISS-111` carry **byte-identical titles** — they are duplicate canonical rows for
  one finding. `ISS-101` is the row *this gate's own row 1* created as the remedy for the ISS-100
  collision, so that remedy silently left a duplicate behind.
- `ISS-095 → ISS-106` **confirmed** (ISS-106's title opens "ISS-093 residue: … `Not` … NEVER_A_PERSON").
- `ISS-098 → ISS-109` **confirmed** (ISS-109's title opens "The ISS-097 `speaking` gate over-refuses:
  ten legitimate self-introductions").
- `ISS-093 → ISS-104` **unconfirmed**: ISS-104 is about a cycle-2 naming-cue rule failing to close
  C2b, not the 20-case fabrication corpus described here.
