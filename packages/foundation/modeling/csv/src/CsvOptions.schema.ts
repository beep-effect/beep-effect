/**
 * How a CSV is read and written. A choice that carries data (the delimiter, the encoding) is a tagged union; a choice
 * between plain modes is a `LiteralKit`, and the behaviour that depends on it sits beside it. Every field has its
 * starting value on the schema, so `CsvReadOptions.make({})` is the default read.
 *
 * @packageDocumentation
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
 * @category schemas
 */
export const CsvDelimiter = LiteralKit([",", ";", "\t", "|"]).pipe(
  $I.annoteSchema("CsvDelimiter", { description: "A field separator the reader knows" })
);

/**
 * Runtime type of {@link CsvDelimiter}.
 *
 * @category models
 */
export type CsvDelimiter = typeof CsvDelimiter.Type;

/**
 * The plural a person reads for each delimiter ("Columns are separated by semicolons").
 *
 * @category utilities
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
 * @category models
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
 * Use one delimiter.
 *
 * @category models
 */
export class CsvFixedDelimiter extends S.Opaque<CsvFixedDelimiter, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("fixed"),
    delimiter: CsvDelimiter.pipe(S.annotateKey({ description: "The delimiter to use" })),
  }).pipe($I.annoteSchema("CsvFixedDelimiter", { description: "Use one delimiter" }))
) {}

/**
 * How the delimiter is chosen.
 *
 * @category schemas
 */
export const CsvDelimiterChoice = LiteralKit(["detect", "fixed"])
  .mapMembers(() => Tuple.make(CsvDetectDelimiter, CsvFixedDelimiter))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("CsvDelimiterChoice", { description: "How the delimiter is chosen" }));

/**
 * Runtime type of {@link CsvDelimiterChoice}.
 *
 * @category models
 */
export type CsvDelimiterChoice = typeof CsvDelimiterChoice.Type;

/**
 * The text encodings the reader knows. `effect/Schema` has no text-encoding schema, so they are named here.
 *
 * @category schemas
 */
export const CsvEncodingName = LiteralKit(["utf-8", "utf-16le", "utf-16be", "windows-1252"]).pipe(
  $I.annoteSchema("CsvEncodingName", { description: "A text encoding the reader knows" })
);

/**
 * Runtime type of {@link CsvEncodingName}.
 *
 * @category models
 */
export type CsvEncodingName = typeof CsvEncodingName.Type;

/**
 * Decide the encoding from a byte-order mark, then from whether the first `window` bytes are valid UTF-8.
 *
 * @category models
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
 * Read the bytes in one encoding.
 *
 * @category models
 */
export class CsvFixedEncoding extends S.Opaque<CsvFixedEncoding, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("fixed"),
    encoding: CsvEncodingName.pipe(S.annotateKey({ description: "The encoding to use" })),
  }).pipe($I.annoteSchema("CsvFixedEncoding", { description: "Read the bytes in one encoding" }))
) {}

/**
 * How the encoding of bytes is chosen.
 *
 * @category schemas
 */
export const CsvEncodingChoice = LiteralKit(["detect", "fixed"])
  .mapMembers(() => Tuple.make(CsvDetectEncoding, CsvFixedEncoding))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("CsvEncodingChoice", { description: "How the encoding is chosen" }));

/**
 * Runtime type of {@link CsvEncodingChoice}.
 *
 * @category models
 */
export type CsvEncodingChoice = typeof CsvEncodingChoice.Type;

/**
 * Whether a misplaced quote is read past (`lenient`, the default) or stops the read (`strict`, RFC 4180 as Effect's
 * `Csv` reads it).
 *
 * @category schemas
 */
export const CsvQuoteRule = LiteralKit(["lenient", "strict"]).pipe(
  $I.annoteSchema("CsvQuoteRule", { description: "Whether a misplaced quote is read past or stops the read" })
);

