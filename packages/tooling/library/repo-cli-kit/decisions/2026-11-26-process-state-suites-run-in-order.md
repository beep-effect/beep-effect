---
title: The package's tests run in order, each file in its own worker, because suites mutate process-wide state
date: 2026-11-26
reversal: Delete processStateSuiteOrder from vitest.config.ts so the shared config's concurrent, coverage-shared tests apply again, after giving each stdout, environment and fixture-directory case its own scope.
governs:
  - vitest.config.ts#processStateSuiteOrder
enforcedBy: []
---

Several suites swap process.stdout.write, stub the environment, seed Bun.env before the first config read, or share one fixture directory between tests. Each file therefore keeps its own worker, even under coverage, and the tests inside one file run sequentially: the settings these suites ran under in repo-cli before they moved here.

Rejected: per-file isolation alone, which separates files but not the concurrent tests inside one file.
