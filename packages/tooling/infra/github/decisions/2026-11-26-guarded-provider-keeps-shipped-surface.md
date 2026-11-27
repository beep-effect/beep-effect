---
title: The prod guard keeps each shipped provider's method surface and dies on a missing guarded method
date: 2026-11-26
reversal: Define read on every guarded provider and call lookup and diff with optional chaining in ProdWriteGuard.ts.
governs:
  - src/ProdWriteGuard.ts#guarded
enforcedBy: []
---

The prod create guard wraps each shipped GitHub provider without changing which methods it has. `read` stays absent where the shipped provider has none, because its presence changes how the plan adopts an object. `lookup` (for the providers given `"lookup"`) and `diff` are called with a non-null assertion: every such shipped provider has them, and a missing one dies, which fails the plan closed.

Rejected: a guard that always defines `read` (it changes adoption) or optional-chains `lookup` and `diff` (a missing method would skip the create or replace check and let the write through).
