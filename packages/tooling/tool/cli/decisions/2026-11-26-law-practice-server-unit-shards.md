---
title: "@beep/law-practice-server unit tests run as eight LPT shards of planned file time"
date: 2026-11-26
reversal: Return the package to one unit bin, or to Vitest's own sha1 hash split, and drop the vitest.shards.json plan.
governs:
  - src/commands/Ci/CiLanePartitions.ts#CI_LANE_PARTITIONS
enforcedBy: []
---

@beep/law-practice-server grew from 98 s (2026-11-02) to about 4,270 s of Bun/Istanbul file time once #2847 registered the canonical citation corpora. Three sha1-hash shards then ran 23.0 / 31.6 / 22.8 min on green main run 42554761567 (file time 1274 / 1779 / 1267 s). Twelve LPT shards planned by `packages/law-practice/server/vitest.shards.json` held about 371 s of file time each, at every file's worst measurement over PR #3007's four green runs (42607991192, 42615698428, 42626103000, 42637312401; `rebalance --write` with repeated `--run`, then `--prune` for the two files #3009 deleted). Hosted shards varied 0.6x to 1.3x around a single-run plan, so the plan carries the worst case and the 480 s budget the rest. The weights are the planned file sums, and `beep ci partitions rebalance --check` fails when they drift from the plan.

Since 2026-11-10 a shard runs two Vitest workers. On PR #3040's run 42732848457 the twelve shards finished 4,512 planned seconds in 2,421 s of Vitest (0.54 of the plan) and ran 3.8-5.5 min, so eight shards of 564 planned seconds hold about 303 s of Vitest each: 8.8 min on a p95 runner (1.28x the median) with 10 percent of plan imbalance. On 2026-11-14 the plan was re-recorded from PR #3355's run 43646904138, after the regex session (#3352) cut regex child processes per ten citation calls from 291 to 10; each shard plans 364 s. The CI goals driver ruled that re-record not lane-affecting for window 5.

Rejected: sha1 hash shards (the 31.6 min shard above); twelve one-worker shards (superseded by two workers per shard).
