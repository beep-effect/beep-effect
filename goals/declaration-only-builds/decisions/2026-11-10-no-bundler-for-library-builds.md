---
title: "No bundler for library builds; the Effect-patched tsrs stays the emitter"
date: 2026-11-10
reversal: "Reopen the exploration at decompose when Bun ships declaration emit and per-module output, or the repo adopts isolatedDeclarations."
---

Library packages keep compiler emit. `bun build` emits no `.d.ts` and has no per-module output, and the declaration is the only artifact anything reads from `dist`. No bundler measured faster than plain emit on `@beep/schema`; tsdown was about 2x slower and skipped type-checking. `bun build --compile` stays in the binary lanes that already use it. Operator ruling.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q1).
