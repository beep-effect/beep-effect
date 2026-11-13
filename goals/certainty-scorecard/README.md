# Certainty Scorecard

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Report the ten-minute target nightly per PR head SHA: p95 push to every required context green on code heads,
with red, held and api-partial heads counted as misses, beside runner-minutes per run, time to Yeet-mergeable
and the main verdict rate. Make local publish and verify economics attributable across retired lanes, T3 lanes
and fleet hosts. Every sibling goal reads its acceptance numbers from this one instrument.

Source exploration: [`explorations/ten-minute-certainty`](../../explorations/ten-minute-certainty/README.md)
(MAP goal 1; provides `ci/certainty-scorecard`; no upstream dependency).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/certainty-scorecard/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P1 Implement — slice 1 (MEAS-01 slice 1 with MEAS-04) merged as #3118 (`beep ci certainty` and per-attempt
job reads; coverage rows fixed by #3121, decision `slice-1-coverage-reds`). Slice 2 (ROUT-05 slice 1) merged
as #3141: every hosted job is attributed to a lane, a support job or unknown, and `beep ci route census` reports
the conservation census (decision `job-attribution-classes`). Slice 3 (MEAS-02 with DEPS-10) merged as #3176:
the Yeet economics fold attributes refusals by failure kind as rows of the same `actionableLaneMix` (checkpoint
`slice-3-refusal-attribution`). Slice 1's scoring was then fixed by #3144 (decision `certainty-scoring-fixes`),
#3168 (decision `main-listing-unread`) and #3181 (coverage). Slice 5 (SCHE-09 slice 1) merged as #3227: rows the
admission ring trims go to UTC day segments kept for 30 days, and `bun run beep quality scheduler history` folds
them with the live journal (decision `sche-09-admission-archive`); the pressure fields are slice 5b. Slice 6
(MEAS-07) merged as #3228: each `yeet final-check` run is a `final-check` attempt in the branch's Yeet attempt
journal, carrying the receipt it wrote (decision `final-check-attempt-journal`). Slice 11 (ROUT-05 slice 2)
merged as #3257: failed jobs keep their steps in the v1 route corpus, rows take optional per-task outcomes, and
aggregate, setup and harness reds are charged to no lane and reported as unknown by the replay (decision
`step-classes-and-red-origins`); its producer of per-task outcome records is the new slice 11b. Slice 10
(MEAS-03) merged as #3262: economics classes every attempt green, red or terminated, terminated attempts leave
the red denominator, and each run mode reports its elapsed p50 and p95 (decision `terminations-apart-from-reds`).
In short, slices 5 (#3227), 6 (#3228), 10 (#3262) and 11 (#3257) merged; 7 (#3263) and 4 (#3266) are in review.
Slice 4 (MEAS-01 slice 2) adds `.github/workflows/certainty-nightly.yml`: it scores the previous UTC day each
night from main's code and turns red when the report is not certified (decision `certainty-nightly-workflow`). It is a workflow change, so the
operator merges it by hand. Each night is recorded in [`history/certainty-nightly.md`](./history/certainty-nightly.md),
and P2's seven nights start at 2026-11-14. Wall-time, cache and dist baselines taken before d8326d55935 (#3208,
declaration-only builds) are not comparable with later readings (checkpoint
`baselines-before-d8326d5593-not-comparable`), nor are check-lane baselines taken before 3e822c71c5 (#3242).

## Latest Evidence

- Slice 1 replays two committed real captures (`packages/tooling/tool/cli/test/fixtures/ci-certainty/`). On
  the 2026-11-09 12:00-18:00Z window, after the #3144 scoring fixes, the SLO statistic is p50 63.35 min with p95
  not attained (6 misses of 17 counted code heads, 14 superseded); green-only p95 101.9 min; 1 code head and 3
  docs heads under ten minutes; runner-minutes per head attempt 251.08 on average over 35; superseded share 42%.
  On the post-#3030 window, admission to heavy-pool pickup has p50 1.22 min. Decisions
  `fixture-corpus-real-captures` and `certainty-scoring-fixes`.
- Slice 2 maps all 80 jobs of Check run 43322847791 (2026-11-12): 72 lane jobs, among them 21 test-integration
  (20 partitions and the aggregate), 25 test-unit and 5 property, and 8 support jobs; 0 unknown, and lane,
  support and unknown time sum to the total. Before it, the 20 Test Integration partition jobs joined no lane.
- Slice 11 keeps the old route receipt's verdict: the 2026-09-01..10-30 corpus (sha256 e840ea6d…), copied to a
  scratch `--corpus` directory, replays to 5,083 heads, 242 skipped lane runs, 0 skipped reds and recall 1, with
  0 unknown-red heads.
- Slice 4's cost reading: the 2026-11-12 UTC day, run locally through the nightly workflow's own scripts, took
  83 GitHub reads and 99 s for 43 heads and was certified. The day predates both baseline breaks, so it is not a
  baseline; the first dispatched run on main measures the hosted runner-minutes.

## Notes

- Merged: MEAS-01 slice 1 with MEAS-04 (#3118), "feat(ci): beep ci certainty head-level required-green and
  main-verdict report" (M, CLI only), with fixes #3144, #3168 and #3181; ROUT-05 slice 1 (partition job
  mapping, #3141); MEAS-02 (refusal attribution, slice 3, #3176); SCHE-09 slice 1 (admission archive, slice 5,
  #3227); MEAS-07 (final-check attempt journals, slice 6, #3228); ROUT-05 slice 2 (failed-job steps and
  uncharged reds, slice 11, #3257); MEAS-03 (terminations apart from reds, slice 10, #3262). The nightly
  workflow (slice 4, #3266) and PERIL-11 slice 1 (slice 7, #3263) are in review.
- Order constraints: MEAS-02 lands before any WaveOrder re-seed in `local-proof-under-ten`; ROUT-05 lands
  before any census or cost ledger (MEAS-05) is trusted and before any route refinement replay; MEAS-07 lands
  before journal retention (PERIL-11); SCHE-09 is owned here and consumed by `local-proof-under-ten` (D23); nightly reads are budgeted against
  `github-budget-ledger`'s reserve signal (D27).
- No lever is fully landed; MEAS-03 is partly landed (economics already prints a terminations census, but
  terminated attempts still count as red). The
  #3007 and #3030 edits to `LaneTimings.ts` are shard-layout census upkeep owned by
  [`ci-lane-economics`](../ci-lane-economics/README.md), not MEAS-04.
- The fixture corpora the plan's MEAS-01 gate names are not in the repository; slice 1 commits its own
  (decision `in-repo-fixture-corpus`).
- Siblings, all reading this goal's numbers: `route-soundness-repair` (runs alongside),
  `main-verdict-every-commit`, `heavy-pool-diet`, `hosted-setup-tax`, `local-proof-under-ten`.
