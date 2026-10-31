# G2: repo-cli coverage shards

Gate fix G2 (D3, D12). Measured 2026-10-31 against `main` at 2c1ff256c1.

## What changed since the design record

The design record's coverage row (one 1,358 s repo-cli shard, about 24 minutes
for the job) describes the old coverage job, which re-ran tests in its own
weight-planned shards. Coverage is now collected inside the Test Unit
partitions (`docs/runbooks/ci-coverage-artifacts.md`): each partition uploads
raw `coverage-final.json` counters, and `Heavy / Coverage Regression` only
validates, merges and compares them. `@beep/repo-cli` already ran as two
Vitest `--shard` halves (`repo-cli-1`, `repo-cli-2`, #1195), each at
`--maxWorkers=1`.

So the tail moved, but repo-cli still holds it whenever a change selects only
repo-cli and its neighbours:

| Run | Event | repo-cli-1 | repo-cli-2 | unit-a | unit-b | Coverage Regression |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 41174954317 | push to main | 1,381 s | 1,277 s | 1,840 s | 1,885 s | 542 s |
| 41132810187 | push to main | 1,669 s | 1,622 s | 1,841 s | 1,950 s | 634 s |
| 41176230928 | PR, repo-cli scope | 1,724 s | 2,073 s | 77 s | 87 s | 195 s |
| 41141818094 | PR, repo-cli scope | 1,666 s | 2,066 s | 88 s | 68 s | 179 s |
| 41117357393 | PR, mixed scope | 1,676 s | 2,058 s | 741 s | 1,022 s | 332 s |
| 41076364914 | PR, mixed scope | 1,726 s | 1,174 s | 1,254 s | 1,417 s | 572 s |

Job wall times, attempt 1. In run 41174954317 the Vitest bodies were 1,252 s
(192 files, 4,202 tests) and 1,155 s (192 files, 3,955 tests): 2,407 s of
serial repo-cli coverage work. Setup is about 70 s per job.

On repo-cli-scoped pull requests the slower half alone gates `Test Unit` and
therefore `Heavy / Coverage Regression` for 28 to 35 minutes, while the unit
bins finish in under two minutes.

## Decision: four shards, not more workers

Split `@beep/repo-cli` into four Vitest `--shard` quarters (`repo-cli-1` to
`repo-cli-4`, `total: 4`). Reasons:

- The merge path already accepts any shard total. `CoverageArtifacts.ts`
  requires exactly `total` slices with indexes `1..total`, the same
  instrumentation fingerprint per file, and no test file in two slices, then
  adds raw Istanbul counters. Nothing in the comparator or the
  `coverage.regression-baseline.jsonc` semantics changes; the ratchet still
  judges one merged map per package.
- More workers in one job collides with G1. The repo-cli config sets
  `isolate: true` and `fileParallelism: false` because suites change the
  working directory, mock modules and stub globals; G1 is the lane that
  separates the suites that are safe to parallelize. Separate runners need no
  such audit, and G1's gain stacks on top of the shards.
- Cost: two more `ubuntu-24.04` jobs of about 70 s setup each, and the same
  test work spread over twice as many runners.

The weights become 603 s each (a quarter of the 2,412 s two-half body). They
remain evidence, not scheduler inputs. Vitest shards by file, so quarters are
close to even but not exact.

Touched: `CiLanePartitions.ts` (ids and table), the `check.yml` Test Unit
matrix, the lane-timings effective-span shard list, the coverage runbook and
the tests that pin them. The `Test Unit` aggregator and required contexts are
unchanged; no token permission changes (`contents: read` for producers,
`actions: read` for the comparison, as before).

Lane-timing windows that straddle this change see pre-change runs without
`repo-cli-3` and `repo-cli-4` as incomplete effective spans, as happened when
#1195 introduced the halves.

## Local proof

Run 2026-10-31 on the workstation with the producer's settings: Node 22.23.4,
`--coverage.provider=v8`, `--maxWorkers=1`, `BEEP_FC_SEED=20260708`,
`CI=true`, run one after another under `beep-heavy`. Each quarter ran
`vitest run --coverage --shard=i/4`; the reference ran the whole package
unsharded. The four `coverage-final.json` maps were merged with
`createCoverageMap`/`addFileCoverage` (the same calls `CoverageArtifacts.ts`
uses) and compared per file against the unsharded map.

| Run | Exit | Wall |
| --- | ---: | ---: |
| quarter 1/4 | 0 | 561 s |
| quarter 2/4 | 0 | 728 s |
| quarter 3/4 | 0 | 863 s |
| quarter 4/4 | 0 | 1,057 s |
| unsharded | 0 | 3,959 s |

| Metric | Merged quarters | Unsharded |
| --- | ---: | ---: |
| Files | 928 | 928 |
| Lines | 74,713 / 83,155 | 74,713 / 83,155 |
| Statements | 79,623 / 88,959 | 79,623 / 88,959 |
| Functions | 25,006 / 28,780 | 25,006 / 28,780 |
| Branches | 28,108 / 33,695 | 28,108 / 33,695 |

Per-file diff: 0 of 928 files differ on any of the four metrics. Because the
merged map equals the unsharded map and `standards/coverage.regression-baseline.jsonc`
is unchanged, the ratchet sees the same numbers against the same floors.

Local wall times are on a loaded workstation and are not comparable to hosted
runners; they show the shape of the split (Vitest shards by file, so the
quarters are uneven), not the hosted gain.

## After (hosted)

Run 41191278261 on #2392 (attempt 1, full coverage fallback because this
change edits global coverage inputs, so every package was measured):

| Job | Wall |
| --- | ---: |
| Test Unit (repo-cli-1) | 1,034 s |
| Test Unit (repo-cli-2) | 842 s |
| Test Unit (repo-cli-3) | 1,194 s |
| Test Unit (repo-cli-4) | 994 s |
| Test Unit (unit-a) | 1,398 s |
| Test Unit (unit-b) | 1,478 s |
| Heavy / Coverage Regression | 570 s |

A full-fallback run measures every package, so the comparable before rows
are the two `main` pushes: the slower repo-cli half took 1,381 s and
1,669 s there, and the slowest quarter now takes 1,194 s. The unit bins
remain the Test Unit tail on such runs. On a repo-cli-scoped pull request
the slower half took 2,066 to 2,073 s; the expected tail there is the
slowest quarter, about 20 minutes instead of 28 to 35, which a scoped run
has yet to confirm.

Coverage Regression accepted the four-quarter merge for `@beep/repo-cli`
and reported no repo-cli row. It failed on one inherited row:
`packages/documents/server/src/aggregates/Sync/VaultSync.file-store.ts`
reached `main` in #2388 without a baseline identity, and this branch touches
no documents-server file.
