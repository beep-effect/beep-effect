---
title: The package's tests run sequentially because the ported suites share per-file fixture state
date: 2026-11-26
reversal: Delete sequentialSuiteOrder from vitest.config.ts so the shared config's concurrent tests apply again, after giving each case its own request log and token clock.
governs:
  - vitest.config.ts#sequentialSuiteOrder
enforcedBy: []
---

The ported suites share per-file fixture state: a module-level `requested` log that property tests reset per run, and GitHubApp's clock- and fetch-scripted token rotation. They were written for the lab's sequential runner, so the suite keeps its sequential order.
Rejected: the shared `vitest.shared.ts` default of concurrent tests, which interleaves those runs and their shared state.
Rejected: one fresh fixture per case, which would rewrite every ported suite's shared request log and scripted clock.
