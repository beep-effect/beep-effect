/**
 * How a CSV is read and written. A choice that carries data (the delimiter, the encoding) is a tagged union; a choice
 * between plain modes is a `LiteralKit`, and the behaviour that depends on it sits beside it. Every field has its
 * starting value on the schema, so `CsvReadOptions.make({})` is the default read.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CsvId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { MAX_TEXT_UNITS } from "./CsvPosition.schema.ts";
import { MAX_FIELDS } from "./CsvTable.schema.ts";

const $I = $CsvId.create("CsvOptions");

/**
 * A field separator the reader knows: comma, semicolon, tab or vertical bar.
 *
 * **Example** (Accept the known separators)
 *
 * ```ts import.meta.vitest name="Accept the known separators"
 * import { CsvDelimiter } from "@beep/csv/CsvOptions.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvDelimiter)(";") // => true
 * S.is(CsvDelimiter)(":") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvDelimiter = LiteralKit([",", ";", "\t", "|"]).pipe(
  $I.annoteSchema("CsvDelimiter", { description: "A field separator the reader knows" })
);

/**
 * One of the four separators {@link CsvDelimiter} admits.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvDelimiter = typeof CsvDelimiter.Type;

const defaultCandidates: readonly [CsvDelimiter, ...Array<CsvDelimiter>] = [",", "\t", "|", ";"];

/**
 * Find the delimiter from the first records, trying the candidates in order (papaparse's order by default).
 *
 * **Details**
 *
 * The order breaks ties: when two candidates split the first records equally well, the earlier one wins.
 *
 * **Example** (Detect with the default candidates)
 *
 * ```ts import.meta.vitest name="Detect with the default candidates"
 * import { CsvDetectDelimiter } from "@beep/csv/CsvOptions.schema"
 *
 * CsvDetectDelimiter.make({}).candidates // => [",", "\t", "|", ";"]
 * CsvDetectDelimiter.make({ candidates: [";", ","] }).candidates // => [";", ","]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvDetectDelimiter extends S.Opaque<CsvDetectDelimiter, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("detect"),
    candidates: S.NonEmptyArray(CsvDelimiter.annotateKey({ description: "A delimiter to try" })).pipe(
      S.annotateKey({ description: "The delimiters tried, in tie-breaking order" }),
      S.withConstructorDefault(Effect.succeed(defaultCandidates)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultCandidates))
    ),
  }).pipe($I.annoteSchema("CsvDetectDelimiter", { description: "Find the delimiter from the first records" }))
) {}

/**
 * Use one delimiter and skip detection.
 *
 * **Example** (Fix the delimiter to a semicolon)
 *
 * ```ts import.meta.vitest name="Fix the delimiter to a semicolon"
 * import { CsvFixedDelimiter } from "@beep/csv/CsvOptions.schema"
 *
 * const choice = CsvFixedDelimiter.make({ delimiter: ";" })
 * choice.kind // => "fixed"
 * choice.delimiter // => ";"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvFixedDelimiter extends S.Opaque<CsvFixedDelimiter, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("fixed"),
    delimiter: CsvDelimiter.pipe(S.annotateKey({ description: "The delimiter to use" })),
  }).pipe($I.annoteSchema("CsvFixedDelimiter", { description: "Use one delimiter" }))
) {}

/**
 * How the delimiter is chosen: detected from the first records or fixed, discriminated by `kind`.
 *
 * **Example** (Decode a choice and fill its defaults)
 *
 * ```ts import.meta.vitest name="Decode a choice and fill its defaults"
 * import { CsvDelimiterChoice } from "@beep/csv/CsvOptions.schema"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const choice = Result.getOrThrow(S.decodeUnknownResult(CsvDelimiterChoice)({ kind: "detect" }))
 * CsvDelimiterChoice.guards.detect(choice) && choice.candidates // => [",", "\t", "|", ";"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvDelimiterChoice = LiteralKit(["detect", "fixed"])
  .mapMembers(() => Tuple.make(CsvDetectDelimiter, CsvFixedDelimiter))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("CsvDelimiterChoice", { description: "How the delimiter is chosen" }));

/**
 * A {@link CsvDetectDelimiter} or a {@link CsvFixedDelimiter}.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvDelimiterChoice = typeof CsvDelimiterChoice.Type;

/**
 * The text encodings the reader knows. `effect/Schema` has no text-encoding schema, so they are named here.
 *
 * **Example** (Accept the known encodings)
 *
 * ```ts import.meta.vitest name="Accept the known encodings"
 * import { CsvEncodingName } from "@beep/csv/CsvOptions.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvEncodingName)("windows-1252") // => true
 * S.is(CsvEncodingName)("latin1") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvEncodingName = LiteralKit(["utf-8", "utf-16le", "utf-16be", "windows-1252"]).pipe(
  $I.annoteSchema("CsvEncodingName", { description: "A text encoding the reader knows" })
);

/**
 * One of the encodings {@link CsvEncodingName} admits, spelled as `TextDecoder` labels.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvEncodingName = typeof CsvEncodingName.Type;

/**
 * The widest detect window a stream may hold before it decides its encoding: 256 MiB, the default byte cap.
 *
 * **Example** (Refuse a window past the maximum)
 *
 * ```ts import.meta.vitest name="Refuse a window past the maximum"
 * import { CsvDetectEncoding, MAX_DETECT_WINDOW } from "@beep/csv/CsvOptions.schema"
 * import * as ByteSize from "effect/ByteSize"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownResult(CsvDetectEncoding)
 * MAX_DETECT_WINDOW === ByteSize.mebibytes(256) // => true
 * decode({ kind: "detect", window: MAX_DETECT_WINDOW })._tag // => "Success"
 * decode({ kind: "detect", window: ByteSize.bytes(MAX_DETECT_WINDOW + 1n) })._tag // => "Failure"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_DETECT_WINDOW: ByteSize.ByteSize = ByteSize.mebibytes(256);

/**
 * Decide the encoding from a byte-order mark, then from whether the first `window` bytes are valid UTF-8.
 *
 * **Details**
 *
 * The window matters only to streams, which must settle the encoding before the input ends. A whole byte input is
 * checked in full, and bytes that are not UTF-8 are read as Windows-1252. A stream holds its window, and the chunk
 * that carries it more than three bytes past it, in memory until it decides, so the window is at most
 * `MAX_DETECT_WINDOW` (256 MiB, the default byte cap); 64 KiB by default. It decides on the window's bytes alone,
 * reading the three after it only to finish a UTF-8 sequence that starts inside it, so the decision does not depend
 * on how the input is cut. Input that ends sooner is decided on all of its bytes, as a whole read decides it.
 *
 * **Example** (Detect within the default window)
 *
 * ```ts import.meta.vitest name="Detect within the default window"
 * import { CsvDetectEncoding } from "@beep/csv/CsvOptions.schema"
 * import * as ByteSize from "effect/ByteSize"
 *
 * CsvDetectEncoding.make({}).window // => ByteSize.kibibytes(64)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvDetectEncoding extends S.Opaque<CsvDetectEncoding, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("detect"),
    window: S.ByteSize.check(S.isLessThanOrEqualToBigInt(MAX_DETECT_WINDOW)).pipe(
      S.annotateKey({ description: "How many leading bytes a stream decides from, at most 256 MiB" }),
      S.withConstructorDefault(Effect.sync(() => ByteSize.kibibytes(64))),
      S.withDecodingDefaultTypeKey(Effect.sync(() => ByteSize.kibibytes(64)))
    ),
  }).pipe($I.annoteSchema("CsvDetectEncoding", { description: "Decide the encoding from the bytes" }))
) {}

/**
 * Read the bytes in one encoding. A fixed UTF-8 still refuses bytes that are not UTF-8 rather than falling back.
 *
 * **Example** (Refuse bytes that are not the fixed UTF-8)
 *
 * ```ts import.meta.vitest name="Refuse bytes that are not the fixed UTF-8"
 * import { Csv } from "@beep/csv/Csv.codec"
 * import { CsvFixedEncoding, CsvReadOptions } from "@beep/csv/CsvOptions.schema"
 * import * as Result from "effect/Result"
 *
 * const bytes = Uint8Array.of(0x43, 0x61, 0x66, 0xe9, 0x0a)
 * const utf8 = CsvReadOptions.make({ encoding: CsvFixedEncoding.make({ encoding: "utf-8" }) })
 * const cp1252 = CsvReadOptions.make({ encoding: CsvFixedEncoding.make({ encoding: "windows-1252" }) })
 * Result.isFailure(Csv.parseBytesResult(bytes, utf8)) // => true
 * Result.map(Csv.parseBytesResult(bytes, cp1252), (read) => read.table.records) // => Result.succeed([["Café"]])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvFixedEncoding extends S.Opaque<CsvFixedEncoding, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("fixed"),
    encoding: CsvEncodingName.pipe(S.annotateKey({ description: "The encoding to use" })),
  }).pipe($I.annoteSchema("CsvFixedEncoding", { description: "Read the bytes in one encoding" }))
) {}

/**
 * How the encoding of bytes is chosen: detected or fixed, discriminated by `kind`. Text input ignores it.
 *
 * **Example** (Decode a fixed encoding)
 *
 * ```ts import.meta.vitest name="Decode a fixed encoding"
 * import { CsvEncodingChoice } from "@beep/csv/CsvOptions.schema"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const choice = Result.getOrThrow(S.decodeUnknownResult(CsvEncodingChoice)({ kind: "fixed", encoding: "utf-16le" }))
 * CsvEncodingChoice.guards.fixed(choice) // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvEncodingChoice = LiteralKit(["detect", "fixed"])
  .mapMembers(() => Tuple.make(CsvDetectEncoding, CsvFixedEncoding))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("CsvEncodingChoice", { description: "How the encoding is chosen" }));

/**
 * A {@link CsvDetectEncoding} or a {@link CsvFixedEncoding}.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvEncodingChoice = typeof CsvEncodingChoice.Type;

/**
 * Whether a misplaced quote is read past (`lenient`, the default) or stops the read (`strict`, RFC 4180 as Effect's
 * `Csv` reads it).
 *
 * **Example** (Accept the quote rules)
 *
 * ```ts import.meta.vitest name="Accept the quote rules"
 * import { CsvQuoteRule } from "@beep/csv/CsvOptions.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvQuoteRule)("strict") // => true
 * S.is(CsvQuoteRule)("rfc4180") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvQuoteRule = LiteralKit(["lenient", "strict"]).pipe(
  $I.annoteSchema("CsvQuoteRule", { description: "Whether a misplaced quote is read past or stops the read" })
);

/**
 * One of the rules {@link CsvQuoteRule} admits.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvQuoteRule = typeof CsvQuoteRule.Type;

/**
 * What happens to a record with more or fewer cells than the first: kept as written, padded with empty cells, or
 * refused. Kept and padded records are reported as warnings.
 *
 * **Example** (Accept the ragged rules)
 *
 * ```ts import.meta.vitest name="Accept the ragged rules"
 * import { CsvRaggedRule } from "@beep/csv/CsvOptions.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvRaggedRule)("pad") // => true
 * S.is(CsvRaggedRule)("truncate") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvRaggedRule = LiteralKit(["keep", "pad", "reject"]).pipe(
  $I.annoteSchema("CsvRaggedRule", { description: "What happens to a record wider or narrower than the first" })
);

/**
 * One of the rules {@link CsvRaggedRule} admits.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvRaggedRule = typeof CsvRaggedRule.Type;

/**
 * Whether a blank line is kept as a record of one empty cell or skipped. A quoted empty cell (`""`) is never skipped.
 *
 * **Example** (Accept the blank-line rules)
 *
 * ```ts import.meta.vitest name="Accept the blank-line rules"
 * import { CsvBlankLineRule } from "@beep/csv/CsvOptions.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvBlankLineRule)("skip") // => true
 * S.is(CsvBlankLineRule)("drop") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvBlankLineRule = LiteralKit(["keep", "skip"]).pipe(
  $I.annoteSchema("CsvBlankLineRule", { description: "Whether a blank line is kept or skipped" })
);

/**
 * One of the rules {@link CsvBlankLineRule} admits.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvBlankLineRule = typeof CsvBlankLineRule.Type;

/**
 * Which cells lose surrounding spaces: none, only unquoted ones, or all.
 *
 * **Example** (Accept the trim rules)
 *
 * ```ts import.meta.vitest name="Accept the trim rules"
 * import { CsvTrimRule } from "@beep/csv/CsvOptions.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvTrimRule)("unquoted") // => true
 * S.is(CsvTrimRule)("quoted") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvTrimRule = LiteralKit(["none", "unquoted", "all"]).pipe(
  $I.annoteSchema("CsvTrimRule", { description: "Which cells lose surrounding spaces" })
);

/**
 * One of the rules {@link CsvTrimRule} admits.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvTrimRule = typeof CsvTrimRule.Type;

const count = (cap: { readonly maximum: number; readonly fallback: number; readonly description: string }) => {
  const fallback = Effect.succeed(cap.fallback);
  return S.Int.check(S.isBetween({ minimum: 1, maximum: cap.maximum })).pipe(
    S.annotateKey({ description: cap.description }),
    S.withConstructorDefault(fallback),
    S.withDecodingDefaultTypeKey(fallback)
  );
};

/**
 * Caps that keep a hostile file in the typed channel. Text caps count UTF-16 units; the byte cap is a `ByteSize`.
 *
 * **Details**
 *
 * Defaults: 10,000,000 records, 100,000 cells per record, 10,000,000 padding cells, 16 Mi units per cell, 64 Mi
 * units per record, 1,000 kept warnings, `MAX_TEXT_UNITS` units of text in all and 256 MiB of input. Every count is
 * an integer of at least 1: records at most 2,147,483,647, cells per record at most `MAX_FIELDS`, and padding cells,
 * lengths and warnings at most `MAX_TEXT_UNITS`.
 *
 * `maxPaddingCells` counts only the empty cells `ragged: "pad"` adds to short records, across the whole read, a
 * stream's included. Cells read from text never count: the text and byte caps already bound them, so the cap rejects
 * no input that an unpadded read accepts. Padding makes cells out of no text, so without it a wide first record and
 * many one-cell records after it would pad to far more cells than the input holds. The default allows one padded
 * cell per record at the default record cap. A read fails with `LimitExceeded` `paddingCells` at the record whose
 * padding would pass the cap, before that record is padded.
 *
 * `maxTextLength` bounds the whole text a read takes in, the units after a byte-order mark and a `sep=` line, so
 * every position a read reports is a valid `CsvIndex`. A stream has no other length bound: past the cap it fails
 * with `LimitExceeded` `textLength` at the first unit it does not read, after the records before it.
 *
 * Passing a text cap or the byte cap ends the read with a `CsvParseError`. The warning cap does not: past
 * `maxWarnings` the read stops building warnings, counts them, and ends its warnings with one `WarningsTruncated`.
 * The byte cap applies to byte input (`parseBytes*`, `fromBytes`, `decode`, `decodeSchema`); a channel fails as
 * soon as its running count passes the cap, so its `TooManyBytes.actual` is the count at that point, not the input's
 * full size. Text input is bounded by the text caps alone.
 *
 * **Example** (Tighten one cap and keep the rest)
 *
 * ```ts import.meta.vitest name="Tighten one cap and keep the rest"
 * import { CsvLimits } from "@beep/csv/CsvOptions.schema"
 * import { MAX_TEXT_UNITS } from "@beep/csv/CsvPosition.schema"
 * import * as ByteSize from "effect/ByteSize"
 *
 * const limits = CsvLimits.make({ maxRecords: 1000 })
 * limits.maxRecords // => 1000
 * limits.maxFieldsPerRecord // => 100000
 * limits.maxPaddingCells // => 10000000
 * limits.maxWarnings // => 1000
 * limits.maxTextLength // => MAX_TEXT_UNITS
 * limits.maxInputBytes // => ByteSize.mebibytes(256)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvLimits extends S.Opaque<CsvLimits, { readonly brand: unique symbol }>()(
  S.Struct({
    maxRecords: count({ maximum: 2_147_483_647, fallback: 10_000_000, description: "Most records read" }),
    maxFieldsPerRecord: count({ maximum: MAX_FIELDS, fallback: 100_000, description: "Most cells in one record" }),
    maxPaddingCells: count({
      maximum: MAX_TEXT_UNITS,
      fallback: 10_000_000,
      description: "Most empty cells padding adds to short records, across every record read",
    }),
    maxFieldLength: count({
      maximum: MAX_TEXT_UNITS,
      fallback: 16 * 1024 * 1024,
      description: "Most UTF-16 units in one cell",
    }),
    maxRecordLength: count({
      maximum: MAX_TEXT_UNITS,
      fallback: 64 * 1024 * 1024,
      description: "Most UTF-16 units in one record, its line break not counted",
    }),
    maxWarnings: count({
      maximum: MAX_TEXT_UNITS,
      fallback: 1000,
      description: "Most warnings kept; the rest are counted in one WarningsTruncated",
    }),
    maxTextLength: count({
      maximum: MAX_TEXT_UNITS,
      fallback: MAX_TEXT_UNITS,
      description:
        "Most UTF-16 units read in all, after a byte-order mark and a sep= line; every position is within it",
    }),
    maxInputBytes: S.ByteSize.pipe(
      S.annotateKey({ description: "Most input bytes read" }),
      S.withConstructorDefault(Effect.sync(() => ByteSize.mebibytes(256))),
      S.withDecodingDefaultTypeKey(Effect.sync(() => ByteSize.mebibytes(256)))
    ),
  }).pipe($I.annoteSchema("CsvLimits", { description: "Caps that keep a hostile file in the typed channel" }))
) {}

/**
 * How a CSV is read. `CsvReadOptions.default` (every default) reads leniently and detects the delimiter and the
 * encoding.
 *
 * **Example** (Read semicolons strictly)
 *
 * ```ts import.meta.vitest name="Read semicolons strictly"
 * import { CsvFixedDelimiter, CsvReadOptions } from "@beep/csv/CsvOptions.schema"
 *
 * const options = CsvReadOptions.make({ delimiter: CsvFixedDelimiter.make({ delimiter: ";" }), quotes: "strict" })
 * options.quotes // => "strict"
 * options.ragged // => "keep"
 * CsvReadOptions.default.quotes // => "lenient"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvReadOptions extends S.Opaque<CsvReadOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    delimiter: CsvDelimiterChoice.pipe(
      S.annotateKey({ description: "How the delimiter is chosen" }),
      S.withConstructorDefault(Effect.sync(() => CsvDetectDelimiter.make({}))),
      S.withDecodingDefaultTypeKey(Effect.sync(() => CsvDetectDelimiter.make({})))
    ),
    encoding: CsvEncodingChoice.pipe(
      S.annotateKey({ description: "How the encoding of bytes is chosen" }),
      S.withConstructorDefault(Effect.sync(() => CsvDetectEncoding.make({}))),
      S.withDecodingDefaultTypeKey(Effect.sync(() => CsvDetectEncoding.make({})))
    ),
    quotes: CsvQuoteRule.pipe(
      S.annotateKey({ description: "Whether a misplaced quote is read past or stops the read" }),
      S.withConstructorDefault(Effect.succeed("lenient" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("lenient" as const))
    ),
    ragged: CsvRaggedRule.pipe(
      S.annotateKey({ description: "What happens to a record wider or narrower than the first" }),
      S.withConstructorDefault(Effect.succeed("keep" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("keep" as const))
    ),
    blankLines: CsvBlankLineRule.pipe(
      S.annotateKey({ description: "Whether a blank line is kept or skipped" }),
      S.withConstructorDefault(Effect.succeed("keep" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("keep" as const))
    ),
    trim: CsvTrimRule.pipe(
      S.annotateKey({ description: "Which cells lose surrounding spaces" }),
      S.withConstructorDefault(Effect.succeed("none" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("none" as const))
    ),
    excelSepHint: S.Boolean.pipe(
      S.annotateKey({ description: "Whether a first line `sep=;` sets the delimiter" }),
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
    limits: CsvLimits.pipe(
      S.withConstructorDefault(Effect.sync(() => CsvLimits.make({}))),
      S.annotateKey({ description: "The caps" }),
      S.withDecodingDefaultTypeKey(Effect.sync(() => CsvLimits.make({})))
    ),
  }).pipe($I.annoteSchema("CsvReadOptions", { description: "How a CSV is read" }))
) {
  /** Every default: lenient quotes, detected delimiter and encoding, ragged records kept, blank lines kept. */
  static readonly default: CsvReadOptions = CsvReadOptions.make({});
}

