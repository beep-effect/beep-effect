/**
 * The two ways this package fails: a file that cannot be read, with the finding that stopped it, and a workbook
 * that cannot be written.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XlsxId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { describeFinding, XlsxFatal } from "./XlsxDiagnostic.schema.ts";

const $I = $XlsxId.create("XlsxError");

/**
 * Why a workbook could not be read: the finding that stopped the read.
 *
 * **Example** (Recover from a file that is not a workbook)
 *
 * ```ts import.meta.vitest name="Recover from a file that is not a workbook"
 * import { Xlsx } from "@beep/xlsx/Xlsx.codec"
 * import * as Effect from "effect/Effect"
 *
 * const program = Xlsx.parse(new Uint8Array([1, 2, 3])).pipe(
 *   Effect.map((read) => `read ${read.workbook.sheets.length} sheets`),
 *   Effect.catchTag("XlsxParseError", (error) => Effect.succeed(error.message))
 * )
 *
 * const message = await Effect.runPromise(program)
 * message // => "XLSX parse failed: the file is not an .xlsx workbook (notAnArchive)"
 * ```
 *
 * **Example** (Build the error from a finding)
 *
 * ```ts import.meta.vitest name="Build the error from a finding"
 * import { NoSheets, XlsxFatal } from "@beep/xlsx/XlsxDiagnostic.schema"
 * import { XlsxParseError } from "@beep/xlsx/XlsxError.errors"
 *
 * const error = XlsxParseError.make({ fatal: XlsxFatal.make({ finding: NoSheets.make({}) }) })
 * error.fatal.finding.kind // => "NoSheets"
 * error.message // => "XLSX parse failed: the workbook has no sheet"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class XlsxParseError extends S.TaggedError<XlsxParseError, { readonly brand: unique symbol }>(
  $I`XlsxParseError`
)(
  "XlsxParseError",
  { fatal: XlsxFatal },
  $I.annoteError<XlsxParseError>("XlsxParseError", { description: "Why a workbook could not be read" })
) {
  /** The finding, in words. */
  override get message(): string {
    return `XLSX parse failed: ${describeFinding(this.fatal.finding)}`;
  }
}

/**
 * Why a workbook could not be written: the zip writer's failure, kept as the cause.
 *
 * **Gotchas**
 *
 * The writer names every part itself, so the zip writer's refusals (a path it cannot hold) are not reached by any
 * workbook the schema admits. A sheet name Excel would not take (see `fitsExcel`) is not this error either: it is
 * written as the schema holds it. A runtime without `CompressionStream` is not this error: `effect/encoding/Zip` dies
 * on it, as on any compressor failure; write with `compression: "store"` there.
 *
 * **Example** (Handle a failed write)
 *
 * ```ts import.meta.vitest name="Handle a failed write"
 * import { XlsxStringifyError } from "@beep/xlsx/XlsxError.errors"
 * import * as Effect from "effect/Effect"
 *
 * const cause = new Error("path is empty")
 * const program = Effect.fail(XlsxStringifyError.make({ reason: cause.message, cause })).pipe(
 *   Effect.catchTag("XlsxStringifyError", (error) => Effect.succeed(error.message))
 * )
 *
 * Effect.runSync(program) // => "XLSX stringify failed: path is empty"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class XlsxStringifyError extends S.TaggedError<XlsxStringifyError, { readonly brand: unique symbol }>(
  $I`XlsxStringifyError`
)(
  "XlsxStringifyError",
  {
    reason: S.String.pipe(S.annotateKey({ description: "What could not be written" })),
    cause: S.Defect({ includeStack: true }).pipe(S.annotateKey({ description: "The zip writer's failure" })),
  },
  $I.annoteError<XlsxStringifyError>("XlsxStringifyError", { description: "Why a workbook could not be written" })
) {
  /** The reason, in words. */
  override get message(): string {
    return `XLSX stringify failed: ${this.reason}`;
  }
}
