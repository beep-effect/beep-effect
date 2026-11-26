---
title: The Bun leg of the differential oracle runs the behavioral contract only, never errno parity
date: 2026-11-26
reversal: Register errnoCases in the Bun leg, with Bun-specific expectations for the edge cases its node:fs maps differently.
governs:
  - test/ErrnoParityContract.ts#errnoCases
enforcedBy: []
---

The Bun leg runs the vendored FileSystemContract against the real filesystem through @effect/platform-bun. The Bun adapter shares the node adapter's implementation but runs it on Bun's own `node:fs`.
The errno parity contract pins the node adapter's failure shapes on Node's `node:fs`, which memfs mirrors. Bun's `node:fs` maps several edge cases to other errnos (copyFile from a directory, remove with a trailing slash, recursive makeDirectory through dangling or looping symlinks), so Bun is not that oracle.
Rejected: running errno parity on Bun, which either fails on those cases or forces a third expectation shape that memfs does not model.
