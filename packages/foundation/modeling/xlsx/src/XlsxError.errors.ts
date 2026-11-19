/**
 * The two ways this package fails: a file that cannot be read, with the finding that stopped it, and a workbook
 * that cannot be written.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XlsxId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { describeFinding, XlsxFatal, XlsxWarning } from "./XlsxDiagnostic.schema.ts";

const $I = $XlsxId.create("XlsxError");

/**
 * Why a workbook could not be read: the finding that stopped the read, and what was read past before it.
 *
 * **Example** (Recover from a file that is not a workbook)
 *
 * ```ts
 * import { Xlsx } from "@beep/xlsx"
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
 * ```ts
 * import { NoSheets, XlsxFatal, XlsxParseError } from "@beep/xlsx"
 *
 * const error = XlsxParseError.make({ fatal: XlsxFatal.make({ finding: NoSheets.make({}) }) })
 * error.warnings.length // => 0
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
  {
    fatal: XlsxFatal.pipe(S.annotateKey({ description: "The finding that stopped the read" })),
    warnings: S.Array(XlsxWarning.annotateKey({ description: "One oddity" })).pipe(
      S.annotateKey({ description: "What was read past before the read stopped" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
  },
  $I.annoteError<XlsxParseError>("XlsxParseError", { description: "Why a workbook could not be read" })
) {
  /** The finding, in words. */
  override get message(): string {
    return `XLSX parse failed: ${describeFinding(this.fatal.finding)}`;
  }
}

/**
 * Why a workbook could not be written. The schema admits only workbooks the format can hold, so this is reached
 * only by a value built past it, or when the runtime has no deflate.
 *
 * **Example** (Handle a failed write)
 *
 * ```ts
 * import { XlsxStringifyError } from "@beep/xlsx"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.fail(XlsxStringifyError.make({ reason: "the runtime has no CompressionStream" })).pipe(
 *   Effect.catchTag("XlsxStringifyError", (error) => Effect.succeed(error.message))
 * )
 *
 * Effect.runSync(program) // => "XLSX stringify failed: the runtime has no CompressionStream"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class XlsxStringifyError extends S.TaggedError<XlsxStringifyError, { readonly brand: unique symbol }>(
  $I`XlsxStringifyError`
)(
  "XlsxStringifyError",
  { reason: S.String.pipe(S.annotateKey({ description: "What could not be written" })) },
  $I.annoteError<XlsxStringifyError>("XlsxStringifyError", { description: "Why a workbook could not be written" })
) {
  /** The reason, in words. */
  override get message(): string {
    return `XLSX stringify failed: ${this.reason}`;
  }
}
