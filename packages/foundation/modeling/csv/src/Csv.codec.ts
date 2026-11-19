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
import * as Match from "effect/Match";
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
  CsvDelimiter,
  CsvDelimiterChoice,
  CsvEncodingChoice,
  CsvReadOptions,
  CsvWriteOptions,
} from "./CsvOptions.schema.ts";
import { recordEndText } from "./CsvPosition.schema.ts";
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
import { CsvHeaderRow, CsvRecordSlice, CsvTable } from "./CsvTable.schema.ts";
import { bomOf, decodeBytes, encodeUtf8, firstInvalidUtf8 } from "./internal/encoding.ts";
import { toHeaderRows } from "./internal/header.ts";
import { end, MachineConfig, MachineState, push } from "./internal/machine.ts";
import { SNIFF_WINDOW, sniffDelimiter } from "./internal/sniff.ts";
import { writeTable } from "./internal/writer.ts";
import type { TextDecodeTo } from "@beep/utils/Schema";
import type { CsvEncodingName } from "./CsvOptions.schema.ts";
import type { CsvDelimiterFound, CsvEncodingFound } from "./CsvRead.schema.ts";
import type { CsvRecord } from "./CsvTable.schema.ts";
import type { RawRecord, Step } from "./internal/machine.ts";

// ── reading ─────────────────────────────────────────────────────────────────────────────────────────────────────────

type ReadOptions = CsvCodecOptions["read"];
type WriteOptions = CsvCodecOptions["write"];

const sepLine = /^sep=([,;\t|])(\r\n|\n|\r)/;

/** A first line such as `sep=;`: the delimiter it names and how many units it spans. */
interface SepLine {
  readonly delimiter: CsvDelimiter;
  readonly length: number;
}

interface Prepared {
  readonly bom: boolean;
  readonly config: MachineConfig;
  readonly delimiter: CsvDelimiterFound;
  readonly text: string;
}

const sepLineOf = (text: string): O.Option<SepLine> =>
  O.flatMap(O.fromNullishOr(sepLine.exec(text)), (match) =>
    O.map(O.filter(O.fromNullishOr(match[1]), S.is(CsvDelimiter)), (delimiter) => ({
      delimiter,
      length: match[0].length,
    }))
  );

/** The delimiter the options fix, or the one detected from the text's start, or the comma fallback. */
const settleDelimiter = (text: string, options: ReadOptions): CsvDelimiterFound =>
  CsvDelimiterChoice.match(options.delimiter, {
    fixed: ({ delimiter }) => CsvDelimiterGiven.make({ delimiter }),
    detect: ({ candidates }) =>
      O.getOrElse(
        O.map(
          sniffDelimiter({ sample: Str.slice(0, SNIFF_WINDOW)(text), candidates, limits: options.limits }),
          (delimiter) => CsvDelimiterDetected.make({ delimiter })
        ),
        () => CsvDelimiterFallback.make({})
      ),
  });

/** Strips a BOM, honours a `sep=` line when asked, and settles the delimiter. */
const prepare = (input: string, options: ReadOptions): Prepared => {
  const bom = Str.startsWith("﻿")(input);
  const unmarked = bom ? Str.slice(1)(input) : input;
  const sep = options.excelSepHint ? sepLineOf(unmarked) : O.none();
  const text = O.getOrElse(
    O.map(sep, ({ length }) => Str.slice(length)(unmarked)),
    () => unmarked
  );
  const delimiter = O.getOrElse(
    O.map(sep, ({ delimiter }): CsvDelimiterFound => CsvDelimiterFromSepLine.make({ delimiter })),
    () => settleDelimiter(text, options)
  );
  return {
    text,
    bom,
    delimiter,
    config: MachineConfig.make({
      delimiter: delimiter.delimiter,
      quotes: options.quotes,
      ragged: options.ragged,
      blankLines: options.blankLines,
      trim: options.trim,
      limits: options.limits,
    }),
  };
};

/** Told after each piece how many records and characters are done, out of how many characters. */
type OnPiece = (records: number, charsRead: number, charsTotal: number) => void;

interface Ran {
  readonly diagnostics: ReadonlyArray<CsvDiagnostic>;
  readonly records: ReadonlyArray<RawRecord>;
}

// crispen: kept as a loop — it drives the push machine piece by piece and stops at the first fatal finding; a fold
// would visit every remaining piece, and recursion would overflow on one-character pieces.
/** Runs the machine over the text in pieces of `pieceChars` characters. */
const run = (text: string, config: MachineConfig, pieceChars: number, onPiece: OnPiece): Ran => {
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
    const next = Num.min(text.length, at + pieceChars);
    state = collect(push(state, Str.slice(at, next)(text), config));
    at = next;
    if (at < text.length) onPiece(records.length, at, text.length);
  }
  if (!state.stopped) collect(end(state, config));
  onPiece(records.length, text.length, text.length);
  return { records, diagnostics };
};

