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
 * @packageDocumentation
 */

import { makeTextDecodeTo } from "@beep/utils/Schema";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Channel from "effect/Channel";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { CsvFatal, InvalidUtf8, TooManyBytes } from "./CsvDiagnostic.schema.ts";
import { CsvParseError } from "./CsvError.errors.ts";
import { CsvCodecOptions, CsvDetectEncoding, CsvReadOptions, CsvWriteOptions } from "./CsvOptions.schema.ts";
import type { TextDecodeTo } from "@beep/utils/Schema";
import type { CsvDiagnostic, CsvWarning } from "./CsvDiagnostic.schema.ts";
import type { CsvDelimiter } from "./CsvOptions.schema.ts";

type CodecOptions = CsvCodecOptions | { readonly read: ReadOptions; readonly write: WriteOptions };
type ReadOptions = CsvCodecOptions["read"];
type WriteOptions = CsvCodecOptions["write"];

import {
  CsvClean,
  CsvDelimiterDetected,
  CsvDelimiterFallback,
  CsvDelimiterFromSepLine,
  CsvDelimiterGiven,
  CsvEncodingFallback,
  CsvEncodingFromBom,
  CsvEncodingGiven,
  CsvEncodingValidUtf8,
  CsvFromBytes,
  CsvFromText,
  CsvNoted,
  CsvRead,
} from "./CsvRead.schema.ts";
import { CsvRecordSlice, CsvTable } from "./CsvTable.schema.ts";
import { bomOf, decodeBytes, encodeUtf8, firstInvalidUtf8 } from "./internal/encoding.ts";
import { toHeaderRows } from "./internal/header.ts";
import { end, MachineState, push } from "./internal/machine.ts";
import { SNIFF_WINDOW, sniffDelimiter } from "./internal/sniff.ts";
import { writeTable } from "./internal/writer.ts";
import type { CsvDelimiterFound, CsvEncodingFound } from "./CsvRead.schema.ts";
import type { CsvRecord } from "./CsvTable.schema.ts";
import type { HeaderRow } from "./internal/header.ts";
import type { MachineConfig, RawRecord, Step } from "./internal/machine.ts";

// ── reading ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const sepLine = /^sep=([,;\t|])(\r\n|\n|\r)/;

interface Prepared {
  readonly bom: boolean;
  readonly config: MachineConfig;
  readonly delimiter: CsvDelimiterFound;
  readonly text: string;
}

/** Strips a BOM, honours a `sep=` line when asked, and settles the delimiter. */
const prepare = (input: string, options: ReadOptions): Prepared => {
  const bom = Str.startsWith("﻿")(input);
  const unmarked = bom ? Str.slice(1)(input) : input;
  const sep = options.excelSepHint ? O.fromNullishOr(sepLine.exec(unmarked)) : O.none();
  const text = O.match(sep, { onNone: () => unmarked, onSome: (match) => Str.slice(match[0].length)(unmarked) });
  const delimiter: CsvDelimiterFound = O.match(sep, {
    onSome: (match) => CsvDelimiterFromSepLine.make({ delimiter: (match[1] ?? ",") as CsvDelimiter }),
    onNone: () =>
      options.delimiter.kind === "fixed"
        ? CsvDelimiterGiven.make({ delimiter: options.delimiter.delimiter })
        : O.match(
            sniffDelimiter({
              sample: Str.slice(0, SNIFF_WINDOW)(text),
              candidates: options.delimiter.candidates,
              limits: options.limits,
            }),
            {
              onNone: () => CsvDelimiterFallback.make({}),
              onSome: (found) => CsvDelimiterDetected.make({ delimiter: found }),
            }
          ),
  });
  return {
    text,
    bom,
    delimiter,
    config: {
      delimiter: delimiter.delimiter,
      quotes: options.quotes,
      ragged: options.ragged,
      blankLines: options.blankLines,
      trim: options.trim,
      limits: options.limits,
    },
  };
};

interface Ran {
  readonly diagnostics: ReadonlyArray<CsvDiagnostic>;
  readonly records: ReadonlyArray<RawRecord>;
}

