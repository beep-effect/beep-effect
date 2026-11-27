---
title: Salvage and archive-move keep source filenames opaque with path.resolve, not realpath
date: 2026-11-26
reversal: Canonicalize each walked source file with fs.realPath before recording it.
governs:
  - src/commands/Corpus/internal/ServicePrograms.ts#collectSalvageSourceFiles
  - src/commands/Corpus/internal/ServicePrograms.ts#collectArchiveSourceFiles
enforcedBy: []
---

Source files from an external drive are recorded under `path.resolve` of their walked path. Bun's
realpath rejects valid POSIX names, such as names containing literal backslashes, so canonicalizing
them would fail the walk on files the corpus must keep.

Rejected: `fs.realPath` on every source file (fails on those names under Bun).
