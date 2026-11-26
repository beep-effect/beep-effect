---
title: The read and write hot paths are loops over local mutable state, not Effect folds or schema-typed tokens
date: 2026-11-26
reversal: Rewrite the governed loops as A.reduce folds, Match pipelines or reducers over immutable state, make the date tokens a LiteralKit tagged union, and accept the per-cell and per-event allocation.
governs:
  - src/internal/budget.ts#ReadBudget
  - src/internal/sheet.ts#SheetReader
  - src/internal/sheet.ts#columnsOf
  - src/internal/sheet.ts#columnOfIgnoringRow
  - src/internal/ooxml.ts#localName
  - src/internal/ooxml.ts#resolve
  - src/internal/ooxml.ts#unescaped
  - src/internal/numberFormat.ts#NextPieceStart
  - src/internal/numberFormat.ts#DateField
  - src/internal/container.ts#partKey
  - src/internal/container.ts#directoryMismatch
  - src/internal/container.ts#census
  - src/internal/workbookPart.ts#customCodes
  - src/internal/workbookPart.ts#stringsOf
  - src/internal/workbookPart.ts#linksById
  - src/internal/workbookPart.ts#sheetsOf
  - src/internal/writer.ts#escaped
  - src/internal/writer.ts#sheetXml
  - src/internal/writer.ts#partsOf
  - src/Xlsx.codec.ts#readSheets
  - src/XlsxWorkbook.schema.ts#boundsOf
  - src/XlsxWorkbook.schema.ts#XlsxWorksheet
  - src/XlsxWorkbook.schema.ts#XlsxWorkbook
enforcedBy: []
---

Code that runs per cell, per XML event, per character of a format code or per archive byte is a `for`/`while` loop over locals or one mutable object: the sheet reader and the read budget, the format-code cursor scanners (each step returns where the next piece starts; `-1` sentinels in place of an `Option`), the shared text table's state machine, the zip directory walk, the writer's piece lists and first-met style index, and the text escapes, which judge a surrogate by its neighbours. Loops that stop early (a finding per listed sheet, a cap checked chunk by chunk) stay loops for the same reason. `boundsOf` and the sheet reader keep the same bounds separately, since the reader never holds the rows. Date tokens stay plain types because nothing outside `numberFormat.ts` sees one.

Rejected: `A.reduce` folds, `Match` per event, an immutable reducer per event and schema-typed tokens, which allocate once per cell or event on reads of millions of cells and the oracle test's 100k+ rendered dates. `XlsxAddress.parse` stays the pattern-based reading for anything off the hot path.
