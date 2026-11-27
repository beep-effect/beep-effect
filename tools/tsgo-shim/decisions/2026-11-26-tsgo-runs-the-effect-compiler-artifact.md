---
title: The tsgo shim runs the Effect compiler artifact found through the bundled CLI
date: 2026-11-26
reversal: Resolve tsgo through the patched @typescript/native binary, or through the exported @effect/tsgo path helper, in tsgo.js.
governs:
  - tsgo.js#effectTsgoCli
  - tsgo.js#executable
enforcedBy: []
---

The shim executes the compiler artifact the installed @effect/tsgo package ships, and finds its path by running the package's bundled CLI with get-exe-path.
Rejected: routing through the mutable @typescript/native patch, where a preserved `.original` backup can make a newer patcher mistake an older Effect compiler for the current one; and the package's exported path helper, which accepts only platform metadata schema v4 while the 0.39 platform packages ship v5.
