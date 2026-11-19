---
title: "Drop r7a.2xlarge from the new CI runner fleet"
date: 2026-11-19
lane: "fix/ci-runners-drop-r7a-2xlarge"
reversal: "Re-add r7a.2xlarge to RunnerInstanceType and to the new heavy (and overflow) type lists in packages/tooling/infra/ci-runners/src/Config.ts"
---

The CI goals driver ruled it, through the orchestrator, on 2026-11-19: `r7a.2xlarge` leaves the
new fleet's heavy and shard-overflow type lists. The live Pulumi fleet is not changed.

**Evidence.** The live heavy fleet's CloudTrail for 2026-11-19 (00:00Z to 23:20Z): 504 Spot launches,
23 `BidEvictedEvent` interruptions. Per 100 runner-hours, `r7a.2xlarge` was evicted at 3.72 times the
fleet's rate (138.7 against 37.3). By zone: 13.41 times in us-east-1b, 2.07 in us-east-1d (one
eviction) and 1.74 in us-east-1c. An independent recount that measures hours from launch to eviction,
termination or last job end gives 5.54 times the fleet, with 19.8 in 1b, 3.1 in 1d and 2.6 in 1c.
The rule was: remove a type whose rate is at least twice the fleet's in at least two zones. It holds
under both counts.

**Heavy pool.** Six types remain: `r7i.2xlarge`, `r6i.2xlarge`, `m7a.4xlarge`, `m7i.4xlarge`,
`m6a.4xlarge`, `m6i.4xlarge`. The largest type still has 16 vCPUs, so the Spot budget's heavy term is
unchanged. `m6i.4xlarge` stays on watch through the green day; it is re-ruled if it has at least two
evictions in a second zone.

**Overflow pool.** `r7i.2xlarge` and `r6i.2xlarge` only, plus a watch for insufficient capacity. The
amended rule allowed `m7i.2xlarge` (its family had no evictions in 16.1 hours) only when the measured
peak memory of the overflow jobs, plus 25%, fits in 32 GiB. No measured figure exists: the
shard-overflow job (`shard-overflow.yml`, Test Unit partitions) does not run under
`beep ci runner-resources`; only the heavy lanes in `heavy.yml` do. No guessed figure was used. A
4xlarge type never goes into the overflow pool, because it would double the pool's per-VM vCPU term.

**Reach.** The change is to `packages/tooling/infra/ci-runners/src/Config.ts` alone. The next
CiRunners deploy carries the pools' instance types in each pool function's runtime configuration
(`env`): the scale-up, job-retry and scale-down functions of both pools, six function updates. No
launch template or other resource changes. Those rows are attributed to this decision.
