---
title: Materialize engine diagnostics at public boundaries
date: 2026-11-22
reversal: Move public diagnostic construction into engine helpers and restore public imports there.
governs:
  - src/internal/diagnostics.ts#RawTomlError
  - src/internal/limits.ts#GuardExceeded
  - src/internal/stringifyValue.ts#raise
  - src/Toml.ts#parseToResult
  - src/TomlVisitor.ts#collectEvents
  - src/TomlVisitor.ts#collectEventsOrFail
enforcedBy: []
---
Keep the raw diagnostic vocabulary independent of public diagnostic materialization.
Keep guard limits in a dependency-free leaf so guard imports cannot form a cycle through it.
Public parse, stringify and visitor boundaries materialize only RawTomlError and GuardExceeded.
Parse diagnostics add source positions; value-stringify errors use zero offsets without source text.
Other throws remain defects: synchronous callers receive a throw and Effect callers receive a Die.
Rejected: constructing public diagnostics inside the engine or converting every thrown value to a typed error.
Those alternatives couple the raw vocabulary to its consumers or conceal programming defects.
