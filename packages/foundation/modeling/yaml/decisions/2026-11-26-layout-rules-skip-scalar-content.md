---
title: Layout lint rules treat whitespace inside scalar content as the value and never flag or fix it
date: 2026-11-26
reversal: Drop the insideScalarSpan skip from trailing-spaces and the composed-scalar guard from empty-lines, so content lines are judged like layout lines.
governs:
  - src/internal/rules/trailing-spaces.ts#trailingSpaces
  - src/internal/rules/empty-lines.ts#layoutBlankPredicateGuardingComposedScalars
enforcedBy: []
---
`trailing-spaces` skips a trailing run that `insideScalarSpan` places inside a scalar token, and `empty-lines` counts a blank line only when it lies outside scalar tokens and outside every composed multi-line scalar span. Whitespace there is part of the parsed value, so a layout rule must not flag it and its fix must not delete it.
This is a recorded divergence from yamllint, whose trailing-spaces flags scalar content too.
Rejected: yamllint's line-only reading, whose fix would change the values of block and multi-line flow scalars.
