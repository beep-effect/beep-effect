---
title: Vitest inlines Alchemy so the engine and the providers share one module instance
date: 2026-11-26
reversal: Drop the inline list from vitest.config.ts so Vitest externalizes alchemy and @alchemy.run again.
governs:
  - vitest.config.ts#alchemySingleModuleInstance
enforcedBy: []
---

Vitest inlines `alchemy` and `@alchemy.run/*`, so Alchemy's engine and this package's providers load one module instance. `Unowned` brands `read` results with a module-private symbol, and a provider from a second instance would not carry the symbol the engine checks.

Rejected: Vitest's default externalization of `node_modules`, which lets the engine and the providers resolve separate module instances.
