---
title: "Overflow is on; window 5 runs 2026-11-13T20:00Z to 2026-11-20T20:00Z"
date: 2026-11-13
lane: "docs/overflow-enabled-window-5"
reversal: "Set BEEP_SHARD_OVERFLOW to off and pick a later window; the pool can stay applied at zero runners."
---

Overflow enablement finished on 2026-11-13: the routing (#3256), the aggregates that take no runner when every shard succeeded (#3258), the first-parent diff base (#3249), the owner rows (#3255) and the cutover (#3275) are on main, the overflow pool is applied, and `BEEP_SHARD_OVERFLOW` was set to `on` at 2026-11-13T19:48:48Z. That is the last lane-affecting change.

- **Window 5 is `2026-11-13T20:00:00Z` to `2026-11-20T20:00:00Z`**, inside ruleset `10240248` version `54940515` (15 required contexts), judged at 15 to 20 CI-active branches on the wait from run creation to each required check (`Wait p95` below 20m00s for every required context) with the 10m00s shard pickup limit. Its census runs on or after `2026-11-20T20:00Z`: `bun run beep ci lane-timings --window --workflow check.yml --event all --since 2026-11-13T20:00:00Z --until 2026-11-20T20:00:00Z --markdown`.
- **What is live:** organization runner group `beep-shard-overflow` restricted to `shard-overflow.yml` at `refs/heads/main`; the webhook secret in SSM; permissions boundary `beep-ci-fleet-boundary` v5 (adds `role/beep-ovf/beep-ovf-*` to PassOwnRoles; rollback `aws iam set-default-policy-version --policy-arn <arn> --version-id v4`, only once the pool is off); the pool with prefix `beep-ovf`, cap 48, `r7a`, `r7i` and `r6i` `.2xlarge` only, zero idle runners; a `workflow_job` webhook on the pool endpoint; the preflight passing. The heavy pool is unchanged at cap 2.
- **The apply took two passes:** 136 creates, then the six KMS grants a saved plan could not carry (friction receipt of the day; runbook "Deploy and verify").
- **Not yet proven:** no overflow VM had launched when this was written. Routing needs about 110 queued hosted jobs. The first launch is the only proof of the boundary entry; if it fails, switch the variable off and follow the runbook.
- **Bursts:** with overflow on, a heavy-pool burst stays at 8 runners or fewer (48 x 8 vCPU + 8 x 16 vCPU is the 512-vCPU spot quota). A burst inside the window is recorded with its hours; the census is read with and without those hours.
- **If a lane-affecting change lands inside the window** (a ruleset change, a job-graph or runner-allocation change, a different overflow threshold), the window restarts at that change.
- Before the pool was renamed, its runner role fell outside the boundary and the pool would have applied and never launched a VM; the preview cannot see that (decision of the day on the prefix).
