---
title: Nested extglobs coalesce only where the repetition count stays the same
date: 2026-11-23
reversal: Replace the adoption and usurp tables with one rule that lets any extglob absorb a nested extglob of any operator.
governs:
  - src/internal/ast.ts#adoptionMap
  - src/internal/ast.ts#adoptionWithEmptyAlternativeMap
  - src/internal/ast.ts#adoptionOrAdoptionWithEmptyAlternativeMap
  - src/internal/ast.ts#usurpMap
enforcedBy: []
---

A parent extglob adopts a nested child's alternatives only when the parent's
count still holds: anything but `!` adopts its own operator, `*` adopts every
operator but `!`, `+` adopts `@`, `?` adopts `@`, `!` adopts only `@`. `+` and `@` never
adopt `*` or `?` (zero would be allowed); `?` and `@` never adopt `*` or `+` (more
than one would be allowed); `!` never adopts `!`, `*`, `+` or `?`.
A second table adopts children by adding one empty alternative; the third is
their union.
The usurp table names which sole child takes over its parent and as what; an
`@` parent with one member is always replaced by that member.
Rejected: letting any extglob absorb any nested operator, which coalesces
`+(*(a))` into `+(a)` and drops its empty-string match.
