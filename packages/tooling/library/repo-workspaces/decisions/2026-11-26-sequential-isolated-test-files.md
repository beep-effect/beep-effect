---
title: The package's tests run in order and each test file keeps its own module graph
date: 2026-11-26
reversal: Delete sequentialIsolatedTestFiles from vitest.config.ts so the shared config's globally concurrent tests and its shared module graph under coverage apply again.
governs:
  - vitest.config.ts#sequentialIsolatedTestFiles
enforcedBy: []
---

The config-dependency suites point `process.env` at real fake-pnpm and hook-marker paths and mock modules per file, so tests run in order and each file keeps its own module graph (the lab's settings).
Rejected: the shared `vitest.shared.ts` defaults, globally concurrent tests and, under coverage, one module graph shared by every file in the worker, where one suite's environment and module mocks would reach another's.
