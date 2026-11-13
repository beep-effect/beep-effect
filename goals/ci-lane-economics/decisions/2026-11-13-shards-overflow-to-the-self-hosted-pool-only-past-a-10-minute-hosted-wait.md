---
title: "Shards overflow to the self-hosted pool only past a 10-minute hosted wait"
date: 2026-11-13
lane: "docs/ci-lane-overflow-ruling"
reversal: "Remove the overflow routing so every shard runs on ubuntu-24.04 again and restore the 5m00s pickup tripwire; no standing AWS setting changes."
---

Operator decision 2026-11-13 (about 06:25Z), after the sizing in `research/shard-runner-sizing-2026-11-13.md`. It replaces the "move the test shards to the self-hosted pool" clause of the same day's load ruling; the 15 to 20 branch bound stands.

- Moving every shard needs about 96 concurrent runners (the spot quota fits 64) and about $1,500 to $2,300 a month against a $200 ceiling. Not done.
- Shards stay on GitHub-hosted runners. A shard runs on the self-hosted pool only when the hosted wait would pass 10 minutes. Modelled on the three days of data: 433 of 6,613 shards, 52.7 VM-hours, peak 78 VMs, shard pickup p95 8m21s, about $130 to $210 a month.
- The queue tripwire moves from 5m00s to 10m00s shard pickup p95, because the design admits waits up to its threshold. The charter is unchanged: every required check under 20m00s at p95, queue and pickup included.
- The scaler baseline cap stays 2. The operator accepted a burst cap near 80 for the overflow; the overflow PR designs how the cap rises and is restored around a burst, and reports its first week of actual spend against the $130 to $210 estimate.
- The hosted job diet goes ahead regardless.
