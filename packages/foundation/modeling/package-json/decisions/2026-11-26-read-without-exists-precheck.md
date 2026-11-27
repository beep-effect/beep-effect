---
title: PackageJsonFile reads the file directly and classifies NotFound from the read failure
date: 2026-11-26
reversal: Call fs.exists before reading and fail with PackageJsonNotFoundError when it answers false.
governs:
  - src/PackageJsonFile.ts#PackageJsonFile
enforcedBy: []
---

`read`, `readManifest` and `modify` read the file's text with no `exists` pre-check. A `PlatformError` whose `reason._tag` is `"NotFound"` becomes `PackageJsonNotFoundError`; every other failure is `PackageJsonReadError`.
Reason: an `exists` check followed by a read is a TOCTOU race, and a file deleted between the two calls would surface as `PackageJsonReadError` instead of NotFound.
Rejected: the `exists` pre-check.
