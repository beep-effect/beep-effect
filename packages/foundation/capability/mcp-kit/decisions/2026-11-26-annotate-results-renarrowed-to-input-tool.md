---
title: Annotation combinators re-narrow to the caller's tool type
date: 2026-11-26
reversal: Drop the `as T` casts and return the widened Tool type that Tool#annotate produces.
governs:
  - src/TierGate.ts#withEnabledWhenApprovedTool
  - src/ToolAnnotations.ts#annotateFourHints
enforcedBy: []
---

`Tool#annotate` returns the widened `Tool<Name, Config, Requirements>` shape rather than the
caller's specific `T`. An annotation never changes `Name`, `Config` or `Requirements`, so
both combinators cast the annotated tool back to `T` and keep the caller's precise type in
`Toolkit.make` and handler maps.

Rejected: returning the widened type, which is sound without a cast but loses the caller's
tool type at every annotated tool.
