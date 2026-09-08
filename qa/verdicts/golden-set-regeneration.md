# Verdict — golden-set-regeneration

**Date:** 2026-09-08
**Contract:** qa/contracts/golden-set-recall.md
**Gate (the acceptance authority for this unit):** qa/gates/golden-set-redesign.md — ANSWERED,
Option C, conditions 1–4 binding
**Cycle checked: 1**
**Dual check:** no

```
VERDICT: FAIL
SCOREBOARD: 3/4 gate conditions met (2 and 3 met; 4 correctly out of scope; 1 not met), 2/2 regression gates hold
FAILURES:
- [Gate C1] sev: high · `data/eval/recall-report.json` carries a `goldenSetProvenance` string that
  is now FALSE — it still says "questions are verbatim session_page.keyInsights excerpts … drawn
  from the same pipeline and document as the retrieval target", which describes the OLD set this
  unit deleted · update the hardcoded literal at `scripts/eval-recall.mjs:82-85` to describe the
  Option-C provenance (raw turns, gemini-2.5-pro, near-neighbour prompt, post-filtered) and
  re-run · issue: ISS-091
- [Validity] sev: high · the post-filter's pin check is computed over the SAME page corpus the
  heuristic retriever scores against, so it selects against the retriever: the 17 questions it
  removed score recall@5 = 0.765, while the 75 it kept score 0.307. 0.307 is therefore a
  downward-biased floor, not a neutral estimate, and the manifest does not disclose this · state
  it beside 0.307 (and consider computing the pin check over the turns corpus instead, which is
  not the retrieval surface) · issue: ISS-092
ISSUES-WRITTEN: ISS-091, ISS-092
EXPLANATION: The remedy worked — I reproduced every headline number independently and gate
conditions 2 and 3 hold with room to spare. It fails on honesty of the artifact, which is the one
thing this unit is about: the persisted report still states the old, leaky provenance, and the
headline 0.307 is presented as the retriever's strength when the unit's own filter is what pushed
it down. Both are small fixes; neither is a rebuild.
```

## What I re-ran myself (nothing below is read from the manifest)

| check | my result | manifest claim | agrees |
|---|---|---|---|
| `node scripts/eval-recall.mjs` | recall@5 = **0.30667** (23/75), **52 misses**, control 0.18667, chance floor 0.21739, `verdict: informative`, `saturated: false` | 0.307 / 52 / 0.187 / informative | ✅ |
| diagnostics, NEW set, turns corpus | pin **9.3%** (7/75), overlap mean 0.164 max 0.313 | 9.3%, 0.164, 0.313 | ✅ |
| diagnostics, NEW set, page corpus | pin **0.0%** (0/75), overlap mean 0.071 max 0.214 | 0.0%, 0.071, 0.214 | ✅ |
| diagnostics, OLD set (`git show 7caae39~1:data/eval/golden-set.json`), turns corpus | pin **56.5%** (26/46) | 56.5% | ✅ |
| diagnostics, OLD set, page corpus | pin **100%**, overlap mean **1.000** | (implied) | ✅ |
| `pnpm --filter @lkb/api test` | **109 pass / 0 fail** | 109/109 | ✅ |
| `pnpm -r typecheck` | Done, exit 0 | exit 0 | ✅ |

I did **not** re-run `gen-golden-set.mjs` without `--dry-run`: it makes 23 paid Gemini calls and
would overwrite the artifact under check, which a checker must not do. Everything the generation
claims is instead verified deterministically from its own outputs (below), which is strictly
stronger than a second non-deterministic sample.

## Condition 2 — checked literally, as instructed

**0.30666666666666664**, strictly greater than 0.217 and strictly less than 1.000, with **52**
misses. **Condition 2 is SATISFIED.** This is not 1.000, so the remedy did not fail and this does
**not** escalate to Option B. The metric is falsifiable again — that part of the unit is real.

## Condition 3 — satisfied

Verbatim overlap stays ~0 (mean 0.071 against the scored corpus, 0.164 against turns; max 0.313,
so no near-verbatim question survives) — still not a copy-detection tautology. Pin rate fell
56.5% → 9.3% on the turns corpus, which is "well below 63%" by any reading.

## The tautology claim — the maker is right, and the turns number is not gamed

Confirmed. `gen-golden-set.mjs:145` computes `unique` from **pageText**, and the filter at
`:185` rejects any candidate carrying a page-unique token. So a page-corpus pin rate of exactly
0.0% is arithmetically forced; it is not evidence, and the manifest is right to say so rather
than banking it.

