---
title: opentype.js is imported through a specifier built at runtime
date: 2026-11-26
reversal: Import opentype.js with a literal specifier and add the DOM library to the package's type program.
governs:
  - src/internal/LabelOutline.ts#OPENTYPE_MODULE
  - src/internal/LabelOutline.ts#parseFont
enforcedBy: []
---

The label-font parser loads opentype.js with a dynamic import whose specifier is concatenated at runtime, then narrows the module to the parse function it reads.
Reason: opentype.js's published typings reference the DOM library, and a non-literal specifier keeps the import out of the type program and out of bundler graphs.
Rejected: a static or literal dynamic import, which pulls the DOM typings into the type check and opentype.js into every bundle that reaches this module.
