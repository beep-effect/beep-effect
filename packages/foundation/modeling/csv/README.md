# @beep/csv

CSV as an Effect Schema codec. Text or bytes in any common dialect read into one
table model, `CsvTable` (records of cells, each cell exactly as written), and
written back canonically. Reads are lenient by default and strict on request.
The same model comes out of the synchronous readers, the `effect/Schema` codecs
and the streaming channels.

## What it holds

- `Csv` (`Csv.codec.ts`): the facade. `parseResult` / `parse` for text,
  `parseBytesResult` / `parseBytes` for bytes, `parseBytesInPiecesResult` for
  progress, `stringify` / `stringifyBytes` for writing, `fromString`,
  `fromBytes`, `recordsFromString`, `schema` and `bind` as Schema codecs, and
  `decodeString`, `decode`, `decodeSchema`, `encodeString` and `encode` as
  channels.
- `CsvTable`, `CsvRecord`, `CsvCell`, `CsvRecordSlice`, `CsvHeaderRow`
  (`CsvTable.schema.ts`): the decoded side.
- `CsvRead` (`CsvRead.schema.ts`): what a read returns. How the delimiter was
  found, whether the input was text or bytes and how its encoding was found,
  and the warnings read past are all tagged unions.
- `CsvDiagnostic` (`CsvDiagnostic.schema.ts`): findings with their positions, as
  a warning or a fatal. A finding that can only stop a read exists only in the
  fatal union.
- `CsvReadOptions`, `CsvWriteOptions`, `CsvCodecOptions`, `CsvLimits`
  (`CsvOptions.schema.ts`): every option with its default on the schema, so
  `CsvReadOptions.make({})` is the default read.
- `CsvParseError` (`CsvError.errors.ts`): the one typed failure.

```ts
import { Csv } from "@beep/csv";
import * as Result from "effect/Result";

const read = Result.getOrThrow(Csv.parseResult('SKU;Name;Qty\nBRK-040;Bracket "40" mm;12\nBLT-0042;Bolt;3\n'));
read.delimiter.delimiter; // ";" (detected)
read.outcome.outcome; // "noted": the two stray quotes were read past as warnings
Csv.stringify(read.table); // canonical: commas, CRLF, minimal quoting
```

## What it trusts and what it does not

- Input is untrusted. Every cap (`CsvLimits`: records, cells per record, cell
  and record length, input bytes) ends a read as a typed `CsvParseError` with
  the finding and its position, never as a defect or a stack overflow.
- Bytes are decoded by their byte-order mark, else as UTF-8 when valid, else
  as Windows-1252 (what Excel writes). The decision and the first invalid byte
  are recorded in `CsvRead.source`.
- In the header view a heading named `__proto__` is an ordinary key; empty and
  repeated headings fail the read.
- Writing is total: every table has one canonical spelling, and
  `formulaGuard: "apostrophe"` defuses cells a spreadsheet would run.

## Laws

- Round trip: a table written and read back with the same delimiter is the
  same table, and canonical text read and written back is the same text.
- Chunk invariance: reading in pieces, or through a channel split anywhere
  (inside UTF-8 sequences included), gives what reading at once gives.
- Strict mode agrees with Effect's `effect/encoding/Csv`: on RFC 4180 text both
  read the same records, on misplaced quotes both refuse, and each reads the
  other's output back unchanged. Effect's module covers strict streaming of one
  dialect only; lenient reads, positions, warnings, delimiter and encoding
  detection, the synchronous API and BOM, quote-everything and formula-guard
  writing are this package's.
- One parser: `internal/machine.ts` is a push machine whose state between
  chunks is a schema value (`MachineState`). The engine in `internal/` never
  imports the facade; only `Csv.codec.ts` decides that a fatal finding fails.

## Tests

```bash
bun run beep:check
bun run beep:test
```

`test/Csv.property.test.ts` holds the round-trip and chunk-invariance laws,
`test/oracle.property.test.ts` the agreement with `effect/encoding/Csv`,
`test/CsvSchemas.property.test.ts` that every exported schema (and the
machine's state) generates only values it accepts, and `test/hostile.test.ts`
the caps. Generators come from the schemas through `effect/Arbitrary`. Tests
import package source through `@beep/csv/...` aliases.

## License

MIT
