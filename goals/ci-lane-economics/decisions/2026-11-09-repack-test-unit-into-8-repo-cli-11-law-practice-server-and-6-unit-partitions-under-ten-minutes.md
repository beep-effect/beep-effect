---
title: "Repack Test Unit into 8 repo-cli, 11 law-practice-server and 7 unit partitions under ten minutes"
date: 2026-11-09
lane: "claude/silly-brahmagupta-5a4fd5"
reversal: "Restore the 13-partition layout (repo-cli-1..6 at 402 s, law-practice-1..3 at 990 s, unit-a..d) in CiLanePartitions.ts, check.yml and the lane-timings census, delete packages/law-practice/server/vitest.shards.json and restore the 2026-11-06 repo-cli plan; the census keeps judging runs by the layout they ran."
---

Green main run 42554761567 (2026-11-09) measured Test Unit at law-practice-1/2/3 = 23.0 / 31.6 / 22.8 min (sha1 hash shards of 1274 / 1779 / 1267 s of file time at one coverage worker), unit-c 13.9 min (serial package sum 1,175 s) and repo-cli-4 10.4 min (Vitest 532.7 s). The operator wants every hosted test job green in under ten minutes.

Every Test Unit partition is now packed by LPT from that run's per-file and per-package Vitest timings:

- `@beep/law-practice-server`: eleven shards planned by `packages/law-practice/server/vitest.shards.json` (280 files, 392.8 s of file time each, budget 480 s), applied by the shared `vitest.sequencer.ts`; predicted wall about 393 + 110 s of job overhead, about 8.4 min, and still under ten minutes if the redundant-test deletion lane does not land.
- `@beep/repo-cli`: eight shards (459 files, 263.2 s each; the 2026-11-06 six-shard plan measured 240-467 s and 322-533 s of Vitest duration); predicted about 6.5 min.
- unit bins: seven (unit-a..g) over 191 packages, 508-509 s of serial sum each (budget 720 s; four bins summed 809 / 894 / 1,175 / 700 s). Six bins of about 595 s were tried first on PR #3007 and unit-a still ran 10.7 min because Turbo's two-at-a-time order left its 292 s package for last; seven bins bound that tail under ten minutes.

`check.yml` lists the twenty-six partitions, the lane-timings census gains the layout, and `bun run beep ci partitions rebalance --check` fails when a table weight drifts from its plan or a partition exceeds its budget; `--write --run <id>` repacks from a later green run. Budgets live in `CiPartitions.schemas.ts`. The check stays on demand (it is not in the cheap lint tier) because the unit lane's `ci-partitions.test.ts` already replays it against the committed plans.
