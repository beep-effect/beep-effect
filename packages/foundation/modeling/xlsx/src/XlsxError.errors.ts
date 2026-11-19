/**
 * The two ways this package fails: a file that cannot be read, with the finding that stopped it, and a workbook
 * that cannot be written.
 *
 * @packageDocumentation
 */

import { $XlsxId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { describeFinding, XlsxFatal, XlsxWarning } from "./XlsxDiagnostic.schema.ts";

const $I = $XlsxId.create("XlsxError");

/**
 * Why a workbook could not be read: the finding that stopped the read, and what was read past before it.
 *
 * @category errors
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
 * @category errors
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
