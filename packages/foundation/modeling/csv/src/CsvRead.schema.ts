/**
 * What a read returns: the table and how it was read. The parts that vary (how the delimiter was found, whether the
 * input was text or bytes and how its encoding was found, whether anything odd was read past) are tagged unions, so
 * no part is optional and each case carries exactly its own data.
 *
 * @packageDocumentation
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

/** @category models */
export class CsvDelimiterGiven extends S.Opaque<CsvDelimiterGiven, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("given"), delimiter }).pipe(
    $I.annoteSchema("CsvDelimiterGiven", { description: "The delimiter was fixed by the options" })
  )
) {}

/** @category models */
export class CsvDelimiterDetected extends S.Opaque<CsvDelimiterDetected, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("detected"), delimiter }).pipe(
    $I.annoteSchema("CsvDelimiterDetected", { description: "The delimiter was detected from the first records" })
  )
) {}

/** @category models */
export class CsvDelimiterFromSepLine extends S.Opaque<CsvDelimiterFromSepLine, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("sepLine"), delimiter }).pipe(
    $I.annoteSchema("CsvDelimiterFromSepLine", { description: "The delimiter came from a first line such as sep=;" })
  )
) {}

/** @category models */
export class CsvDelimiterFallback extends S.Opaque<CsvDelimiterFallback, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("fallback"), delimiter: S.tag(",") }).pipe(
    $I.annoteSchema("CsvDelimiterFallback", {
      description: "No candidate split the first records consistently, so a comma was used",
    })
  )
) {}

/**
 * How the delimiter was found.
 *
 * @category schemas
 */
export const CsvDelimiterFound = LiteralKit(["given", "detected", "sepLine", "fallback"])
  .mapMembers(() => Tuple.make(CsvDelimiterGiven, CsvDelimiterDetected, CsvDelimiterFromSepLine, CsvDelimiterFallback))
  .pipe(S.toTaggedUnion("how"), $I.annoteSchema("CsvDelimiterFound", { description: "How the delimiter was found" }));

/**
 * Runtime type of {@link CsvDelimiterFound}.
 *
 * @category models
 */
export type CsvDelimiterFound = typeof CsvDelimiterFound.Type;

/** @category models */
export class CsvEncodingFromBom extends S.Opaque<CsvEncodingFromBom, { readonly brand: unique symbol }>()(
  S.Struct({
    how: S.tag("bom"),
    encoding: CsvEncodingName.pick(["utf-8", "utf-16le", "utf-16be"]).pipe(
      S.annotateKey({ description: "The encoding the byte-order mark names" })
    ),
  }).pipe($I.annoteSchema("CsvEncodingFromBom", { description: "A byte-order mark named the encoding" }))
) {}

/** @category models */
export class CsvEncodingValidUtf8 extends S.Opaque<CsvEncodingValidUtf8, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("valid"), encoding: S.tag("utf-8") }).pipe(
    $I.annoteSchema("CsvEncodingValidUtf8", { description: "The bytes were valid UTF-8" })
  )
) {}

/** @category models */
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

/** @category models */
export class CsvEncodingGiven extends S.Opaque<CsvEncodingGiven, { readonly brand: unique symbol }>()(
  S.Struct({
    how: S.tag("given"),
    encoding: CsvEncodingName.pipe(S.annotateKey({ description: "The encoding the options fixed" })),
    bom: S.Boolean.pipe(S.annotateKey({ description: "Whether a byte-order mark was stripped" })),
  }).pipe($I.annoteSchema("CsvEncodingGiven", { description: "The options fixed the encoding" }))
) {}

/**
 * How the encoding of bytes was found.
 *
 * @category schemas
 */
export const CsvEncodingFound = LiteralKit(["bom", "valid", "fallback", "given"])
  .mapMembers(() => Tuple.make(CsvEncodingFromBom, CsvEncodingValidUtf8, CsvEncodingFallback, CsvEncodingGiven))
  .pipe(S.toTaggedUnion("how"), $I.annoteSchema("CsvEncodingFound", { description: "How the encoding was found" }));

/**
 * Runtime type of {@link CsvEncodingFound}.
 *
 * @category models
 */
export type CsvEncodingFound = typeof CsvEncodingFound.Type;

/** @category models */
export class CsvFromText extends S.Opaque<CsvFromText, { readonly brand: unique symbol }>()(
  S.Struct({
    input: S.tag("text"),
    bom: S.Boolean.pipe(S.annotateKey({ description: "Whether a byte-order mark was stripped" })),
  }).pipe($I.annoteSchema("CsvFromText", { description: "The input was text" }))
) {}

/** @category models */
export class CsvFromBytes extends S.Opaque<CsvFromBytes, { readonly brand: unique symbol }>()(
  S.Struct({
    input: S.tag("bytes"),
    encoding: CsvEncodingFound.pipe(S.annotateKey({ description: "How the encoding was found" })),
    bytes: S.ByteSize.pipe(S.annotateKey({ description: "How many bytes were read" })),
  }).pipe($I.annoteSchema("CsvFromBytes", { description: "The input was bytes" }))
) {}

/**
 * Whether the input was text or bytes, and what was learned from the bytes.
 *
 * @category schemas
 */
export const CsvSource = LiteralKit(["text", "bytes"])
  .mapMembers(() => Tuple.make(CsvFromText, CsvFromBytes))
  .pipe(S.toTaggedUnion("input"), $I.annoteSchema("CsvSource", { description: "What the input was" }));

/**
 * Runtime type of {@link CsvSource}.
 *
 * @category models
 */
export type CsvSource = typeof CsvSource.Type;

/** @category models */
export class CsvClean extends S.Opaque<CsvClean, { readonly brand: unique symbol }>()(
  S.Struct({ outcome: S.tag("clean") }).pipe($I.annoteSchema("CsvClean", { description: "Nothing odd was found" }))
) {}

/** @category models */
export class CsvNoted extends S.Opaque<CsvNoted, { readonly brand: unique symbol }>()(
  S.Struct({
    outcome: S.tag("noted"),
    warnings: S.NonEmptyArray(CsvWarning.annotateKey({ description: "One warning" })).pipe(
      S.annotateKey({ description: "Every oddity read past, in file order" })
    ),
  }).pipe($I.annoteSchema("CsvNoted", { description: "Read, with oddities to show the person" }))
) {}

/**
 * Whether the read found oddities.
 *
 * @category schemas
 */
export const CsvOutcome = LiteralKit(["clean", "noted"])
  .mapMembers(() => Tuple.make(CsvClean, CsvNoted))
  .pipe(S.toTaggedUnion("outcome"), $I.annoteSchema("CsvOutcome", { description: "Whether the read found oddities" }));

/**
 * Runtime type of {@link CsvOutcome}.
 *
 * @category models
 */
export type CsvOutcome = typeof CsvOutcome.Type;

/**
 * What a read returns: the table, how its delimiter was found, what the input was, and what was read past.
 *
 * @category models
 */
export class CsvRead extends S.Opaque<CsvRead, { readonly brand: unique symbol }>()(
  S.Struct({
    table: CsvTable.pipe(S.annotateKey({ description: "The records read" })),
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