/** Runs the machine over the text in pieces, telling `onPiece` how many records and characters are done. */
const run = (
  text: string,
  config: MachineConfig,
  pieceChars: number,
  onPiece: (records: number, charsRead: number) => void
): Ran => {
  const records: Array<RawRecord> = [];
  const diagnostics: Array<CsvDiagnostic> = [];
  const collect = (step: Step): MachineState => {
    A.forEach(step.records, (record) => records.push(record));
    A.forEach(step.diagnostics, (diagnostic) => diagnostics.push(diagnostic));
    return step.state;
  };
  let state = MachineState.initial;
  let at = 0;
  while (at < text.length && !state.stopped) {
    const next = Math.min(text.length, at + pieceChars);
    state = collect(push(state, Str.slice(at, next)(text), config));
    at = next;
    if (at < text.length) onPiece(records.length, at);
  }
  if (!state.stopped) collect(end(state, config));
  onPiece(records.length, text.length);
  return { records, diagnostics };
};

const fatalsOf = (diagnostics: ReadonlyArray<CsvDiagnostic>): ReadonlyArray<CsvFatal> =>
  A.filter(diagnostics, (d): d is CsvFatal => d.severity === "fatal");

const warningsOf = (diagnostics: ReadonlyArray<CsvDiagnostic>): ReadonlyArray<CsvWarning> =>
  A.filter(diagnostics, (d): d is CsvWarning => d.severity === "warning");

const finish = (
  prepared: Prepared,
  ran: Ran,
  source: (bom: boolean) => CsvRead["source"]
): Result.Result<CsvRead, CsvParseError> => {
  const fatals = fatalsOf(ran.diagnostics);
  if (A.isReadonlyArrayNonEmpty(fatals)) return Result.fail(CsvParseError.make({ diagnostics: fatals }));
  const warnings = warningsOf(ran.diagnostics);
  return Result.succeed(
    CsvRead.make({
      table: CsvTable.make({ records: A.map(ran.records, (record) => record.cells) }),
      delimiter: prepared.delimiter,
      source: source(prepared.bom),
      outcome: A.isReadonlyArrayNonEmpty(warnings) ? CsvNoted.make({ warnings }) : CsvClean.make({}),
    })
  );
};

const noProgress = (): void => {};

interface Decoded {
  readonly encoding: CsvEncodingFound;
  readonly text: string;
}

const fatal = (finding: InvalidUtf8 | TooManyBytes): CsvParseError =>
  CsvParseError.make({ diagnostics: [CsvFatal.make({ finding })] });

/** Bytes to text: a BOM names the encoding; otherwise valid UTF-8, else Windows-1252 (the old reader's rule). */
const decodeInput = (bytes: Uint8Array, options: ReadOptions): Result.Result<Decoded, CsvParseError> => {
  const size = ByteSize.bytes(BigInt(bytes.length));
  if (ByteSize.isGreaterThan(size, options.limits.maxInputBytes)) {
    return Result.fail(fatal(TooManyBytes.make({ maximum: options.limits.maxInputBytes, actual: size })));
  }
  if (options.encoding.kind === "fixed") {
    const encoding = options.encoding.encoding;
    if (encoding === "utf-8") {
      const invalid = firstInvalidUtf8(bytes);
      if (O.isSome(invalid)) return Result.fail(fatal(InvalidUtf8.make({ byteOffset: invalid.value })));
    }
    const bom = O.isSome(bomOf(bytes));
    return Result.succeed({
      text: decodeBytes({ bytes, encoding }),
      encoding: CsvEncodingGiven.make({ encoding, bom }),
    });
  }
  const mark = bomOf(bytes);
  if (O.isSome(mark) && mark.value !== "utf-8") {
    return Result.succeed({
      text: decodeBytes({ bytes, encoding: mark.value }),
      encoding: CsvEncodingFromBom.make({ encoding: mark.value }),
    });
  }
  const invalid = firstInvalidUtf8(bytes);
  if (O.isSome(invalid)) {
    return Result.succeed({
      text: decodeBytes({ bytes, encoding: "windows-1252" }),
      encoding: CsvEncodingFallback.make({ firstInvalidByte: invalid.value }),
    });
  }
  return Result.succeed({
    text: decodeBytes({ bytes, encoding: "utf-8" }),
    encoding: O.isSome(mark) ? CsvEncodingFromBom.make({ encoding: "utf-8" }) : CsvEncodingValidUtf8.make({}),
  });
};

