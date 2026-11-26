---
title: The vendored FileSystem contract suite leaves upstream's open contract questions unanswered
date: 2026-11-26
reversal: Answer an open question in the port by pinning one outcome in its case, or add the missing case, and drop it from this list.
governs:
  - test/FileSystemContract.ts#fileSystemCases
enforcedBy: []
---

The suite body is upstream PR #6555's (pinned 2492ba9d), and upstream left these contract questions open, so the port asserts only what both outcomes share or omits the case:
copy with `overwrite: false` onto an existing destination may succeed unchanged or fail AlreadyExists; stream and sink finalization after interruption waits for a deterministic synchronization point; the adapter working directory is undefined, as is whether the memory adapter defaults to a virtual `/`, so no relative-path case exists; a utimes failure may report `utimes` or the host's `utime` (node reports `utime`), so its method is not asserted; `access` ok, readable and writable have no meaning without user identity or permission state; positive chmod and chown conformance belongs in a POSIX-only metadata suite; preserveTimestamps may guarantee mtime only (node preserves mtime but resets atime); watch event ordering, normalized paths and watcher cleanup wait for deterministic registration and subscription-control hooks, so no watch-event case exists.
Rejected: answering the questions in the port, which drifts from the pinned upstream without an adaptation-ledger entry; empty placeholder cases, which register tests that assert nothing.
