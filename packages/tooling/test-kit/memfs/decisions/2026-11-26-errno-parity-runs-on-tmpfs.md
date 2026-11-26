---
title: The node errno parity run pins TMPDIR to tmpfs
date: 2026-11-26
reversal: Drop the TMPDIR override from vitest.config.ts and let the run inherit the host temp directory.
governs:
  - vitest.config.ts#tmpfsTempDirectory
  - test/ErrnoParityContract.ts#cases
enforcedBy: []
---

The errno parity fixtures live under the host temp directory, and the asserted Linux errnos are tmpfs's: btrfs lets copyFile read an empty directory, where the asserted EISDIR comes from tmpfs.
Rejected: inheriting the host TMPDIR, which on a btrfs temp directory fails the copyFile-from-a-directory case with no hint why.
