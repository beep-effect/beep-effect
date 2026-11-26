---
title: Unit test files run isolated, coverage included
date: 2026-11-26
reversal: Remove isolate so vitest.shared.ts shares the module graph under coverage.
governs:
  - vitest.config.ts#isolateEachTestFile
enforcedBy: []
---

Tests here mock modules, stub globals or change the working directory, so every file keeps its own worker even under coverage.

Rejected: the shared module graph `vitest.shared.ts` uses under coverage by default, which leaks one file's mocks and globals into the next.
