---
title: "Run sharded Test Unit jobs on two Vitest workers and split the 344 s replay file"
date: 2026-11-10
lane: "perf/unit-shards-two-workers"
reversal: "Set CI_COVERAGE_SHARD_WORKERS_ARG in CiCoverage.ts back to --maxWorkers=1 and re-plan the shards for one worker (13 repo-cli, 10 law-practice-server, 8 unit bins plus a two-shard pair for the ai-metrics package). Undo the split by moving the tests of research-library-replay-integrity.test.ts back into research-library-replay.test.ts and pruning the plan."
---

The same plan ran `repo-cli-3` in 7.5, 8.3 and 11.2 min on three main runs. Over the eight green runs since PR 3028 (240 Test Unit job logs) a hosted runner is between 0.45 and 1.44 times the median speed (p90 1.19, p95 1.28, 184 shard jobs); once the runner is removed, a file varies by 6 percent at p90. So the variance is the runner, and a plan sized for the median runner breaks on a slow one.

- Adding shards does not help. A full main run already requests 72 hosted jobs against the 60-job concurrency cap; a queue simulation at that cap puts a 39-job Test Unit layout at 11.2 min after the first job start and a 33-job one at 9.9, against 9.2 today.
- Sharded Test Unit jobs now run two Vitest workers. A sharded job runs one coverage producer and used one of the four vCPUs (run 42726850927, `repo-cli-3`: 562 s of Vitest for 452 s of file time). A unit bin already runs two one-worker producers side by side on the same runner, so the worker count and memory are the ones the bins use.
- Integration shards keep one worker: two workers gave them no gain and pushed native replays past their deadlines (PR 3005).
- `test/research-library-replay.test.ts` was 344 s on a median runner, more than a ten-minute job can hold on a slow runner at any shard count. It is split in two with no test body changed.
- The first push keeps the 11 / 12 / 7 layout so its run measures two-worker contention against the one-worker medians. The counts are cut from that measurement.
- Rejected: sizing one-worker shards for the slowest runner (33 jobs: 13 repo-cli, 10 law-practice-server, 8 unit bins and a two-shard pair for the ai-metrics package). It holds ten minutes at 1.44 times the median but adds queueing. It stays the fallback if two workers show contention above 1.3, a memory kill or a deadline flake.
