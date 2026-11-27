---
title: "@beep/law-practice-server integration tests run as LPT shards of worst-case file seconds"
date: 2026-11-26
reversal: Follow the reversals in the goals/citation-extraction-engine decisions named below.
governs:
  - src/commands/Ci/CiLanePartitions.ts#CI_LANE_PARTITIONS
enforcedBy: []
---

Anchor for goals/citation-extraction-engine/decisions/2026-11-09-integration-shards-are-sized-at-each-file-s-worst-seconds-over-several-green-runs.md and 2026-11-09-run-the-law-practice-server-integration-suite-as-hosted-partitions-that-report-heavy-test-integration.md. The shard total must equal the length of packages/law-practice/server/vitest.integration.shards.json, or Vitest falls back to its hash split.
