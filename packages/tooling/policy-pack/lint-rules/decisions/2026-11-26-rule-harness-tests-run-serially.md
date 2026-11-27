---
title: Rule harness tests run serially with a subprocess-sized timeout
date: 2026-11-26
reversal: Remove the sequence, fileParallelism and testTimeout overrides from vitest.config.ts.
governs:
  - vitest.config.ts#ruleHarnessTestOptions
enforcedBy: []
---

The rule and parity harnesses lint each fixture through a synchronous Biome or oxlint subprocess. Concurrent tests in one worker would charge the time a fixture spends blocked behind another's subprocess to their own timers, so tests and files run one at a time, with a 30-second timeout (300 seconds under coverage or a deep fast-check sweep).

Rejected: the shared concurrent defaults with a longer timeout, which keep the blocked time on every timer and only hide it.
