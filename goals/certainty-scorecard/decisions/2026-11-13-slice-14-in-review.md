---
title: "Slice 14 (MEAS-05 slice 1) in review: one lane map for every job-name join"
date: 2026-11-13
kind: checkpoint
lane: "refactor/certainty-meas-05-lane-map"
reversal: "Delete this checkpoint so the certainty-nightly first-run checkpoint is the latest PLAN status note, and revert the slice-14 PR."
---

Slice 14 makes `CI_LANE_DESCRIPTORS` the one job-name map: the descriptors gain `jobAliases` and `shardFamily`, and the new `packages/tooling/tool/cli/src/commands/Ci/CiLaneJobs.ts` derives the joins the route census, the lane-timings census, the certainty scorecard, heavy admission and the ruleset governance check read, in place of their own literals (decision `lane-job-map`). #3256's overflow name is the map's one called shard job. The admission gate holds: no existing test changed, `ci-lane-jobs.test.ts` reproduces every answer the replaced mappers gave on a56516d6d30 (fixture `test/fixtures/ci-lane-jobs/job-name-conservation.json`), and the 2026-09-01..10-30 receipt still replays to 242 skipped lane runs and 0 skipped reds. Slice 15 (the ledger fold) can read lanes and shard families from the map.
