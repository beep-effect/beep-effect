---
title: the integration catch-all runs the root integration lane, and a planned partition list must cover every partition
date: 2026-11-26
reversal: Give int-rest a Turbo package list like the other bins, and stop proving the planned list.
governs:
  - src/commands/Ci/CiLane.ts#proveCiLanePartition
  - src/commands/Ci/CiLane.ts#planCiLanePartitions
enforcedBy: []
---

The integration catch-all bin is not a package list for Turbo: it runs today's root integration lane (parallel, unsplit and serial tasks alike) for every package the sharded bins do not own, so the hosted leg proves exactly what the heavy lane proved. Turbo's negated filters keep the sharded packages out and `--affected` still scopes pull requests. The leg always runs, because Turbo applies the affected scope to its tasks itself and only the parallel task is in the proof.

The partition proof and the partition plan share one lane selection and workspace inventory, so both read the same task set; an instrumented Test Unit selection also carries every coverage owner, because the coverage planner can widen past Turbo's affected set. The run's plan travels between jobs as one JSON array: `--plan-partitions` publishes it as the `partitions` step output and `--planned-partitions` reads it back. A partition handed that list proves the plan allocated every partition its own selection needs: a partition the plan never allocated runs no job, so an omission would otherwise read as a pass, and any allocated sibling turns it into a failure.

Rejected: a package-list catch-all (it would drop the unsplit and serial tasks); trusting the plan unproved (an omitted partition passes silently).
