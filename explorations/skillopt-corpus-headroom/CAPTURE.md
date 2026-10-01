# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-10-01

Evidence, from
[`goals/harness-evidence-ledger/history/p4-rerun/FINDINGS.md`](../../goals/harness-evidence-ledger/history/p4-rerun/FINDINGS.md):

- Baseline 0.9167 on four validation items with an Opus 5.5 rollout target.
- Three baseline passes on identical inputs spread over 0.0833, so the largest
  measurable gain on this corpus is about one noise width.
- Both gate accepts sat inside that spread: one by a rounding gap, one by
  exactly the spread. The ledger defers both (`hl-20260929-df3f0899`,
  `hl-20260929-f88812b2`) until a corpus can tell them apart from noise.
- Four of six candidates were screened out before evaluation.

What a next run needs before it spends quota:

- A harder or larger corpus: more validation items, and tasks whose baseline
  sits well below 1.0 at the target model (roughly 0.6 or lower).
- Rollouts isolated from the corpus and its task manifests. Rollout agents
  wrote build-info files into corpus fixture directories during the rerun.
- A gate margin at least as wide as the measured baseline spread, instead of a
  strict-greater comparison.
- A scorer self-test preflight: score an untouched fixture and a known-good
  solution, and fail when either result is wrong for an environment reason.
- A screen rule for checker-directed wording, such as text about what a lint
  or audit "flags" or "checks".

Resume triggers: the operator asks for skill training again, or a new model
release changes where the baseline sits.
