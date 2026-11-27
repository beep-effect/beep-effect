---
title: The reachability walker reads Vite-inlined source text and only top-of-line statements
date: 2026-11-26
reversal: Read src through the filesystem, strip comments before matching, and resolve any relative specifier.
governs:
  - test/support/sourceGraph.ts#sources
  - test/support/sourceGraph.ts#CLAUSE_EDGE
  - test/support/sourceGraph.ts#siblingOf
enforcedBy: []
---

The walker takes each `src` module from Vite's raw glob import, inlined at
transform time, so it touches no filesystem and runs the same under Node and Bun.
Only top-of-line `import`/`export` statements count, and an edge needs a clause
shape, which keeps JSDoc example imports, prose and a `from` inside a string out
of the graph. It is sized to this package: a relative edge is `./<Module>.ts` or
`./internal/<module>.ts`, and anything else fails loudly.

Rejected: a filesystem read, which the inlined text replaces so Node and Bun
walk identical input; a comment stripper, where a `/*` inside a line comment
once opened a phantom block and hid every later import; a general resolver,
which guesses where this package has exactly two shapes.
