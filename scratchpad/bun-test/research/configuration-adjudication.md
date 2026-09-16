# Bun/Turbo configuration review adjudication

Date: 2026-09-15. This reconciles the independent
[Codex review](codex-turbo-review.md) and [Grok review](grok-turbo-review.md).
It specifies qualification requirements, not benchmark results or adoption.

## Conclusion

A local pilot remains worthwhile. Neither review establishes that native Bun
will save resources, nor that it cannot. Configuration must be qualified on
the pinned installed versions before accepting timings. Correctness and workload
equivalence apply to both runners; baseline defects must not manufacture a win.

Codex checked installed CLI behavior, source, primary documentation, and Turbo
dry runs. Grok supplied an independent adversarial source review but did not
complete its primary-document fetches. The parent checked the material disputes
against installed help and current Bun documentation, and requested a bounded
Codex adjudication of Grok's draft. Agreement between reviewers is not proof.

## Accepted findings

1. Ordinary schema tests already execute Vitest on Bun. Compare native Bun to
   that baseline. Keep the Node 22.22.3 V8 coverage baseline distinct and record
   the actual child executable for every trial.
2. Turbo cache hits can replay successful logs without executing tests. Disable
   both reads and writes for runner trials and require fresh child execution
   receipts. Package-runner timing and the complete Turbo task graph are
   separate measurements.
3. A positive property floor changes the Vitest file population. Freeze separate,
   nonempty ordinary/property manifests and count generated checks as well as
   cases. Strict environment filtering must preserve the intended settings.
4. Model adapter, preload, aliases, helper closure, runtime, and environment
   inputs. Schema's undeclared test-utils import is inherited graph debt;
   test-utils already depends on schema, so adding the reverse edge creates a
   cycle. Use explicit isolated pilot input accounting without changing that
   production topology.
5. Match task concurrency, file workers, within-file concurrency, isolation,
   timeouts, setup, and prerequisite artifacts. Coverage currently schedules
   dependency builds that ordinary/property tasks do not execute.
6. Transitive assertions, mocks, module reset, property semantics, interruption,
   completion hooks, and Layer lifetimes need executable qualification. Existing
   scratch tests and a top-level import rewrite do not establish full parity.
7. Native coverage does not currently establish the repository's statement and
   branch regression contract. Retaining Node/V8 coverage is an allowed outcome.
8. A schema timing ratio cannot establish total CI cost savings. Preserve the
   distinction between GitHub-hosted jobs and EC2 occupancy, and between queue
   latency and billed work. Cache hits, setup, unchanged tasks, retries, failed
   attempts, and runner lifetime remain in the eventual cost model.

## Corrections to the reviewer output

| Claim or recommendation | Adjudication |
| --- | --- |
| Lack of measurements falsifies the migration hypothesis, or proves the savings threshold is structurally hard to clear | Rejected. The hypothesis is untested. Difficulty requires measured attributable cost shares. An uncertainty interval crossing the threshold is inconclusive for adoption, not proof that savings are absent. |
| Historical zero coverage under Bun establishes a V8-on-Bun failure | Rejected. `vitest.setup.ts:1–8` records an Istanbul failure. Current coverage uses V8. Bun-hosted V8 is a separate unqualified variant. |
| Use `--force` or read-only caching for the experiment | Corrected. `--force` still permits writes; `--no-cache` means `--cache=local:r,remote:r`. Installed Turbo 2.10.12 accepts `--cache=local:,remote:` to disable both. |
| `--dry=json` proves that a test executed | Rejected. It proves a planned graph and inputs. Actual child start/end receipts and run summaries must establish execution. |
| Missing Turbo outputs means nothing is cached | Rejected. Logs and successful task results can be cached without file outputs. The local skill's wording is inaccurate on this point. |
| Adapter `addEqualityTesters` being a no-op proves an equality regression | Rejected as established evidence. Installed `@effect/vitest/src/internal/internal.ts:59–61` registers an empty array. A representative equality sentinel remains required; do not invent custom testers without an observed difference. |
| Root Bun `exclude` proves discovery exclusions work | Unqualified. `bunfig.toml:11–12` uses `exclude`; current docs and installed help specify `pathIgnorePatterns`. Use explicit populations and an excluded-file sentinel, rather than assuming this key works or claiming it was experimentally proven broken. |
| Bun file isolation replaces `vi.resetModules()` inside a test | Rejected. Bun isolation resets between files. The Float16 test changes a global and reimports within a file; it needs an explicit qualified solution. |
| All tests must have physical import rewrites | Too strong. A qualified resolution/preload facade may intercept direct and transitive imports. It must prove identities and must not stub code under test. |
| Flush page caches or delete `node_modules/.bun` to equalize trials | Rejected. Do not disturb workstation caches or installation state. Use fresh processes, isolated trial artifacts, and labeled warm-cache conditions. |
| Existing production Vitest doctrine prevents the authorized scratch experiment | Rejected. The user authorized investigation of an isolated alternative. A later canonical migration requires a deliberate doctrine and generator update. |

