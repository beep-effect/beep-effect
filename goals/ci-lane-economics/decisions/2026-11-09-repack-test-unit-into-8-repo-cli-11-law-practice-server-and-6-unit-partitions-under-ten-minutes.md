---
title: "Repack Test Unit into 9 repo-cli, 12 law-practice-server and 7 unit partitions under ten minutes"
date: 2026-11-09
lane: "claude/silly-brahmagupta-5a4fd5"
reversal: "Restore the 13-partition layout (repo-cli-1..6 at 402 s, law-practice-1..3 at 990 s, unit-a..d) in CiLanePartitions.ts, check.yml and the lane-timings census, delete packages/law-practice/server/vitest.shards.json and restore the 2026-11-06 repo-cli plan; the census keeps judging runs by the layout they ran."
---

Green main run 42554761567 (2026-11-09) measured Test Unit at law-practice-1/2/3 = 23.0 / 31.6 / 22.8 min (sha1 hash shards of 1274 / 1779 / 1267 s of file time at one coverage worker), unit-c 13.9 min (serial package sum 1,175 s) and repo-cli-4 10.4 min (Vitest 532.7 s). The operator wants every hosted test job green in under ten minutes.

Every Test Unit partition is now packed by LPT from that run's per-file and per-package Vitest timings:

- `@beep/law-practice-server`: twelve shards planned by `packages/law-practice/server/vitest.shards.json` (281 files, 325.9 s of file time each, budget 480 s), applied by the shared `vitest.sequencer.ts`. The plan is measured on PR #3007's own run 42607991192 (pull-request runners), where eleven shards of 393 s varied 0.6x to 1.3x (235 to 505 s, 5.7 to 10.1 min); twelve shards keep the 1.3x case under ten minutes without waiting for the redundant-test deletion lane.
- `@beep/repo-cli`: nine shards (460 files; eight planned at 334.8 s and one carrying `test/research-library-views.test.ts` alone at 449 s). repo-cli tests run about 1.5x slower on pull-request runners than on the main run (3,128 s against 2,106 s of file time on the same files), so the plan is measured on the PR run. `research-library-views` alone exceeds the ten-minute target (449 s of file time plus about 175 s of job overhead); it is reported to its owner as a test defect (seven 16.7 s and three 20 s cases that look like real timeouts), not hidden by more shards.
- unit bins: seven (unit-a..g) over 191 packages, 453-454 s of serial sum each on the PR run (budget 720 s; four bins summed 809 / 894 / 1,175 / 700 s on main). Six bins of about 595 s were tried first on PR #3007 and unit-a still ran 10.7 min because Turbo's two-at-a-time order left its 292 s package for last; seven bins bound that tail under ten minutes.

`check.yml` lists the twenty-eight partitions, the lane-timings census gains the layout, and `bun run beep ci partitions rebalance --check` fails when a table weight drifts from its plan or a partition exceeds its budget; `--write --run <id>` repacks from a later green run. Budgets live in `CiPartitions.schemas.ts`. The check stays on demand (it is not in the cheap lint tier) because the unit lane's `ci-partitions.test.ts` already replays it against the committed plans.