const readText = (
  text: string,
  options: ReadOptions,
  pieceChars: number,
  onPiece: (records: number, charsRead: number) => void
): Result.Result<CsvRead, CsvParseError> => {
  const prepared = prepare(text, options);
  return finish(prepared, run(prepared.text, prepared.config, pieceChars, onPiece), (bom) => CsvFromText.make({ bom }));
};

const readBytes = (
  bytes: Uint8Array,
  options: ReadOptions,
  pieceChars: number,
  onPiece: (records: number, charsRead: number) => void
): Result.Result<CsvRead, CsvParseError> =>
  Result.flatMap(decodeInput(bytes, options), (decoded) => {
    const prepared = prepare(decoded.text, options);
    return finish(prepared, run(prepared.text, prepared.config, pieceChars, onPiece), () =>
      CsvFromBytes.make({ encoding: decoded.encoding, bytes: ByteSize.bytes(BigInt(bytes.length)) })
    );
  });

const WHOLE = Number.MAX_SAFE_INTEGER;

// ── schema plumbing ──────────────────────────────────────────────────────────────────────────────────────────────────

const issue = (error: CsvParseError, input: unknown): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue({ message: error.message }, input);

const tableFromText = (text: string, options: CodecOptions) =>
  Effect.mapBoth(Effect.fromResult(readText(text, options.read, WHOLE, noProgress)), {
    onSuccess: (read) => read.table,
    onFailure: (error) => issue(error, text),
  });

/**
 * A domain codec bound to its two directions, returned by {@link Csv.bind}.
 *
 * @category models
 */
export interface CsvBoundCodec<T, RD = never, RE = never> {
  /** Decode CSV text into `T`. */
  readonly decode: (text: string) => Effect.Effect<T, S.SchemaError, RD>;
  /** Encode `T` as canonical CSV text. */
  readonly encode: (value: T) => Effect.Effect<string, S.SchemaError, RE>;
  /** The composed codec. */
  readonly schema: S.Codec<T, string, RD, RE>;
}

// ── streaming ────────────────────────────────────────────────────────────────────────────────────────────────────────

type Pending =
  | { readonly phase: "buffering"; readonly buffer: string; readonly first: boolean }
  | { readonly phase: "running"; readonly state: MachineState; readonly config: MachineConfig };

type Emitted = A.NonEmptyReadonlyArray<CsvRecordSlice> | CsvParseError;

const slicesOf = (step: Step): ReadonlyArray<Emitted> => {
  const fatals = fatalsOf(step.diagnostics);
  const slices = A.map(step.records, (record) =>
    CsvRecordSlice.make({ cells: record.cells, record: record.record, span: record.span, end: record.end })
  );
  const out: Array<Emitted> = [];
  if (A.isReadonlyArrayNonEmpty(slices)) out.push(slices);
  if (A.isReadonlyArrayNonEmpty(fatals)) out.push(CsvParseError.make({ diagnostics: fatals }));
  return out;
};

const startRunning = (buffer: string, options: ReadOptions): readonly [Pending, ReadonlyArray<Emitted>] => {
  const prepared = prepare(buffer, options);
  const step = push(MachineState.initial, prepared.text, prepared.config);
  return [{ phase: "running", state: step.state, config: prepared.config }, slicesOf(step)];
};

const stepText = (
  pending: Pending,
  chunk: string,
  options: ReadOptions
): readonly [Pending, ReadonlyArray<Emitted>] => {
  if (pending.phase === "running") {
    if (pending.state.stopped) return [pending, []];
    const step = push(pending.state, chunk, pending.config);
    return [{ phase: "running", state: step.state, config: pending.config }, slicesOf(step)];
  }
  const buffer = pending.buffer + chunk;
  const settled = options.delimiter.kind === "fixed" || buffer.length >= SNIFF_WINDOW;
  return settled ? startRunning(buffer, options) : [{ phase: "buffering", buffer, first: false }, []];
};

const haltText = (pending: Pending, options: ReadOptions): ReadonlyArray<Emitted> => {
  if (pending.phase === "running") return pending.state.stopped ? [] : slicesOf(end(pending.state, pending.config));
  const [started, emitted] = startRunning(pending.buffer, options);
  return started.phase === "running" && !started.state.stopped
    ? [...emitted, ...slicesOf(end(started.state, started.config))]
    : emitted;
};

