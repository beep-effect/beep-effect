---
title: "HOST-08 starts only once the Test Unit layout is at steady state; ci-lane-economics owns the layout"
date: 2026-11-09
reversal: "Supersede with a decision file naming a different steady-state test, or hand HOST-08 to ci-lane-economics."
---

The Test Unit layout belongs to `goals/ci-lane-economics` (#3007, #3028, #3030, #3040, #3043 and #3046 merged). HOST-08 here is only the queue-aware leg-width A/B harness and its reading. Steady state means: the Test Unit layout of #3043 (nine repo-cli and eight law-practice shards on two Vitest workers) and #3046 (test shards created before non-test lanes, 20-minute shard timeouts) has run seven consecutive days of PR runs with no further change to `packages/tooling/tool/cli/vitest.shards.json`, `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts` or the Test Unit shard jobs in `.github/workflows/check.yml`, counted from c90929b1ff1 (#3046) or from any later layout change. HOST-08 also waits on MEAS-04 (certainty-scorecard); its ROUT-01 dependency is already met, because ROUT-01's empty-partition skips landed in #3030 (hosted-setup-tax keeps only its residual gate). It adds legs only within the hosted job ceiling. Rejected: running the A/B now (every Test Unit number is pre-steady-state) and changing shard counts from this goal (ci-lane-economics owns them).

Source: `git log origin/main` (dbaf55668cb #3028, f818c6e52bf #3030, 0ae245d5da8 #3007, 694c91bbf9d #3040, 08972a39a16 #3043, c90929b1ff1 #3046); exploration `explorations/ten-minute-certainty/research/phase2/PLAN.md` (HOST-08 row).