/**
 * The line break written after each record. A lone CR is read but never written.
 *
 * **Example** (Accept the written line breaks)
 *
 * ```ts import.meta.vitest name="Accept the written line breaks"
 * import { CsvTerminator } from "@beep/csv/CsvOptions.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvTerminator)("LF") // => true
 * S.is(CsvTerminator)("CR") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvTerminator = LiteralKit(["CRLF", "LF"]).pipe(
  $I.annoteSchema("CsvTerminator", { description: "The line break written after each record" })
);

/**
 * One of the line breaks {@link CsvTerminator} admits.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvTerminator = typeof CsvTerminator.Type;

/**
 * Which cells are quoted when written: only those that need it, or all.
 *
 * **Example** (Accept the quote styles)
 *
 * ```ts import.meta.vitest name="Accept the quote styles"
 * import { CsvQuoteStyle } from "@beep/csv/CsvOptions.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvQuoteStyle)("always") // => true
 * S.is(CsvQuoteStyle)("never") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvQuoteStyle = LiteralKit(["minimal", "always"]).pipe(
  $I.annoteSchema("CsvQuoteStyle", { description: "Which cells are quoted when written" })
);

/**
 * One of the styles {@link CsvQuoteStyle} admits.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvQuoteStyle = typeof CsvQuoteStyle.Type;

/**
 * Whether a written cell that a spreadsheet would run as a formula is defused with a leading apostrophe.
 *
 * **Details**
 *
 * `apostrophe` prefixes `'` to every cell whose first character is `=`, `+`, `-`, `@`, a tab or a carriage return
 * (the OWASP list). It looks at the first character only: a cell that starts with a space before `=`, or with a
 * full-width `＝`, is written unchanged.
 *
 * **Gotchas**
 *
 * A guarded table does not read back as itself: `-40` is written `'-40` and reads back as `'-40`. The round trip
 * holds only under `none`, the default.
 *
 * **Example** (Defuse a formula when writing)
 *
 * ```ts import.meta.vitest name="Defuse a formula when writing"
 * import { Csv } from "@beep/csv/Csv.codec"
 * import { CsvWriteOptions } from "@beep/csv/CsvOptions.schema"
 * import { CsvTable } from "@beep/csv/CsvTable.schema"
 *
 * const table = CsvTable.make({ records: [["=SUM(A1:A9)", "-40", "Bolt"]] })
 * Csv.stringify(table, CsvWriteOptions.make({ formulaGuard: "apostrophe" })) // => "'=SUM(A1:A9),'-40,Bolt\r\n"
 * Csv.stringify(table) // => "=SUM(A1:A9),-40,Bolt\r\n"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvFormulaGuard = LiteralKit(["none", "apostrophe"]).pipe(
  $I.annoteSchema("CsvFormulaGuard", { description: "Whether a cell a spreadsheet would run as a formula is defused" })
);

/**
 * One of the guards {@link CsvFormulaGuard} admits.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvFormulaGuard = typeof CsvFormulaGuard.Type;

/**
 * How a CSV is written. `CsvWriteOptions.default` writes commas, CRLF after every record, minimal quoting, no BOM
 * and no formula guard. Every combination reads back as the same table under the same fixed delimiter, with or
 * without `excelSepHint` and the other read rules at their defaults, except a `formulaGuard` of `apostrophe`, which
 * changes the cells it defuses.
 *
 * **Example** (Write LF line breaks)
 *
 * ```ts import.meta.vitest name="Write LF line breaks"
 * import { CsvWriteOptions } from "@beep/csv/CsvOptions.schema"
 *
 * const options = CsvWriteOptions.make({ terminator: "LF" })
 * options.terminator // => "LF"
 * options.delimiter // => ","
 * CsvWriteOptions.default.terminator // => "CRLF"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvWriteOptions extends S.Opaque<CsvWriteOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    delimiter: CsvDelimiter.pipe(
      S.annotateKey({ description: "The delimiter written" }),
      S.withConstructorDefault(Effect.succeed("," as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("," as const))
    ),
    terminator: CsvTerminator.pipe(
      S.annotateKey({ description: "The line break after each record" }),
      S.withConstructorDefault(Effect.succeed("CRLF" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("CRLF" as const))
    ),
    finalTerminator: S.Boolean.pipe(
      S.annotateKey({ description: "Whether the last record ends with a line break" }),
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    ),
    quoteStyle: CsvQuoteStyle.pipe(
      S.annotateKey({ description: "Which cells are quoted" }),
      S.withConstructorDefault(Effect.succeed("minimal" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("minimal" as const))
    ),
    bom: S.Boolean.pipe(
      S.annotateKey({ description: "Whether the text starts with a byte-order mark" }),
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
    formulaGuard: CsvFormulaGuard.pipe(
      S.annotateKey({
        description: "Whether formula-like cells are defused; a guarded table does not read back as itself",
      }),
      S.withConstructorDefault(Effect.succeed("none" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("none" as const))
    ),
  }).pipe($I.annoteSchema("CsvWriteOptions", { description: "How a CSV is written" }))
) {
  /** Every default. */
  static readonly default: CsvWriteOptions = CsvWriteOptions.make({});
}

