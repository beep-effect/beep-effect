---
title: The test fixture filesystem is a real memfs volume, not a stub of the operations the package calls
date: 2026-11-26
reversal: Replace the MemoryFileSystem volume in test/support/fixtures.ts with a hand-written FileSystem stub implementing exists, readFileString, readDirectory and stat over the Tree record.
governs:
  - test/support/fixtures.ts#fileSystem
enforcedBy: []
---

The fixture `FileSystem` is an `@effected/memfs` volume, a real virtual POSIX filesystem, so the package tests without `@effect/platform-node`, and its directories come from the volume rather than from file keys.
Rejected: a stub implementing the four operations the package happens to call; a stub only implements the semantics its author remembered, so a bug that depends on anything else cannot surface in a test.