const failOnError = (emitted: Emitted): Effect.Effect<A.NonEmptyReadonlyArray<CsvRecordSlice>, CsvParseError> =>
  P.isTagged(emitted, "CsvParseError")
    ? Effect.fail(emitted as CsvParseError)
    : Effect.succeed(emitted as A.NonEmptyReadonlyArray<CsvRecordSlice>);

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
    Channel.mapAccum(
      (): Pending => ({ phase: "buffering", buffer: "", first: true }),
      (pending, chunks: A.NonEmptyReadonlyArray<string>) =>
        stepText(pending, A.join(chunks, ""), options) as readonly [Pending, ReadonlyArray<Emitted>],
      { onHalt: (pending) => [...haltText(pending, options)] }
    ),
    Channel.mapEffect(failOnError)
  );

type BytesPending =
  | { readonly phase: "window"; readonly bytes: Uint8Array }
  | { readonly phase: "utf8"; readonly carry: Uint8Array; readonly at: number }
  | { readonly phase: "fixed"; readonly decoder: InstanceType<typeof TextDecoder> };

type Text = string | CsvParseError;

const concatBytes = (left: Uint8Array, right: Uint8Array): Uint8Array => {
  const out = new Uint8Array(left.length + right.length);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
};

/** How many trailing bytes start a UTF-8 sequence that the chunk does not finish. */
const incompleteTail = (bytes: Uint8Array): number => {
  for (let back = 1; back <= Math.min(3, bytes.length); back += 1) {
    const b = bytes[bytes.length - back] ?? 0;
    if ((b & 0xc0) === 0x80) continue;
    const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 1;
    return need > back ? back : 0;
  }
  return 0;
};

const utf8Step = (carry: Uint8Array, at: number, chunk: Uint8Array): readonly [BytesPending, ReadonlyArray<Text>] => {
  const bytes = concatBytes(carry, chunk);
  const keep = incompleteTail(bytes);
  const whole = bytes.subarray(0, bytes.length - keep);
  const invalid = firstInvalidUtf8(whole);
  if (O.isSome(invalid)) {
    return [
      { phase: "utf8", carry: new Uint8Array(0), at },
      [fatal(InvalidUtf8.make({ byteOffset: at + invalid.value }))],
    ];
  }
  const text = decodeBytes({ bytes: whole, encoding: "utf-8" });
  return [
    { phase: "utf8", carry: bytes.slice(bytes.length - keep), at: at + whole.length },
    text.length > 0 ? [text] : [],
  ];
};

const decideWindow = (bytes: Uint8Array, options: ReadOptions): readonly [BytesPending, ReadonlyArray<Text>] => {
  const mark = bomOf(bytes);
  if (O.isSome(mark) && mark.value !== "utf-8") {
    const decoder = new TextDecoder(mark.value);
    return [{ phase: "fixed", decoder }, [decoder.decode(bytes, { stream: true })]];
  }
  const body = O.isSome(mark) ? bytes.subarray(3) : bytes;
  const invalid = firstInvalidUtf8(body.subarray(0, body.length - incompleteTail(body)));
  if (O.isSome(invalid)) {
    const decoder = new TextDecoder("windows-1252");
    return [{ phase: "fixed", decoder }, [decoder.decode(bytes, { stream: true })]];
  }
  void options;
  return utf8Step(new Uint8Array(0), O.isSome(mark) ? 3 : 0, body);
};

const stepBytes = (
  pending: BytesPending,
  chunk: Uint8Array,
  options: ReadOptions
): readonly [BytesPending, ReadonlyArray<Text>] => {
  switch (pending.phase) {
    case "fixed":
      return [pending, [pending.decoder.decode(chunk, { stream: true })]];
    case "utf8":
      return utf8Step(pending.carry, pending.at, chunk);
    case "window": {
      const bytes = concatBytes(pending.bytes, chunk);
      if (options.encoding.kind === "fixed") {
        const encoding = options.encoding.encoding;
        if (encoding === "utf-8") {
          const body = O.isSome(bomOf(bytes)) ? bytes.subarray(3) : bytes;
          return utf8Step(new Uint8Array(0), bytes.length - body.length, body);
        }
        const decoder = new TextDecoder(encoding);
        return [{ phase: "fixed", decoder }, [decoder.decode(bytes, { stream: true })]];
      }
      return ByteSize.isGreaterThanOrEqualTo(ByteSize.bytes(BigInt(bytes.length)), options.encoding.window)
        ? decideWindow(bytes, options)
        : [{ phase: "window", bytes }, []];
    }
  }
};