const fatalsOf = A.filter(CsvDiagnostic.guards.fatal);
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
        CsvRead.make({
          table: CsvTable.make({ records: A.map(ran.records, (record) => record.cells) }),
          delimiter: prepared.delimiter,
          source: source(prepared.bom),
          outcome: A.match(warningsOf(ran.diagnostics), {
            onEmpty: (): CsvRead["outcome"] => CsvClean.make({}),
            onNonEmpty: (warnings) => CsvNoted.make({ warnings }),
          }),
        })
      ),
  });

interface Decoded {
  readonly encoding: CsvEncodingFound;
  readonly text: string;
}

const fatal = (finding: InvalidUtf8 | TooManyBytes): CsvParseError => parseError([CsvFatal.make({ finding })]);

const byteSizeOf = (bytes: Uint8Array): ByteSize.ByteSize => ByteSize.bytes(BigInt(bytes.length));

/** Bytes in the encoding the options fix; fixed UTF-8 must be valid. */
const decodeFixed = (bytes: Uint8Array, encoding: CsvEncodingName): Result.Result<Decoded, CsvParseError> =>
  O.match(encoding === "utf-8" ? firstInvalidUtf8(bytes) : O.none(), {
    onSome: (byteOffset): Result.Result<Decoded, CsvParseError> => Result.fail(fatal(InvalidUtf8.make({ byteOffset }))),
    onNone: () =>
      Result.succeed({
        text: decodeBytes({ bytes, encoding }),
        encoding: CsvEncodingGiven.make({ encoding, bom: O.isSome(bomOf(bytes)) }),
      }),
  });

/** A BOM names the encoding; otherwise valid UTF-8, else Windows-1252 (the old reader's rule). */
const decodeDetected = (bytes: Uint8Array): Decoded => {
  const mark = bomOf(bytes);
  if (O.isSome(mark) && mark.value !== "utf-8") {
    return {
      text: decodeBytes({ bytes, encoding: mark.value }),
      encoding: CsvEncodingFromBom.make({ encoding: mark.value }),
    };
  }
  return O.match(firstInvalidUtf8(bytes), {
    onSome: (firstInvalidByte): Decoded => ({
      text: decodeBytes({ bytes, encoding: "windows-1252" }),
      encoding: CsvEncodingFallback.make({ firstInvalidByte }),
    }),
    onNone: () => ({
      text: decodeBytes({ bytes, encoding: "utf-8" }),
      encoding: O.isSome(mark) ? CsvEncodingFromBom.make({ encoding: "utf-8" }) : CsvEncodingValidUtf8.make({}),
    }),
  });
};

/** Bytes to text, under the byte cap and the encoding rule. */
const decodeInput = (bytes: Uint8Array, options: ReadOptions): Result.Result<Decoded, CsvParseError> => {
  const size = byteSizeOf(bytes);
  return ByteSize.isGreaterThan(size, options.limits.maxInputBytes)
    ? Result.fail(fatal(TooManyBytes.make({ maximum: options.limits.maxInputBytes, actual: size })))
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
  const prepared = prepare(text, options);
  return finish(prepared, run(prepared.text, prepared.config, pieceChars, onPiece), (bom) => CsvFromText.make({ bom }));
};

const readBytes = (
  bytes: Uint8Array,
  options: ReadOptions,
  pieceChars: number,
  onPiece: OnPiece
): Result.Result<CsvRead, CsvParseError> =>
  Result.flatMap(decodeInput(bytes, options), (decoded) => {
    const prepared = prepare(decoded.text, options);
    return finish(prepared, run(prepared.text, prepared.config, pieceChars, onPiece), () =>
      CsvFromBytes.make({ encoding: decoded.encoding, bytes: byteSizeOf(bytes) })
    );
  });

const WHOLE = Number.MAX_SAFE_INTEGER;

// ── schema plumbing ──────────────────────────────────────────────────────────────────────────────────────────────────

const issue = (error: CsvParseError, input: unknown): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue({ message: error.message }, input);

const tableFromText = (text: string, options: CsvCodecOptions) =>
  Effect.mapBoth(Effect.fromResult(readText(text, options.read, WHOLE, constVoid)), {
    onSuccess: (read) => read.table,
    onFailure: (error) => issue(error, text),
  });

