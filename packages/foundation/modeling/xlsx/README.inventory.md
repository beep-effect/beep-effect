# @beep/xlsx

An Excel workbook as an Effect Schema codec: `.xlsx` and `.xlsm` bytes read into one workbook model with what was
read past, written back by value, and the round trip as one `effect/Schema` codec.

```ts
import { Xlsx } from "@beep/xlsx/Xlsx"

const read = yield* Xlsx.parse(bytes) // the workbook and its warnings
const counts = yield* Xlsx.sheets(bytes) // every sheet counted, none kept
const rows = Xlsx.rows(bytes, "Items") // one sheet as a stream of rows
const back = yield* Xlsx.stringify(read.workbook) // .xlsx bytes
const codec = Xlsx.XlsxFromBytes // S.Codec<XlsxWorkbook, Uint8Array>
```

## What it holds

Cell values and their kinds, formula text with the result the file saved, each cell's number format, the date
system, sheet names with their order and state, merged ranges, hidden rows and columns. Everything else a file holds
(fonts, charts, comments, macros and so on) is named in `workbook.dropped` and not written back. No formula is
evaluated. `.xls`, `.xlsb`, `.ods` and encrypted workbooks are recognised (`Xlsx.container`) and refused.

The laws are about values and hold up to `XlsxWorkbook.canonical`, the form a file gives a workbook back in: a
workbook written and read back is its canonical form, and that form does not move under a second pass.

## What it trusts

Nothing a file declares. Caps (`XlsxLimits`) are counted as bytes are inflated, a declared extent is kept as a
claim, and a cell the file gets wrong is kept as `Unreadable` with what was written, and reported.

The archive is read with `effect/encoding/Zip` and the XML with `effect/encoding/Xml` (each behind one file in
`src/internal`). That zip reader goes through the entries in order and never reads the central directory. Two things
follow, and a caller should know both:

- A path met twice stops the read (`DuplicatePart`), because Excel would open the entry the directory names.
- An entry that is in the archive and missing from the directory is invisible to Excel and visible here. Only parts
  the workbook's own relationships name are read, so such an entry is ignored unless it takes a real part's path,
  which is the repeat above.

A file cut short inside its directory, after the last entry, still reads: every entry it holds was checked against
its checksum.

## Displayed text

`XlsxCell.shown` gives the text Excel would display for the General format, date and time formats, zero-padding
(`00000`) and one plain number pattern (fixed decimals, thousands separators, a percent sign, literal text around).
Any other format gives none, and the read reports it (`FormatNotShown`). The General rule and the date tokens follow
what SheetJS's formatter displayed, which this package's oracle test compares it with.

Notice: the number-format behaviour follows SheetJS (Apache License 2.0), which is also this package's test oracle.

## Tests

`test/oracle.property.test.ts` is the only file that imports SheetJS (`xlsx`, a devDependency, Apache-2.0): it reads
what this package writes and writes what this package reads. Fixtures are built from hand-written parts in
`test/support/workbooks.ts`; no binary file is committed here.
