/**
 * The `Csv` facade: reading text or bytes into one table model, leniently by default and strictly on request,
 * writing it back canonically, the whole round trip as one `effect/Schema` codec, and the same through streaming
 * channels.
 *
 * **Details**
 *
 * Cycle firewall: the engine in `internal/` returns records and findings as schema values and never imports this
 * module; only this module decides that a fatal finding fails, and builds the `CsvParseError`.
 *
 * Effect's `effect/encoding/Csv` covers strict RFC 4180 streaming of one dialect; it has no lenient read, no
 * positions or warnings, no delimiter or encoding detection, no synchronous API and no quote-everything, BOM or
 * formula-guard writing, so the engine here owns the parse and the oracle tests hold strict mode to Effect's.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeTextDecodeTo } from "@beep/utils/Schema";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Channel from "effect/Channel";
import * as Effect from "effect/Effect";
import { constVoid, flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { CsvDiagnostic, CsvFatal, InvalidUtf8, TooManyBytes } from "./CsvDiagnostic.schema.ts";
import { CsvParseError } from "./CsvError.errors.ts";
import {
  CsvCodecOptions,
  CsvDelimiterChoice,
  CsvEncodingChoice,
  CsvReadOptions,
  CsvWriteOptions,
} from "./CsvOptions.schema.ts";
import { recordEndText } from "./CsvPosition.schema.ts";
import { CsvClean, CsvEncodingGiven, CsvFromBytes, CsvFromText, CsvNoted, CsvRead } from "./CsvRead.schema.ts";
import { CsvHeaderRow, CsvTable } from "./CsvTable.schema.ts";
import { bomOf, decodeBytes, detectEncoding, encodeUtf8, firstInvalidUtf8 } from "./internal/encoding.ts";
import { checkHeader, rowsOf, toHeaderRows } from "./internal/header.ts";
import { built, Machine } from "./internal/machine.ts";
import { SNIFF_WINDOW, sniffDelimiter } from "./internal/sniff.ts";
import { prepare, startOf } from "./internal/start.ts";
import { bytesSteps, fatalsOf, mapAccumToEnd, textSteps } from "./internal/stream.ts";
import { writeTable } from "./internal/writer.ts";
import type { TextDecodeTo } from "@beep/utils/Schema";
import type { CsvDelimiter, CsvEncodingName } from "./CsvOptions.schema.ts";
import type { CsvEncodingFound } from "./CsvRead.schema.ts";
import type { CsvRecord, CsvRecordSlice } from "./CsvTable.schema.ts";
import type { MachineConfig } from "./internal/machine.ts";
import type { Prepared } from "./internal/start.ts";

type ReadOptions = CsvCodecOptions["read"];
type WriteOptions = CsvCodecOptions["write"];

type OnPiece = (recordsDone: number, charsRead: number, charsTotal: number) => void;

interface Ran {
  readonly diagnostics: ReadonlyArray<CsvDiagnostic>;
  readonly records: ReadonlyArray<CsvRecord>;
}

// decision: imperative-engine-loops
const run = (text: string, config: MachineConfig, pieceChars: number, onPiece: OnPiece): Ran => {
  const records: Array<CsvRecord> = [];
  const diagnostics: Array<CsvDiagnostic> = [];
  const collect = (machine: Machine): void => {
    A.forEach(machine.takeCells(), (record) => records.push(record));
    A.forEach(machine.takeDiagnostics(), (diagnostic) => diagnostics.push(diagnostic));
  };
  const machine = Machine.start(config);
  let at = 0;
  while (at < text.length && !machine.stopped) {
    const next = Num.min(text.length, at + pieceChars);
    collect(machine.feed(Str.slice(at, next)(text)));
    at = next;
    if (at < text.length) onPiece(records.length, at, text.length);
  }
  if (!machine.stopped) collect(machine.finish());
  onPiece(records.length, text.length, text.length);
  return { records, diagnostics };
};

const warningsOf = A.filter(CsvDiagnostic.guards.warning);

const parseError = (diagnostics: A.NonEmptyReadonlyArray<CsvFatal>): CsvParseError =>
  CsvParseError.make({ diagnostics });

const finish = (
  prepared: Prepared,
  ran: Ran,
  source: (bom: boolean) => CsvRead["source"]
): Result.Result<CsvRead, CsvParseError> =>
  A.match(fatalsOf(ran.diagnostics), {
    onNonEmpty: (fatals): Result.Result<CsvRead, CsvParseError> => Result.fail(parseError(fatals)),
    onEmpty: () =>
      Result.succeed(
        CsvRead.make(
          {
            table: CsvTable.make({ records: ran.records }, built),
            delimiter: prepared.delimiter,
            source: source(prepared.bom),
            outcome: A.match(warningsOf(ran.diagnostics), {
              onEmpty: (): CsvRead["outcome"] => CsvClean.make({}),
              onNonEmpty: (warnings) => CsvNoted.make({ warnings }, built),
            }),
          },
          built
        )
      ),
  });

interface Decoded {
  readonly encoding: CsvEncodingFound;
  readonly text: string;
}

const fatal = (finding: InvalidUtf8 | TooManyBytes): CsvParseError => parseError([CsvFatal.make({ finding })]);

const byteSizeOf = (bytes: Uint8Array): ByteSize.ByteSize => ByteSize.bytes(BigInt(bytes.length));

const decodeFixed = (bytes: Uint8Array, encoding: CsvEncodingName): Result.Result<Decoded, CsvParseError> =>
  O.match(encoding === "utf-8" ? firstInvalidUtf8(bytes) : O.none(), {
    onSome: (byteOffset): Result.Result<Decoded, CsvParseError> => Result.fail(fatal(InvalidUtf8.make({ byteOffset }))),
    onNone: () =>
      Result.succeed({
        text: decodeBytes({ bytes, encoding }),
        encoding: CsvEncodingGiven.make({ encoding, bom: O.isSome(bomOf(bytes)) }),
      }),
  });

const decodeDetected = (bytes: Uint8Array): Decoded => {
  const encoding = detectEncoding({ bytes });
  return { text: decodeBytes({ bytes, encoding: encoding.encoding }), encoding };
};

const tooManyBytes = (actual: ByteSize.ByteSize, options: ReadOptions): CsvParseError =>
  fatal(TooManyBytes.make({ maximum: options.limits.maxInputBytes, actual }));

const decodeInput = (bytes: Uint8Array, options: ReadOptions): Result.Result<Decoded, CsvParseError> => {
  const size = byteSizeOf(bytes);
  return ByteSize.isGreaterThan(size, options.limits.maxInputBytes)
    ? Result.fail(tooManyBytes(size, options))
    : CsvEncodingChoice.match(options.encoding, {
        fixed: ({ encoding }) => decodeFixed(bytes, encoding),
        detect: () => Result.succeed(decodeDetected(bytes)),
      });
};

const readText = (
  text: string,
  options: ReadOptions,
  pieceChars: number,
  onPiece: OnPiece
): Result.Result<CsvRead, CsvParseError> => {
  const prepared = prepare(startOf(text, options), options);
  return finish(prepared, run(prepared.text, prepared.config, pieceChars, onPiece), (bom) => CsvFromText.make({ bom }));
};

const readBytes = (
  bytes: Uint8Array,
  options: ReadOptions,
  pieceChars: number,
  onPiece: OnPiece
): Result.Result<CsvRead, CsvParseError> =>
  Result.flatMap(decodeInput(bytes, options), (decoded) => {
    const prepared = prepare(startOf(decoded.text, options), options);
    return finish(prepared, run(prepared.text, prepared.config, pieceChars, onPiece), () =>
      CsvFromBytes.make({ encoding: decoded.encoding, bytes: byteSizeOf(bytes) })
    );
  });

const WHOLE = Number.MAX_SAFE_INTEGER;

const issue = (error: CsvParseError, input: unknown): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue({ message: error.message }, input);

const tableOf = (read: Result.Result<CsvRead, CsvParseError>, input: unknown) =>
  Effect.mapBoth(Effect.fromResult(read), {
    onSuccess: (done) => done.table,
    onFailure: (error) => issue(error, input),
  });

const writeRecords = (records: ReadonlyArray<CsvRecord>, options: WriteOptions, opensText = true): string =>
  writeTable({ table: { records }, options, opensText });

const rowCells = (header: CsvRecord, row: CsvHeaderRow): CsvRecord =>
  A.map(header, (name) => O.getOrElse(R.get(row, name), () => ""));

const headerOf = (rows: A.NonEmptyReadonlyArray<CsvHeaderRow>): Result.Result<CsvRecord, string> =>
  Result.flatMap(
    A.match(R.keys(A.headNonEmpty(rows)), {
      onEmpty: (): Result.Result<CsvRecord, string> =>
        Result.fail("the first row has no keys, so there is no header to write"),
      onNonEmpty: (header) =>
        A.contains(header, "")
          ? Result.fail("the first row has an empty key, which no header can name")
          : Result.succeed(header),
    }),
    (header) => {
      const known = HashSet.fromIterable(header);
      return O.match(
        A.findFirst(A.tailNonEmpty(rows), (row) => A.some(R.keys(row), (key) => !HashSet.has(known, key))),
        {
          onNone: () => Result.succeed(header),
          onSome: (row) =>
            Result.fail(
              `a row has the keys ${A.join(
                A.map(
                  A.filter(R.keys(row), (key) => !HashSet.has(known, key)),
                  (key) => `"${key}"`
                ),
                ", "
              )}, which the first row does not, so they cannot be written`
            ),
        }
      );
    }
  );

const headerRecords = (rows: ReadonlyArray<CsvHeaderRow>): Result.Result<ReadonlyArray<CsvRecord>, string> =>
  A.match(rows, {
    onEmpty: () => Result.succeed(A.empty()),
    onNonEmpty: (nonEmpty) =>
      Result.map(headerOf(nonEmpty), (header) => [header, ...A.map(nonEmpty, (row) => rowCells(header, row))]),
  });

const decodeStringChannel = <IE, Done>(
  options: ReadOptions
): Channel.Channel<
  A.NonEmptyReadonlyArray<CsvRecordSlice>,
  IE | CsvParseError,
  Done,
  A.NonEmptyReadonlyArray<string>,
  IE,
  Done
> =>
  Channel.identity<A.NonEmptyReadonlyArray<string>, IE, Done>().pipe(
    mapAccumToEnd(textSteps(options)),
    Channel.mapEffect(flow(Result.mapError(parseError), Effect.fromResult))
  );

const bytesToText = <IE, Done>(
  options: ReadOptions
): Channel.Channel<
  A.NonEmptyReadonlyArray<string>,
  IE | CsvParseError,
  Done,
  A.NonEmptyReadonlyArray<Uint8Array>,
  IE,
  Done
> =>
  Channel.identity<A.NonEmptyReadonlyArray<Uint8Array>, IE, Done>().pipe(
    mapAccumToEnd(bytesSteps(options)),
    Channel.mapEffect(flow(Result.mapBoth({ onSuccess: A.of, onFailure: parseError }), Effect.fromResult))
  );

const ending = (noRecordWritten: boolean, options: WriteOptions): ReadonlyArray<string> => {
  if (noRecordWritten) return options.bom ? ["\uFEFF"] : [];
  return options.finalTerminator ? [recordEndText(options.terminator)] : [];
};

const encodeStringChannel = <IE, Done>(
  options: WriteOptions
): Channel.Channel<A.NonEmptyReadonlyArray<string>, IE, Done, A.NonEmptyReadonlyArray<CsvRecord>, IE, Done> =>
  Channel.identity<A.NonEmptyReadonlyArray<CsvRecord>, IE, Done>().pipe(
    mapAccumToEnd({
      initial: () => true,
      step: (first, records) => {
        const body = writeRecords(
          records,
          CsvWriteOptions.make({ ...options, bom: first && options.bom, finalTerminator: false }),
          first
        );
        const separator = first ? "" : recordEndText(options.terminator);
        return [false, [`${separator}${body}`]];
      },
      halt: (first) => ending(first, options),
    }),
    Channel.map(A.of)
  );

type RowsEmitted = Result.Result<ReadonlyArray<CsvHeaderRow>, CsvParseError>;

const cellsOf = (slice: CsvRecordSlice): CsvRecord => slice.cells;

const stepRows = (
  headerCheckedOnFirstBatch: O.Option<CsvRecord>,
  slices: A.NonEmptyReadonlyArray<CsvRecordSlice>
): readonly [O.Option<CsvRecord>, ReadonlyArray<RowsEmitted>] =>
  O.match(headerCheckedOnFirstBatch, {
    onSome: (header): readonly [O.Option<CsvRecord>, ReadonlyArray<RowsEmitted>] => [
      headerCheckedOnFirstBatch,
      [Result.succeed(rowsOf(header, A.map(slices, cellsOf)))],
    ],
    onNone: () => {
      const header = A.headNonEmpty(slices).cells;
      const body = A.map(A.drop(slices, 1), cellsOf);
      return Result.match(checkHeader(header), {
        onFailure: (fatals): readonly [O.Option<CsvRecord>, ReadonlyArray<RowsEmitted>] => [
          O.some(header),
          [Result.fail(parseError(fatals))],
        ],
        onSuccess: (checked) => [
          O.some(checked),
          A.isReadonlyArrayNonEmpty(body) ? [Result.succeed(rowsOf(checked, body))] : [],
        ],
      });
    },
  });

/**
 * Static entry points for reading and writing CSV. Not instantiable.
 *
 * **Details**
 *
 * Every read returns the same `CsvTable` model. The `*Result` readers are synchronous; their `Effect` twins carry a
 * span. `fromString`, `fromBytes` and `recordsFromString` are `effect/Schema` codecs, so they compose with
 * `S.decodeTo`; `decodeString`, `decode`, `decodeSchema`, `encodeString` and `encode` are streaming channels.
 *
 * A read fails with `CsvParseError` on any fatal finding, and only then: a passed text cap (`LimitExceeded`), more
 * bytes than `maxInputBytes` (`TooManyBytes`, byte input only), a quote never closed (`UnterminatedQuote`), a
 * misplaced quote under `quotes: "strict"` (`StrayQuote`, `TextAfterClosingQuote`), a ragged record under
 * `ragged: "reject"` (`RaggedRecord`), bytes that are not UTF-8 where UTF-8 was fixed or, in a stream, chosen
 * (`InvalidUtf8`), and in the header view an empty or repeated heading (`EmptyHeader`, `DuplicateHeader`). Anything
 * else a lenient read goes past is a warning.
 *
 * **Example** (Read a messy file leniently)
 *
 * ```ts import.meta.vitest name="Read a messy file leniently"
 * import { Csv } from "@beep/csv/Csv.codec"
 * import { CsvRead } from "@beep/csv/CsvRead.schema"
 * import * as Result from "effect/Result"
 *
 * const read = Result.getOrThrow(Csv.parseResult('SKU;Name;Qty\nBRK-040;Bracket "40" mm;12\nBLT-0042;Bolt;3\n'))
 * read.table.records // => [["SKU", "Name", "Qty"], ["BRK-040", 'Bracket "40" mm', "12"], ["BLT-0042", "Bolt", "3"]]
 * read.delimiter.delimiter // => ";"
 * CsvRead.warnings(read).length // => 2
 * ```
 *
 * **Example** (Round-trip a table through the Schema codec)
 *
 * ```ts import.meta.vitest name="Round-trip a table through the Schema codec"
 * import { Csv } from "@beep/csv/Csv.codec"
 * import { CsvTable } from "@beep/csv/CsvTable.schema"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const text = yield* S.encodeEffect(Csv.CsvFromString)(CsvTable.make({ records: [["a", "b,c"], ["d;e"]] }))
 *   const table = yield* S.decodeEffect(Csv.CsvFromString)(text)
 *   return { text, records: table.records }
 * })
 * Effect.runSync(program) // => { text: 'a,"b,c"\r\nd;e\r\n', records: [["a", "b,c"], ["d;e"]] }
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export class Csv {
  private constructor() {}

  /**
   * Reads CSV text, synchronously. A lenient read succeeds with its warnings in `outcome`; a fatal finding fails it
   * with `CsvParseError`. Text input has no byte cap; the text caps bound it.
   */
  static parseResult(
    text: string,
    options: CsvReadOptions = CsvReadOptions.default
  ): Result.Result<CsvRead, CsvParseError> {
    return readText(text, options, WHOLE, constVoid);
  }

  /** {@link Csv.parseResult} as an `Effect`, with its span. */
  static readonly parse = Effect.fn("Csv.parse")((text: string, options?: CsvReadOptions) =>
    Effect.fromResult(Csv.parseResult(text, options))
  );

  /**
   * Reads CSV bytes, detecting or fixing the encoding; `source` says how. Besides the findings of a text read, more
   * bytes than `maxInputBytes` fail with `TooManyBytes`, and bytes that are not UTF-8 under a fixed UTF-8 with
   * `InvalidUtf8`.
   */
  static parseBytesResult(
    bytes: Uint8Array,
    options: CsvReadOptions = CsvReadOptions.default
  ): Result.Result<CsvRead, CsvParseError> {
    return readBytes(bytes, options, WHOLE, constVoid);
  }

  /** {@link Csv.parseBytesResult} as an `Effect`, with its span. */
  static readonly parseBytes = Effect.fn("Csv.parseBytes")((bytes: Uint8Array, options?: CsvReadOptions) =>
    Effect.fromResult(Csv.parseBytesResult(bytes, options))
  );

  /**
   * {@link Csv.parseBytesResult} read in pieces of `pieceChars` characters, telling `onPiece` after each how many
   * records and characters are done, so a screen can show progress. The result is that of reading at once, failures
   * included.
   */
  static parseBytesInPiecesResult(
    bytes: Uint8Array,
    progress: {
      readonly options: CsvReadOptions;
      readonly pieceChars: number;
      readonly onPiece: OnPiece;
    }
  ): Result.Result<CsvRead, CsvParseError> {
    return readBytes(bytes, progress.options, Num.max(1, progress.pieceChars), progress.onPiece);
  }

  /**
   * Writes a table as canonical CSV text. Total: every table has a spelling, and it reads back as the same table
   * under the same fixed delimiter, with or without `excelSepHint` and the other read rules at their defaults, unless
   * `formulaGuard` is `apostrophe`.
   */
  static stringify(table: Pick<CsvTable, "records">, options: CsvWriteOptions = CsvWriteOptions.default): string {
    return writeTable({ table, options });
  }

  /** Writes a table as UTF-8 bytes; a lone UTF-16 surrogate in a cell is written as U+FFFD, as `TextEncoder` does. */
  static stringifyBytes(
    table: Pick<CsvTable, "records">,
    options: CsvWriteOptions = CsvWriteOptions.default
  ): Uint8Array {
    return encodeUtf8(Csv.stringify(table, options));
  }

  /**
   * A `Codec<CsvTable, string>`: decode reads (warnings are dropped; call `parse` to see them), encode writes. A fatal
   * finding fails the decode with the `CsvParseError`'s message as its issue. Under `CsvCodecOptions.default` it
   * reads with the comma it writes, so `decode(encode(table))` is the table.
   */
  static fromString(options: CsvCodecOptions = CsvCodecOptions.default): S.Codec<CsvTable, string> {
    return S.String.pipe(
      S.decodeTo(
        CsvTable,
        SchemaTransformation.transformEffect({
          decode: (text: string) => tableOf(readText(text, options.read, WHOLE, constVoid), text),
          encode: (table: Pick<CsvTable, "records">) => Effect.succeed(writeRecords(table.records, options.write)),
        })
      )
    );
  }

  /** {@link Csv.fromString} with every default, pre-bound. */
  static readonly CsvFromString: S.Codec<CsvTable, string> = Csv.fromString();

  /**
   * A `Codec<CsvTable, Uint8Array>`: bytes decode through the encoding rules and the byte cap, encode as UTF-8. A
   * cell holding a lone UTF-16 surrogate has no UTF-8 spelling, so its table fails to encode rather than come back
   * changed.
   */
  static fromBytes(options: CsvCodecOptions = CsvCodecOptions.default): S.Codec<CsvTable, Uint8Array> {
    return S.Uint8Array.pipe(
      S.decodeTo(
        CsvTable,
        SchemaTransformation.transformEffect({
          decode: (bytes: Uint8Array) => tableOf(readBytes(bytes, options.read, WHOLE, constVoid), bytes),
          encode: (table: Pick<CsvTable, "records">) => {
            const text = writeRecords(table.records, options.write);
            return text.isWellFormed()
              ? Effect.succeed(encodeUtf8(text))
              : Effect.fail(
                  new SchemaIssue.InvalidValue(
                    { message: "a cell holds a lone UTF-16 surrogate, which UTF-8 cannot carry" },
                    table
                  )
                );
          },
        })
      )
    );
  }

  /**
   * A codec of rows keyed by the first record's headings. An empty or repeated heading fails the decode; a heading
   * named `__proto__` is an ordinary key.
   *
   * **Details**
   *
   * Encoding writes the first row's keys as the header and each row's cells in that order; a row missing a heading
   * writes an empty cell, which is how the decode reads a short record. Rows the decode could not give back are
   * refused with an issue: a first row with no keys or with an empty key, and a later row with a key the first row
   * lacks.
   */
  static recordsFromString(
    options: CsvCodecOptions = CsvCodecOptions.default
  ): S.Codec<ReadonlyArray<CsvHeaderRow>, string> {
    return S.String.pipe(
      S.decodeTo(
        S.Array(CsvHeaderRow),
        SchemaTransformation.transformEffect({
          decode: (text: string) =>
            Effect.flatMap(tableOf(readText(text, options.read, WHOLE, constVoid), text), (table) =>
              Effect.mapError(Effect.fromResult(toHeaderRows(table)), (fatals) => issue(parseError(fatals), text))
            ),
          encode: (rows: ReadonlyArray<CsvHeaderRow>) =>
            Effect.mapBoth(Effect.fromResult(headerRecords(rows)), {
              onSuccess: (records) => writeRecords(records, options.write),
              onFailure: (message) => new SchemaIssue.InvalidValue({ message }, rows),
            }),
        })
      )
    );
  }

  /**
   * Composes the header view with a target schema: `Csv.schema(S.Array(Row))`.
   *
   * **Gotchas**
   *
   * A heading named `__proto__` reaches the row as an own key, and an `S.Struct` target reads it when its field is
   * declared with a computed key, `S.Struct({ ["__proto__"]: S.String })`. Written as `{ "__proto__": S.String }`,
   * the object literal sets the fields object's prototype instead of declaring a field, so the struct has no such
   * field and the column is dropped.
   */
  static readonly schema: TextDecodeTo<CsvCodecOptions> = makeTextDecodeTo((options?: CsvCodecOptions) =>
    Csv.recordsFromString(options)
  );

  /**
   * A channel from text chunks to records with where they were; a fatal finding fails it with `CsvParseError`. Split
   * anywhere, it gives the records of {@link Csv.parseResult}. An upstream failure passes through unchanged, and the
   * record left open when it came is not emitted.
   */
  static decodeString<IE = never, Done = unknown>(
    options: CsvReadOptions = CsvReadOptions.default
  ): Channel.Channel<
    A.NonEmptyReadonlyArray<CsvRecordSlice>,
    IE | CsvParseError,
    Done,
    A.NonEmptyReadonlyArray<string>,
    IE,
    Done
  > {
    return decodeStringChannel<IE, Done>(options);
  }

  /**
   * A channel from bytes to records: the encoding is decided within the detect window, then held, and the bytes are
   * counted against `maxInputBytes` as they arrive.
   *
   * **Gotchas**
   *
   * Under a detected encoding the channel decides once more than three bytes past its window have arrived, on the
   * window's bytes alone (a UTF-8 sequence that starts inside the window is checked to its end), so the decision does
   * not depend on how the input is cut, but it can differ from {@link Csv.parseBytesResult}: bytes valid as UTF-8 in
   * the window and not after it fail the channel with `InvalidUtf8`, where the whole read falls back to
   * Windows-1252. Input that ends within the window, or at most three bytes past it, is decided on all of its bytes,
   * as the whole read decides it.
   *
   * The channel fails on the first fatal finding in input order, after the records before it, however the input is
   * cut: the bytes before an invalid UTF-8 byte, or before the byte cap, are read first, and a record they leave open
   * is not emitted. The whole read checks the byte cap and the encoding before it parses: when a text cap is passed
   * before bytes that the cap or a fixed UTF-8 refuses, the channel fails with the `LimitExceeded` and the whole read
   * with `TooManyBytes` or `InvalidUtf8`.
   */
  static decode<IE = never, Done = unknown>(
    options: CsvReadOptions = CsvReadOptions.default
  ): Channel.Channel<
    A.NonEmptyReadonlyArray<CsvRecordSlice>,
    IE | CsvParseError,
    Done,
    A.NonEmptyReadonlyArray<Uint8Array>,
    IE,
    Done
  > {
    return Channel.pipeTo(bytesToText<IE, Done>(options), decodeStringChannel<IE | CsvParseError, Done>(options));
  }

  /**
   * A channel from bytes to rows decoded with `row`, through the header view: the first record names the fields, an
   * empty or repeated heading fails with `CsvParseError` (even with no record after it), a row that does not decode
   * fails with `S.SchemaError`. The header is checked once, on the first record.
   */
  static decodeSchema<Row extends S.Top>(row: Row) {
    return <IE = never, Done = unknown>(
      options: CsvReadOptions = CsvReadOptions.default
    ): Channel.Channel<
      A.NonEmptyReadonlyArray<Row["Type"]>,
      IE | CsvParseError | S.SchemaError,
      Done,
      A.NonEmptyReadonlyArray<Uint8Array>,
      IE,
      Done,
      Row["DecodingServices"]
    > => {
      const decodeRows = S.decodeUnknownEffect(S.NonEmptyArray(row));
      return Csv.decode<IE, Done>(options).pipe(
        Channel.mapAccum((): O.Option<CsvRecord> => O.none(), stepRows),
        Channel.mapEffect(flow(Effect.fromResult, Effect.flatMap(decodeRows)))
      );
    };
  }

  /** A channel from records to canonical text chunks; joined, they are {@link Csv.stringify} of the records. */
  static encodeString<IE = never, Done = unknown>(
    options: CsvWriteOptions = CsvWriteOptions.default
  ): Channel.Channel<A.NonEmptyReadonlyArray<string>, IE, Done, A.NonEmptyReadonlyArray<CsvRecord>, IE, Done> {
    return encodeStringChannel<IE, Done>(options);
  }

  /** A channel from records to UTF-8 bytes; a lone UTF-16 surrogate in a cell is written as U+FFFD. */
  static encode<IE = never, Done = unknown>(
    options: CsvWriteOptions = CsvWriteOptions.default
  ): Channel.Channel<A.NonEmptyReadonlyArray<Uint8Array>, IE, Done, A.NonEmptyReadonlyArray<CsvRecord>, IE, Done> {
    return encodeStringChannel<IE, Done>(options).pipe(Channel.map(A.map(encodeUtf8)));
  }

  /**
   * The delimiter detected from a sample among the options' candidates (a fixed delimiter is the only candidate), or
   * none. The options' caps do not change the delimiter: a read under them fails at the cap it passes instead.
   */
  static sniff(sample: string, options: CsvReadOptions = CsvReadOptions.default): O.Option<CsvDelimiter> {
    return sniffDelimiter({
      sample: Str.slice(0, SNIFF_WINDOW)(sample),
      candidates: CsvDelimiterChoice.match(options.delimiter, {
        detect: ({ candidates }) => candidates,
        fixed: ({ delimiter }) => [delimiter],
      }),
    });
  }
}
