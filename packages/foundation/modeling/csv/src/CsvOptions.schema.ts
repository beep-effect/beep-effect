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
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { CsvDiagnostic } from "./CsvDiagnostic.schema.ts";
import { MAX_TEXT_UNITS } from "./CsvPosition.schema.ts";
import { MAX_FIELDS } from "./CsvTable.schema.ts";
import type { RaggedRecord, StrayQuote, TextAfterClosingQuote } from "./CsvDiagnostic.schema.ts";

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

/**
 * The plural a person reads for each delimiter ("Columns are separated by semicolons").
 *
 * **Example** (Name a delimiter for a person)
 *
 * ```ts import.meta.vitest name="Name a delimiter for a person"
 * import { delimiterName } from "@beep/csv/CsvOptions.schema"
 *
 * const sentence = `Columns are separated by ${delimiterName("\t")}`
 * sentence // => "Columns are separated by tabs"
 * delimiterName(";") // => "semicolons"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const delimiterName = CsvDelimiter.match({
  ",": () => "commas",
  ";": () => "semicolons",
  "\t": () => "tabs",
  "|": () => "vertical bars",
});

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
 * import * as S from "effect/Schema"
 *
 * const choice = S.decodeUnknownSync(CsvDelimiterChoice)({ kind: "detect" })
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
 * Decide the encoding from a byte-order mark, then from whether the first `window` bytes are valid UTF-8.
 *
 * **Details**
 *
 * The window matters only to streams, which must settle the encoding before the input ends. A whole byte input is
 * checked in full, and bytes that are not UTF-8 are read as Windows-1252.
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
    window: S.ByteSize.pipe(
      S.annotateKey({ description: "How many leading bytes a stream decides from" }),
      S.withConstructorDefault(Effect.sync(() => ByteSize.kibibytes(64))),
      S.withDecodingDefaultTypeKey(Effect.sync(() => ByteSize.kibibytes(64)))
    ),
  }).pipe($I.annoteSchema("CsvDetectEncoding", { description: "Decide the encoding from the bytes" }))
) {}

/**
 * Read the bytes in one encoding. A fixed UTF-8 still refuses bytes that are not UTF-8 rather than falling back.
 *
 * **Example** (Fix the encoding to Windows-1252)
 *
 * ```ts import.meta.vitest name="Fix the encoding to Windows-1252"
 * import { CsvFixedEncoding } from "@beep/csv/CsvOptions.schema"
 *
 * CsvFixedEncoding.make({ encoding: "windows-1252" }).kind // => "fixed"
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
 * import * as S from "effect/Schema"
 *
 * const choice = S.decodeUnknownSync(CsvEncodingChoice)({ kind: "fixed", encoding: "utf-16le" })
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
 * How serious a quoting finding is under a rule: a warning when lenient, fatal when strict.
 *
 * **Example** (Judge a stray quote under both rules)
 *
 * ```ts import.meta.vitest name="Judge a stray quote under both rules"
 * import { StrayQuote } from "@beep/csv/CsvDiagnostic.schema"
 * import { judgeQuote } from "@beep/csv/CsvOptions.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 *
 * const finding = StrayQuote.make({ at: CsvTextSpan.locate('a,b"c', 3, 1), record: 0, field: 1 })
 * judgeQuote("lenient", finding).severity // => "warning"
 * judgeQuote(finding)("strict").severity // => "fatal"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const judgeQuote: {
  (finding: StrayQuote | TextAfterClosingQuote): (rule: CsvQuoteRule) => CsvDiagnostic;
  (rule: CsvQuoteRule, finding: StrayQuote | TextAfterClosingQuote): CsvDiagnostic;
} = dual(
  2,
  (rule: CsvQuoteRule, finding: StrayQuote | TextAfterClosingQuote): CsvDiagnostic =>
    CsvQuoteRule.match(rule, {
      lenient: () => CsvDiagnostic.cases.warning.make({ finding }),
      strict: () => CsvDiagnostic.cases.fatal.make({ finding }),
    })
);

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
 * How serious a ragged record is under a rule: a warning when kept or padded, fatal when rejected.
 *
 * **Example** (Judge a short record under each rule)
 *
 * ```ts import.meta.vitest name="Judge a short record under each rule"
 * import { RaggedRecord } from "@beep/csv/CsvDiagnostic.schema"
 * import { judgeRagged } from "@beep/csv/CsvOptions.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 *
 * const at = CsvTextSpan.locate("SKU,Name\nBRK-040\n", 9, 7)
 * const finding = RaggedRecord.make({ at, record: 1, expected: 2, actual: 1 })
 * judgeRagged("pad", finding).severity // => "warning"
 * judgeRagged(finding)("reject").severity // => "fatal"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const judgeRagged: {
  (finding: RaggedRecord): (rule: CsvRaggedRule) => CsvDiagnostic;
  (rule: CsvRaggedRule, finding: RaggedRecord): CsvDiagnostic;
} = dual(
  2,
  (rule: CsvRaggedRule, finding: RaggedRecord): CsvDiagnostic =>
    CsvRaggedRule.match(rule, {
      keep: () => CsvDiagnostic.cases.warning.make({ finding }),
      pad: () => CsvDiagnostic.cases.warning.make({ finding }),
      reject: () => CsvDiagnostic.cases.fatal.make({ finding }),
    })
);

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

/**
 * A cell after the trim rule, given whether it was quoted. Under `unquoted`, spaces inside quotes are kept because
 * the writer quoted them on purpose.
 *
 * **Example** (Trim only unquoted cells)
 *
 * ```ts import.meta.vitest name="Trim only unquoted cells"
 * import { applyTrim } from "@beep/csv/CsvOptions.schema"
 *
 * applyTrim("unquoted", "  Bracket ", false) // => "Bracket"
 * applyTrim("unquoted", "  Bracket ", true) // => "  Bracket "
 * applyTrim("  Bracket ", true)("all") // => "Bracket"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const applyTrim: {
  (cell: string, quoted: boolean): (rule: CsvTrimRule) => string;
  (rule: CsvTrimRule, cell: string, quoted: boolean): string;
} = dual(3, (rule: CsvTrimRule, cell: string, quoted: boolean): string =>
  CsvTrimRule.match(rule, {
    none: () => cell,
    unquoted: () => (quoted ? cell : Str.trim(cell)),
    all: () => Str.trim(cell),
  })
);

const count = (maximum: number, fallback: number, description: string) =>
  S.Int.check(S.isBetween({ minimum: 1, maximum })).pipe(
    S.annotateKey({ description }),
    S.withConstructorDefault(Effect.succeed(fallback)),
    S.withDecodingDefaultTypeKey(Effect.succeed(fallback))
  );

/**
 * Caps that keep a hostile file in the typed channel. Text caps count UTF-16 units; the byte cap is a `ByteSize`.
 *
 * **Details**
 *
 * Defaults: 10,000,000 records, 100,000 cells per record, 16 Mi units per cell, 64 Mi units per record and 256 MiB of
 * input. Every count is an integer of at least 1: records at most 2,147,483,647, cells per record at most
 * `MAX_FIELDS`, and lengths at most `MAX_TEXT_UNITS`.
 *
 * **Example** (Tighten one cap and keep the rest)
 *
 * ```ts import.meta.vitest name="Tighten one cap and keep the rest"
 * import { CsvLimits } from "@beep/csv/CsvOptions.schema"
 * import * as ByteSize from "effect/ByteSize"
 *
 * const limits = CsvLimits.make({ maxRecords: 1000 })
 * limits.maxRecords // => 1000
 * limits.maxFieldsPerRecord // => 100000
 * limits.maxInputBytes // => ByteSize.mebibytes(256)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvLimits extends S.Opaque<CsvLimits, { readonly brand: unique symbol }>()(
  S.Struct({
    maxRecords: count(2_147_483_647, 10_000_000, "Most records read"),
    maxFieldsPerRecord: count(MAX_FIELDS, 100_000, "Most cells in one record"),
    maxFieldLength: count(MAX_TEXT_UNITS, 16 * 1024 * 1024, "Most UTF-16 units in one cell"),
    maxRecordLength: count(MAX_TEXT_UNITS, 64 * 1024 * 1024, "Most UTF-16 units in one record"),
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
      S.annotateKey({ description: "The caps" }),
      S.withConstructorDefault(Effect.sync(() => CsvLimits.make({}))),
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
 * **Example** (Accept the formula guards)
 *
 * ```ts import.meta.vitest name="Accept the formula guards"
 * import { CsvFormulaGuard } from "@beep/csv/CsvOptions.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvFormulaGuard)("apostrophe") // => true
 * S.is(CsvFormulaGuard)("escape") // => false
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

const formulaStart = /^[=+\-@\t\r]/;

/**
 * A cell after the formula guard: `apostrophe` prefixes `'` to a cell starting with `=`, `+`, `-`, `@`, tab or
 * carriage return.
 *
 * **Gotchas**
 *
 * The guard looks only at the first character, so a negative number such as `-40` is prefixed too and no longer
 * reads back as the same cell.
 *
 * **Example** (Defuse a formula cell)
 *
 * ```ts import.meta.vitest name="Defuse a formula cell"
 * import { applyFormulaGuard } from "@beep/csv/CsvOptions.schema"
 *
 * applyFormulaGuard("apostrophe", "=SUM(A1:A9)") // => "'=SUM(A1:A9)"
 * applyFormulaGuard("apostrophe", "-40") // => "'-40"
 * applyFormulaGuard("Bracket")("apostrophe") // => "Bracket"
 * applyFormulaGuard("none", "=SUM(A1:A9)") // => "=SUM(A1:A9)"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const applyFormulaGuard: {
  (cell: string): (guard: CsvFormulaGuard) => string;
  (guard: CsvFormulaGuard, cell: string): string;
} = dual(2, (guard: CsvFormulaGuard, cell: string): string =>
  CsvFormulaGuard.match(guard, {
    none: () => cell,
    apostrophe: () => (formulaStart.test(cell) ? `'${cell}` : cell),
  })
);

/**
 * How a CSV is written. `CsvWriteOptions.default` writes commas, CRLF after every record, minimal quoting, no BOM
 * and no formula guard.
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
      S.annotateKey({ description: "Whether formula-like cells are defused" }),
      S.withConstructorDefault(Effect.succeed("none" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("none" as const))
    ),
  }).pipe($I.annoteSchema("CsvWriteOptions", { description: "How a CSV is written" }))
) {
  /** Every default. */
  static readonly default: CsvWriteOptions = CsvWriteOptions.make({});
}