const haltBytes = (pending: BytesPending, options: ReadOptions): ReadonlyArray<Text> => {
  switch (pending.phase) {
    case "fixed":
      return [pending.decoder.decode()];
    case "utf8":
      return pending.carry.length > 0 ? [fatal(InvalidUtf8.make({ byteOffset: pending.at }))] : [];
    case "window": {
      const [next, texts] = stepBytes({ phase: "window", bytes: new Uint8Array(0) }, pending.bytes, {
        ...options,
        encoding: CsvDetectEncoding.make({ window: ByteSize.zero }),
      });
      return [...texts, ...haltBytes(next, options)];
    }
  }
};

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
    Channel.mapAccum(
      (): BytesPending => ({ phase: "window", bytes: new Uint8Array(0) }),
      (pending, chunks: A.NonEmptyReadonlyArray<Uint8Array>) =>
        A.reduce(
          chunks,
          [pending, [] as ReadonlyArray<Text>] as readonly [BytesPending, ReadonlyArray<Text>],
          (acc, chunk) => {
            const [next, texts] = stepBytes(acc[0], chunk, options);
            return [next, [...acc[1], ...texts]] as const;
          }
        ),
      { onHalt: (pending) => [...haltBytes(pending, options)] }
    ),
    Channel.mapEffect((text) =>
      P.isTagged(text, "CsvParseError")
        ? Effect.fail(text as CsvParseError)
        : Effect.succeed(A.of(text as string) as A.NonEmptyReadonlyArray<string>)
    )
  );

const encodeStringChannel = <IE, Done>(
  options: WriteOptions
): Channel.Channel<A.NonEmptyReadonlyArray<string>, IE, Done, A.NonEmptyReadonlyArray<CsvRecord>, IE, Done> =>
  Channel.identity<A.NonEmptyReadonlyArray<CsvRecord>, IE, Done>().pipe(
    Channel.mapAccum(
      () => true,
      (first: boolean, records: A.NonEmptyReadonlyArray<CsvRecord>) => {
        const body = writeTable({
          table: CsvTable.make({ records }),
          options: { ...options, bom: first && options.bom, finalTerminator: false },
        });
        const separator = first ? "" : options.terminator === "CRLF" ? "\r\n" : "\n";
        return [false, [`${separator}${body}`]] as const;
      },
      {
        onHalt: (first) => (!first && options.finalTerminator ? [options.terminator === "CRLF" ? "\r\n" : "\n"] : []),
      }
    ),
    Channel.map((text) => A.of(text) as A.NonEmptyReadonlyArray<string>)
  );

// ── the facade ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Static entry points for reading and writing CSV. Not instantiable.
 *
 * **Example** (Read a messy file leniently)
 *
 * ```ts
 * import { Csv } from "@beep/csv/Csv"
 * import { CsvRead } from "@beep/csv/CsvRead"
 * import * as Result from "effect/Result"
 *
 * const read = Result.getOrThrow(Csv.parseResult('SKU;Name\nBRK-040;"Bracket" 40 mm\n'))
 * read.table.records // => [["SKU", "Name"], ["BRK-040", 'Bracket" 40 mm\n']] (quote read past, as a warning)
 * read.delimiter.delimiter // => ";"
 * CsvRead.warnings(read).length // => 1
 * ```
 *
 * @category utilities
 */
export class Csv {
  private constructor() {}

  /** Reads CSV text, synchronously. A lenient read succeeds with its warnings in `outcome`. */
  static parseResult(
    text: string,
    options: CsvReadOptions = CsvReadOptions.default
  ): Result.Result<CsvRead, CsvParseError> {
    return readText(text, options, WHOLE, noProgress);
  }

  /** {@link Csv.parseResult} as an `Effect`, with its span. */
  static readonly parse = Effect.fn("Csv.parse")((text: string, options?: CsvReadOptions) =>
    Effect.fromResult(Csv.parseResult(text, options))
  );

  /** Reads CSV bytes, detecting or fixing the encoding; `source` says how. */
  static parseBytesResult(
    bytes: Uint8Array,
    options: CsvReadOptions = CsvReadOptions.default
  ): Result.Result<CsvRead, CsvParseError> {
    return readBytes(bytes, options, WHOLE, noProgress);
  }

