# QUEUE — top-3 recommended next units (checker sweep 2026-09-08T13:05Z, Mode B)

> Range: `6e9f728..6d4f8e8` — 16 commits, 3 units (`search-store-rank-assertion`,
> `web-ask-page`, `loop-safety-mutation-guard`), all three PASSed and closed out.
> **Terminal state: FINDINGS: 2** (ISS-087 medium, ISS-088 low).
> A second maker loop is live in this working tree; nothing uncommitted was swept into this commit.

**The gate moved.** `qa/gates/golden-set-redesign.md` is **ANSWERED** — `Answered: 2026-09-08 —
Option C (regenerate from raw transcripts) — Umesh, in session`, landed in `a7641bf`. The prior
sweep's "confirmed still open, do not build past it" is superseded. Nothing was built past it while
it was open (`git log 6e9f728..HEAD -- scripts/gen-golden-set.mjs data/eval/` is empty).

**The backlog override worked.** D-013/D-014's stated success test was "a tick selects a `T-###`
roadmap unit rather than a `qa/QUEUE.md` row". `a7641bf` shipped the U3.1 Ask page — the first
roadmap-tier unit in this project's history. The search seam stayed closed; no round 8.

## Top-3

1. **`goal-unblock-t021-t022`** — *maker work, no human, newly unblocked, tier 3 (roadmap).*
   `.goal/goal.json` still carries `T-021` and `T-022` at **`blocked`**, blocked on a gate that was
   answered earlier today. Move both to `pending`, then land the standing re-expression: `T-021`'s
   `done_check` becomes **"the recall report's `assessBaseline` verdict is `informative`"** instead
   of the unfailable `recall@5 >= 0.85`. Still correct under Option C — `assessBaseline`'s verdict is
   a property of the *instrument*, not a threshold on the score, and it evaluates to `saturated`
   (= not done) against today's set, matching the reverted status. Option C additionally authorizes
   the `gen-golden-set.mjs` rewrite (raw `turns.json` not `session_page.json`; different model and
   prompt; real questions; near-neighbour distractors) — that is the follow-on unit, not this one.

2. **`loop-safety-contract-ratification`** — *HUMAN_GATE, one line from Umesh, then maker.*
   ISS-087. `qa/contracts/loop-safety.md` was authored by a unit checker without the START approval,
   on the stated ground that it derives wholly from D-014. C1–C6 and I1–I4 do. **C7 and C8 do not.**
   C8 in particular (*"a recorded decision must be effective where the loop reads it"*) is a new
   repo-wide Lab-Protocol rule binding every future DECISIONS entry, written under an approval scoped
   to a hook branch and a CLAUDE.md paragraph. The contract's own amendment log admits C7/C8 are
   "judgments the checker made", contradicting its gate note. Ask Umesh to ratify or amend C7/C8;
   until then demote them out of the scored Criteria block. Do not delete the contract.

3. **`tracker-audit-g2-severity-scope`** — *maker work, small.* ISS-088. G2 now reports 34 of 36
   `fixed` rows lacking `verified_date`, up from 33 of 35, and it can only ever rise: under the
   severity gate, medium fixes are "verified inside the next unit touching the same file" and low
   fixes are never pulled, so neither path ever writes a `verified_date`. The row shape is correct
   per schema; the **gate** is the defect — a check that can never go green gets read past, and three
   sweeps in a row (mine included) have called it "known project shape". Scope G2 to high/critical, or
   add a terminal `closed-under-severity-gate` status. **Do not backfill `verified_date`.**

## Not queued, deliberately

- **`.claude/CLAUDE.md` cites `ISS-5A`** in its Severity-gate section; that id does not exist in the
  ledger (0 occurrences in 88 rows). The bug meant is **ISS-078**. Low-severity doc defect in the
  operative rule file — per this repo's own Verdict rule, an `EXPLANATION` note, not a backlog row.
  Fix it in passing next time that section is touched.
- **D-014's `Changes-authorized` is narrower than the edit that applied it.** The field says
  "replace the round-cap paragraph … the rest of that section is unchanged"; `50862f3` also rewrote
  the Why paragraph and added the retraction. The *reasoning* is authorized — D-014's Why states the
  retraction explicitly — so this is an under-specified field, not an unauthorized edit. Recorded for
  the Approver; no row.
- **Three source commits in range carry no manifest** (`b66fa04` snapshot tree, `ad01e06` lint
  `.git` exclusion, `fbbafc0` catalogue C2/C3 downgrade). **Not bypasses.** All three are non-security,
  non-auth, non-tenancy, non-data-write, and the severity gate now routes exactly that class away from
  full ceremony. Filing them would be the ledger inflation D-013 was written to stop.

## Standing

ISS-050/051/052 (low, `catalogue-progress-score`) — ruled file-don't-fix. ISS-071 (high) — the
saturation record; now actionable via item 1. ISS-073 (low), ISS-081, ISS-082 — documented bounds,
file-don't-fix. ISS-085 — open. ISS-087/088 — this sweep.
