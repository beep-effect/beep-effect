/**
 * What a read returns: the workbook and what was read past on the way.
 *
 * @packageDocumentation
 */

import { $XlsxId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { XlsxColumn, XlsxRange } from "./XlsxAddress.schema.ts";
import { XlsxWarning } from "./XlsxDiagnostic.schema.ts";
import { XlsxDateSystem } from "./XlsxSerial.schema.ts";
import { XlsxSheetCount, XlsxWorkbook } from "./XlsxWorkbook.schema.ts";
import type { XlsxDroppedKind } from "./XlsxWorkbook.schema.ts";

export { XlsxContainer } from "./XlsxDiagnostic.schema.ts";

const $I = $XlsxId.create("XlsxRead");

/**
 * A workbook that was read, with the oddities the read went past.
 *
 * @category models
 */
export class XlsxRead extends S.Opaque<XlsxRead, { readonly brand: unique symbol }>()(
  S.Struct({
    workbook: XlsxWorkbook.pipe(S.annotateKey({ description: "The workbook" })),
    warnings: S.Array(XlsxWarning.annotateKey({ description: "One oddity" })).pipe(
      S.annotateKey({ description: "What the read went past, in the order it was found" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
  }).pipe($I.annoteSchema("XlsxRead", { description: "A workbook and what was read past" }))
) {
  /** The kinds of part the file held that are not modelled, each once. */
  static readonly droppedKinds = (read: {
    readonly workbook: Pick<XlsxWorkbook, "dropped">;
  }): ReadonlyArray<XlsxDroppedKind> => A.dedupe(A.map(read.workbook.dropped, (part) => part.kind));
}

/**
 * One sheet in a workbook's outline: how much it holds, and what its XML says beside its rows.
 *
 * @category models
 */
export class XlsxSheetOutline extends S.Opaque<XlsxSheetOutline, { readonly brand: unique symbol }>()(
  S.Struct({
    count: XlsxSheetCount.pipe(S.annotateKey({ description: "How much the sheet holds" })),
    merges: S.Array(XlsxRange.annotateKey({ description: "One merged range" })).pipe(
      S.annotateKey({ description: "The merged ranges" })
    ),
    hiddenColumns: S.Array(XlsxColumn.annotateKey({ description: "One hidden column" })).pipe(
      S.annotateKey({ description: "The hidden columns" })
    ),
  }).pipe($I.annoteSchema("XlsxSheetOutline", { description: "One sheet, counted and not kept" }))
) {}

/**
 * A workbook without its rows: its date system and every sheet counted. What a sheet chooser needs, and what says
 * which sheet to read.
 *
 * @category models
 */
export class XlsxOutline extends S.Opaque<XlsxOutline, { readonly brand: unique symbol }>()(
  S.Struct({
    dateSystem: XlsxDateSystem.pipe(S.annotateKey({ description: "The day the workbook's date serials count from" })),
    sheets: S.Array(XlsxSheetOutline.annotateKey({ description: "One sheet" })).pipe(
      S.annotateKey({ description: "The sheets, in the workbook's order" })
    ),
  }).pipe($I.annoteSchema("XlsxOutline", { description: "A workbook's date system and its sheets, counted" }))
) {}
