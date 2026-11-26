---
title: makeSync validates the seed root and keys before building, duplicating the check seedWith makes
date: 2026-11-26
reversal: Drop the applyRoot pre-check in makeSync and let seedWith inside buildHandle reject the root or key.
governs:
  - src/MemoryFileSystem.ts#MemoryFileSystem
enforcedBy: []
---

A bad root or seed key makes `makeSync` throw node's EINVAL naming the offending value in the path slot, and so in the message, before anything is built.
`seedWith` inside `buildHandle` makes the same check, but its failure is a typed BadArgument, which carries no path, so `runNode` could only report `seed ''`. Validating first is the only way the thrown error names the key.
Rejected: one check in `seedWith`, which a deduplication would leave, losing the offending value from the thrown error.