The turns-only figure survives that objection: the filter never optimised against turns
uniqueness, and the two corpora are genuinely different surfaces — 921 page-unique tokens vs
**3910** turns-unique tokens. The 9.3% is a real, non-optimised measurement. One residual caveat
the manifest could state: page-uniqueness and turns-uniqueness are correlated (both proxy
"distinctive vocabulary"), so a small part of the 56.5% → 9.3% fall is indirect. It does not
change the conclusion.

## The post-filter IS load-bearing — and that is also where the problem is

**Load-bearing, proven without an API call.** `data/eval/golden-set-rejected.json` holds 17
rejections, all with reason `pinned by unique token "<t>"`. I replayed the exact predicate from
`gen-golden-set.mjs:185` against a `globallyUniqueTokens(pageText)` map I built myself:
**17/17 rejections independently reproduced, with the same token each time.** Disabling the pin
check is therefore equivalent to re-admitting exactly those 17 questions — no mutation needed, and
I did not arm one (an armed mutation blocks the commit, and the equivalent evidence was available
deterministically).

**And re-admitting them moves the headline:**

```
recall@5 on the 17 FILTERED-OUT questions      = 0.765 (13/17)
recall@5 on the 75 KEPT questions              = 0.307 (23/75)
recall@5 with the pin filter DISABLED (92 qs)  = 0.391 (36/92)
```

That is the finding. The pin check is computed over `pageText` — **the same corpus
`createHeuristicRetriever` scores against**. So it does not remove "trivially pinned" questions in
a retriever-neutral way; it removes the questions whose vocabulary matches the target summary
distinctively, which is the *only* signal a bag-of-words retriever has. The filter is adversarial
to the instrument by construction.

Worse, "globally unique in the page corpus" is a much weaker property than the docstring's
"names Flywire and only one session says Flywire". The page corpus is small, so ordinary words
qualify: I confirmed `parents`, `interest`, `story` and `loan` are all page-unique, and all four
appear as rejection reasons. None is page-unique in the turns corpus. Three of the 17 rejections
are questions about education loans thrown out for containing the word "parents" or "interest".

None of this makes 0.307 wrong, and none of it rescues the old 1.000. But the manifest's
headline — "the retriever is much weaker than anyone could previously see" — is stated without
this caveat, and 0.307 should be read as a **conservative floor**, with 0.391 the unfiltered
comparison. Fixable by disclosure; better fixed by computing the pin check against the turns
corpus, which is not the retrieval surface.

## The judgment the maker asked for: are the questions single-answer?

I read a 12-question sample spread across 12 different sessions. **The maker's threat to validity
is real, and it is concentrated, not uniform.**

Clearly single-answer (the expected id is the only defensible one):
- `entrance-exams-…-gq02` — "How does the main entrance exam differ from the advanced-level one in
  terms of what it's trying to test?" (JEE Main vs Advanced; no other session covers it)
- `in-focus-3-gq04` — "study in New Zealand if someone eventually wants to live and work in
  Australia?"
- `telling-your-brand-story-better-gq01`, `visa-blueprint-…-gq01` — defensible, mildly contestable

**Genuinely answerable by more than one session** (the expected id is arbitrary):
- `uniaccess-atlas-skilltech-gq02` — "Is the university located right in the city or is it more of
  a secluded campus?" There are **seven** `uniaccess-*` sessions of identical format (Xavier, CEPT,
  Ashoka, Leeds Arts, Atlas SkillTech, …). Every one of them answers this. Nothing in the question
  selects Atlas.
- `uniaccess-cept-university-gq04` — "what kind of daily time commitment should students expect to
  spend on campus for classes and project work?" Same problem, same family.
- `uk-beyond-offer-letters-reupload-gq03` — "Once I get an offer letter, what are the next steps…"
  The corpus contains a near-duplicate pair (`uk-beyond-offer-letters` and its `-reupload`); the
  expected id here cannot be uniquely correct in principle. The manifest already concedes 5 of 52
  misses to this pair.
- `leeds-arts-gq01` (art programs without a portfolio) overlaps `creative-futures`;
  `in-focus-4-gq02`, `exploring-identity-gq01`, `decoding-…-gq03` and `law-careers-gq02` are each
  phrased generically enough to fit two or three sibling sessions.

Honest tally on my sample: **~4/12 clean, ~4/12 genuinely multi-session, ~4/12 borderline.** The
mechanism is exactly what the maker feared and the pin filter compounds it: condition 4 of the
prompt asks for wording that fits the near neighbours, and then the filter deletes every candidate
that carried a distinguishing word. For the seven same-format `uniaccess-*` sessions the two
pressures leave nothing to distinguish them by.

