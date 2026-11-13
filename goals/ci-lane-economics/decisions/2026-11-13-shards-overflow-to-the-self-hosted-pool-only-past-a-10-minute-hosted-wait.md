---
title: "Shards overflow to the self-hosted pool only past a 10-minute hosted wait"
date: 2026-11-13
lane: "docs/ci-lane-overflow-ruling"
reversal: "Remove the overflow routing so every shard runs on ubuntu-24.04 again and restore the 5m00s pickup tripwire; no standing AWS setting changes."
---

Operator decision 2026-11-13 (about 06:25Z), after the sizing in `research/shard-runner-sizing-2026-11-13.md`. It replaces the "move the test shards to the self-hosted pool" clause of the same day's load ruling; the 15 to 20 branch bound stands.

- Moving every shard needs about 96 concurrent runners (the spot quota fits 64) and about $1,500 to $2,300 a month against a $200 ceiling. Not done.
- Shards stay on GitHub-hosted runners. A shard runs on the self-hosted pool only when the hosted wait would pass 10 minutes. Unbounded, the model sends 433 of 6,613 shards over three days and peaks at 78 VMs, which is 624 vCPU and over the 512-vCPU spot quota. The overflow pool is therefore 48 VMs of the 8-vCPU `.2xlarge` types only (384 vCPU), leaving 128 vCPU for the Heavy lanes. The scaler cap counts VMs and the shared pool launches seven types, four of them 16-vCPU `.4xlarge`, so overflow runners get their own launch configuration restricted to `r7a`, `r7i` and `r6i` `.2xlarge`; the overflow PR shows the worst-case vCPU of overflow plus Heavy at or under 512. No `.4xlarge` overflow option is offered: it was not modelled. A shard that finds the pool full stays in the hosted queue. Modelled at that cap: 300 shards, 43.8 VM-hours, shard pickup p95 8m43s, longest wait 12m52s, about $110 to $170 a month. No quota request and no second shard per VM.
- The queue tripwire moves from 5m00s to 10m00s shard pickup p95 for windows starting on or after 2026-11-13, because the design admits waits up to its threshold; earlier windows keep 5m00s so their documents reproduce. The census retarget (`Ci/LaneTimings.ts`, a window-dated limit) is open work: it is being added to #3229, whose first head (ee4b635b) left the limit at 5m00s. Until that lands on main the command prints 5m00s, and window 5 does not start before it. The charter is unchanged: every required check under 20m00s at p95, queue and pickup included.
- The scaler baseline cap stays 2. The operator accepted a burst cap near 80 for the overflow; the quota bounds it lower, at 48 `.2xlarge` overflow VMs plus the Heavy lanes, 512 vCPU in all. The overflow PR designs how the cap rises and is restored around a burst, and reports its first week of actual spend against the estimate.
- The hosted job diet goes ahead regardless.
