---
title: The commonmark.js surface is declared locally instead of through @types/commonmark
date: 2026-11-26
reversal: Add `@types/commonmark` at a version matching the installed runtime and delete test/support/commonmark.d.ts.
governs:
  - test/support/oracle.ts#parser
  - test/support/oracle.ts#renderer
  - test/support/oracle.ts#renderOracleHtml
enforcedBy: []
---

The `commonmark` package ships no type declarations, and DefinitelyTyped's `@types/commonmark` is pinned at 0.27, three minors behind the 0.31.2 runtime the oracle calls, so it describes a different API. The oracle uses two classes and two methods, declared in `test/support/commonmark.d.ts`.

Rejected: depending on `@types/commonmark@0.27`.
