---
title: A copy onto an existing destination without overwrite reports the destination, not upstream's source
date: 2026-11-26
reversal: Restore upstream's source-blaming pathOrDescriptor assertion and make the engine's copy conflict arm blame the source again.
governs:
  - test/FileSystemContract.ts#fileSystemCases
enforcedBy: []
---

Upstream's contract asserted `pathOrDescriptor: source` for the AlreadyExists failure of a copy with `overwrite: false`, matching a bug in upstream PR #6573's engine, whose one conflict arm blamed the source. The port fixes the engine to report the destination, the entry that actually conflicts, and the conditional assertion names it.
The node adapter never reaches that branch: node's `fs.cp` with `force: false` silently keeps the destination instead of failing.
Rejected: keeping upstream's source assertion, which pins the engine bug into the contract.
