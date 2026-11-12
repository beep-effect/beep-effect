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
job reads; coverage rows fixed by #3121, decision `slice-1-coverage-reds`). Slice 2 (ROUT-05 slice 1) is in
review: every hosted job is attributed to a lane, a support job or unknown, and `beep ci route census` reports
the conservation census (decision `job-attribution-classes`). Next startable: MEAS-02 (slice 3) and the nightly
(slice 4).

## Latest Evidence

- Slice 1 replays two committed real captures (`packages/tooling/tool/cli/test/fixtures/ci-certainty/`): on
  the 2026-11-09 12:00-18:00Z window the SLO statistic is p50 63.35 min with p95 not attained (6 misses of 17
  counted code heads, 14 superseded); green-only p95 101.9 min; 4 heads under ten minutes; runner-minutes per
  producer run 219.7 on average; superseded share 40.8%. Decision `fixture-corpus-real-captures`.
- Slice 2 maps all 80 jobs of Check run 43322847791 (2026-11-12): 72 lane jobs, among them 21 test-integration
  (20 partitions and the aggregate), 25 test-unit and 5 property, and 8 support jobs; 0 unknown, and lane,
  support and unknown time sum to the total. Before it, the 20 Test Integration partition jobs joined no lane.

## Notes

- First slice, ready now: MEAS-01 slice 1 with MEAS-04, "feat(ci): beep ci certainty head-level
  required-green and main-verdict report" (M, CLI only). The nightly workflow is its own later PR. ROUT-05
  slice 1 (partition job mapping) and MEAS-02 (refusal attribution) can open beside it; that is the packet's
  three-PR limit.
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
