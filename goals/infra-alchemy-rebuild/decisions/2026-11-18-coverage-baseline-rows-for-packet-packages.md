---
title: "Seed coverage baseline rows for the seven packages the packet added"
date: 2026-11-18
lane: "goals/infra-alchemy-rebuild-coverage-baseline-rows"
reversal: "remove the 7 rows from standards/coverage.regression-baseline.jsonc"
---

`standards/coverage.regression-baseline.jsonc` had no rows for seven packages this packet added: `@beep/alchemy-aws-extras`, `@beep/alchemy-github-runners`, `@beep/alchemy-vercel`, `@beep/infra-cost-controls`, `@beep/infra-github`, `@beep/infra-hosts` and `@beep/infra-turbo-cache`. The hosted Heavy / Coverage Regression job reported them as missing only on full-matrix runs (PR #3367 job 134497133455, PR #3369 job 134501277702).

The rows come from hosted measurement, not a local run. Each source run's unit coverage artifacts were downloaded, and the repo's own `collectCoverageProducerArtifacts` ran over them in a checkout of that run's tested SHA, on the producer runtime pins (Node 22.23.4, Bun 1.4.4). The resulting rows were inserted unchanged.

- Six rows come from workflow run 44212040109 (the run behind job 134497133455, execution SHA `169fdd16cdf`, all 25 partitions): `@beep/alchemy-aws-extras`, `@beep/alchemy-github-runners`, `@beep/alchemy-vercel`, `@beep/infra-github`, `@beep/infra-hosts` and `@beep/infra-turbo-cache`. `git diff --stat 169fdd16cdf b430fa98ee` is empty for each of their package directories.
- The `@beep/infra-cost-controls` row comes from #3373's own Check run 44219059468 (execution SHA `e576e8298f6`, the merge of `b430fa98ee` into `3199097213`), which contains #3366. #3366 rewrote `cost-controls/src/PlanCheck.ts` (4 files, +233/-44 since `169fdd16cdf`), so the first draft's row from run 44212040109 described the old file. The beep-reviewer caught it (thread r4608264233).
- Run 44219059468 also measured the six other packages. Their rows came out deep-equal to the rows taken from run 44212040109.

Against `origin/main`, the diff adds 1137 lines and removes none. Decoded through the `CoverageRegressionBaseline` schema, it adds 7 rows and changes no existing row or document field.

| Package | Lines | Statements | Branches | Functions |
| --- | --- | --- | --- | --- |
| `@beep/alchemy-aws-extras` | 92.71 | 91.51 | 73.01 | 83.78 |
| `@beep/alchemy-github-runners` | 94.69 | 93.72 | 74.62 | 87.24 |
| `@beep/alchemy-vercel` | 92.99 | 91.73 | 87.79 | 82.05 |
| `@beep/infra-cost-controls` | 99.37 | 99.42 | 92.94 | 98.36 |
| `@beep/infra-github` | 100 | 100 | 100 | 100 |
| `@beep/infra-hosts` | 99.61 | 99.63 | 100 | 98.75 |
| `@beep/infra-turbo-cache` | 72.9 | 74.1 | 58.62 | 72.28 |

All seven rows clear the tiered minimum, so none needs a `follow_ups` entry. This packet owns the seven rows: each package's owning phase lane, and the packet gate until closeout.