const writeRecords = (records: ReadonlyArray<CsvRecord>, options: WriteOptions): string =>
  writeTable({ table: CsvTable.make({ records }), options });

/** A header row's cells in the header's order; a missing heading is an empty cell. */
const rowCells = (header: ReadonlyArray<string>, row: CsvHeaderRow): ReadonlyArray<string> =>
  A.map(header, (name) => O.getOrElse(R.get(row, name), () => ""));

/** A record of the cells, or one empty cell when there are none. */
const asRecord = (cells: ReadonlyArray<string>): CsvRecord => (A.isReadonlyArrayNonEmpty(cells) ? cells : [""]);

/** The header rows as records: the first row's keys, then each row's cells in that order. */
const headerRecords = (rows: ReadonlyArray<CsvHeaderRow>): ReadonlyArray<CsvRecord> =>
  A.match(rows, {
    onEmpty: A.empty,
    onNonEmpty: (nonEmpty) => {
      const header = R.keys(A.headNonEmpty(nonEmpty));
      return A.map([header, ...A.map(nonEmpty, (row) => rowCells(header, row))], asRecord);
    },
  });

/**
 * A domain codec bound to its two directions, returned by {@link Csv.bind}.
 *
 * @category models
 * @since 0.0.0
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

interface Running {
  readonly config: MachineConfig;
  readonly phase: "running";
  readonly state: MachineState;
}

type Pending = { readonly phase: "buffering"; readonly buffer: string } | Running;

/** What the text channel emits before failing on errors: the records of a step, or the error that stopped it. */
type Emitted = Result.Result<A.NonEmptyReadonlyArray<CsvRecordSlice>, CsvParseError>;

const sliceOf = (record: RawRecord): CsvRecordSlice =>
  CsvRecordSlice.make({ cells: record.cells, record: record.record, span: record.span, end: record.end });

/** A step's records, then the error that stopped it, each only when there is one. */
const slicesOf = (step: Step): ReadonlyArray<Emitted> => [
  ...A.match(A.map(step.records, sliceOf), {
    onEmpty: A.empty<Emitted>,
    onNonEmpty: flow(Result.succeed, A.of<Emitted>),
  }),
  ...A.match(fatalsOf(step.diagnostics), {
    onEmpty: A.empty<Emitted>,
    onNonEmpty: flow(parseError, Result.fail, A.of<Emitted>),
  }),
];

const startRunning = (buffer: string, options: ReadOptions): readonly [Running, ReadonlyArray<Emitted>] => {
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
  return settled ? startRunning(buffer, options) : [{ phase: "buffering", buffer }, []];
};

const haltRunning = (running: Running): ReadonlyArray<Emitted> =>
  running.state.stopped ? [] : slicesOf(end(running.state, running.config));

const haltText = (pending: Pending, options: ReadOptions): Array<Emitted> => {
  if (pending.phase === "running") return [...haltRunning(pending)];
  const [started, emitted] = startRunning(pending.buffer, options);
  return [...emitted, ...haltRunning(started)];
};

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
      (): Pending => ({ phase: "buffering", buffer: "" }),
      (pending, chunks: A.NonEmptyReadonlyArray<string>) => stepText(pending, A.join(chunks, ""), options),
      { onHalt: (pending) => haltText(pending, options) }
    ),
    Channel.mapEffect(Effect.fromResult)
  );

type BytesPending =
  | { readonly phase: "window"; readonly bytes: Uint8Array }
  | { readonly phase: "utf8"; readonly carry: Uint8Array; readonly at: number }
  | { readonly phase: "fixed"; readonly decoder: InstanceType<typeof TextDecoder> };

/** A decoded piece of text, or the error that stopped the decoding. */
type Text = Result.Result<string, CsvParseError>;

type BytesStep = readonly [BytesPending, ReadonlyArray<Text>];

const concatBytes = (left: Uint8Array, right: Uint8Array): Uint8Array => {
  const out = new Uint8Array(left.length + right.length);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
};

// crispen: kept as a loop — it reads at most the last three bytes of a chunk, back to the first that starts a
// UTF-8 sequence; no Effect module reads a partial UTF-8 tail.
/** How many trailing bytes start a UTF-8 sequence that the chunk does not finish. */
const incompleteTail = (bytes: Uint8Array): number => {
  for (let back = 1; back <= Num.min(3, bytes.length); back += 1) {
    const b = bytes[bytes.length - back] ?? 0;
    if ((b & 0xc0) === 0x80) continue;
    const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 1;
    return need > back ? back : 0;
  }
  return 0;
};

