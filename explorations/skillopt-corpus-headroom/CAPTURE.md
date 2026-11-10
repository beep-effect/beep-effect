# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-10-01

Evidence, from
[goals/harness-evidence-ledger/history/p4-rerun/FINDINGS.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/harness-evidence-ledger/history/p4-rerun/FINDINGS.md):

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

## 2026-11-10

Operator asked for a review of this packet with a view to graduating it.
Findings from that review, checked against the checkout and the archive:

- The trainer is gone. `tools/skillopt` was retired on 2026-10-17 (PR #1898)
  under a locked disposition: retire the runner, keep a compact results
  record, build no replacement optimizer. Record:
  `goals/repository-simplification-residue/history/receipts/skillopt-retirement-record.md`.
- The two deferred accepts named above were tombstoned on 2026-10-14
  (`hl-20261014-9e833571`, `hl-20261014-69d53a31`) with
  `resurrectWhen: a corpus with headroom above the 0.0833 baseline spread`.
- The second resume trigger points the wrong way. A stronger model pushes a
  fixed corpus toward 1.0, so a release cannot restore headroom.
- Per-item scores from the archived `baseline-noise.json` (three noise passes
  plus the loop baseline, soft then hard):
  - `sfv4-fn-schema-003`: 1, 1, 1, 1; hard 4 of 4.
  - `sfv4-null-return-003`: 1, 1, 1, 1; hard 4 of 4.
  - `sfv4-getsomes-struct-003`: 0.83, 1, 0.83, 0.83; hard 1 of 4.
  - `sfv4-normalization-003`: 1, 0.83, 0.67, 0.83; hard 1 of 4.
- Two of four validation items never vary. All the variance and all the
  available gain sit in the other two.
- The hard score already has a baseline of 0.625 with a spread of 0.25. That
  is the "roughly 0.6" this file asked for, and it measures nothing. What
  matters is how strongly items respond to the skill relative to run-to-run
  noise, not where the baseline sits.
- The gate compared single passes. Rough arithmetic on the four pass means
  (mean 0.927, standard deviation 0.040): about five passes per arm, 40
  rollouts, would have separated a candidate at 1.0 from the baseline. The
  rerun spent 37. Replication was cheaper than a new corpus.
- The corpus is four task families with three instances each. Validation is
  the third instance of each family, so it measures within-family
  generalization only.
- Nobody measured the baseline with no skill loaded. If Opus 5.5 scores the
  same without the skill, there is nothing to train for this skill class.
- `claude plugin eval` (Claude Code 2.1.322 here) runs each case with and
  without the plugin, repeats runs, and isolates each run. It covers most of
  what the retired runner did.
- Schema-first laws are lint-enforced now, so final compliance saturates by
  design. The skill's value would show as first-pass compliance.
- Operator chose: reshape the packet around measuring skill effect and
  graduate one small probe goal with a kill criterion.
