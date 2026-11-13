# Analysis rule amendment 2, 2026-11-13

Amends [`2026-11-12-analysis-rule.md`](./2026-11-12-analysis-rule.md) and
[`2026-11-13-analysis-rule-amendment.md`](./2026-11-13-analysis-rule-amendment.md),
which stay as written. Committed before the laws-prompt pilot and before the
first scored run record. Where the files disagree, this one holds. Source:
the packet author's decision of 2026-11-13 on the cell A pilot's no-go, which
authorised these changes and the `SPEC.md` Decision Rule edit.

## Why

The cell A headroom pilot ([census](../history/p1-headroom-pilot/README.md))
was the wrong proxy. The archived prompt names no package and the completion
contract needs repository idioms (`Fn`, `O.getSomesStruct`, the `S.` and `O.`
aliases), so cell A sits at the floor by construction and says nothing about
headroom in cells B and C. The census also showed a floor that hits every
cell: Biome `format` and `assist/source/*` findings in 10 of 12 tasks, which
only a formatter satisfies, and no run has one.

## Scorer profile `skill-probe-scorer/v3`

Profile v2 plus one repair for every cell: the Biome lane ignores findings
with rule id `format` or `assist/source/*` (organizeImports,
useSortedInterfaceMembers). Every production session runs a formatter; no
probe run can. Biome `lint/*` findings stay scored. tsgo findings other than
`missingPipeableSignature` stay scored, TS2835 included. Preflight was rerun
under v3: 12 of 12 pass ([`history/preflight.json`](../history/preflight.json)).

## Laws-prompt pilot, replacing the cell A go or no-go

One `--ablation with-without` invocation of the laws prompt against the skill
plugin, 12 tasks by 2 runs: 24 cell B and 24 cell C runs. Unscored, outside
the 216-attempt cap, recorded under `history/p1-laws-pilot/` with a lane
census per task and cell. The pilot shows C beside B. The scored run is
fresh and independent of it, and the selection below reads only pooled B and
C passes, never their difference.

## Primary selection

In this fixed order, the first candidate that qualifies is the primary:

1. **all-lanes pass** under profile v3;
2. **law pass**: the completion and schema-first lanes both 1 under v3.

A candidate qualifies when at least 4 tasks, drawn from at least 2 families,
have at least one pass among their 4 pilot runs (B and C pooled).
`beep agent-effectiveness evals probe select` implements this test.

The thresholds, the clustered interval, Insensitive, harm and the fired-rate
gate apply unchanged to the selected primary; Insensitive counts tasks with a
pass on the selected primary. The other candidate and the lane fraction are
secondary. The selected primary is stated in a one-line dated note in
`research/`, committed before the first scored record, and passed to
`probe report --primary`.

If neither candidate qualifies, there is no scored run. The verdict is
Insensitive from the pilot, with the lane census as the finding: this corpus
cannot measure the skill at Opus 5.5 without tools. No prune proposal; the
packet goes to P3 and P4 with that verdict and the exploration map says so.

If one qualifies, the scored run starts without waiting: all three cells,
5 runs each, under the run configuration of the first amendment. Cell A
stays; B minus A on the lane fraction shows what the laws text adds.

Nothing else is picked or tuned from the pilot. A census result this rule
did not foresee goes to the packet author before the scored run.