## Configuration contract to implement and prove

| Surface | Required configuration and evidence |
| --- | --- |
| Package tasks | Keep package ownership and Turbo scheduling. Pilot configuration stays isolated; later canonical scripts go through the existing generator and package scaffold. No repository-wide root discovery command. |
| Config loading | Pin package working directory and config/preload paths. Prove which config is loaded, how relative paths resolve, and which aliases/exports resolve. Account for automatic dotenv loading; capture only approved nonsecret settings, never whole environments. |
| Discovery | Exact per-workload file manifests, nonempty selection, matching test/skip/todo inventories, excluded-file sentinel, and failure on unexpected zero tests. Do not rely on default glob differences. |
| Isolation | Initial comparison preserves file isolation on both runners. Installed Bun supports `--isolate` and `--parallel=N`; parallel mode implies isolation. Preloads rerun per isolated file. Prove global/module leakage and fixture lifetime behavior. |
| Concurrency | Set Turbo task count, runner worker count, and within-file concurrency explicitly. Give each runner a bounded tuning allowance under the same CPU/memory limits; retain matched-resource results separately from tuned results. |
| Property work | Separate ordinary selection from deep property selection. Reuse `fcRuns`; pin compatible seeds/floors; record effective runs and discarded/shrunk checks where observable. Changing a seed/floor must reach the child and affect the appropriate task hash. |
| Caching and graph | Disable Turbo reads/writes during timing. Dry-run both graphs, allowlist expected prerequisite commands, hash out-of-package inputs, and prove fresh child execution. Later realistic cache-hit scenarios are separate from runner timings. |
| Semantics | Known failing assertions must fail. Qualify helper assertions, mocks/restore, within-test module reset, equality, timeout interruption, finalizers, completion hook failures/counts, Layer scope, and retained test typechecking. |
| Coverage | Run the bounded comparison with equivalent prerequisites and fresh report directories. Compare source inclusion and available per-file metrics; do not derive branches/statements from line coverage. Prove regression failures and uncovered-source behavior before considering substitution. |
| Resources | Fresh trial cgroup under repository admission; aggregate CPU and memory peak; capture before collection. One arm at a time. Label cgroup peak separately from RSS and enforce the agreed aggregate execution budget. |

Current Bun documentation disagrees about LCOV-only threshold enforcement:
the [configuration page](https://bun.com/docs/test/configuration) says thresholds
apply with any reporter, while the [coverage page](https://bun.com/docs/test/code-coverage)
describes a serial LCOV-only exception. Test serial/parallel and text/LCOV/both
with deliberately insufficient coverage before trusting any gate. The same
configuration page documents lines/functions and says the statements key is
accepted without enforcement.

The [parallelism documentation](https://bun.com/docs/test/parallel) distinguishes
file processes, isolated globals, and within-file concurrency. Its defaults
are not interchangeable with Vitest's. Bun's documented `--smol` mode may be a
separately labeled memory-tuning variant within the shared budget; it is not a
reason to lower concurrency or weaken isolation on only one side silently.

## Evidence boundary

Installed help, source inspection, primary-document review, and Turbo dry runs
are complete. No benchmark, test, build, trial cgroup, hosted CI job, live billing
query, or configuration change was executed for these reviews. None of the
executable qualification rows is claimed to have passed. Production source,
package manifests, runner configuration, and workflows remain unchanged.
