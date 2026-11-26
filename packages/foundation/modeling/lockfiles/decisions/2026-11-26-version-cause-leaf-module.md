---
title: The version-gate cause lives in a leaf module both the internals and Lockfile.ts import
date: 2026-11-26
reversal: Move the UnsupportedLockfileVersion schema into Lockfile.ts beside LockfileParseError, or give internal/shared.ts its own copy of the record shape.
governs:
  - src/UnsupportedLockfileVersion.ts#UnsupportedLockfileVersion
  - src/internal/shared.ts#requireLockfileVersion
enforcedBy: []
---

`UnsupportedLockfileVersion.ts` holds only the cause record and its predicate. `internal/shared.ts` builds the record and must not import `Lockfile.ts` (noImportCycles), so the shape sits in a module both sides can reach.

`requireLockfileVersion` types the record it builds as the exported `UnsupportedLockfileVersion`, so the value a consumer narrows with `isUnsupportedLockfileVersion` and the value the gate builds cannot drift apart.

Rejected: declaring the schema in `Lockfile.ts` (an import cycle through the internals), and a structurally equal private type in `internal/shared.ts` (it drifts silently from the public one).
