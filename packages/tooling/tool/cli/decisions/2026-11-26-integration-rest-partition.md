---
title: the integration catch-all partition runs the root integration lane, not a package list
date: 2026-11-26
reversal: Follow the reversal in the goals/citation-extraction-engine decision named below.
governs:
  - src/commands/Ci/CiLane.ts#isIntegrationRestPartition
  - src/commands/Ci/CiLane.ts#runCiPartitionExecution
enforcedBy: []
---

Anchor for goals/citation-extraction-engine/decisions/2026-11-09-run-the-law-practice-server-integration-suite-as-hosted-partitions-that-report-heavy-test-integration.md.

The leg always runs: Turbo scopes its parallel, unsplit and serial tasks itself and only the parallel
task is in the proof; a package-list catch-all would drop the unsplit and serial tasks.
