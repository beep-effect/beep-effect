---
title: Native wall-clock tests run in their own two-worker Vitest project
date: 2026-11-23
reversal: Drop the projects split in vitest.config.ts and merge one config with the native-wallclock cap or Vitest's default width; delete this file and its pointers.
governs:
  - vitest.config.ts#nativeWallclockSuites
  - vitest.config.ts#cliExcludes
  - vitest.config.ts#splitProjects
  - test/vitest-shards-plan.test.ts#nativeWallclockUnitFiles
enforcedBy: []
---
Split the package's test run into two Vitest projects. `native-wallclock` holds every unit file whose fixture closure spawns real native workers through `test/CitationNativeSpawner.fixtures.ts` with no manual, sleep or fixed clock (`makeCitationNativeManualClock` / `makeCitationNativeSleepClock`, the spawner fixtures aside), plus every integration file, at two workers and two concurrent tests (#2511), group order 0. `replay` holds the rest at its own width, group order 1: projects with different worker caps cannot share a group, and the wall-clock group drains before the replay group widens.
Reason: a cold native worker load under a saturated runner consumes a production deadline. The integration replays hold `regexDeadline` and `extractDeadline` on the manual clock and give `operationDeadline` the `test/CitationReplayBudget.ts` budget, but their clean, resolve, queue and cleanup deadlines run on the real clock; PR #3007's first heavy run at Vitest's default width (seven workers plus native children on the 8-vCPU runner) failed them with `CitationSafetyLimitExceeded`. The hosted coverage producer passes `--maxWorkers=2` to a unit shard, which Vitest applies to every project, so the two caps agree; each native owner still enforces its own queue and execution limits.
Projects that extend the root concatenate `include`, so the root include is cleared after the merge and each project names its files. Vitest 5.1 forwards only a fixed list of CLI options to projects and `--exclude` is not among them, so every project re-reads the scripts' `--exclude=<glob>` arguments; before this, hosted unit shards on PR #3007 ran integration replays.
Doctest mode collects `src/**` through `includeSource` and the deep property sweep resolves its own include list, so both keep the single config with the package-wide two-worker cap; splitting would add `test/**` to the projects and run every doctest twice (repo-cli guards the same way).
Unit membership is mechanical: `test/vitest-shards-plan.test.ts` re-derives it from the fixture closures.
Rejected: one config at Vitest's default width; one config capped at two workers for every file.
