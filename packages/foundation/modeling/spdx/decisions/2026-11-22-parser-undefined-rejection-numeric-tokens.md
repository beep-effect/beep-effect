---
title: The internal SPDX parser rejects with undefined and tags tokens with numeric constants
date: 2026-11-22
reversal: Make scan and the descent steps return Option or Result, and replace the TOKEN_* constants with an enum or string literal kinds.
governs:
  - src/internal/parser.ts#TOKEN_OPEN_PAREN
  - src/internal/parser.ts#scan
  - src/internal/parser.ts#parseOrUndefined
  - src/internal/parser.ts#parse
enforcedBy: []
---

The scanner and the recursive-descent steps signal rejection with `undefined`
and return it through every step; only the internal `parse` export lifts the
result to `Option`, and the facades turn `none` into `InvalidSpdxExpressionError`.
Token kinds are plain numeric constants with shared punctuation token objects.
This keeps `isValidExpression` allocation-light: one parse allocates no
wrappers per step and no token object per punctuation hit.
The scanner is iterative, so input length cannot overflow its call stack.

Rejected: `Option`/`Result` per descent step, which allocates on every token;
`const enum` under `isolatedModules` and runtime `enum`, which emit enum
objects instead of leaving only the numeric constants.
