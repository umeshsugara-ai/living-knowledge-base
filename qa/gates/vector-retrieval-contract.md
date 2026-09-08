# HUMAN_GATE — `packages/index/src/vector/` has no contract, and U1.5 is about to build on it

**Opened:** 2026-09-08T20:30:00Z
**Raised by:** the U1.4 checker, at cycle 1 and again — more strongly — at cycle 2.
**Blocks:** U1.5 (hybrid tree + vector + lexical merge into `askV2`) starting honestly.
**Needs:** your approval to create a contract. **A maker may never write one.**

## The situation

U1.4 shipped and PASSed (7/7). But it was judged partly against **plan §10's prose**, because the
contract it names (`ingest-indexing-pipeline.md`) does not cover vector retrieval at all. Both
checkers said so explicitly rather than quietly forcing a mismatched fit.

That was tolerable for U1.4. It is not tolerable for U1.5, and the checker sharpened exactly why:

> **U1.5 inherits 0.935 as the input to a `≥0.85` exit criterion, while the directory it depends on
> has no criteria of its own.**

So the next unit would be measured against a threshold derived from a number produced by code that
nothing has ever specified. That is how a passing gate stops meaning anything.

## Why this is yours and not mine

`checker/SKILL.md` makes contract creation a human-gated START action, and `.claude/CLAUDE.md`
makes `qa/contracts/` read-only to the maker — feedback goes to the inbox, never into a contract.
This is the segregation-of-duties rule that ISS-006 was filed for. I can build to a contract; I
cannot write the one I will be judged against.

## The decision

1. **Run `/checker init-contract vector-retrieval`** (the checker drafts it, you approve it), then
   U1.5 proceeds against real criteria. **Recommended.**
2. **Let U1.5 proceed against plan §10 alone**, with the checker again judging against prose and
   saying so in the verdict. Cheaper now; it means two consecutive units in the retrieval layer
   with no specification, and the ≥0.85 threshold stays ungrounded.
3. **Defer U1.5 entirely** and take a different roadmap unit next (U2.1, promoting `topics`/`orgs`
   from the tree deterministically, is unblocked and is the biggest single lever on the catalogue
   score).

## What I recommend, and what I will do meanwhile

**1, and 3 in the meantime** — U2.1 is genuinely unblocked, needs no LLM, and moves the score more
than U1.5 does. I will not idle on this gate.

**One thing the contract should settle, whoever writes it:** the standing constraint that
**recall@5 = 0.935 is a FLOOR, citable only with the sibling-session caveat attached, and may not
by itself satisfy a `≥0.85` criterion** while `golden-set-redesign.md` precondition 1 is open. That
constraint currently lives only in a manifest and a verdict. If it is not in a contract, the next
unit inherits the number without the caveat — which is precisely how 1.000 became load-bearing
before the golden set was rebuilt.

**Answered:** _(pending)_
