---
title: "Route Test Unit shards to the overflow pool on the hosted queue depth, into free VMs only"
date: 2026-11-13
lane: "feat/ci-shard-overflow-routing"
reversal: "Set BEEP_SHARD_OVERFLOW off (no deploy), or revert the PR; set ciShardOverflow:enabled false and apply to drop the pool."
---

Design for the operator decision of the same day (shards overflow only past a 10-minute hosted wait). Model, calibration and tables: `research/shard-overflow-routing-2026-11-13.md`.

- **Signal.** Test Plan counts the jobs waiting for a GitHub-hosted runner across this repository's queued and in-progress runs, with its own `GITHUB_TOKEN` (two run listings and one jobs listing per run, at most 40 runs), and predicts the wait as 5.5 s a queued job (330 s mean hosted body over 60 hosted runners). A run routes past 600 s, 110 queued jobs. On the 296 runs of 2026-11-10..13 that planned shards it flags 18 of 235 runs whose worst shard waited ten minutes or less (7.7%) and misses 27 of 61 that waited longer (44.3%). Test Plan's own pickup delay (one API call) correlates at 0.36 against 0.62 and was rejected; an outside controller flipping a variable needs a variable-writing token and was rejected.
- **Routed.** Test Unit partitions only, the first `min(planned, free VMs)` in plan order, free VMs being 48 less the overflow jobs queued or running; the rest stay hosted, so a routed shard never waits behind a full pool. Without that rule the replay queued 29 shards inside a full pool.
- **Aggregates** stay hosted here. Skipping them at job level on success is the largest single lever in the model (Test Unit wait p95 on 2026-11-13: 32m08s with overflow alone, 26m31s with both, at $113 to $178 a month) and needs the census to accept a skipped aggregator first, so it is its own change.
- **Charter.** Within 48 VMs no rule tested brings Test Unit's wait p95 under 20 minutes on the 17-branch day: the best is 21m15s, routing past 20 queued jobs, at $334 to $527 a month. The front hop (Change Profile and Test Plan queueing, 8m31s p95 even then) is what remains.
- **Safety and pool.** The `beep-shard-overflow` label is reachable only through `shard-overflow.yml`, whose job condition admits a push or a same-repository pull request and whose runner group admits only that file at `refs/heads/main`. The job equals the hosted shard but for `runs-on`. The pool is a second `CiFleetController` with the heavy pool's rails, `r7a`/`r7i`/`r6i` `.2xlarge` only, at most 48 VMs, declared only under `ciShardOverflow:enabled`; 384 overflow vCPU plus 128 for the heavy pool at a burst cap of 8 is the 512-vCPU Spot quota.
- **Off by default.** Nothing routes until the repository variable `BEEP_SHARD_OVERFLOW` is `on`, the pool is applied, and a follow-up pins the caller to `shard-overflow.yml@main`; until that pin the command routes main pushes only.
