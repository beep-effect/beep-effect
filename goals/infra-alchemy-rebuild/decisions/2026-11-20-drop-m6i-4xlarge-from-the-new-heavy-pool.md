---
title: "Drop m6i.4xlarge from the new heavy pool"
date: 2026-11-20
lane: "fix/ci-runners-drop-m6i-4xlarge"
reversal: "re-add m6i.4xlarge to RunnerInstanceType and instanceVcpus in packages/tooling/infra/ci-runners/src/Config.ts, with an env-only dispatch"
---

The CI goals driver re-ruled `m6i.4xlarge` on 2026-11-20, ahead of the green day: it leaves the new fleet's heavy pool,
which keeps five types: `r7i.2xlarge`, `r6i.2xlarge`, `m7a.4xlarge`, `m7i.4xlarge` and `m6a.4xlarge`. The overflow
pool never listed it, and the live Pulumi fleet is not changed.

**Method.** The test is evictions per instance-hour in the live (old) fleet's Spot population, cumulative from
2026-11-19 00:00Z.

- **Data:** the gate's analysis.3 (to 2026-11-20 05:46:42Z) plus analysis.4 (05:46:42Z to 09:09Z), both workstation-local
  analysis files built from the fleet's CloudTrail `RunInstances` and `BidEvictedEvent` records and the GitHub job
  windows of each runner.
- **Hour rule:** an instance counts from launch to its eviction, else to its last job end plus two minutes, else to the
  window end.
- **Statistic:** a Poisson tail P(X ≥ k) for each zone and overall, against the rest of the fleet's rate (every type
  except `m6i.4xlarge`).
- **Two treatments** of the 16 analysis.4 instances with no end source:
  - as measured (to the window end);
  - a conservative bound (`analysis.4.conservative.txt`): open non-m6i instances count zero hours, which raises the
    rest-of-fleet rate, and open m6i instances count to the window end.

**Result.**

| Measure | As measured | Conservative bound |
| --- | --- | --- |
| Rest of fleet (per 100 instance-hours) | 27.1 (29 evictions in 106.97 h) | 33.9 (85.54 h) |
| `m6i.4xlarge` overall: 7 evictions in 5.70 h, P(≥7) | 0.0011 | 0.0038 |
| us-east-1f: 5 evictions in 4.72 h, P(≥5) | 0.0100 | 0.0236 |
| us-east-1d: 2 evictions in 0.67 h, P(≥2) | 0.0146 | 0.0222 |

The rule was met under both treatments: us-east-1f below 0.05 or the overall test below 0.01, with us-east-1d already
significant.

**Reach.** The change is to `packages/tooling/infra/ci-runners/src/Config.ts`. `m6i.4xlarge` leaves the
`RunnerInstanceType` literal and `instanceVcpus`, and nothing else references it. The heavy pool takes every literal, so
only the heavy pool's runtime configuration changes: its scale-up, job-retry and scale-down functions get env-only
updates. The largest heavy type still has 16 vCPUs, so the Spot budget is unchanged. The change rides the 4b dispatch
with those rows attributed.

**New watch.** It replaces the `m6i.4xlarge` watch: re-rule the new heavy pool if a heavy job waits more than 10 minutes
for a runner while `CreateFleet` returns `InsufficientInstanceCapacity` for all five overrides. The overflow ICE watch
and the us-east-1b watch continue.
