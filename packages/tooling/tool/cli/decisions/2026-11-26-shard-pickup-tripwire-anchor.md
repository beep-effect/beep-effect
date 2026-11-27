---
title: The census shard pickup tripwire is 10m00s for windows from 2026-11-13 and 5m00s before
date: 2026-11-26
reversal: Drop the 2026-11-13 entry from CI_LANE_TIMING_QUEUE_TRIPWIRE_CHANGES so every window is judged at 5m00s.
governs:
  - src/commands/Ci/LaneTimings.ts#CI_LANE_TIMING_QUEUE_TRIPWIRE_CHANGES
enforcedBy: []
---

Anchor for `goals/ci-lane-economics/decisions/2026-11-13-shards-overflow-to-the-self-hosted-pool-only-past-a-10-minute-hosted-wait.md`, which records why the design admits shard pickup up to the overflow threshold.
