// Shared test pieces: read options, the generators of hostile text and raw bytes, a splitter that cuts input at
// arbitrary points, the outcome of a read reduced to what the laws compare (records, or the fatal findings), a stream
// that fails after its values, and a cost ratio that needs no wall-clock bound.

import { Csv } from "@beep/csv/Csv.codec";
import {
  CsvDetectDelimiter,
  CsvDetectEncoding,
  CsvFixedDelimiter,
  CsvFixedEncoding,
  CsvLimits,
  CsvReadOptions,
} from "@beep/csv/CsvOptions.schema";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import { dual, flow } from "effect/Function";
import * as Num from "effect/Number";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import type { CsvFatal } from "@beep/csv/CsvDiagnostic.schema";
import type { CsvParseError } from "@beep/csv/CsvError.errors";
import type { CsvDelimiter } from "@beep/csv/CsvOptions.schema";
import type { CsvRead } from "@beep/csv/CsvRead.schema";
import type { CsvRecord, CsvRecordSlice } from "@beep/csv/CsvTable.schema";

export const runs = { arbitrary: { runs: 200 } };

type Rules = Partial<Omit<CsvReadOptions, "delimiter">>;

/** Read options with one fixed delimiter and other rules. */
export const readWithRules: {
  (rules: Rules): (delimiter: CsvDelimiter) => CsvReadOptions;
  (delimiter: CsvDelimiter, rules: Rules): CsvReadOptions;
} = dual(
  2,
  (delimiter: CsvDelimiter, rules: Rules): CsvReadOptions =>
    CsvReadOptions.make({ ...rules, delimiter: CsvFixedDelimiter.make({ delimiter }) })
);

/** Read options with one fixed delimiter and every other default. */
export const readWith = (delimiter: CsvDelimiter): CsvReadOptions => readWithRules(delimiter, {});

/**
 * The read configurations every chunk-invariance law runs under: fixed, detected, fixed with `sep=` lines, and fixed
 * under caps small enough that most generated inputs pass one.
 */
export const readConfigs = {
  fixed: readWith(","),
  detect: CsvReadOptions.make({ delimiter: CsvDetectDelimiter.make({}) }),
  sepHint: readWithRules(",", { excelSepHint: true }),
  tightCaps: readWithRules(",", {
    limits: CsvLimits.make({
      maxRecords: 4,
      maxFieldsPerRecord: 3,
      maxFieldLength: 3,
      maxRecordLength: 8,
      maxWarnings: 2,
    }),
  }),
};

/** The byte decodings the bytes channel runs under: fixed UTF-8, a one-byte detect window, and the default window. */
export const byteConfigs = {
  fixedUtf8: CsvFixedEncoding.make({ encoding: "utf-8" }),
  detectOneByte: CsvDetectEncoding.make({ window: ByteSize.bytes(1n) }),
  detectDefault: CsvDetectEncoding.make({}),
};

// Text over the characters that matter to CSV, so quotes, delimiters, line breaks, byte-order marks and multi-byte
// characters meet often, after a start that may be a BOM, a `sep=` line, or both.
const MessyChar = S.Literals(['"', ",", ";", "\r", "\n", " ", "a", "é", "😀", "\uFEFF"]);
const MessyStart = S.Literals(["", "\uFEFF", "sep=;\n", "\uFEFFsep=;\r\n", "sep=|\r", "sep=,", "se"]);

/** Hostile text: an optional BOM or `sep=` start, then any mix of the characters CSV cares about. */
export const messyText = Arbitrary.schema(S.Tuple([MessyStart, S.Array(MessyChar)])).pipe(
  Arbitrary.map(([start, chars]) => `${start}${A.join(chars, "")}`)
);

/** Cut lengths, zero included, so empty chunks arrive too. */
export const cuts = S.Int.check(S.isBetween({ minimum: 0, maximum: 9 })).pipe(S.Array, Arbitrary.schema);

/**
 * The input cut after each length in `cuts` (the rest is the last piece), as `slice(from, to)` makes the pieces.
 * Empty pieces come from zero cuts; an empty input has no pieces.
 */
export const pieces: {
  <T>(cutLengths: ReadonlyArray<number>, slice: (from: number, to: number) => T): (length: number) => ReadonlyArray<T>;
  <T>(length: number, cutLengths: ReadonlyArray<number>, slice: (from: number, to: number) => T): ReadonlyArray<T>;
} = dual(
  3,
  <T>(length: number, cutLengths: ReadonlyArray<number>, slice: (from: number, to: number) => T): ReadonlyArray<T> => {
    const bounds = [
      0,
      ...A.filter(A.drop(A.scan(cutLengths, 0, Num.sum), 1), (at) => at < length),
      ...(length > 0 ? [length] : []),
    ];
    return A.zipWith(bounds, A.drop(bounds, 1), slice);
  }
);

