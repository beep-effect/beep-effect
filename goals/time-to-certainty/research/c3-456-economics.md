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

## After merge (accounted 2026-09-12)

Hosted wall-clock sample, minutes:seconds; columns identify the exact commits. These are single
runs, not new p50/p95 estimates, and lanes are not summed.

| Lane | PR `a0f8bb79c9` | main cold `e08b24b004` | main next `c8d6d2f218` |
| --- | ---: | ---: | ---: |
| Heavy / Lint Policy | 22:49 | 21:43 | 22:03 |
| Heavy / Check | 11:16 | 9:46 | 9:48 |
| Heavy / Doctest | 6:36 | 6:46 | 6:34 |
| Heavy / Docgen | 14:47 | 14:48 | 14:42 |
| Heavy / Coverage Regression | 35:10 | 33:00 | 34:32 |
| Heavy / Test Integration | 4:39 | 3:39 | not in the sample |
| Test Unit (repo-cli) | 13:50 | 17:09 | 17:21 |

Inside `Heavy / Lint Policy`, both main runs' cheap-phase footer reads:
`Tasks: 9 successful, 9 total / Cached: 1 cached, 9 total`. Only the policy fingerprint replays.

- Cold main `e08b24b004`: 2 cache hits, 99 misses, 4 bypasses (`cache: false`, by design):
  `//:knowledge:refs-check`, `//:lint:jsdoc-module-tags`, `//:lint:oxlint`, `//:lint:typos`.
- Next main `c8d6d2f218`, a docs-only nightly research packet: 2 hits, 150 misses, 7 bypasses:
  `//:goals:doctor`, `//:jsdoc:inventory:check`, `//:knowledge:refs-check`,
  `//:knowledge:semantic-delta`, `//:lint:jsdoc-module-tags`, `//:lint:oxlint`, `//:lint:typos`.

Reading: consecutive main commits replayed almost nothing in the policy lanes. Migrated root
tasks still declare whole-tree inputs (the F-B surface in `c3-turbo-facts.md`), so a docs-only
commit can invalidate their hashes; the 18 `cache: false` census rows bypass by design.
Against the table above, `Heavy / Lint Policy` moved from a 620 s p50 (650 s p95, n=11)
to 1,303–1,369 s in these three runs: the one-job D10 plan on a 4-vCPU runner roughly doubles
the lane's wall-clock compared with the sharded lane it replaced, and no hit offsets it yet.
The other heavy lanes sit inside their earlier p95 bands. The hit economics C3 was built for
depend on C4 narrowing the inputs. PLAN C3.6's post-merge accounting is delivered here; this is
not a cache-hit win or a whole-proof speedup claim, and the Lint Policy wall-clock is a debt.
