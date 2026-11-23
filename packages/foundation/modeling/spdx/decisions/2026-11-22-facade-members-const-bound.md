---
title: SpdxExpression facade members are const bindings, not function declarations
date: 2026-11-22
reversal: Declare parseResult (and the other facade members) as hoisted function declarations.
governs:
  - src/SpdxExpression.ts#parseResult
  - src/SpdxExpression.ts#parseEffect
  - src/SpdxExpression.ts#FromString
  - src/SpdxExpression.ts#SpdxExpression
enforcedBy: []
---

Every member of the `as const` `SpdxExpression` facade that is not exported on
its own is a `const` binding. The const's structural type inlines into the
facade's emitted `.d.ts`, so consumers see the member's signature.

A named `function` is emitted as `typeof parseResult`, a reference to a
symbol the module never exports, which leaks an unexported name onto the
public surface (API Extractor reports it as `ae-forgotten-export`).

Rejected: `function parseResult(...)`, matching the exported
`isValidExpression` declaration beside it.
