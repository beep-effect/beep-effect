---
title: The npm name grammar is written without lookahead, with reserved names in a separate check
date: 2026-11-26
reversal: Fold the reserved names and leading-character rules into one regex with (?! ) lookaheads.
governs:
  - src/PackageName.ts#UNSCOPED_RE
  - src/PackageName.ts#SCOPED_RE
  - src/PackageName.ts#isNotReserved
enforcedBy: []
---

`UNSCOPED_RE` and `SCOPED_RE` use no `(?=` or `(?!`, and `node_modules` and `favicon.ico` are refused by the `isNotReserved` filter.
Reason: the regex compiler in `effect/Arbitrary` rejects lookahead, so `Arbitrary.schema` would fall back to filtering random strings, none of which is ever a package name.
Every accepted name is valid for `validate-npm-package-name`'s `validForOldPackages`: URL-safe lowercase, and an unscoped name never starts with `.`, `_` or `-`.
Rejected: a single lookahead regex, which is shorter but leaves the schema with no usable generator.
