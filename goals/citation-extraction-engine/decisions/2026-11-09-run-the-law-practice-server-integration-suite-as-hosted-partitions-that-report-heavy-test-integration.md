---
title: "Run the law-practice-server integration suite as hosted partitions that report Heavy / Test Integration"
date: 2026-11-09
lane: "claude/integration-hosted-partitions-ba7e3b"
reversal: "Restore the test-integration job in heavy.yml and in the heavy route lanes, remove the check.yml partition matrix and aggregate, and drop the test-integration partitions from CiLanePartitions.ts and the sequencer plan from the package."
---

'Heavy / Test Integration' is reported by a hosted aggregate job that needs every integration partition and fails on failure, cancellation or skip; integration partitions run on GitHub-hosted runners on every non-docs PR.

Mechanism. The required context used to be the reusable heavy.yml job (called from check.yml's Heavy job, so GitHub named it Heavy / Test Integration). check.yml now runs Test Integration (lps-int-N) on ubuntu-24.04, one Vitest --shard of @beep/law-practice-server's integration suite each, placed by the LPT plan in packages/law-practice/server/vitest.integration.shards.json (per-file seconds of main run 42554761567), plus Test Integration (int-rest), the root integration lane with the sharded package filtered out for every other package. The aggregate job is literally named 'Heavy / Test Integration', the same way Coverage Regression took its context over, so standards/branch-protection-contexts.json and ruleset 10240248 are unchanged; while the resolved heavy.yml@main still declares its Test Integration job the aggregate takes the migration name 'Test Integration Partitions' (admission output legacy_integration), and after this change merges the heavy job is gone and the aggregate owns the context. The lane leaves Heavy Admission (heavyRouteLanes no longer lists test-integration), so the two-instance beep-ec2-heavy pool no longer queues it; the remaining heavy lanes keep admission. Pull requests keep --affected, so a PR that does not touch an integration owner runs the partition proof only.

Assumption to measure. Partition weights come from 8-vCPU heavy timings; the first hosted run measures whether 4-vCPU per-file times match (the plan projected 8-10 minutes per partition at about 450-760 s of file time with two workers). Partitions are rebalanced from the measured run and again after the deletion lane merges.
