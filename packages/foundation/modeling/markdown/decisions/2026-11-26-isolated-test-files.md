---
title: The package's test files run isolated, coverage runs included
date: 2026-11-26
reversal: Delete isolatedTestFiles from vitest.config.ts so the shared config's coverage-time module sharing applies again.
governs:
  - vitest.config.ts#isolatedTestFiles
enforcedBy: []
---

The coverage tests replace the parser's dialect registries through `vi.spyOn` (`BlockRegistry.blockDialect`, `Registry.inlineDialect`), and the registry spies need a fresh module context for every test file. The package therefore sets `isolate: true` for every run, coverage runs included.

Rejected: the shared `vitest.shared.ts` default, which turns isolation off under coverage for speed and shares one module context across the files of a worker.
