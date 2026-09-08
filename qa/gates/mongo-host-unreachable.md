# HUMAN_GATE — the database host is unreachable, and only you can restart it

**Opened:** 2026-09-08T15:00:00Z
**Blocks:** every live verification, and (if this is the production store) the running product.
**Needs:** an infrastructure action outside this repo. Nothing here can fix it.

## What is measured, not inferred

`13.202.206.101:27017` — the store named by `MONGODB_URL`:

```
ping         2 packets sent, 0 received, 100% loss
TCP :27017   TIMEOUT after 8000 ms  (not "connection refused")
driver       Server selection timed out — 7 attempts across ~2 hours
```

**`TIMEOUT`, not `ECONNREFUSED`, is the diagnostic detail.** A refused connection means the host is
up and nothing is listening on that port — a `mongod` problem. A timeout with 100% packet loss
means the **host is not answering at all**: stopped instance, changed security group, or a network
path change. So this is not a database fault to debug from here.

## Why it matters beyond QA

If this instance backs the running API, then `/ask`, `/search`, `/sessions` and `/citations` are
all down right now, along with the 26 sessions, 2,118 turns and the tree index. **Nothing in this
repo can tell the difference between "the QA database is down" and "the product is down"** — same
host, same URL.

## What it is blocking here

Three PASSed units carry an explicitly **UNVERIFIED** live half rather than a passed one:

| unit | what cannot be checked |
|---|---|
| `chunk-schema-and-chunker` | the `chunks` collection's real state |
| `embed-on-index` | **C8 / ISS-113** — 26-session non-emptiness, `vector.length === dims` **as rows**, `turnRefs` resolution |
| earlier search units | live parity re-runs |

That debt is **deferred, not hidden** — each is a ledger row or a stated UNVERIFIED, and no timeout
was ever converted into a pass or a fail. But it compounds: `U1.4` (cosine retrieval) and `U1.5`
(hybrid merge) are both next, and both are ultimately judged on a **recall delta measured over real
rows**. Building them is still worthwhile — the retrieval maths is pure and genuinely testable — but
the further we go, the more lands in one big unverified batch.

## The decision

1. **Restart / reachability-fix the instance** (AWS console, security group, or whatever changed),
   then say so — one live run discharges most of the backlog at once.
2. **Point `MONGODB_URL` at a local `mongod`** for verification purposes. Unblocks the row-level
   checks immediately; the numbers then describe a local corpus, not production, and every claim
   must say which.
3. **Keep building the pure layers and accept the growing unverified batch**, on the understanding
   that the first live run may surface several units' worth of problems at once.

**My recommendation: 1, and if it will not be quick, 3 in the meantime** — the retrieval work is
pure functions over injected data, which is the most honestly testable kind of unit we have. I will
keep flagging the batch size each tick rather than letting it become background noise.

**I have not tried to restart anything.** Infrastructure changes are outward-facing and yours.

**Answered:** 2026-09-08 — SELF-RESOLVED (see the close-out note above). Left no longer pending.

**Answered:** 2026-09-08 — SELF-RESOLVED, no human decision was needed — maker tick, verified by
re-probe. TCP :27017 connects in ~31 ms and the driver reads all 23 `lkb` collections; the host
came back on its own. **Correction to this gate's own evidence:** ICMP `ping` still shows 100%
loss and always would, because ICMP is filtered at that host — `ping` was never a valid health
probe here and the "100% packet loss" line above overstates what it can prove. TCP connect is the
signal. Last night both agreed, so the wrong conclusion was not drawn, but the reasoning was luckier
than it looked. Nothing was built past this gate while it was open, and the deferred C8/ISS-113
row-level checks were discharged on real rows in the `chunk-backfill` unit (26/26 sessions, 0 dim
mismatches, 0 dangling turnRefs).
