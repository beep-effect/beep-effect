---
title: Values leave the engine through make with disableChecks, and tests hold every read workbook to S.is
date: 2026-11-26
reversal: Drop disableChecks from the governed make calls and let every constructor run its filters, accepting the extra walks per read.
governs:
  - src/Xlsx.codec.ts#checked
  - src/internal/sheet.ts#checked
  - src/internal/workbookPart.ts#open
enforcedBy: []
---

The engine hands on constructor inputs built from parts it has checked one by one (a finite number, text within its cap, an error code from the list, a shared text entry held to the caps as it was read), and each leaves the engine through one `make` that keeps the shape checked and skips the filters.

Rejected: a filtered `make` per cell and per aggregate, which walked every cell four times over: a read of 200,000 cells went from about 200 ms to 800 ms, and the shared text table can hold millions of entries.

Accepted limit: the filters run only in tests, where every workbook read from a fixture, a generated file or a hostile one is held to `S.is(XlsxWorkbook)`.
