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

## After merge (accounted 2026-09-13)

The obligation above: the first cold run and the next run on `main`, per lane, for Doctest,
Knip, Fallow, JSDoc Ratchet and Lint Policy, from `bun run beep ci lane-timings --runs 60 --tsv`
plus each lane's Turbo task cache status; p50/p95 compared lane by lane, never summed.

### Turbo task cache status, main cold `e08b24b004` vs next `c8d6d2f218`

Counts are the per-task `cache hit, replaying` / `cache miss, executing` / `cache bypass, force
executing` lines of each lane's job log (the same rows the run summary carries as
`tasks[].cache.status`); the footer is Turbo's own `Cached: n cached, m total`.

| Lane | cold hit / miss / bypass | cold footer | next hit / miss / bypass | next footer |
| --- | ---: | --- | ---: | --- |
| Heavy / Doctest | 0 / 27 / 0 | 0 of 27 | 0 / 27 / 0 | 0 of 27 |
| Knip | 0 / 1 / 1 | 0 of 2 | 0 / 1 / 1 | 0 of 2 |
| Fallow Advisory Envelopes | 6 / 1 / 7 | 7 footers, 1 of 2 each after the first | 7 / 0 / 7 | 1 of 2 each |
| JSDoc Ratchet | 0 / 1 / 1 | 0 of 2 | 0 / 1 / 1 | 0 of 2 |
| Heavy / Lint Policy | 2 / 99 / 4 | cheap 1 of 9 | 2 / 150 / 7 | cheap 1 of 9 |

Bypasses are the `cache: false` rows (Knip and JSDoc Ratchet each pair one census task with the
policy fingerprint; Lint Policy's cold-run bypasses were `//:knowledge:refs-check`,
`//:lint:jsdoc-module-tags`, `//:lint:oxlint`, `//:lint:typos`, joined on the next run by
`//:goals:doctor`, `//:jsdoc:inventory:check`, `//:knowledge:semantic-delta`).

### Wall-clock, seconds

`cold` and `next` are the two main runs; `pre` and `post` are the census window split at the
first main run after the merge (`34725404916`), successful jobs only, so `pre` holds the last
pre-migration heads and `post` the post-migration heads including pull requests.

| Lane | cold | next | pre n / p50 / p95 | post n / p50 / p95 |
| --- | ---: | ---: | ---: | ---: |
| Heavy / Doctest | 406 | 394 | 10 / 363 / 396 | 14 / 146 / 408 |
| Knip | 111 | 88 | 11 / 96 / 114 | 17 / 96 / 119 |
| Fallow Advisory Envelopes | 276 | 306 | 10 / 265 / 285 | 15 / 288 / 349 |
| JSDoc Ratchet | 472 | 521 | 9 / 512 / 520 | 15 / 521 / 614 |
| Heavy / Lint Policy | 1,303 | 1,323 | 7 / 655 / 1,160 | 10 / 1,211 / 1,323 |

### Reading

- Lint Policy is the debt: post-migration p50 1,211 s against 655 s before (and 620 s in the
  older table above), with both main runs above 1,300 s. The one-job D10 plan on a 4-vCPU runner
  replaced parallel sharded jobs, and consecutive main commits replay almost nothing because the
  migrated root tasks still declare whole-tree inputs (fact F-B in `c3-turbo-facts.md`).
- Doctest replayed nothing on either main run (0 of 27 twice, a docs-only commit included),
  yet the post-migration census p50 dropped to 146 s because pull-request runs do replay the
  fleet. Main's doctest hashes or its remote-cache read path differ from the PR path; that is a
  C4 question, recorded here, not diagnosed.
- Knip and JSDoc Ratchet run one `cache: false` census task plus one miss each and sit inside
  their earlier bands. Fallow's non-bypass task replays on the next run.
- This is the accounting PLAN C3.6 owed. It is not a cache-hit win or a whole-proof speedup
  claim; the hit economics C3 was built for arrive when C4 narrows the inputs.
