# QUEUE — top-3 recommended next units (checker sweep 2026-09-08T16:05Z, Mode B)

> Range: `6d4f8e8..a17c47b` — 61 first-parent commits, two lanes merged (`lane/a-speakers` twice).
> **Terminal state: FINDINGS: 1** (ISS-116 high). ISS-113 updated in place, not duplicated.
> A second maker loop is live in this working tree. Nothing outside `qa/QUEUE.md`,
> `qa/.last-sweep` and `qa/issues.jsonl` was written by this sweep.

**Mongo is back, and I confirmed it rather than trusting it.** Raw TCP connect to
`13.202.206.101:27017` in **32 ms**; the real driver then read `lkb`'s 23 collections. ICMP still
reports 100 % loss because ICMP is filtered at that host — **`ping` is not a valid health probe
here, TCP connect is**, and `qa/gates/mongo-host-unreachable.md`'s evidence block leans on it.

**`chunks` is not empty — the premise this sweep was handed was false.** First probe read 1 row;
three minutes later 876, then stable at 876 across three samples 20 s apart. An indexing run landed
*during* this sweep. So the deferred C8 checks are not merely "now dischargeable" — two of the three
are **discharged, on real rows, by this sweep**:

| C8 | Check | Live result |
|---|---|---|
| (b) | `vector.length === dims` for 100 % of rows | **876 / 876** ✅ |
| (c) | every `turnRefs` id resolves to an existing `turns` row | **1328 / 1328** ✅ |
| (a) | `chunks` non-empty for **all 26 sessions** | **23 / 26** ❌ |

**No unit overclaimed, and I looked for it specifically.** `qa/manifests/embed-on-index.md` says in
its own evidence block *"No live row has been written … C8 should stay open until a live run"*, and
its checker held C8 open instead of crediting intent. U1.1 / U1.2 / U1.3 each PASSed on what they
actually evidenced. What three fixture-level PASSes could not see is the one thing only a live run
shows — and the first live run showed it immediately. **That is the deferral working.**

## Top-3

1. **`embed-batching-and-skip-surfacing`** — *maker work, no human, tier 2 (open high issue).*
   **ISS-116.** The three sessions with zero chunks are **exactly the top three by turn count** —
   `visa-blueprint-part2` (291), `creative-futures` (269), `ucas-what-changed` (230) — while the
   largest session that *did* chunk has 134. A monotone cutoff between 230 and 134 is
   **size-dependent, not content-dependent**. 790 of 2118 turns (**37 % of the corpus**) are absent
   from the vector index, and `2118 − 1328 = 790` exactly: nothing is partially covered, three whole
   sessions were skipped. Two defects, one unit, because they are cause and concealment:
   - `apps/api/src/indexing.ts:100` embeds every plan in **one unbatched call** with no size bound.
     Batch it, with the bound derived from the provider's documented limit, not guessed.
   - `apps/api/src/indexing.ts:224-225` **discards** `writeSessionChunks`'s
     `{ written, skipped }`, so `indexSession` reports success and no job row, session field or
     ledger records the loss. Surface `skipped` where an operator or a test can read it.

   **Full ceremony**, despite this not being a security finding: `.claude/CLAUDE.md`'s severity gate
   gives ceremony to anything touching **data writes regardless of severity**. **No round-cap
   concern** — this is the *first* live exercise of the U1.3 seam; every prior PASS on it was
   measured against fixtures. Per D-015, the standing regression must replay **ISS-116's own recorded
   reproduction** — re-index those three named sessions and assert 26/26 — not a corpus the maker
   picks. C8(a) is the acceptance criterion and it is already written; do not restate it more weakly.

2. **`close-out-mongo-host-gate`** — *maker work, no human, one file, small.*
   `qa/gates/mongo-host-unreachable.md` is **self-resolved**: its blocking condition no longer
   exists, nothing was built past it while it was open, and it needs **no answer from Umesh** — only
   a close-out line recording that the host came back on its own, with the TCP evidence above.
   Gates are maker-owned; this sweep does not edit them. While there, correct the gate's own
   diagnostic: it treats `ping` 100 % loss as corroboration, and ICMP is filtered at that host, so
   that line would have read identically on a perfectly healthy server.

3. **`ledger-id-allocation`** — *HUMAN_GATE already open; the evidence changed under it.*
   `qa/gates/ledger-id-divergence.md` predicted this and **it happened during this sweep**: I read
   `max(id) = 113`, wrote `ISS-114`, and found `lane/a-speakers` had committed *its own* ISS-114 and
   ISS-115 in the interval. Mine was renumbered to **ISS-116**; the ledger re-validates at 116 rows,
   0 parse errors, 0 duplicate ids. This is at least the third occurrence. The gate should now be
   read as **demonstrated, not anticipated** — worth telling Umesh when he answers it, because
   "it will recur on the next merge" has stopped being a forecast.

## Not queued, deliberately

- **`speaker-verbatim-token-boundary` is at `ready-for-check` cycle 3 with a matching cycle-3 FAIL
  verdict** (`e290653`, twelve minutes after the manifest). That is a **fix gap, not a dispatch
  gap**, and five source commits under `packages/index/src/pipeline/` postdate it — that lane is
  demonstrably working the FAIL. Belongs to the concurrent lane; not filed, not touched.
- **Unmanifested source commits in range.** Same ruling as the last two sweeps: non-security,
  non-auth, non-tenancy classes are exactly what the severity gate routes away from full ceremony.
  Filing them would be the ledger inflation D-013 exists to stop.
- **`ai-transport.ts:17`'s bare `catch`** returns raw text on unparseable JSON. That is the
  documented contract of a best-effort parse, not a masked failure. Not filed.

## For the Approver — out of band, not a unit

The production host serves a database named **`READ__ME_TO_RECOVER_YOUR_DATA`** alongside `lkb`.
That is a ransomware calling card on the same `mongod` this project writes to. It is entirely
outside this repo's governance and nothing here can act on it, so it is neither a unit nor a ledger
row — but it is the most consequential thing this sweep saw, and a sweep that noticed it and stayed
quiet would be running the same trick ISS-116 is about. **Raise it with Umesh directly.**

## Standing

ISS-104 (critical, open) — `lane/a-speakers`', flagged as theirs in `bd438e1`; not this lane's to
take. ISS-087 (medium) — the `loop-safety` C7/C8 ratification gate, unchanged, still awaiting one
line from Umesh. ISS-088 (low) — tracker-audit G2 can never go green. ISS-085 (medium) — no test
counts `turns` queries. ISS-050/051/052/073/081/082 — ruled file-don't-fix.
