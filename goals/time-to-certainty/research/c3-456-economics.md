# C3.6 — economics baseline for the migrated lanes (accounting before claims, §7.1.4)

Recorded 2026-09-12 before the one-PR train (`ttc/c3-4-5-6-turbo-tasks`) merged. Hosted numbers come
from `bun run beep ci lane-timings --runs 60 --tsv` (56 workflow runs, 833 jobs, successful jobs only,
nearest-rank percentiles over `durationSeconds`). The bounded `--window` census could not run: it
fails closed with "Ruleset 10240248 must expose exactly 18 required contexts; observed 17" (a live
required-check drift outside this PR; receipt in `OPPORTUNITIES.md`). No whole-proof denominator is
claimed anywhere in this file.

## Hosted lanes before the migration

| Hosted lane | n (success) | p50 s | p95 s |
| --- | ---: | ---: | ---: |
| Codegen Drift | 28 | 18 | 161 |
| Fallow Advisory Envelopes | 19 | 262 | 307 |
| Heavy / Check | 22 | 145 | 154 |
| Heavy / Coverage Regression | 4 | 99 | 1866 |
| Heavy / Docgen | 22 | 146 | 324 |
| Heavy / Doctest | 24 | 103 | 357 |
| Heavy / Lint Policy | 11 | 620 | 650 |
| JSDoc Ratchet | 18 | 503 | 537 |
| Knip | 26 | 96 | 123 |
| Lint (lint-a) | 26 | 97 | 123 |
| Lint (lint-b) | 26 | 86 | 119 |
| Repo Sanity | 22 | 219 | 325 |

window: 56 workflow runs, 833 jobs (recent-runs census, --runs 60)

## Local measurements from the train (Stages B–D, this workstation, concurrency 4)

| Program | Cold | Warm | Source |
| --- | ---: | ---: | --- |
| `turbo run doctest` (27 owners, Node) | 103.6 s Turbo wall; task lifetime p50 10.6 s, max 37.8 s (`@beep/repo-cli`) | 0.12 s, 27/27 `HIT` | Stage B3 orchestrator verdict |
| `turbo run lint:laws lint:native-runtime:roots` (141 + 1 tasks) | 88.7 s (142/142) | 0.4 s | Stage A verification |
| `beep lint policy` local D10 plan, affected scope = whole fleet (turbo.json changed) | 1,208 s wall: cheap 9/9, medium 283/283, state 7/8 (one real oxlint finding, fixed), typed 141/141 | not measured | Stage D gate run |

## After merge (owed, not claimed)

Record, in a closeout receipt, the first cold run and the second run's per-lane cache-hit ratio on
`main` for Doctest, Knip, Fallow, JSDoc Ratchet and Lint Policy, using the same
`bun run beep ci lane-timings --runs 60 --tsv` census plus each lane's Turbo summary
(`tasks[].cache.status`). Compare p50/p95 against the table above lane by lane; never sum lanes.
