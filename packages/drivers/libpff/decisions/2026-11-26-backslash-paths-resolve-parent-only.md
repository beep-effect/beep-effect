---
title: An exported path containing a backslash resolves only its parent through realPath
date: 2026-11-26
reversal: Call fs.realPath on every absolutePath in resolveExportEntry in src/Libpff.pffexport.ts, once Bun's realpath keeps literal backslashes.
governs:
  - src/Libpff.pffexport.ts#makePffexportFileProcessingEngine
enforcedBy: []
---

Bun's realpath interprets literal backslashes in a path, and pffexport writes file and directory names that contain them.
For such a path the driver resolves each parent directory recursively and joins the basename verbatim, so every component keeps its backslashes until the escape pass rewrites them to `%5C`.
Rejected: resolving the full path with realPath, which on Bun rewrites the backslashed components and resolves a different file.
