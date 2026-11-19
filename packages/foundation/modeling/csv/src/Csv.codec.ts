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
import { bomOf, decodeBytes, decoderFor, encodeUtf8, firstInvalidUtf8 } from "./internal/encoding.ts";
import { checkHeader, rowsOf, toHeaderRows } from "./internal/header.ts";
import { Machine, MachineConfig } from "./internal/machine.ts";
import { SNIFF_WINDOW, sniffDelimiter } from "./internal/sniff.ts";
import { writeTable } from "./internal/writer.ts";
import type { TextDecodeTo } from "@beep/utils/Schema";
import type { CsvEncodingName } from "./CsvOptions.schema.ts";
import type { CsvDelimiterFound, CsvEncodingFound } from "./CsvRead.schema.ts";
import type { CsvRecord } from "./CsvTable.schema.ts";
import type { RawRecord } from "./internal/machine.ts";

// ── reading ─────────────────────────────────────────────────────────────────────────────────────────────────────────

type ReadOptions = CsvCodecOptions["read"];
type WriteOptions = CsvCodecOptions["write"];

/** Engine-built values hold their invariants by construction; the property tests prove them, so `make` skips checks. */
const built = { disableChecks: true } as const;

const sepLine = /^sep=([,;\t|])(\r\n|\n|\r)/;

/** A start more input could still turn into a `sep=` line, or change its line break (`sep=;\r` may be `sep=;\r\n`). */
const openSepLine = /^(?:s|se|sep|sep=|sep=[,;\t|]|sep=[,;\t|]\r)?$/;

/** A first line such as `sep=;`: the delimiter it names and how many units it spans. */
interface SepLine {
  readonly delimiter: CsvDelimiter;
  readonly length: number;
}