/**
 * The options of a CSV codec: how it reads and how it writes. Either side left out takes its `default`.
 *
 * **Example** (Read strictly and write by default)
 *
 * ```ts import.meta.vitest name="Read strictly and write by default"
 * import { CsvCodecOptions, CsvReadOptions } from "@beep/csv/CsvOptions.schema"
 *
 * const options = CsvCodecOptions.make({ read: CsvReadOptions.make({ quotes: "strict" }) })
 * options.read.quotes // => "strict"
 * options.write.quoteStyle // => "minimal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvCodecOptions extends S.Opaque<CsvCodecOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    read: CsvReadOptions.pipe(
      S.annotateKey({ description: "How the codec decodes" }),
      S.withConstructorDefault(Effect.sync(() => CsvReadOptions.default)),
      S.withDecodingDefaultTypeKey(Effect.sync(() => CsvReadOptions.default))
    ),
    write: CsvWriteOptions.pipe(
      S.annotateKey({ description: "How the codec encodes" }),
      S.withConstructorDefault(Effect.sync(() => CsvWriteOptions.default)),
      S.withDecodingDefaultTypeKey(Effect.sync(() => CsvWriteOptions.default))
    ),
  }).pipe($I.annoteSchema("CsvCodecOptions", { description: "How a CSV codec reads and writes" }))
) {
  /** Every default. */
  static readonly default: CsvCodecOptions = CsvCodecOptions.make({});
}
