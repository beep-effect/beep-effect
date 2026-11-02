# Test Unit re-bin and two-wide producers — 2026-11-02

## Why

The window-4 preview (`2026-10-27T10:00:00Z` → `2026-11-03T10:00:00Z`, 15
ratified contexts) read `Test Unit` at **44m27s p95** (p50 32m47s, max
94m48s) with 721 incomplete shard sets, and the shard-pickup tripwire at
11m18s. A 60-run sample of attempt-one successful shards (40 PR, 20 push,
2026-10-31 → 2026-11-02) attributed the span to shard bodies, not the queue:

| Shard | body p50 | body p95 | pickup p95 |
| --- | ---: | ---: | ---: |
| repo-cli-1 | 14.0m | 15.2m | 5.8m |
| repo-cli-2 | 9.4m | 11.4m | 5.0m |
| repo-cli-3 | 15.5m | 18.5m | 5.7m |
| repo-cli-4 | 12.0m | 14.8m | 6.0m |
| unit-a | 19.6m | 32.3m | 5.2m |
| unit-b | 25.9m | 36.7m | 5.0m |

Two causes, both measured from run `41247317827` (PR, cold cache):

1. **The producers run one package at a time.** `runCompoundCoverageSteps`
   issued one `ci:test:<package>` step per package through
   `Effect.forEach` with no concurrency: unit-a ran 86 steps whose
   busy-sum (26.4 min) equals the span (26.4 min) at a maximum
   concurrency of 1, on a 4-vCPU runner where every vitest process is
   pinned to `--maxWorkers=1`.
2. **44 packages were never binned.** Since September the default placer
   hashed every new workspace into unit-a or unit-b (`@beep/markdown`
   168 s, `@beep/repo-workspaces` 111 s, `@beep/cli-kit`, `@beep/glob`
   70 s, the `@beep/practice-*` apps, …), so the curated 1,214 s weights
   described bins that had grown to 1,587 s (unit-a) and 1,355 s (unit-b)
   of serial test time.

## Measured per-package wall time (top 20 of 177)

| Package | Old bin | Wall s |
| --- | --- | ---: |
| `@beep/professional-desktop` | unit-a | 207 |
| `@beep/markdown` | unit-b | 168 |
| `@beep/repo-workspaces` | unit-b | 111 |
| `@beep/test-utils` | unit-a | 107 |
| `@beep/law-practice-server` | unit-b | 98 |
| `@beep/repo-ai-metrics` | unit-b | 92 |
| `@beep/lint-rules` | unit-a | 89 |
| `@beep/duckdb` | unit-b | 86 |
| `@beep/md` | unit-a | 70 |
| `@beep/glob` | unit-a | 70 |
| `@beep/doc-text` | unit-a | 55 |
| `@beep/epistemic-server` | unit-a | 54 |
| `@beep/box-provisioning` | unit-b | 51 |
| `@beep/db-admin` | unit-a | 49 |
| `@beep/yaml` | unit-b | 47 |
| `@beep/ontology-server` | unit-a | 42 |
| `@beep/editor` | unit-b | 35 |
| `@beep/technical-drawing` | unit-a | 35 |
| `@beep/occt` | unit-a | 33 |
| `@beep/ontology-client` | unit-a | 32 |

Full table: `unita-durations.txt` / `unitb-durations.txt` in the session
scratchpad; the `ci:test:<package>:<n>: ok in <ms>` lines of jobs
`124673581997` (unit-a) and `124673581837` (unit-b) are the source. Eight
packages without a measurement in that run (`@beep/fc-runs`, `@beep/types`,
`@beep/spdx`, `@beep/identity`, `@beep/ontology-config`, `@beep/storybook`,
`@beep/test-runner`, `@beep/github-commands`) took the median
(7.9 s).

## Decision (SPEC D4)

- Four unit bins, LPT over the measured seconds (every one of the 182
  test-unit packages curated, none left to the hash):

| Bin | Packages | Serial weight s | Heaviest |
| --- | ---: | ---: | --- |
| unit-a | 45 | 749 | `@beep/professional-desktop`, `@beep/glob`, `@beep/box-provisioning`, `@beep/editor` |
| unit-b | 45 | 750 | `@beep/markdown`, `@beep/lint-rules`, `@beep/doc-text`, `@beep/yaml` |
| unit-c | 46 | 749 | `@beep/repo-workspaces`, `@beep/repo-ai-metrics`, `@beep/duckdb`, `@beep/db-admin` |
| unit-d | 46 | 749 | `@beep/test-utils`, `@beep/law-practice-server`, `@beep/md`, `@beep/epistemic-server` |

- The producers run **two package steps at a time** with buffered output
  (`runQualityTaskBufferedStepGroup`), so a bin's body is about half its
  serial weight: ~6–7 min plus ~4.5 min of checkout, install and dependency
  build.
- `@beep/repo-cli` goes from four to **six** Vitest shards (402 s arithmetic
  weight each) so its slowest slice (18.5 min p95 as a quarter) fits under
  the bar with pickup.
- The census (`beep ci lane-timings`) carries both shard layouts; a run is
  complete when its attempt-one shard set is exactly one of them, so window
  4 (old layout) and window 5 (new layout) are judged against the layout
  that produced them.

Projection: Test Unit effective p95 ≈ 11–13 min at the sampled pickup
(5–6 min p95); the queue tripwire itself is not repaired by this change.

## Lint

Not repaired here. The cold Lint body (27m32s p95 in the preview) was
biome's project scan: the project-domain rule `noDeprecatedImports` made
every per-package `biome check .` index the whole repository (~75 CPU-s per
package, 31 s wall on a 4-vCPU runner, 92 tasks at concurrency 2 ≈ 25 min).
#2526 (merged 2026-11-02, `3ceb6833db`) turned the rule off per package and
runs it once at the root; the first cold `main` lint shards after it
(run `41412952418`) ran 92 and 91 uncached lint tasks in 30.9 s and 34.8 s.
The window-5 census measures the effect.
