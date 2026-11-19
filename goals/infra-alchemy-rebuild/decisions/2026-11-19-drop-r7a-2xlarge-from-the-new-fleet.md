---
title: "Drop r7a.2xlarge from the new CI runner fleet"
date: 2026-11-19
lane: "fix/ci-runners-drop-r7a-2xlarge"
reversal: "Re-add r7a.2xlarge to RunnerInstanceType and to the new heavy (and overflow) type lists in packages/tooling/infra/ci-runners/src/Config.ts"
---

The CI goals driver ruled it, through the orchestrator, on 2026-11-19: `r7a.2xlarge` leaves the
new fleet's heavy and shard-overflow type lists. The live Pulumi fleet is not changed.

**Evidence.** One count, the packet gate's recount, from the live heavy fleet's CloudTrail for
2026-11-19, 00:00Z to 23:20Z (`RunInstances`, `BidEvictedEvent` and `TerminateInstances`, plus the
GitHub job windows of each runner; workstation-local folder
`~/.cache/beep/ci-runners-step0/eviction-analysis-20261119/`, not in the repo). Hour rule: an
instance counts from its `RunInstances` time to its `BidEvictedEvent` time if it was evicted, else to
its `TerminateInstances` time, else to the end of its last job window; the two instances with none of
these count to the end of the data. Result: 504 Spot launches, 23 evictions over 83.4 instance-hours,
27.6 evictions per 100 hours for the fleet. `r7a.2xlarge`: 10 evictions over 6.5 hours, 152.8 per
100 hours, 5.54 times the fleet. By zone: us-east-1b 19.79 times (6 evictions), us-east-1d 3.12 times
(1 eviction), us-east-1c 2.60 times (3 evictions). The rule was: remove a type whose rate is at least
twice the fleet's in at least two zones. It holds in all three zones where the type was evicted.

**Heavy pool.** Six types remain: `r7i.2xlarge`, `r6i.2xlarge`, `m7a.4xlarge`, `m7i.4xlarge`,
`m6a.4xlarge`, `m6i.4xlarge`. The largest type still has 16 vCPUs, so the Spot budget's heavy term is
unchanged. `m6i.4xlarge` stays on watch through the green day; it is re-ruled if it has at least two
evictions in a second zone.

**Overflow pool.** `r7i.2xlarge` and `r6i.2xlarge` only, under the ICE watch below. The
amended rule allowed `m7i.2xlarge` (its family had no evictions in 16.1 hours) only when the measured
peak memory of the overflow jobs, plus 25%, fits in 32 GiB. No measured figure exists: the
shard-overflow job (`shard-overflow.yml`, Test Unit partitions) does not run under
`beep ci runner-resources`; only the heavy lanes in `heavy.yml` do. No guessed figure was used. A
4xlarge type never goes into the overflow pool, because it would double the pool's per-VM vCPU term.

**ICE watch.** During the green day, the overflow pool is re-ruled if any overflow job waits more
than 10 minutes for a runner because `CreateFleet` returned `InsufficientInstanceCapacity` for every
remaining override. A measured Test Unit partition memory peak, which the `m7i.2xlarge` branch needs,
is owed only if the watch trips.

**Order of the heavy types.** The heavy pool takes `RunnerInstanceType.literals` in order, so its
first type moves from `r7a.2xlarge` to `r7i.2xlarge`. Only the empty-overrides fallback in
`ScaleUp.program.ts` reads the first type. Override priorities come from list order only under a
`prioritized` allocation strategy, and both pools run the default `capacity-optimized`
(`lowest-price` for on-demand), which sets none. This is not a priority change.

**Reach.** The change is to `packages/tooling/infra/ci-runners/src/Config.ts` alone. The next
CiRunners deploy carries the pools' instance types in each pool function's runtime configuration
(`env`): the scale-up, job-retry and scale-down functions of both pools, six function updates. No
launch template or other resource changes. Those rows are attributed to this decision.
