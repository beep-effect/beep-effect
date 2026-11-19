/**
 * The choices a read or a write takes: which sheets, the caps on what a file may hold or inflate to, and how the
 * written archive is compressed. Every choice has its starting value on its schema.
 *
 * @packageDocumentation
 */

import { $XlsxId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { MAX_COLUMN, MAX_ROW } from "./XlsxAddress.schema.ts";
import { MAX_CELL_CHARS } from "./XlsxCell.schema.ts";
import { XlsxSheetName } from "./XlsxWorkbook.schema.ts";

const $I = $XlsxId.create("XlsxOptions");

/** Read every sheet. */
export class XlsxAllSheets extends S.Opaque<XlsxAllSheets, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("All") }).pipe($I.annoteSchema("XlsxAllSheets", { description: "Read every sheet" }))
) {}

/** Read the sheets of these names, whatever the case; a name the workbook lacks is passed over. */
export class XlsxNamedSheets extends S.Opaque<XlsxNamedSheets, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("Named"),
    names: S.NonEmptyArray(XlsxSheetName.annotateKey({ description: "A sheet to read" })).pipe(
      S.annotateKey({ description: "The sheets to read" })
    ),
  }).pipe($I.annoteSchema("XlsxNamedSheets", { description: "Read the sheets of these names" }))
) {}

/** Read the first sheet only. */
export class XlsxFirstSheet extends S.Opaque<XlsxFirstSheet, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("First") }).pipe($I.annoteSchema("XlsxFirstSheet", { description: "Read the first sheet" }))
) {}

/**
 * Which sheets a read keeps. The others are still named, with no rows.
 *
 * @category schemas
 */
export const XlsxSheetChoice = LiteralKit(["All", "Named", "First"])
  .mapMembers(() => Tuple.make(XlsxAllSheets, XlsxNamedSheets, XlsxFirstSheet))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("XlsxSheetChoice", { description: "Which sheets a read keeps" }));

/**
 * Runtime type of {@link XlsxSheetChoice}.
 *
 * @category models
 */
export type XlsxSheetChoice = typeof XlsxSheetChoice.Type;

const count = (maximum: number, fallback: number, description: string) =>
  S.Int.check(S.isBetween({ minimum: 1, maximum })).pipe(
    S.annotateKey({ description }),
    S.withConstructorDefault(Effect.succeed(fallback)),
    S.withDecodingDefaultTypeKey(Effect.succeed(fallback))
  );

const size = (fallback: () => ByteSize.ByteSize, description: string) =>
  S.ByteSize.pipe(
    S.annotateKey({ description }),
    S.withConstructorDefault(Effect.sync(fallback)),
    S.withDecodingDefaultTypeKey(Effect.sync(fallback))
  );

/**
 * The caps a read holds a file to. They are counted as bytes are inflated, never taken from the sizes a file
 * declares, so a small file built to inflate without end stops at `maxInflatedBytes`.
 *
 * @category models
 */
export class XlsxLimits extends S.Opaque<XlsxLimits, { readonly brand: unique symbol }>()(
  S.Struct({
    maxInputBytes: size(() => ByteSize.mebibytes(3), "Most bytes the file itself may have"),
    maxInflatedBytes: size(() => ByteSize.mebibytes(64), "Most bytes all the file's parts may inflate to"),
    maxPartBytes: size(() => ByteSize.mebibytes(64), "Most bytes one part may inflate to"),
    maxParts: count(1_000_000, 10_000, "Most parts in the archive"),
    maxSheets: count(100_000, 1000, "Most sheets in the workbook"),
    maxSharedStrings: count(100_000_000, 2_000_000, "Most entries in the shared text table"),
    maxRows: count(MAX_ROW, MAX_ROW, "Most rows read from one sheet"),
    maxColumns: count(MAX_COLUMN + 1, MAX_COLUMN + 1, "Most columns a cell may be at"),
    maxCellChars: count(MAX_CELL_CHARS, MAX_CELL_CHARS, "Most characters in one cell"),
  }).pipe($I.annoteSchema("XlsxLimits", { description: "The caps a read holds a file to" }))
) {
  /** The starting caps: 3 MiB of file, 64 MiB inflated, a worksheet's own bounds. */
  static readonly default: XlsxLimits = XlsxLimits.make({});
}

/**
 * How a workbook is read.
 *
 * @category models
 */
export class XlsxReadOptions extends S.Opaque<XlsxReadOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    sheets: XlsxSheetChoice.pipe(
      S.annotateKey({ description: "Which sheets are read" }),
      S.withConstructorDefault(Effect.sync(() => XlsxAllSheets.make({}))),
      S.withDecodingDefaultTypeKey(Effect.sync(() => XlsxAllSheets.make({})))
    ),
    limits: XlsxLimits.pipe(
      S.annotateKey({ description: "The caps the file is held to" }),
      S.withConstructorDefault(Effect.sync(() => XlsxLimits.default)),
      S.withDecodingDefaultTypeKey(Effect.sync(() => XlsxLimits.default))
    ),
  }).pipe($I.annoteSchema("XlsxReadOptions", { description: "How a workbook is read" }))
) {
  /** Every sheet, under the starting caps. */
  static readonly default: XlsxReadOptions = XlsxReadOptions.make({});
}

/**
 * Whether the written archive's parts are deflated or stored as they are.
 *
 * @category schemas
 */
export const XlsxCompression = LiteralKit(["deflate", "store"]).pipe(
  $I.annoteSchema("XlsxCompression", { description: "Whether the written parts are deflated or stored" })
);

/**
 * Runtime type of {@link XlsxCompression}.
 *
 * @category models
 */
export type XlsxCompression = typeof XlsxCompression.Type;

/**
 * How a workbook is written.
 *
 * @category models
 */
export class XlsxWriteOptions extends S.Opaque<XlsxWriteOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    compression: XlsxCompression.pipe(
      S.annotateKey({ description: "Whether the parts are deflated or stored" }),
      S.withConstructorDefault(Effect.succeed("deflate" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("deflate" as const))
    ),
  }).pipe($I.annoteSchema("XlsxWriteOptions", { description: "How a workbook is written" }))
) {
  /** Deflated parts. */
  static readonly default: XlsxWriteOptions = XlsxWriteOptions.make({});
}

/**
 * The options of a codec: how it reads and how it writes.
 *
 * @category models
 */
export class XlsxCodecOptions extends S.Opaque<XlsxCodecOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    read: XlsxReadOptions.pipe(
      S.annotateKey({ description: "How the codec reads" }),
      S.withConstructorDefault(Effect.sync(() => XlsxReadOptions.default)),
      S.withDecodingDefaultTypeKey(Effect.sync(() => XlsxReadOptions.default))
    ),
    write: XlsxWriteOptions.pipe(
      S.annotateKey({ description: "How the codec writes" }),
      S.withConstructorDefault(Effect.sync(() => XlsxWriteOptions.default)),
      S.withDecodingDefaultTypeKey(Effect.sync(() => XlsxWriteOptions.default))
    ),
  }).pipe($I.annoteSchema("XlsxCodecOptions", { description: "How a codec reads and writes" }))
) {
  /** The starting options of both directions. */
  static readonly default: XlsxCodecOptions = XlsxCodecOptions.make({});
}
