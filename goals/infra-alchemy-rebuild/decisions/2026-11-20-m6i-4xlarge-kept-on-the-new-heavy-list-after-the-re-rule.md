---
title: "m6i.4xlarge kept on the new heavy list after the re-rule"
date: 2026-11-20
lane: "docs/infra-alchemy-p5-m6i-and-iam-reapply"
reversal: "a Config.ts PR removing m6i.4xlarge from the new heavy list, plus an env-only dispatch"
---

The CI goals driver re-ruled `m6i.4xlarge` on 2026-11-20 and kept it on the new fleet's heavy list. The heavy pool keeps
its six types; there is no Config.ts change and no extra dispatch.

Source: the workstation-local analysis `~/.cache/beep/ci-runners-step0/eviction-analysis-20261119/analysis.3.txt`
(the live heavy fleet's CloudTrail from 2026-11-19 00:00Z to 2026-11-20 05:46Z: 674 Spot launches, 31 evictions over
83.87 instance-hours, 37.0 per 100 hours).

- `m6i.4xlarge` overall: 4 evictions over 3.76 hours, 106.5 per 100 hours, 3.16 times the rest of the fleet
  (P = 0.040 under the rest-of-fleet rate).
- By zone, only us-east-1d is significant: 2 evictions over 0.67 hours, 8.84 times (P = 0.022). us-east-1f is
  2.14 times on 2 evictions (P = 0.24, consistent with chance), and us-east-1b had none. The removal rule (at least
  twice the fleet in at least two zones) is not met.
- `m6i.4xlarge` is 4.5% of fleet hours. In a fleet that hits InsufficientInstanceCapacity often, keeping the capacity
  diversity outweighs that excess.
- In us-east-1f, the zone with the most ICE, non-m6i types run at 0.68 times the other zones' rate, so there is no zone
  change. The ICE load there is covered by the overflow ICE watch.
- For comparison: `m7i.4xlarge` had no evictions in 19.98 hours, and `r7i.2xlarge` ran at the fleet rate.

New trigger through the green day, cumulative from 2026-11-19 00:00Z: re-rule if a second zone reaches at least three
`m6i.4xlarge` evictions with P < 0.05, or if the overall per-hour P falls below 0.01.
