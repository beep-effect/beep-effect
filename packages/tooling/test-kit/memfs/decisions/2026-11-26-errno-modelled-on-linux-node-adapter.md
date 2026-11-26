---
title: Every errno failure is built in internal/errno.ts from the code node raises, Linux's where hosts differ
date: 2026-11-26
reversal: Let each engine site pick its own PlatformError tag again, as upstream PR #6573 did, and model macOS codes alongside Linux's.
governs:
  - src/internal/errno.ts#errnoError
  - src/internal/errno.ts#errnoTag
  - src/internal/errno.ts#nodeErrno
  - src/internal/volume.ts#resolveParent
  - src/internal/volume.ts#getOpenFile
  - src/internal/volume.ts#validateCopyEntryKinds
  - src/internal/volume.ts#glob
enforcedBy: []
---

One module owns errno for the package: the engine, the sync and promises ports and NodeSyncFileSystem build failures through `errnoError` or `nodeErrno`, and `errnoTag` maps a code to its tag case for case with `handleErrnoException` in @effect/platform-node-shared. The code rides on `reason.cause.code`, as on the node adapter.
A site names the errno node raises for the same call and the tag follows: EISDIR for a directory opened with a write or create flag, ERR_FS_EISDIR from `fs.rm` on any directory without `recursive`, ERR_FS_CP_* from the kind and same-inode checks `fs.cp` makes before `force`, EINVAL from `ftruncate` on a descriptor not open for writing, ENOTDIR when renaming a non-directory onto a trailing slash, EEXIST from a non-recursive `mkdir("/")`, BadArgument for a NUL byte, and an empty match set from `fs.glob` on a missing or non-directory root.
Where Linux and macOS report different codes for one call, the Linux code is modelled.
Accepted limit: without `force`, node's `fs.cp` silently keeps an existing destination; the engine fails AlreadyExists.
Rejected: upstream's hand-picked tag per site, which disagreed with node (readLink EINVAL, non-recursive remove, ENOTEMPTY, EBADF); modelling macOS codes, or both platforms, in the engine.