**So: a material fraction of the 52 misses are not retriever failures — they are questions with no
unique right answer.** The maker's counter-argument (the control at 0.187 sits below the 0.217
chance floor, so the set is not degenerate) is sound as far as it goes — a set of pure coin flips
would not do that — but it rules out *total* degeneracy, not the partial kind I found. I would not
cite 0.307 as "the retriever's true recall" in any Phase 1 document. It is a floor, on a set whose
per-question ground truth is contestable in roughly a third of cases.

This does **not** change the verdict on condition 2 (the metric is falsifiable, which was the
point) and it is **not** a reason to escalate to Option B. It is a reason to fix condition 4's
re-pointing carefully: before U1.5's "≥ 0.85" is aimed at this set, the `uniaccess-*` family and
the `-reupload` duplicate need either de-duplication or questions that name their session's
distinguishing content.

## Ruling on the `ai-transport.ts` scope addition

**Folding it in was defensible; I would not have filed a finding for the scope alone.** It was a
hard blocker (the gate forbids reusing the summarizer's vendor; the api-key path is dead because
`ANTHROPIC_API_KEY` is a bare name), it was fixed in place in the one existing function rather
than duplicated into the script, it landed as its own commit `6e249ee` with a full explanation, and
the manifest disclosed it and invited this ruling. That is the honest version of a widened unit.

**The fix itself is correct.** `resolveCliCommand` (`apps/api/src/ai-transport.ts:40`) previously
appended `.cmd` unconditionally on Windows; Node ≥20 refuses to spawn `.cmd`/`.bat` with
`shell:false`, which `cliTransport` sets at `:64`, so every claude-code job did fail. The new
version probes PATH, honours `PATHEXT`, prefers `.exe` (preserving the `shell:false` property the
function exists to protect), and falls back to the old string when nothing is found, so no
previously-working path changes. Two small notes, neither worth an issue: it scans all PATH dirs
for `.exe` before any dir for `.cmd`, which is not Windows' own per-directory PATHEXT order (a
deliberate, documented trade); and it returns `command+ext` rather than the resolved absolute
path, so `spawn` re-searches PATH and could in principle land on a different file.

**It does deserve a regression test, and does not have one.** `resolveCliCommand` is not exported
(`:40`) and nothing in the repo references it outside its own file — I checked. The whole real
transport has zero coverage, which is precisely why a production-breaking bug sat there invisibly
under 109 green tests. Exporting it and asserting the three branches against a stubbed
`PATH`/`PATHEXT` is a few lines. I am **not** filing this as a FAILURE line: it is a pre-existing
coverage gap this unit exposed rather than caused, and the contract for this unit does not cover
`apps/api`. **But `ai-transport.ts` is NOT certified by this verdict** — no criterion in
`golden-set-recall.md` governs it. It should get a criterion (in whichever contract owns
`apps/api`'s transport) plus that test, in its own unit.

## The disclosures — both present, neither buried

- **Nothing here claims the gate is CLOSED.** Confirmed. The manifest says so explicitly twice,
  and condition 4 (re-pointing U1.4/U1.5) is named as *not done by this unit*. The gate file's own
  closing line is intact. Correct, and the right call: on my reading above, condition 4 should not
  be executed until the multi-session questions are dealt with.
- **The Gemini-on-Gemini weakness is disclosed, not hidden.** It is honesty note 2 in the
  manifest *and* a 10-line comment at `gen-golden-set.mjs:147-157`, in the artifact itself, naming
  Flash vs Pro, the shared vendor/family/lineage, that this reduces leakage less than a
  cross-vendor run, and that it was Umesh's call. That is the standard, met.
  One small correction owed: the file's own header comment at `gen-golden-set.mjs:16` still says
  *"this is Anthropic"*, which the body then contradicts. Cosmetic, but it is a stale claim about
  provenance in the same file as the real one — fold it into the ISS-091 fix.

## What a PASS needs at cycle 2

1. `scripts/eval-recall.mjs:82-85` — provenance string describes the actual Option-C set; re-run
   `node scripts/eval-recall.mjs` so `data/eval/recall-report.json` carries it. Fix the stale
   `gen-golden-set.mjs:16` line in the same edit.
2. One paragraph in the manifest disclosing the filter's downward bias on recall, with the
   0.765 / 0.307 / 0.391 numbers, and stating 0.307 as a floor.
3. Acknowledge the multi-session finding above (the `uniaccess-*` family and the `-reupload` pair)
   as a named precondition on condition 4, so it cannot be skipped when U1.4/U1.5 are re-pointed.

Nothing needs regenerating. No API call is required to reach PASS.
