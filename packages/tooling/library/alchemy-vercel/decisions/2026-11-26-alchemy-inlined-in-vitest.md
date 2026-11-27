---
title: Vitest inlines alchemy so the engine and the Vercel providers share one module instance
date: 2026-11-26
reversal: Drop the inline list from vitest.config.ts so Vitest externalizes alchemy again.
governs:
  - vitest.config.ts#alchemySingleModuleInstance
enforcedBy: []
---

Alchemy brands `Unowned` reads with a module-private symbol. Inlining `alchemy` keeps its engine and this package's providers on one module instance, so the brand a provider's `read` sets is the one the engine checks.

Rejected: Vitest's default externalization of `node_modules`, under which the engine and the providers can load separate instances.
