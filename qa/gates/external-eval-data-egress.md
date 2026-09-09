# HUMAN_GATE — external-eval-data-egress

**Question:** May these two bounded validation payloads be sent to Google's Gemini API?

1. T-021: the 92 internal golden-set questions, for query embeddings compared with existing
   `toc` chunk vectors.
2. U3.1: one generic Ask question plus the internal tree and retrieved candidate context needed to
   generate a real answer with citations in the live browser.

**Why this is a gate:** both checks can be made Mongo-read-only, but Gemini still receives internal
evaluation or retrieval context. The environment safety reviewer rejected transmission because the
specific payloads and destination were not explicitly approved. The privacy-safe local alternative
is currently unavailable: Ollama is running, but `nomic-embed-text` is not installed and its model
registry DNS lookup fails.

## Options

- **A — approve both bounded Gemini checks:** allow both payloads above. The evaluator's jobs
  writer is disabled, and every browser run must use an explicit `MONGO_WORK_DB`; neither check may
  write production/default Mongo.
- **B — local only:** send neither payload externally. Keep both final checks parked until a local
  embedding/generation route is available.
- **C — approve Ask only:** allow the single U3.1 browser question/context submission, but keep the
  92-question T-021 embedding run parked.

**Answer format:** `external-eval-data-egress: A`, `external-eval-data-egress: B`, or
`external-eval-data-egress: C`.

**Blocks:** the semantic embedding leg of T-021 condition 4 and U3.1's final real-answer plus
citation-link browser proof. It does not block U2.4 or other local-only catalogue work.

**Opened:** 2026-09-09T16:39:45+05:30 by maker after two measured failures: Gemini/live-vector
execution rejected by the environment safety reviewer; local `nomic-embed-text` pull failed on
`registry.ollama.ai` DNS.

**Answered:** pending