  /** {@link Csv.parseBytesResult} as an `Effect`, with its span. */
  static readonly parseBytes = Effect.fn("Csv.parseBytes")((bytes: Uint8Array, options?: CsvReadOptions) =>
    Effect.fromResult(Csv.parseBytesResult(bytes, options))
  );

  /**
   * {@link Csv.parseBytesResult} read in pieces of `pieceChars` characters, telling `onPiece` after each how many
   * records and characters are done, so a screen can show progress. The result is that of reading at once.
   */
  static parseBytesInPiecesResult(
    bytes: Uint8Array,
    progress: {
      readonly options: CsvReadOptions;
      readonly pieceChars: number;
      readonly onPiece: (records: number, charsRead: number, charsTotal: number) => void;
    }
  ): Result.Result<CsvRead, CsvParseError> {
    let total = 0;
    return Result.flatMap(decodeInput(bytes, progress.options), (decoded) => {
      const prepared = prepare(decoded.text, progress.options);
      total = prepared.text.length;
      return finish(
        prepared,
        run(prepared.text, prepared.config, Math.max(1, progress.pieceChars), (records, read) =>
          progress.onPiece(records, read, total)
        ),
        () => CsvFromBytes.make({ encoding: decoded.encoding, bytes: ByteSize.bytes(BigInt(bytes.length)) })
      );
    });
  }

  /** Writes a table as canonical CSV text. Total: every table has a spelling. */
  static stringify(table: Pick<CsvTable, "records">, options: CsvWriteOptions = CsvWriteOptions.default): string {
    return writeTable({ table, options });
  }

  /** Writes a table as UTF-8 bytes. */
  static stringifyBytes(
    table: Pick<CsvTable, "records">,
    options: CsvWriteOptions = CsvWriteOptions.default
  ): Uint8Array {
    return encodeUtf8(Csv.stringify(table, options));
  }

  /** A `Codec<CsvTable, string>`: decode reads (warnings are dropped; call `parse` to see them), encode writes. */
  static fromString(options: CsvCodecOptions = CsvCodecOptions.default): S.Codec<CsvTable, string> {
    return S.String.pipe(
      S.decodeTo(
        CsvTable,
        SchemaTransformation.transformEffect({
          decode: (text: string) => tableFromText(text, options),
          encode: (table: CsvTable["Encoded" & keyof CsvTable] | { readonly records: ReadonlyArray<CsvRecord> }) =>
            Effect.succeed(writeTable({ table: CsvTable.make({ records: table.records }), options: options.write })),
        })
      )
    );
  }

  /** {@link Csv.fromString} with every default, pre-bound. */
  static readonly CsvFromString: S.Codec<CsvTable, string> = Csv.fromString();

  /** A `Codec<CsvTable, Uint8Array>`: bytes decode through the encoding rules, encode as UTF-8. */
  static fromBytes(options: CsvCodecOptions = CsvCodecOptions.default): S.Codec<CsvTable, Uint8Array> {
    return S.Uint8Array.pipe(
      S.decodeTo(
        CsvTable,
        SchemaTransformation.transformEffect({
          decode: (bytes: Uint8Array) =>
            Effect.mapBoth(Effect.fromResult(readBytes(bytes, options.read, WHOLE, noProgress)), {
              onSuccess: (read) => read.table,
              onFailure: (error) => issue(error, bytes),
            }),
          encode: (table: { readonly records: ReadonlyArray<CsvRecord> }) =>
            Effect.succeed(
              encodeUtf8(writeTable({ table: CsvTable.make({ records: table.records }), options: options.write }))
            ),
        })
      )
    );
  }

