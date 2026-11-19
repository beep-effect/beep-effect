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
  `fromBytes`, `recordsFromString` and `schema` as Schema codecs, and
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
  and record length, text length, input bytes) ends a read as a typed `CsvParseError` with
  the finding and its position, never as a defect or a stack overflow. The
  byte cap bounds byte input, streams included (a channel fails as soon as its
  running count passes it); text input is bounded by the text caps, and
  `maxTextLength` (`MAX_TEXT_UNITS` by default and at most) bounds the whole
  text of any read, a stream's included, so every reported position is valid. A lenient
  read keeps at most `maxWarnings` warnings (1,000 by default) and counts the
  rest in one closing `WarningsTruncated`, so a hostile file cannot fill
  memory with them. A read costs time linear in its input, however it is cut
  into chunks; a stream holds at most its detect window (64 KiB by default,
  256 MiB at most) and its delimiter-detection window before it reads on.
- Bytes are decoded by their byte-order mark, else as UTF-8 when valid, else
  as Windows-1252 (what Excel writes). The decision and the first invalid byte
  are recorded in `CsvRead.source`.
- In the header view a heading named `__proto__` is an ordinary key; empty and
  repeated headings fail the read. Writing rows refuses those that could not
  be read back: a first row with no keys or an empty key, and a later row with
  a key the first row lacks.
- Writing text is total: every table has one canonical spelling, and
  `formulaGuard: "apostrophe"` defuses cells a spreadsheet would run (a cell
  starting with `=`, `+`, `-`, `@`, tab or CR). The `fromBytes` codec
  refuses a table with a lone UTF-16 surrogate, which UTF-8 cannot carry.

## Laws

- Round trip: a table written and read back with the same fixed delimiter,
  with or without `excelSepHint` and the other read rules at their defaults
  (trimming, padding or skipping can change a table), is the same table, under
  any write options except `formulaGuard: "apostrophe"` (which changes the
  cells it defuses); a first cell starting `sep=` is written quoted so that a
  `sep=` reader keeps it. Canonical text read and written
  back is the same text. The default codecs read with the comma they write,
  so `decode(encode(table))` is the table.
- Chunk invariance: reading in pieces, or through a channel split anywhere
  (inside a BOM, a `sep=` line, a UTF-8 sequence or a CRLF), gives what
  reading at once gives, findings and their positions included. Two exceptions,
  both in a byte channel. A detected encoding settles once the bytes held pass
  `CsvDetectEncoding.window` by more than three, so a later byte that breaks
  UTF-8 fails the channel with `InvalidUtf8`, where the whole read falls back
  to Windows-1252; input that ends within the window, or at most three bytes
  past it, reads the same both ways.
  And a channel reports the first fatal finding in input order, where a whole
  read checks the byte cap and the encoding before it parses: bytes past a
  passed text cap that the encoding or the byte cap refuses fail the two
  differently. An upstream failure passes through a channel unchanged, with
  nothing flushed before it.
- Strict mode agrees with Effect's `effect/encoding/Csv`: on RFC 4180 text both
  read the same records, on misplaced quotes both refuse, and each reads the
  other's output back unchanged. Effect's module covers strict streaming of one
  dialect only; lenient reads, positions, warnings, delimiter and encoding
  detection, the synchronous API and BOM, quote-everything and formula-guard
  writing are this package's.
- One parser: `internal/machine.ts` is a push machine, and one machine lives
  across the chunks of a read. `internal/start.ts` reads a start (BOM, `sep=`
  line, delimiter) for whole reads and streams alike, and `internal/stream.ts`
  holds the channels' state chunk by chunk. The engine in `internal/` never
  imports the facade; only `Csv.codec.ts` decides that a fatal finding fails.

## Tests

```bash
bun run beep:check
bun run beep:test
```

`test/Csv.property.test.ts` holds the round-trip and chunk-invariance laws
(every channel fed one piece per batch, under fixed, detected, `sep=` and
tight-cap reads), `test/oracle.property.test.ts` the agreement with
`effect/encoding/Csv`, `test/CsvSchemas.property.test.ts` that every exported
schema (and the machine's state) generates only values it accepts,
`test/brands.test.ts` that Opaque-typed fields keep their nominal types,
`test/encoding.test.ts` byte decoding, the byte cap and failing upstreams, `test/header.test.ts`
the header view, `test/lenient.test.ts` the findings a lenient read reports and
a strict read refuses, `test/write.test.ts` the formula guard, write options and
writing channels, and `test/hostile.test.ts` the caps and linear cost (by structure and
machine counts, not wall-clock bounds).
Generators come from the schemas through `effect/Arbitrary`. Tests import
package source through `@beep/csv/...` aliases.

## License

MIT