/** What the laws compare of a read: its records, or its fatal findings. */
export type Outcome = Result.Result<ReadonlyArray<CsvRecord>, ReadonlyArray<CsvFatal>>;

export const outcomeOfRead = (read: Result.Result<CsvRead, CsvParseError>): Outcome =>
  Result.mapBoth(read, { onSuccess: (done) => done.table.records, onFailure: (error) => error.diagnostics });

export const outcomeOfSlices = (slices: Result.Result<ReadonlyArray<CsvRecordSlice>, CsvParseError>): Outcome =>
  Result.mapBoth(slices, {
    onSuccess: A.map((slice) => slice.cells),
    onFailure: (error) => error.diagnostics,
  });

/** The pieces streamed one per batch, so the channel really sees them apart. */
export const streamPieces = <T>(chunks: ReadonlyArray<T>) => Stream.fromIterable(chunks).pipe(Stream.rechunk(1));

/** The text channel's outcome over the pieces. */
export const streamText: {
  (options: CsvReadOptions): (chunks: ReadonlyArray<string>) => Effect.Effect<Outcome>;
  (chunks: ReadonlyArray<string>, options: CsvReadOptions): Effect.Effect<Outcome>;
} = dual(2, (chunks: ReadonlyArray<string>, options: CsvReadOptions) =>
  streamPieces(chunks).pipe(
    Stream.pipeThroughChannel(Csv.decodeString(options)),
    Stream.runCollect,
    Effect.result,
    Effect.map(outcomeOfSlices)
  )
);

/** The bytes channel's outcome over the pieces. */
export const streamBytes: {
  (options: CsvReadOptions): (chunks: ReadonlyArray<Uint8Array>) => Effect.Effect<Outcome>;
  (chunks: ReadonlyArray<Uint8Array>, options: CsvReadOptions): Effect.Effect<Outcome>;
} = dual(2, (chunks: ReadonlyArray<Uint8Array>, options: CsvReadOptions) =>
  streamPieces(chunks).pipe(
    Stream.pipeThroughChannel(Csv.decode(options)),
    Stream.runCollect,
    Effect.result,
    Effect.map(outcomeOfSlices)
  )
);

export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/** The findings the fatal diagnostics carry. */
export const findingsOfFatals = A.map((fatal: CsvFatal) => fatal.finding);

/** An outcome with its fatal findings in place of the diagnostics that carry them. */
export const fatalFindings = Result.mapError(findingsOfFatals);

// Bytes over ASCII CSV characters, UTF-8 lead and continuation bytes, a UTF-8 BOM and bytes that UTF-8 never uses, so
// inputs end inside a sequence, hold a Windows-1252 accent, or are valid UTF-8, all often.
const RawByte = S.Literals([0x61, 0x2c, 0x0a, 0x22, 0xc3, 0xa9, 0xe2, 0x82, 0xf0, 0x9f, 0xff, 0xef, 0xbb, 0xbf]);

/** Raw bytes, valid UTF-8 or not. */
export const rawBytes = RawByte.pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map((bytes) => Uint8Array.from(bytes))
);

/** A stream's elements, each as a success, then the error that failed it, so a test sees what came before a failure. */
export const untilFailure = <A, E>(stream: Stream.Stream<A, E>): Effect.Effect<Array<Result.Result<A, E>>> =>
  stream.pipe(Stream.map(Result.succeed<A>), Stream.catch(flow(Result.fail<E>, Stream.make)), Stream.runCollect);

/** A stream of `values`, then the caller's own failure, as an upstream that breaks mid-input. */
export const thenFail: {
  (error: string): <A>(values: ReadonlyArray<A>) => Stream.Stream<A, string>;
  <A>(values: ReadonlyArray<A>, error: string): Stream.Stream<A, string>;
} = dual(
  2,
  <A>(values: ReadonlyArray<A>, error: string): Stream.Stream<A, string> =>
    Stream.concat(streamPieces(values), Stream.fail(error))
);

/** Milliseconds `thunk` takes: the median of five runs, after one to warm up. */
const medianMs = (thunk: () => void): number => {
  thunk();
  const times = A.makeBy(5, () => {
    const started = performance.now();
    thunk();
    return performance.now() - started;
  });
  return A.sort(times, Num.Order)[2] ?? 0;
};

/**
 * How much more `run` costs on the larger of two texts than on the smaller, measured in the same test and with the
 * texts built beforehand. For texts k times apart, about k for a linear cost and about k squared for a quadratic one:
 * a ratio, not a time, so a loaded machine slows both sides alike.
 */
export const growth: {
  (inputs: readonly [string, string]): (run: (input: string) => unknown) => number;
  (run: (input: string) => unknown, inputs: readonly [string, string]): number;
} = dual(
  2,
  (run: (input: string) => unknown, [smaller, larger]: readonly [string, string]): number =>
    medianMs(() => run(larger)) / medianMs(() => run(smaller))
);
