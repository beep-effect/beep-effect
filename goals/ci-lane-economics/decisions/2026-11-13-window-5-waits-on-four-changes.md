---
title: "Window 5 waits on four changes; routing alone does not reach 20 minutes at 17 branches"
date: 2026-11-13
kind: checkpoint
lane: "docs/check-lane-baseline-break"
reversal: "Delete this checkpoint; it records measurements and open work and changes no behaviour."
---

State after the first day under the restated bound.

- On main: the load ruling and sizing (#3222, #3230), the census fix (#3229: `Wait p50`/`Wait p95` per required context from run creation to the check reporting, Test Integration measured by its shards, the window-dated 10m00s pickup limit) and #3215 (a documentation-only pull request requests no test, lint or heavy runner).
- Measured on 2026-11-13 (83 green runs): Test Unit verdict wait p50 19m49s, p95 41m26s, made of three trips through the hosted queue: run created to the planning jobs done p95 11m00s, worst shard pickup p95 16m54s, worst shard body p95 9m21s, last shard done to the aggregate reporting p95 9m13s. On the fixed census nine of the fifteen required contexts breach on wait over the two busiest hours, where the old duration measure showed one.
- A replay of the whole job graph (it reads that day 17 to 24 percent high) puts Test Unit wait p95 on the 17-branch day at 48m22s today, 34m14s with aggregates that take no runner when every shard succeeded (#3258), 26m31s with that and the overflow as decided (#3256), and 21m15s at best inside 48 VMs with a far lower threshold. Routing alone does not reach 20 minutes on that day.
- Demand: 100 of 253 pull-request runs allocated the full 24-shard Test Unit matrix. A stale diff base explains 4 of 47 sampled (#3249, hosted-setup-tax); paths with no workspace owner explain about a tenth of those shard jobs (#3255, hosted-setup-tax); the rest edit a global input themselves.
- Open before window 5: #3258, #3249, #3255, #3256 (ships switched off; the operator applies the pool and a follow-up PR enables it). Window 5 is the first seven days after the last of them is live; its census is scheduled when that date is known. If Test Unit still breaches on measured numbers the choices are a lower overflow threshold, shorter shard bodies and planning hop, or restating the charter for the worst day.
