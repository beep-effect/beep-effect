---
title: "The replay counts the job-adding and job-removing levers that have landed"
date: 2026-11-09
reversal: "Make the job removals a gate on the layout or re-dispatch slice here, with a decision file naming the levers."
---

Every lever that adds hosted jobs or legs draws on the same unverified ceiling of about 60 concurrent hosted jobs, so the critic ordered job-removing levers before job-adding ones. Per-SHA groups, the job-adding stage this order gated, left this goal (D28). Under `sequencing-against-ten-minute-certainty` the job removals in heavy-pool-diet and hosted-setup-tax now precede `merge-group-parity`, which waits on route-soundness-repair, heavy-pool-diet and hosted-setup-tax merging. Here they gate no slice: the merge-timestamp replay counts the job-adding and job-removing levers that have landed when it runs. The cancel ban adds no jobs, the throughput layout lowers a push run's job count, and re-dispatch adds full Check runs (about 75 hosted jobs each per #3046) but only while no main run is queued or pending, and it lands only if the replay shows PR first-wave pickup p95 and heavy-wait p95 regressed by at most 1 min. Rejected: keeping the removals as a gate on the layout (the layout removes jobs; re-dispatch, the one job-adding slice, is gated by the replay instead).
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D19, D28) and `explorations/github-merge-queue/DECISIONS.md` (`sequencing-against-ten-minute-certainty`).