  /**
   * A codec of rows keyed by the first record's headings. An empty or repeated heading fails the decode; a heading
   * named `__proto__` is an ordinary key.
   */
  static recordsFromString(
    options: CsvCodecOptions = CsvCodecOptions.default
  ): S.Codec<ReadonlyArray<HeaderRow>, string> {
    return S.String.pipe(
      S.decodeTo(
        S.Array(S.Record(S.String, S.String)),
        SchemaTransformation.transformEffect({
          decode: (text: string) =>
            Effect.flatMap(tableFromText(text, options), (table) =>
              Effect.mapError(Effect.fromResult(toHeaderRows(table)), (fatals) =>
                issue(
                  CsvParseError.make({ diagnostics: A.isReadonlyArrayNonEmpty(fatals) ? fatals : ([] as never) }),
                  text
                )
              )
            ),
          encode: (rows: ReadonlyArray<HeaderRow>) => {
            const header = O.getOrElse(
              O.map(A.head(rows), (row) => R.keys(row)),
              () => []
            );
            const records = A.map([header, ...A.map(rows, (row) => A.map(header, (name) => row[name] ?? ""))], (r) =>
              A.isReadonlyArrayNonEmpty(r) ? r : ([""] as const)
            );
            return Effect.succeed(
              writeTable({
                table: CsvTable.make({ records: rows.length === 0 ? [] : records }),
                options: options.write,
              })
            );
          },
        })
      )
    );
  }

  /** Composes the header view with a target schema: `Csv.schema(S.Array(Row))`. */
  static readonly schema: TextDecodeTo<CsvCodecOptions> = makeTextDecodeTo((options?: CsvCodecOptions) =>
    Csv.recordsFromString(options)
  );

  /** Binds a target schema to the header view once, with its two directions. */
  static bind<T, E, RD = never, RE = never>(
    target: S.Codec<T, E, RD, RE>,
    options: CsvCodecOptions = CsvCodecOptions.default
  ): CsvBoundCodec<T, RD, RE> {
    const schema = Csv.recordsFromString(options).pipe(S.decodeTo(target));
    return { schema, decode: S.decodeEffect(schema), encode: S.encodeEffect(schema) };
  }

  /** A channel from text chunks to records with where they were; a fatal finding fails it. */
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

  /** A channel from bytes to records: the encoding is decided within the detect window, then held. */
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
   * empty or repeated heading fails with `CsvParseError`, a row that does not decode fails with `S.SchemaError`.
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
      const decodeRows = S.decodeUnknownEffect(S.Array(row));
      return Csv.decode<IE, Done>(options).pipe(
        Channel.mapAccum(
          (): O.Option<CsvRecord> => O.none(),
          (header, slices: A.NonEmptyReadonlyArray<CsvRecordSlice>) => {
            const head = O.orElse(header, () => O.some(A.headNonEmpty(slices).cells));
            const body = O.isNone(header) ? A.drop(slices, 1) : slices;
            return [head, A.isReadonlyArrayNonEmpty(body) ? [{ header: head, body }] : []] as const;
          }
        ),
        Channel.mapEffect(({ header, body }) =>
          Effect.flatMap(
            Effect.fromResult(
              Result.mapError(
                toHeaderRows({ records: [O.getOrElse(header, () => [""] as const), ...A.map(body, (s) => s.cells)] }),
                (fatals) => CsvParseError.make({ diagnostics: fatals as A.NonEmptyReadonlyArray<CsvFatal> })
              )
            ),
            (rows) => decodeRows(rows)
          ).pipe(Effect.map((rows) => rows as A.NonEmptyReadonlyArray<Row["Type"]>))
        )
      );
    };
  }

  /** A channel from records to canonical text chunks. */
  static encodeString<IE = never, Done = unknown>(
    options: CsvWriteOptions = CsvWriteOptions.default
  ): Channel.Channel<A.NonEmptyReadonlyArray<string>, IE, Done, A.NonEmptyReadonlyArray<CsvRecord>, IE, Done> {
    return encodeStringChannel<IE, Done>(options);
  }

  /** A channel from records to UTF-8 bytes. */
  static encode<IE = never, Done = unknown>(
    options: CsvWriteOptions = CsvWriteOptions.default
  ): Channel.Channel<A.NonEmptyReadonlyArray<Uint8Array>, IE, Done, A.NonEmptyReadonlyArray<CsvRecord>, IE, Done> {
    return encodeStringChannel<IE, Done>(options).pipe(
      Channel.map((texts) => A.map(texts, encodeUtf8) as A.NonEmptyReadonlyArray<Uint8Array>)
    );
  }

  /** The delimiter detected from a sample, or none. */
  static sniff(sample: string, options: CsvReadOptions = CsvReadOptions.default): O.Option<CsvDelimiter> {
    return sniffDelimiter({
      sample: Str.slice(0, SNIFF_WINDOW)(sample),
      candidates: options.delimiter.kind === "detect" ? options.delimiter.candidates : [options.delimiter.delimiter],
      limits: options.limits,
    });
  }
}
