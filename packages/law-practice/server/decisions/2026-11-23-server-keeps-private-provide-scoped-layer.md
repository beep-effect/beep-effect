---
title: Server source keeps its own module-private provideScopedLayer instead of importing the test-utils copy
date: 2026-11-23
reversal: Import provideScopedLayer from `@beep/test-utils` in server source, or export the server copy.
governs:
  - src/PracticeKg.rows.ts#provideScopedLayer
  - src/PracticeKg.rows.ts#withDuckDb
enforcedBy: []
---

`PracticeKg.rows.ts` holds the one production-side copy of the scoped-layer helper, module-private and consumed only by `withDuckDb`.

Reason: `@beep/test-utils` exports the canonical copy for tests, and server source cannot import tooling packages.

Rejected: importing the test-utils helper into server source, and exporting the server copy as a second public helper.
