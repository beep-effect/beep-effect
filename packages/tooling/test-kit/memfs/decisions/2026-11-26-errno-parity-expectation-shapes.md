---
title: Errno parity asserts tag, method and errno code on both implementations, with platform and divergence shapes
date: 2026-11-26
reversal: Collapse every expectation to one outcome and assert pathOrDescriptor, or drop the cases where memfs and node disagree.
governs:
  - test/ErrnoParityContract.ts#Expectation
  - test/ErrnoParityContract.ts#resolveExpectation
  - test/ErrnoParityContract.ts#assertOutcome
  - test/ErrnoParityContract.ts#cases
enforcedBy: []
---

ErrnoParityContract is the kit's own extension of the differential oracle; the vendored FileSystemContract stays upstream's and unedited. Each case pins a failure the audit found memfs and the node adapter disagreeing on: the reason `_tag`, the `method` and the errno `code` on `reason.cause`. It runs unchanged against MemoryFileSystem.layer and @effect/platform-node's real filesystem.
An expectation is one outcome (both sides agree on every platform), `{ linux, darwin }` (the platform disagrees with itself: memfs models the Linux errno, the node run asserts the platform it is on) or `{ memory, node }` (a known divergence memfs keeps: both sides are still asserted, so a change on either side fails and forces this decision to be revisited).
`pathOrDescriptor` is not asserted: the adapter reports the first path argument of a two-path operation (rename, copy, copyFile, link, symlink), memfs the one the conflict concerns.
Accepted limit: without `overwrite`, `fs.cp` silently keeps an existing destination (merging into an existing directory) and creates missing destination parents, where memfs fails EEXIST and ENOENT. Same-entry and kind mismatches fail before `overwrite` is consulted, on both sides.
Rejected: skipping the cases where the sides disagree, which hides drift on either side; asserting `pathOrDescriptor`, which fails every two-path conflict on node; modeling darwin errnos in memfs.