const fixedStep = (decoder: InstanceType<typeof TextDecoder>, bytes: Uint8Array): BytesStep => [
  { phase: "fixed", decoder },
  [Result.succeed(decoder.decode(bytes, { stream: true }))],
];

const utf8Step = (carry: Uint8Array, at: number, chunk: Uint8Array): BytesStep => {
  const bytes = concatBytes(carry, chunk);
  const keep = incompleteTail(bytes);
  const whole = bytes.subarray(0, bytes.length - keep);
  return O.match(firstInvalidUtf8(whole), {
    onSome: (invalid): BytesStep => [
      { phase: "utf8", carry: new Uint8Array(0), at },
      [Result.fail(fatal(InvalidUtf8.make({ byteOffset: at + invalid })))],
    ],
    onNone: () => {
      const text = decodeBytes({ bytes: whole, encoding: "utf-8" });
      return [
        { phase: "utf8", carry: bytes.slice(bytes.length - keep), at: at + whole.length },
        Str.isNonEmpty(text) ? [Result.succeed(text)] : [],
      ];
    },
  });
};

/** Decides the encoding from the detect window: a BOM, else whether the window is valid UTF-8. */
const decideWindow = (bytes: Uint8Array): BytesStep => {
  const mark = bomOf(bytes);
  if (O.isSome(mark) && mark.value !== "utf-8") return fixedStep(new TextDecoder(mark.value), bytes);
  const body = O.isSome(mark) ? bytes.subarray(3) : bytes;
  return O.isSome(firstInvalidUtf8(body.subarray(0, body.length - incompleteTail(body))))
    ? fixedStep(new TextDecoder("windows-1252"), bytes)
    : utf8Step(new Uint8Array(0), O.isSome(mark) ? 3 : 0, body);
};

/** Fills the detect window, or decodes at once when the options fix the encoding. */
const windowStep = (bytes: Uint8Array, options: ReadOptions): BytesStep =>
  CsvEncodingChoice.match(options.encoding, {
    fixed: ({ encoding }): BytesStep => {
      if (encoding !== "utf-8") return fixedStep(new TextDecoder(encoding), bytes);
      const body = O.isSome(bomOf(bytes)) ? bytes.subarray(3) : bytes;
      return utf8Step(new Uint8Array(0), bytes.length - body.length, body);
    },
    detect: ({ window }): BytesStep =>
      ByteSize.isGreaterThanOrEqualTo(byteSizeOf(bytes), window)
        ? decideWindow(bytes)
        : [{ phase: "window", bytes }, []],
  });

const stepBytes: (pending: BytesPending) => (chunk: Uint8Array, options: ReadOptions) => BytesStep =
  Match.type<BytesPending>().pipe(
    Match.discriminatorsExhaustive("phase")({
      fixed:
        ({ decoder }) =>
        (chunk: Uint8Array) =>
          fixedStep(decoder, chunk),
      utf8:
        ({ carry, at }) =>
        (chunk: Uint8Array) =>
          utf8Step(carry, at, chunk),
      window:
        ({ bytes }) =>
        (chunk: Uint8Array, options: ReadOptions) =>
          windowStep(concatBytes(bytes, chunk), options),
    })
  );

/** What is left at the end of the bytes: a decoder's tail, an unfinished UTF-8 sequence, or an undecided window. */
const haltBytes: (pending: BytesPending) => ReadonlyArray<Text> = Match.type<BytesPending>().pipe(
  Match.discriminatorsExhaustive("phase")({
    fixed: ({ decoder }): ReadonlyArray<Text> => [Result.succeed(decoder.decode())],
    utf8: ({ carry, at }): ReadonlyArray<Text> =>
      carry.length > 0 ? [Result.fail(fatal(InvalidUtf8.make({ byteOffset: at })))] : [],
    window: ({ bytes }): ReadonlyArray<Text> => {
      const [next, texts] = decideWindow(bytes);
      return [...texts, ...haltBytes(next)];
    },
  })
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
    Channel.mapAccum(
      (): BytesPending => ({ phase: "window", bytes: new Uint8Array(0) }),
      (pending, chunks: A.NonEmptyReadonlyArray<Uint8Array>) => {
        const initial: BytesStep = [pending, []];
        return A.reduce(chunks, initial, ([state, texts], chunk): BytesStep => {
          const [next, more] = stepBytes(state)(chunk, options);
          return [next, A.appendAll(texts, more)];
        });
      },
      { onHalt: (pending) => [...haltBytes(pending)] }
    ),
    Channel.mapEffect((text) => Effect.map(Effect.fromResult(text), A.of))
  );