/**
 * Runtime type of {@link CsvQuoteRule}.
 *
 * @category models
 */
export type CsvQuoteRule = typeof CsvQuoteRule.Type;

/**
 * How serious a quoting finding is under a rule: a warning when lenient, fatal when strict.
 *
 * @category utilities
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
 * @category schemas
 */
export const CsvRaggedRule = LiteralKit(["keep", "pad", "reject"]).pipe(
  $I.annoteSchema("CsvRaggedRule", { description: "What happens to a record wider or narrower than the first" })
);

/**
 * Runtime type of {@link CsvRaggedRule}.
 *
 * @category models
 */
export type CsvRaggedRule = typeof CsvRaggedRule.Type;

/**
 * How serious a ragged record is under a rule.
 *
 * @category utilities
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
 * @category schemas
 */
export const CsvBlankLineRule = LiteralKit(["keep", "skip"]).pipe(
  $I.annoteSchema("CsvBlankLineRule", { description: "Whether a blank line is kept or skipped" })
);

/**
 * Runtime type of {@link CsvBlankLineRule}.
 *
 * @category models
 */
export type CsvBlankLineRule = typeof CsvBlankLineRule.Type;

/**
 * Which cells lose surrounding spaces: none, only unquoted ones, or all.
 *
 * @category schemas
 */
export const CsvTrimRule = LiteralKit(["none", "unquoted", "all"]).pipe(
  $I.annoteSchema("CsvTrimRule", { description: "Which cells lose surrounding spaces" })
);

/**
 * Runtime type of {@link CsvTrimRule}.
 *
 * @category models
 */
export type CsvTrimRule = typeof CsvTrimRule.Type;

/**
 * A cell after the trim rule, given whether it was quoted.
 *
 * @category utilities
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
 * @category models
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
 * ```ts
 * import { CsvFixedDelimiter, CsvReadOptions } from "@beep/csv/CsvOptions"
 *
 * const options = CsvReadOptions.make({ delimiter: CsvFixedDelimiter.make({ delimiter: ";" }), quotes: "strict" })
 * options.ragged // => "keep"
 * ```
 *
 * @category models
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
 * The line break written after each record.
 *
 * @category schemas
 */
export const CsvTerminator = LiteralKit(["CRLF", "LF"]).pipe(
  $I.annoteSchema("CsvTerminator", { description: "The line break written after each record" })
);

/**
 * Runtime type of {@link CsvTerminator}.
 *
 * @category models
 */
export type CsvTerminator = typeof CsvTerminator.Type;

/**
 * Which cells are quoted when written: only those that need it, or all.
 *
 * @category schemas
 */
export const CsvQuoteStyle = LiteralKit(["minimal", "always"]).pipe(
  $I.annoteSchema("CsvQuoteStyle", { description: "Which cells are quoted when written" })
);

/**
 * Runtime type of {@link CsvQuoteStyle}.
 *
 * @category models
 */
export type CsvQuoteStyle = typeof CsvQuoteStyle.Type;

/**
 * Whether a written cell that a spreadsheet would run as a formula is defused with a leading apostrophe.
 *
 * @category schemas
 */
export const CsvFormulaGuard = LiteralKit(["none", "apostrophe"]).pipe(
  $I.annoteSchema("CsvFormulaGuard", { description: "Whether a cell a spreadsheet would run as a formula is defused" })
);

/**
 * Runtime type of {@link CsvFormulaGuard}.
 *
 * @category models
 */
export type CsvFormulaGuard = typeof CsvFormulaGuard.Type;

const formulaStart = /^[=+\-@\t\r]/;

/**
 * A cell after the formula guard: `apostrophe` prefixes `'` to a cell starting with `=`, `+`, `-`, `@`, tab or
 * carriage return.
 *
 * @category utilities
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
 * @category models
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
 * The options of a CSV codec: how it reads and how it writes.
 *
 * @category models
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
