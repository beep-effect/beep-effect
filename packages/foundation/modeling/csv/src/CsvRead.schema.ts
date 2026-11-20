/**
 * What a read returns: the table and how it was read. The parts that vary (how the delimiter was found, whether the
 * input was text or bytes and how its encoding was found, whether anything odd was read past) are tagged unions, so
 * no part is optional and each case carries exactly its own data.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CsvId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CsvWarning } from "./CsvDiagnostic.schema.ts";
import { CsvDelimiter, CsvEncodingName } from "./CsvOptions.schema.ts";
import { CsvByteOffset } from "./CsvPosition.schema.ts";
import { CsvTable } from "./CsvTable.schema.ts";

const $I = $CsvId.create("CsvRead");

const delimiter = CsvDelimiter.pipe(S.annotateKey({ description: "The delimiter the records were split by" }));

/**
 * The delimiter was fixed by the read options, so the records were split by exactly that character.
 *
 * **Example** (Record a delimiter the options fixed)
 *
 * ```ts import.meta.vitest name="Record a delimiter the options fixed"
 * import { CsvDelimiterGiven } from "@beep/csv/CsvRead.schema"
 *
 * const found = CsvDelimiterGiven.make({ delimiter: ";" })
 * found.how // => "given"
 * found.delimiter // => ";"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvDelimiterGiven extends S.Opaque<CsvDelimiterGiven, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("given"), delimiter }).pipe(
    $I.annoteSchema("CsvDelimiterGiven", { description: "The delimiter was fixed by the options" })
  )
) {}

/**
 * The delimiter was detected: one of the candidates split the first records into a consistent number of cells.
 *
 * **Example** (Detect tabs from the first records)
 *
 * ```ts import.meta.vitest name="Detect tabs from the first records"
 * import { Csv } from "@beep/csv/Csv.codec"
 * import { CsvDelimiterDetected } from "@beep/csv/CsvRead.schema"
 * import * as Result from "effect/Result"
 *
 * const read = Result.getOrThrow(Csv.parseResult("SKU\tName\tQty\nBRK-040\tBracket\t12\nBLT-0042\tBolt\t3\n"))
 * read.delimiter // => CsvDelimiterDetected.make({ delimiter: "\t" })
 * read.table.records[1] // => ["BRK-040", "Bracket", "12"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvDelimiterDetected extends S.Opaque<CsvDelimiterDetected, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("detected"), delimiter }).pipe(
    $I.annoteSchema("CsvDelimiterDetected", { description: "The delimiter was detected from the first records" })
  )
) {}

/**
 * The delimiter came from an Excel `sep=` first line, such as `sep=;`, which the read honours when
 * `excelSepHint` is on.
 *
 * **Example** (Record a delimiter from a sep line)
 *
 * ```ts import.meta.vitest name="Record a delimiter from a sep line"
 * import { CsvDelimiterFromSepLine } from "@beep/csv/CsvRead.schema"
 *
 * const found = CsvDelimiterFromSepLine.make({ delimiter: ";" })
 * found.how // => "sepLine"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvDelimiterFromSepLine extends S.Opaque<CsvDelimiterFromSepLine, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("sepLine"), delimiter }).pipe(
    $I.annoteSchema("CsvDelimiterFromSepLine", { description: "The delimiter came from a first line such as sep=;" })
  )
) {}

/**
 * No candidate split the first records consistently, so the records were split by commas. The delimiter is always
 * `,`, so `make` needs no fields.
 *
 * **Example** (Record the comma fallback)
 *
 * ```ts import.meta.vitest name="Record the comma fallback"
 * import { CsvDelimiterFallback } from "@beep/csv/CsvRead.schema"
 *
 * const found = CsvDelimiterFallback.make({})
 * found.delimiter // => ","
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvDelimiterFallback extends S.Opaque<CsvDelimiterFallback, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("fallback"), delimiter: S.tag(",") }).pipe(
    $I.annoteSchema("CsvDelimiterFallback", {
      description: "No candidate split the first records consistently, so a comma was used",
    })
  )
) {}

/**
 * How the delimiter was found, discriminated by `how`; every case carries the delimiter the records were split by.
 *
 * **Example** (Report how a delimiter was found)
 *
 * ```ts import.meta.vitest name="Report how a delimiter was found"
 * import { CsvDelimiterFallback, CsvDelimiterFound } from "@beep/csv/CsvRead.schema"
 *
 * const explain = CsvDelimiterFound.match({
 *   given: (found) => `split by ${found.delimiter}, as asked`,
 *   detected: (found) => `split by ${found.delimiter}, detected`,
 *   sepLine: (found) => `split by ${found.delimiter}, from the sep line`,
 *   fallback: () => "no delimiter fitted, split by commas",
 * })
 * explain(CsvDelimiterFallback.make({})) // => "no delimiter fitted, split by commas"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvDelimiterFound = LiteralKit(["given", "detected", "sepLine", "fallback"])
  .mapMembers(() => Tuple.make(CsvDelimiterGiven, CsvDelimiterDetected, CsvDelimiterFromSepLine, CsvDelimiterFallback))
  .pipe(S.toTaggedUnion("how"), $I.annoteSchema("CsvDelimiterFound", { description: "How the delimiter was found" }));

/**
 * One of the four ways {@link CsvDelimiterFound} records that the delimiter was found.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvDelimiterFound = typeof CsvDelimiterFound.Type;

/**
 * A byte-order mark at the start of the bytes named the encoding; the mark itself is not part of the text.
 *
 * **Example** (Record an encoding named by a byte-order mark)
 *
 * ```ts import.meta.vitest name="Record an encoding named by a byte-order mark"
 * import { CsvEncodingFromBom } from "@beep/csv/CsvRead.schema"
 *
 * const found = CsvEncodingFromBom.make({ encoding: "utf-16le" })
 * found.how // => "bom"
 * found.encoding // => "utf-16le"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvEncodingFromBom extends S.Opaque<CsvEncodingFromBom, { readonly brand: unique symbol }>()(
  S.Struct({
    how: S.tag("bom"),
    encoding: CsvEncodingName.pick(["utf-8", "utf-16le", "utf-16be"]).pipe(
      S.annotateKey({ description: "The encoding the byte-order mark names" })
    ),
  }).pipe($I.annoteSchema("CsvEncodingFromBom", { description: "A byte-order mark named the encoding" }))
) {}

/**
 * The bytes had no byte-order mark and were valid UTF-8 (a stream checks only its detection window), so they were read
 * as UTF-8.
 *
 * **Example** (Read bytes that are UTF-8 without a mark)
 *
 * ```ts import.meta.vitest name="Read bytes that are UTF-8 without a mark"
 * import { Csv } from "@beep/csv/Csv.codec"
 * import { CsvSource } from "@beep/csv/CsvRead.schema"
 * import * as Result from "effect/Result"
 *
 * const read = Result.getOrThrow(Csv.parseBytesResult(new TextEncoder().encode("Größe,Qty\n40 mm,12\n")))
 * CsvSource.guards.bytes(read.source) && read.source.encoding.how // => "valid"
 * read.table.records[0] // => ["Größe", "Qty"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvEncodingValidUtf8 extends S.Opaque<CsvEncodingValidUtf8, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("valid"), encoding: S.tag("utf-8") }).pipe(
    $I.annoteSchema("CsvEncodingValidUtf8", { description: "The bytes were valid UTF-8" })
  )
) {}

/**
 * The bytes were not UTF-8, so they were read as Windows-1252, the encoding Excel writes; `firstInvalidByte` says
 * where UTF-8 failed.
 *
 * **Example** (Read bytes Excel wrote in Windows-1252)
 *
 * ```ts import.meta.vitest name="Read bytes Excel wrote in Windows-1252"
 * import { Csv } from "@beep/csv/Csv.codec"
 * import { CsvEncodingFallback, CsvSource } from "@beep/csv/CsvRead.schema"
 * import * as Result from "effect/Result"
 *
 * // "Caf\xE9,1\n": the lone 0xE9 is not UTF-8
 * const read = Result.getOrThrow(Csv.parseBytesResult(Uint8Array.of(0x43, 0x61, 0x66, 0xe9, 0x2c, 0x31, 0x0a)))
 * CsvSource.guards.bytes(read.source) && read.source.encoding // => CsvEncodingFallback.make({ firstInvalidByte: 3 })
 * read.table.records // => [["Café", "1"]]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvEncodingFallback extends S.Opaque<CsvEncodingFallback, { readonly brand: unique symbol }>()(
  S.Struct({
    how: S.tag("fallback"),
    encoding: S.tag("windows-1252"),
    firstInvalidByte: CsvByteOffset.pipe(S.annotateKey({ description: "The first byte that is not UTF-8" })),
  }).pipe(
    $I.annoteSchema("CsvEncodingFallback", {
      description: "The bytes were not UTF-8, so they were read as Windows-1252, the encoding Excel writes",
    })
  )
) {}

/**
 * The read options fixed the encoding; `bom` says whether a byte-order mark was still found and stripped.
 *
 * **Example** (Record an encoding the options fixed)
 *
 * ```ts import.meta.vitest name="Record an encoding the options fixed"
 * import { CsvEncodingGiven } from "@beep/csv/CsvRead.schema"
 *
 * const found = CsvEncodingGiven.make({ encoding: "windows-1252", bom: false })
 * found.how // => "given"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvEncodingGiven extends S.Opaque<CsvEncodingGiven, { readonly brand: unique symbol }>()(
  S.Struct({
    how: S.tag("given"),
    encoding: CsvEncodingName.pipe(S.annotateKey({ description: "The encoding the options fixed" })),
    bom: S.Boolean.pipe(S.annotateKey({ description: "Whether a byte-order mark was stripped" })),
  }).pipe($I.annoteSchema("CsvEncodingGiven", { description: "The options fixed the encoding" }))
) {}

/**
 * How the encoding of bytes was found, discriminated by `how`; every case carries the encoding the bytes were read
 * in.
 *
 * **Example** (Pick out a guessed encoding)
 *
 * ```ts import.meta.vitest name="Pick out a guessed encoding"
 * import { CsvEncodingFallback, CsvEncodingFound, CsvEncodingFromBom } from "@beep/csv/CsvRead.schema"
 *
 * const guessed = CsvEncodingFound.guards.fallback
 * guessed(CsvEncodingFallback.make({ firstInvalidByte: 12 })) // => true
 * guessed(CsvEncodingFromBom.make({ encoding: "utf-8" })) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvEncodingFound = LiteralKit(["bom", "valid", "fallback", "given"])
  .mapMembers(() => Tuple.make(CsvEncodingFromBom, CsvEncodingValidUtf8, CsvEncodingFallback, CsvEncodingGiven))
  .pipe(S.toTaggedUnion("how"), $I.annoteSchema("CsvEncodingFound", { description: "How the encoding was found" }));

/**
 * One of the four ways {@link CsvEncodingFound} records that the encoding was found.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvEncodingFound = typeof CsvEncodingFound.Type;

/**
 * The input was already text, so no encoding was chosen; `bom` says whether a leading byte-order mark was stripped.
 *
 * **Example** (Record text input)
 *
 * ```ts import.meta.vitest name="Record text input"
 * import { CsvFromText } from "@beep/csv/CsvRead.schema"
 *
 * const source = CsvFromText.make({ bom: true })
 * source.input // => "text"
 * source.bom // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvFromText extends S.Opaque<CsvFromText, { readonly brand: unique symbol }>()(
  S.Struct({
    input: S.tag("text"),
    bom: S.Boolean.pipe(S.annotateKey({ description: "Whether a byte-order mark was stripped" })),
  }).pipe($I.annoteSchema("CsvFromText", { description: "The input was text" }))
) {}

/**
 * The input was bytes: how their encoding was found and how many were read.
 *
 * **Example** (Record byte input)
 *
 * ```ts import.meta.vitest name="Record byte input"
 * import { CsvEncodingValidUtf8, CsvFromBytes } from "@beep/csv/CsvRead.schema"
 * import * as ByteSize from "effect/ByteSize"
 *
 * const source = CsvFromBytes.make({ encoding: CsvEncodingValidUtf8.make({}), bytes: ByteSize.bytes(2048) })
 * source.encoding.encoding // => "utf-8"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvFromBytes extends S.Opaque<CsvFromBytes, { readonly brand: unique symbol }>()(
  S.Struct({
    input: S.tag("bytes"),
    encoding: CsvEncodingFound.pipe(S.annotateKey({ description: "How the encoding was found" })),
    bytes: S.ByteSize.pipe(S.annotateKey({ description: "How many bytes were read" })),
  }).pipe($I.annoteSchema("CsvFromBytes", { description: "The input was bytes" }))
) {}

/**
 * Whether the input was text or bytes, and what was learned from the bytes, discriminated by `input`.
 *
 * **Example** (Name the encoding a source was read in)
 *
 * ```ts import.meta.vitest name="Name the encoding a source was read in"
 * import { CsvEncodingFallback, CsvFromBytes, CsvFromText, CsvSource } from "@beep/csv/CsvRead.schema"
 * import * as ByteSize from "effect/ByteSize"
 *
 * const encodingOf = CsvSource.match({ text: () => "none, the input was text", bytes: (s) => s.encoding.encoding })
 * encodingOf(CsvFromText.make({ bom: false })) // => "none, the input was text"
 * const encoding = CsvEncodingFallback.make({ firstInvalidByte: 3 })
 * encodingOf(CsvFromBytes.make({ encoding, bytes: ByteSize.bytes(10) })) // => "windows-1252"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvSource = LiteralKit(["text", "bytes"])
  .mapMembers(() => Tuple.make(CsvFromText, CsvFromBytes))
  .pipe(S.toTaggedUnion("input"), $I.annoteSchema("CsvSource", { description: "What the input was" }));

/**
 * A {@link CsvFromText} or a {@link CsvFromBytes}.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvSource = typeof CsvSource.Type;

/**
 * The read found nothing odd. It is the default outcome of {@link CsvRead}.
 *
 * **Example** (Mark a clean read)
 *
 * ```ts import.meta.vitest name="Mark a clean read"
 * import { CsvClean } from "@beep/csv/CsvRead.schema"
 *
 * CsvClean.make({}).outcome // => "clean"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvClean extends S.Opaque<CsvClean, { readonly brand: unique symbol }>()(
  S.Struct({ outcome: S.tag("clean") }).pipe($I.annoteSchema("CsvClean", { description: "Nothing odd was found" }))
) {}

/**
 * The read returned its table and found oddities to show the person; `warnings` is never empty and is in file order.
 *
 * **Example** (Note a warning)
 *
 * ```ts import.meta.vitest name="Note a warning"
 * import { CsvWarning, StrayQuote } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 * import { CsvNoted } from "@beep/csv/CsvRead.schema"
 *
 * const stray = StrayQuote.make({ at: CsvTextSpan.locate('a,b"c', 3, 1), record: 0, field: 1 })
 * const noted = CsvNoted.make({ warnings: [CsvWarning.make({ finding: stray })] })
 * noted.warnings.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvNoted extends S.Opaque<CsvNoted, { readonly brand: unique symbol }>()(
  S.Struct({
    outcome: S.tag("noted"),
    warnings: S.NonEmptyArray(CsvWarning).pipe(S.annotateKey({ description: "Every oddity read past, in file order" })),
  }).pipe($I.annoteSchema("CsvNoted", { description: "Read, with oddities to show the person" }))
) {}

/**
 * Whether the read found oddities, discriminated by `outcome`. A clean read has no warnings field at all, so an empty
 * warning list cannot be stored.
 *
 * **Example** (Refuse a noted outcome with no warnings)
 *
 * ```ts import.meta.vitest name="Refuse a noted outcome with no warnings"
 * import { CsvOutcome } from "@beep/csv/CsvRead.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvOutcome)({ outcome: "clean" }) // => true
 * S.is(CsvOutcome)({ outcome: "noted", warnings: [] }) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvOutcome = LiteralKit(["clean", "noted"])
  .mapMembers(() => Tuple.make(CsvClean, CsvNoted))
  .pipe(S.toTaggedUnion("outcome"), $I.annoteSchema("CsvOutcome", { description: "Whether the read found oddities" }));

/**
 * A {@link CsvClean} or a {@link CsvNoted}.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvOutcome = typeof CsvOutcome.Type;

/**
 * What a read returns: the table, how its delimiter was found, what the input was, and what was read past.
 *
 * **Details**
 *
 * `outcome` defaults to {@link CsvClean} when constructed. `CsvRead.warnings` flattens the outcome into a possibly
 * empty array, for callers that only want to list what was read past.
 *
 * **Example** (List the warnings of a read)
 *
 * ```ts import.meta.vitest name="List the warnings of a read"
 * import { CsvDelimiterDetected, CsvFromText, CsvRead } from "@beep/csv/CsvRead.schema"
 * import { CsvTable } from "@beep/csv/CsvTable.schema"
 *
 * const read = CsvRead.make({
 *   table: CsvTable.make({ records: [["SKU", "Name"], ["BRK-040", "Bracket"]] }),
 *   delimiter: CsvDelimiterDetected.make({ delimiter: "," }),
 *   source: CsvFromText.make({ bom: false }),
 * })
 * read.outcome.outcome // => "clean"
 * CsvRead.warnings(read) // => []
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvRead extends S.Opaque<CsvRead, { readonly brand: unique symbol }>()(
  S.Struct({
    table: CsvTable,
    delimiter: CsvDelimiterFound.pipe(S.annotateKey({ description: "How the delimiter was found" })),
    source: CsvSource.pipe(S.annotateKey({ description: "What the input was" })),
    outcome: CsvOutcome.pipe(
      S.annotateKey({ description: "What was read past" }),
      S.withConstructorDefault(Effect.sync(() => CsvClean.make({})))
    ),
  }).pipe($I.annoteSchema("CsvRead", { description: "What a CSV read returns" }))
) {
  /** The warnings of a read, empty when it was clean. */
  static readonly warnings = (read: CsvRead): ReadonlyArray<CsvWarning> =>
    CsvOutcome.match(read.outcome, { clean: () => [], noted: (noted) => noted.warnings });
}
