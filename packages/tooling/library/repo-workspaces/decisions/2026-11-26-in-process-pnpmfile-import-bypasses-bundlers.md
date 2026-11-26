---
title: The in-process pnpmfile import carries a webpackIgnore hint so bundlers leave it alone
date: 2026-11-26
reversal: Drop the `webpackIgnore` hint from the computed `import()` in replayInProcess and let bundlers compile it into a context module.
governs:
  - src/ConfigDependencyHooks.ts#replayInProcess
enforcedBy: []
---

`replayInProcess` imports a pnpmfile from a path known only at runtime, under the consumer's own `node_modules` or the pnpm store, so no bundler can resolve it at build time.
The `webpackIgnore` hint stops webpack-family bundlers from compiling that computed import into a context module.
Without it every bundled consumer carries a Critical-dependency warning it cannot silence, a consumer of `layerSubprocess` included, because this module stays in its import graph either way.
Rejected: a plain computed `import()`, which gives every bundled consumer that warning and a context module that throws at runtime.
Rejected: moving the in-process replay into its own entry point, which changes the public import surface to hide a build warning.
