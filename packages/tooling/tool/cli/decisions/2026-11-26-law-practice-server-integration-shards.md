---
title: "@beep/law-practice-server integration tests run as nineteen LPT shards; the rest share int-rest"
date: 2026-11-26
reversal: Run the package's integration suite inside int-rest with the root integration lane.
governs:
  - src/commands/Ci/CiLanePartitions.ts#CI_LANE_PARTITIONS
enforcedBy: []
---

Hosted Test Integration partitions (goals/citation-extraction-engine, 2026-11-09): nineteen Vitest shards of @beep/law-practice-server's integration suite, placed by the LPT plan in `packages/law-practice/server/vitest.integration.shards.json`. The weight is each bin's sum of its files' worst passing hosted seconds over eight runs (PR #3005 run 42656046751, main runs 42662847801, 42675828132 and 42677073526, pull-request runs 42679893579, 42680346897, 42682725454 and 42690710476; ubuntu-24.04, one worker). The count is the smallest whose largest bin equals the largest single file (422 s), and every bin stays within `CI_SHARDED_PARTITION_FILE_BUDGET_SECONDS`, which test/ci-lane.test.ts enforces. The shard total must equal that plan's length, or Vitest falls back to its hash split. Every other package with an integration task is default-placed into `int-rest`, which runs the root integration lane with the sharded packages filtered out.

Rejected: fewer shards (a bin above the 422 s largest file); Vitest's hash split (unbalanced against the file budget).
