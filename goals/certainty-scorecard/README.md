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

P1 Implement — slice 19 is built and in review (checkpoint `slice-19-empty-legs-and-local-proof`). These slices
have merged:

| Slice | Lever | PR | What it added |
| --- | --- | --- | --- |
| 1 | MEAS-01 slice 1, MEAS-04 | #3118 (fixes #3121, #3144, #3168, #3181) | `beep ci certainty` and per-attempt job reads |
| 2 | ROUT-05 slice 1 | #3141 | every hosted job a lane, support or unknown job, with a conservation census |
| 3 | MEAS-02, DEPS-10 | #3176 | refusals attributed as rows of `actionableLaneMix` |
| 4 | MEAS-01 slice 2 | #3266 (first run #3270) | the certainty nightly on main |
| 5, 5b | SCHE-09 | #3227, #3344 | the admission archive, then pressure stamps |
| 6 | MEAS-07 | #3228 | final-check runs journaled as attempts |
| 7, 8, 9 | PERIL-11 | #3263, #3273, #3349 | journals retained on removal, the T3 root row, host and seat fields with read-only fleet-host reads |
| 10, 10b | MEAS-03 | #3262, #3342 | terminations apart from reds; handler errors typed and located |
| 11, 11b, 12 | ROUT-05 | #3257, #3369, #3372 | failed-job steps, per-task outcome records, the corpus through 2026-11-17 |
| 13 | MEAS-06 | #3367 | Test Unit timings on every event |
| 14, 15 | MEAS-05 | #3274, #3347 | one lane-job map; the cost ledger fold |
| 16 | MEAS-08 | #3351 | PSI samples and admission stamps joined onto attempts |
| 18 | sibling rows | #3609 | heavy slot-minutes, heavy-queue and heavy-wait p95, Lint Policy wall, Property Laws, first-wave pickup, main cancel actor, replay inputs, the 7-day main horizon |

#3305 moved the per-attempt job reads to 30-job pages. P2 is met: seven certified nights, UTC days 2026-11-14 to
2026-11-20 (#3605, [`history/certainty-nightly.md`](./history/certainty-nightly.md)). Acceptance criteria 1 and 3 to 9 are ticked
against [`history/closeout-evidence-2026-11-27.md`](./history/closeout-evidence-2026-11-27.md) and the 2026-11-26 nightly
(run 46015289067), the first report scored by #3609's code. That report certified, but two rows of "Numbers the
scorecard reports" exist only outside it: empty-leg runner-minutes (`ci ledger`) and local publish and verify
(`yeet economics --fleet`). Slice 19 builds both into `beep ci certainty` (decision
`criterion-2-rows-built-into-certainty`): `emptyLegs` through the ledger's own fold, and `localProof`, which a
hosted report shows as n=0 with every run censored and the reason. The closeout PR follows the first nightly
after slice 19 merges that shows every row. Wall-time, cache and dist baselines taken
before d8326d55935 (#3208) are not comparable with later readings (checkpoint
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
- Slice 5b's overhead, one sequential run per mode of 100 admissions over a 600-row journal on a busy host
  (`ops/admission-stamp-overhead.ts`): promotion p50 and p95 64.7 and 172.6 ms on origin/main; on the final
  revision, which reads the gate at each transition, 58.1 and 157.5 ms with the gate off and 88.9 and 157.9 ms
  with it on; release 16.0 and 33.7, 15.1 and 31.4, 20.9 and 40.4 ms. The same mode moved by up to 33 ms at p50
  between two runs, so host load dominates (decision `sche-09-pressure-stamps` has both runs). A stamp adds about
  165 bytes to each admitted and released row. With every gate off, every record matches the bytes captured
  from origin/main's encoder.
- Slice 4's cost reading: the 2026-11-12 UTC day, run locally through the nightly workflow's own scripts, took
  83 GitHub reads and 99 s for 43 heads and was certified. The day predates both baseline breaks, so it is not a
  baseline; the first dispatched run on main measures the hosted runner-minutes.
- Slice 10b on the workstation fleet (3052 attempts, 1201 red, aggregates only): `unlocated` falls from 160 to
  27. The 133 located are `refusal:publish-input` 57, `refusal:review-threads` 42, `github:rate-limit` 33 and
  `github:transport` 1; every other row, `redAttempts` and the mix total (1201) are unchanged. The largest
  residue is a since-fixed pull request number decode (8 rows, 5.0%).
- Slice 9 is proved on fixtures only, with no live fleet read: a mixed-revision journal (two rows from
  origin/main's encoder, two with `host` and `seat`) decodes under both revisions' readers and folds to
  `hostMix` and `seatMix` with the older rows `unrecorded`; a fake SSH executor that dies on any command
  but the exact `find`/`tail` read serves five hosts, one per status (read, timeout, connection failure,
  partial, truncated output), and the report holds their receipts and no raw row.
- Slice 15 on three Check runs read 2026-11-14
  (`packages/tooling/tool/cli/test/fixtures/ci-cost-ledger/reference-runs.json`): 43604442987 (push, full
  matrix) 307.1 job-minutes, 43585338714 (documentation only) 7.1 and 43605277972 (an empty
  `int-rest` leg) 203.7 each map 100% of their job-minutes to a lane or a named support job, with lane shares of
  99.4%, 78.2% and 98.2% and no unknown minute. Empty-leg runner-minutes per run: 0, 0 and 1.97 (the catch-all
  partition the plan allocated with 0 of 24 integration tasks selected). Every aggregate skipped on success on
  those runs; the umbrella, wrapper and rerun fixture in
  `packages/tooling/tool/cli/test/ci-cost-ledger.test.ts` shows no double count.
- Slice 16 (`packages/tooling/tool/cli/test/yeet-economics-pressure.test.ts`, fixtures only, Node and Bun):
  four recorder samples across two boots and eight attempts give one three-sample window (cpu mean 2 max 3,
  io mean 5 max 6, MemAvailable min 79.5 GiB), one single-sample window whose io and MemAvailable figures are
  absent because that sample lacks them, and one attempt per gap (no samples, outside the recorder span, two
  untimed, a start row naming another host, a fleet-host attempt counted but not listed). A recorder with one of
  five lines undecodable reads `partial`; an admission history whose rows all decode reads `present`; a missing,
  unreadable or skipped source reads `absent` with the reason in its note.

## Notes

- Every planned slice has merged (table under Current Phase); per-lever detail is in SPEC "Levers".
- Order constraints: MEAS-02 lands before any WaveOrder re-seed in `local-proof-under-ten`; ROUT-05 lands
  before any census or cost ledger (MEAS-05) is trusted and before any route refinement replay; MEAS-07 lands
  before journal retention (PERIL-11); SCHE-09 is owned here and consumed by `local-proof-under-ten` (D23); nightly reads are budgeted against
  `github-budget-ledger`'s reserve signal (D27).
- The #3007 and #3030 edits to `LaneTimings.ts` are shard-layout census upkeep owned by
  [`ci-lane-economics`](../ci-lane-economics/README.md), not MEAS-04.
- The fixture corpora the plan's MEAS-01 gate names are not in the repository; slice 1 commits its own
  (decision `in-repo-fixture-corpus`).
- Siblings, all reading this goal's numbers: `route-soundness-repair` (runs alongside),
  `main-verdict-every-commit`, `heavy-pool-diet`, `hosted-setup-tax`, `local-proof-under-ten`.
