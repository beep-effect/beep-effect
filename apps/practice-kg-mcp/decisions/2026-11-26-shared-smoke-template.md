---
title: Copy one lazily built smoke template per test
date: 2026-11-26
reversal: Build the complete PGlite and DuckDB smoke bundle separately for each test.
governs:
  - test/Host.test.ts#makeSmokeTemplate
  - test/Host.test.ts#copySmokeBundle
enforcedBy: []
---

Build one smoke template lazily on first use, copy it with its corpus into each test directory, and remove the template after the file.
Reason: concurrent per-test PGlite and DuckDB builds multiply the dominant CPU cost and make each timeout measure its neighbors.
Rejected: rebuild the same template for every test; a file that never needs a bundle should build none.
