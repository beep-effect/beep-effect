---
title: The package's tests run sequentially because the ported suites share process-wide state
date: 2026-11-27
reversal: Delete portedSuiteOrder from vitest.config.ts so the shared config's concurrent tests apply again, after giving each Action.main, logger-property and DetachedProcess case its own console, transcript and child-process scope.
governs:
  - vitest.config.ts#portedSuiteOrder
enforcedBy: []
---

The ported suites share process-wide state. `Action.main` writes through the global console, the logger properties read one TestConsole transcript, and the DetachedProcess suites spawn and reap real child processes. The package therefore runs its tests sequentially.
Rejected: the shared `vitest.shared.ts` default of concurrent tests, which interleaves those runs, so one case's console writes land in another case's transcript.
Rejected: per-file isolation alone, which separates files but not the concurrent tests inside one file.