const encodeStringChannel = <IE, Done>(
  options: WriteOptions
): Channel.Channel<A.NonEmptyReadonlyArray<string>, IE, Done, A.NonEmptyReadonlyArray<CsvRecord>, IE, Done> =>
  Channel.identity<A.NonEmptyReadonlyArray<CsvRecord>, IE, Done>().pipe(
    Channel.mapAccum(
      () => true,
      (first: boolean, records: A.NonEmptyReadonlyArray<CsvRecord>) => {
        const body = writeRecords(
          records,
          CsvWriteOptions.make({ ...options, bom: first && options.bom, finalTerminator: false })
        );
        const separator = first ? "" : recordEndText(options.terminator);
        return [false, [`${separator}${body}`]] as const;
      },
      { onHalt: (first) => (!first && options.finalTerminator ? [recordEndText(options.terminator)] : []) }
    ),
    Channel.map(A.of)
  );

// ── the facade ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Static entry points for reading and writing CSV. Not instantiable.
 *
 * **Details**
 *
 * Every read returns the same `CsvTable` model. The `*Result` readers are synchronous; their `Effect` twins carry a
 * span. `fromString`, `fromBytes` and `recordsFromString` are `effect/Schema` codecs, so they compose with
 * `S.decodeTo`; `decodeString`, `decode`, `decodeSchema`, `encodeString` and `encode` are streaming channels.
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
 *   const text = yield* S.encodeEffect(Csv.CsvFromString)(CsvTable.make({ records: [["a", "b,c"]] }))
 *   const table = yield* S.decodeEffect(Csv.CsvFromString)(text)
 *   return [text, table.records] as const
 * })
 * Effect.runSync(program) // => ['a,"b,c"\r\n', [["a", "b,c"]]]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export class Csv {
  private constructor() {}

  /** Reads CSV text, synchronously. A lenient read succeeds with its warnings in `outcome`. */
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

  /** Reads CSV bytes, detecting or fixing the encoding; `source` says how. */
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
   * records and characters are done, so a screen can show progress. The result is that of reading at once.
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
          encode: (table: Pick<CsvTable, "records">) => Effect.succeed(writeRecords(table.records, options.write)),
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
            Effect.mapBoth(Effect.fromResult(readBytes(bytes, options.read, WHOLE, constVoid)), {
              onSuccess: (read) => read.table,
              onFailure: (error) => issue(error, bytes),
            }),
          encode: (table: Pick<CsvTable, "records">) =>
            Effect.succeed(encodeUtf8(writeRecords(table.records, options.write))),
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
  ): S.Codec<ReadonlyArray<CsvHeaderRow>, string> {
    return S.String.pipe(
      S.decodeTo(
        S.Array(CsvHeaderRow),
        SchemaTransformation.transformEffect({
          decode: (text: string) =>
            Effect.flatMap(tableFromText(text, options), (table) =>
              Effect.mapError(Effect.fromResult(toHeaderRows(table)), (fatals) => issue(parseError(fatals), text))
            ),
          encode: (rows: ReadonlyArray<CsvHeaderRow>) =>
            Effect.succeed(writeRecords(headerRecords(rows), options.write)),
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
      const decodeRows = S.decodeUnknownEffect(S.NonEmptyArray(row));
      return Csv.decode<IE, Done>(options).pipe(
        Channel.mapAccum(
          (): O.Option<CsvRecord> => O.none(),
          (seen, slices: A.NonEmptyReadonlyArray<CsvRecordSlice>) => {
            const header = O.getOrElse(seen, () => A.headNonEmpty(slices).cells);
            const body = O.isNone(seen) ? A.drop(slices, 1) : slices;
            return [O.some(header), A.isReadonlyArrayNonEmpty(body) ? [{ header, body }] : []] as const;
          }
        ),
        Channel.mapEffect(({ header, body }) =>
          Effect.fromResult(
            Result.mapError(toHeaderRows({ records: [header, ...A.map(body, (slice) => slice.cells)] }), parseError)
          ).pipe(Effect.flatMap(decodeRows))
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
    return encodeStringChannel<IE, Done>(options).pipe(Channel.map(A.map(encodeUtf8)));
  }

  /** The delimiter detected from a sample, or none. */
  static sniff(sample: string, options: CsvReadOptions = CsvReadOptions.default): O.Option<CsvDelimiter> {
    return sniffDelimiter({
      sample: Str.slice(0, SNIFF_WINDOW)(sample),
      candidates: CsvDelimiterChoice.match(options.delimiter, {
        detect: ({ candidates }) => candidates,
        fixed: ({ delimiter }) => [delimiter],
      }),
      limits: options.limits,
    });
  }
}