/** The input's start, read: whether it had a byte-order mark, its `sep=` line when honoured, and the text after. */
interface Start {
  readonly bom: boolean;
  readonly sep: O.Option<SepLine>;
  readonly text: string;
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

const unmarked = (input: string): string => (Str.startsWith("\uFEFF")(input) ? Str.slice(1)(input) : input);

/** Strips a BOM and, when asked, a `sep=` line. */
const startOf = (input: string, options: ReadOptions): Start => {
  const text = unmarked(input);
  const sep = options.excelSepHint ? sepLineOf(text) : O.none();
  return {
    bom: text.length < input.length,
    sep,
    text: O.getOrElse(
      O.map(sep, ({ length }) => Str.slice(length)(text)),
      () => text
    ),
  };
};

/**
 * Whether more input could no longer change what {@link startOf} makes of a stream's first text: a BOM is decided by
 * the first unit, a `sep=` line once its line break is known.
 */
const startDecided = (input: string, options: ReadOptions): boolean =>
  Str.isNonEmpty(input) && !(options.excelSepHint && openSepLine.test(unmarked(input)));

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

/** Settles the delimiter of a read start: from its `sep=` line, else as the options say. */
const prepare = (start: Start, options: ReadOptions): Prepared => {
  const delimiter = O.getOrElse(
    O.map(start.sep, ({ delimiter }): CsvDelimiterFound => CsvDelimiterFromSepLine.make({ delimiter })),
    () => settleDelimiter(start.text, options)
  );
  return {
    text: start.text,
    bom: start.bom,
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
  const collect = (machine: Machine): void => {
    A.forEach(machine.takeRecords(), (record) => records.push(record));
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
        CsvRead.make(
          {
            table: CsvTable.make({ records: A.map(ran.records, (record) => record.cells) }, built),
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

const tooManyBytes = (actual: ByteSize.ByteSize, options: ReadOptions): CsvParseError =>
  fatal(TooManyBytes.make({ maximum: options.limits.maxInputBytes, actual }));

/** Bytes to text, under the byte cap and the encoding rule. */
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

// ── schema plumbing ──────────────────────────────────────────────────────────────────────────────────────────────────

const issue = (error: CsvParseError, input: unknown): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue({ message: error.message }, input);

/** A read's table, or its error as the issue a Schema codec fails with. */
const tableOf = (read: Result.Result<CsvRead, CsvParseError>, input: unknown) =>
  Effect.mapBoth(Effect.fromResult(read), {
    onSuccess: (done) => done.table,
    onFailure: (error) => issue(error, input),
  });

const writeRecords = (records: ReadonlyArray<CsvRecord>, options: WriteOptions): string =>
  writeTable({ table: { records }, options });

/** A header row's cells in the header's order; a missing heading is an empty cell. */
const rowCells = (header: CsvRecord, row: CsvHeaderRow): CsvRecord =>
  A.map(header, (name) => O.getOrElse(R.get(row, name), () => ""));

/** The header of rows to write: the first row's keys, which must be non-empty, and hold every later row's keys. */
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

/** The header rows as records, the header first; refused when the rows cannot be written and read back. */
const headerRecords = (rows: ReadonlyArray<CsvHeaderRow>): Result.Result<ReadonlyArray<CsvRecord>, string> =>
  A.match(rows, {
    onEmpty: () => Result.succeed(A.empty()),
    onNonEmpty: (nonEmpty) =>
      Result.map(headerOf(nonEmpty), (header) => [header, ...A.map(nonEmpty, (row) => rowCells(header, row))]),
  });

// ── streaming ────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Running {
  readonly machine: Machine;
  readonly phase: "running";
}

type Pending = { readonly phase: "buffering"; readonly buffer: string } | Running;

/** What the text channel emits before failing on errors: the records of a step, or the error that stopped it. */
type Emitted = Result.Result<A.NonEmptyReadonlyArray<CsvRecordSlice>, CsvParseError>;

const sliceOf = (record: RawRecord): CsvRecordSlice =>
  CsvRecordSlice.make({ cells: record.cells, record: record.record, span: record.span, end: record.end }, built);

/** A step's records, then the error that stopped it, each only when there is one. */
const slicesOf = (machine: Machine): ReadonlyArray<Emitted> => [
  ...A.match(A.map(machine.takeRecords(), sliceOf), {
    onEmpty: A.empty<Emitted>,
    onNonEmpty: flow(Result.succeed, A.of<Emitted>),
  }),
  ...A.match(fatalsOf(machine.takeDiagnostics()), {
    onEmpty: A.empty<Emitted>,
    onNonEmpty: flow(parseError, Result.fail, A.of<Emitted>),
  }),
];

const startRunning = (prepared: Prepared): readonly [Running, ReadonlyArray<Emitted>] => {
  const machine = Machine.start(prepared.config);
  return [{ phase: "running", machine }, slicesOf(machine.feed(prepared.text))];
};

const buffering = (buffer: string): readonly [Pending, ReadonlyArray<Emitted>] => [{ phase: "buffering", buffer }, []];

/**
 * One text chunk. The first text is held until its start is decided (a BOM, a `sep=` line) and, when the delimiter
 * is detected, until the text after that start fills the detection window, so a stream sniffs and strips exactly what
 * a whole read would.
 */
const stepText = (
  pending: Pending,
  chunk: string,
  options: ReadOptions
): readonly [Pending, ReadonlyArray<Emitted>] => {
  if (pending.phase === "running")
    return [pending, pending.machine.stopped ? [] : slicesOf(pending.machine.feed(chunk))];
  const buffer = pending.buffer + chunk;
  if (!startDecided(buffer, options)) return buffering(buffer);
  const start = startOf(buffer, options);
  return options.delimiter.kind === "fixed" || O.isSome(start.sep) || start.text.length >= SNIFF_WINDOW
    ? startRunning(prepare(start, options))
    : buffering(buffer);
};

const haltRunning = (running: Running): ReadonlyArray<Emitted> =>
  running.machine.stopped ? [] : slicesOf(running.machine.finish());

const haltText = (pending: Pending, options: ReadOptions): Array<Emitted> => {
  if (pending.phase === "running") return [...haltRunning(pending)];
  const [started, emitted] = startRunning(prepare(startOf(pending.buffer, options), options));
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

type Decoding =
  | { readonly phase: "window"; readonly bytes: Uint8Array }
  | { readonly phase: "utf8"; readonly carry: Uint8Array; readonly at: number }
  | { readonly phase: "fixed"; readonly decoder: TextDecoder };

/** The decoding so far and the bytes seen, against the byte cap. */
interface BytesPending {
  readonly decoding: Decoding;
  readonly over: boolean;
  readonly seen: number;
}

/** A decoded piece of text, or the error that stopped the decoding. */
type Text = Result.Result<string, CsvParseError>;

type DecodingStep = readonly [Decoding, ReadonlyArray<Text>];

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

const fixedStep = (decoder: TextDecoder, bytes: Uint8Array): DecodingStep => [
  { phase: "fixed", decoder },
  [Result.succeed(decoder.decode(bytes, { stream: true }))],
];

const utf8Step = (carry: Uint8Array, at: number, chunk: Uint8Array): DecodingStep => {
  const bytes = concatBytes(carry, chunk);
  const keep = incompleteTail(bytes);
  const whole = bytes.subarray(0, bytes.length - keep);
  return O.match(firstInvalidUtf8(whole), {
    onSome: (invalid): DecodingStep => [
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

/**
 * Decides the encoding from the detect window: a UTF-16 BOM, else whether the window is valid UTF-8. A byte-order
 * mark stays in the decoded text; the text reader strips it, as it does for a whole read.
 */
const decideWindow = (bytes: Uint8Array): DecodingStep => {
  const mark = bomOf(bytes);
  if (O.isSome(mark) && mark.value !== "utf-8") return fixedStep(decoderFor(mark.value), bytes);
  return O.isSome(firstInvalidUtf8(bytes.subarray(0, bytes.length - incompleteTail(bytes))))
    ? fixedStep(decoderFor("windows-1252"), bytes)
    : utf8Step(new Uint8Array(0), 0, bytes);
};

/** Fills the detect window, or decodes at once when the options fix the encoding. */
const windowStep = (bytes: Uint8Array, options: ReadOptions): DecodingStep =>
  CsvEncodingChoice.match(options.encoding, {
    fixed: ({ encoding }): DecodingStep =>
      encoding === "utf-8" ? utf8Step(new Uint8Array(0), 0, bytes) : fixedStep(decoderFor(encoding), bytes),
    detect: ({ window }): DecodingStep =>
      ByteSize.isGreaterThanOrEqualTo(byteSizeOf(bytes), window)
        ? decideWindow(bytes)
        : [{ phase: "window", bytes }, []],
  });

const stepDecoding: (decoding: Decoding) => (chunk: Uint8Array, options: ReadOptions) => DecodingStep =
  Match.type<Decoding>().pipe(
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
const haltDecoding: (decoding: Decoding) => ReadonlyArray<Text> = Match.type<Decoding>().pipe(
  Match.discriminatorsExhaustive("phase")({
    fixed: ({ decoder }): ReadonlyArray<Text> => [Result.succeed(decoder.decode())],
    utf8: ({ carry, at }): ReadonlyArray<Text> =>
      carry.length > 0 ? [Result.fail(fatal(InvalidUtf8.make({ byteOffset: at })))] : [],
    window: ({ bytes }): ReadonlyArray<Text> => {
      const [next, texts] = decideWindow(bytes);
      return [...texts, ...haltDecoding(next)];
    },
  })
);

/** One byte chunk: counted against the byte cap first, so a stream fails as soon as it has read past the cap. */
const stepBytes = (
  pending: BytesPending,
  chunk: Uint8Array,
  options: ReadOptions
): readonly [BytesPending, ReadonlyArray<Text>] => {
  if (pending.over) return [pending, []];
  const seen = pending.seen + chunk.length;
  const size = ByteSize.bytes(BigInt(seen));
  if (ByteSize.isGreaterThan(size, options.limits.maxInputBytes))
    return [{ ...pending, seen, over: true }, [Result.fail(tooManyBytes(size, options))]];
  const [decoding, texts] = stepDecoding(pending.decoding)(chunk, options);
  return [{ decoding, seen, over: false }, texts];
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
      (): BytesPending => ({ decoding: { phase: "window", bytes: new Uint8Array(0) }, seen: 0, over: false }),
      (pending, chunks: A.NonEmptyReadonlyArray<Uint8Array>) => {
        const initial: readonly [BytesPending, ReadonlyArray<Text>] = [pending, []];
        return A.reduce(chunks, initial, ([state, texts], chunk): readonly [BytesPending, ReadonlyArray<Text>] => {
          const [next, more] = stepBytes(state, chunk, options);
          return [next, A.appendAll(texts, more)];
        });
      },
      { onHalt: (pending) => (pending.over ? [] : [...haltDecoding(pending.decoding)]) }
    ),
    Channel.mapEffect((text) => Effect.map(Effect.fromResult(text), A.of))
  );

/** What closes written text: a BOM alone when no record came, as `stringify` writes an empty table, else the final
 * terminator when asked. */
const ending = (first: boolean, options: WriteOptions): Array<string> => {
  if (first) return options.bom ? ["\uFEFF"] : [];
  return options.finalTerminator ? [recordEndText(options.terminator)] : [];
};

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
      { onHalt: (first) => ending(first, options) }
    ),
    Channel.map(A.of)
  );

/** The header-view rows of a stream's batch, or the error about its header. */
type RowsEmitted = Result.Result<ReadonlyArray<CsvHeaderRow>, CsvParseError>;

const cellsOf = (slice: CsvRecordSlice): CsvRecord => slice.cells;

/** A batch of records against the header: the first batch names and checks it, once; later ones only use it. */
const stepRows = (
  seen: O.Option<CsvRecord>,
  slices: A.NonEmptyReadonlyArray<CsvRecordSlice>
): readonly [O.Option<CsvRecord>, ReadonlyArray<RowsEmitted>] =>
  O.match(seen, {
    onSome: (header): readonly [O.Option<CsvRecord>, ReadonlyArray<RowsEmitted>] => [
      seen,
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
 *   return [text, table.records] as const
 * })
 * Effect.runSync(program) // => ['a,"b,c"\r\nd;e\r\n', [["a", "b,c"], ["d;e"]]]
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
   * under the same delimiter unless `formulaGuard` is `apostrophe`.
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
   * anywhere, it gives the records of {@link Csv.parseResult}.
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
   * Under a detected encoding the channel cannot look past its window, so it can differ from
   * {@link Csv.parseBytesResult}: bytes valid as UTF-8 within the window and not after it fail the channel with
   * `InvalidUtf8`, where the whole read falls back to Windows-1252. A fixed encoding, or input that the window
   * decides, reads the same both ways.
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