const commaRead = CsvReadOptions.make({ delimiter: CsvFixedDelimiter.make({ delimiter: "," }) });

/**
 * The options of a CSV codec: how it reads and how it writes. Left out, `write` is `CsvWriteOptions.default` and
 * `read` is `CsvReadOptions.default` with the delimiter fixed to the comma that `write` writes, so the default
 * codec reads back exactly what it wrote.
 *
 * **Gotchas**
 *
 * The two sides are set apart: a codec that writes another delimiter must fix `read.delimiter` to the same character,
 * and a codec whose `read` detects the delimiter can read a table back split differently from how it was written.
 *
 * **Example** (Read and write semicolons)
 *
 * ```ts import.meta.vitest name="Read and write semicolons"
 * import { CsvCodecOptions, CsvFixedDelimiter, CsvReadOptions, CsvWriteOptions } from "@beep/csv/CsvOptions.schema"
 *
 * const options = CsvCodecOptions.make({
 *   read: CsvReadOptions.make({ delimiter: CsvFixedDelimiter.make({ delimiter: ";" }) }),
 *   write: CsvWriteOptions.make({ delimiter: ";" }),
 * })
 * options.write.quoteStyle // => "minimal"
 * CsvCodecOptions.default.read.delimiter.kind // => "fixed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvCodecOptions extends S.Opaque<CsvCodecOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    read: CsvReadOptions.pipe(
      S.withConstructorDefault(Effect.succeed(commaRead)),
      S.annotateKey({ description: "How the codec decodes; by default with the comma it writes" }),
      S.withDecodingDefaultTypeKey(Effect.succeed(commaRead))
    ),
    write: CsvWriteOptions.pipe(
      S.withConstructorDefault(Effect.sync(() => CsvWriteOptions.default)),
      S.annotateKey({ description: "How the codec encodes" }),
      S.withDecodingDefaultTypeKey(Effect.sync(() => CsvWriteOptions.default))
    ),
  }).pipe($I.annoteSchema("CsvCodecOptions", { description: "How a CSV codec reads and writes" }))
) {
  /** Every default. */
  static readonly default: CsvCodecOptions = CsvCodecOptions.make({});
}
