/**
 * The error a CSV read fails with.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CsvId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CsvFatal, describeFinding } from "./CsvDiagnostic.schema.ts";

const $I = $CsvId.create("CsvError");

/**
 * Why a CSV could not be read: the findings that stopped it (today the first one).
 *
 * **Details**
 *
 * `message` describes the first diagnostic with {@link describeFinding}, so it carries a 1-based position a person
 * can find in an editor; the full findings stay on `diagnostics` for callers that render their own report.
 *
 * **Example** (Read the message)
 *
 * ```ts import.meta.vitest name="Read the message"
 * import { CsvFatal, UnterminatedQuote } from "@beep/csv/CsvDiagnostic.schema"
 * import { CsvParseError } from "@beep/csv/CsvError.errors"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 *
 * const finding = UnterminatedQuote.make({ at: CsvTextSpan.locate('a,"b\nc', 2, 1), record: 0, field: 1 })
 * const error = CsvParseError.make({ diagnostics: [CsvFatal.make({ finding })] })
 * error._tag // => "CsvParseError"
 * error.message // => 'CSV parse failed: a quote (") opened at 1:3 is never closed, so the rest of the file would run into one cell'
 * ```
 *
 * @see {@link CsvFatal} for the findings a parse error carries.
 * @category errors
 * @since 0.0.0
 */
export class CsvParseError extends S.TaggedError<CsvParseError, { readonly brand: unique symbol }>($I`CsvParseError`)(
  "CsvParseError",
  {
    diagnostics: S.NonEmptyArray(CsvFatal.annotateKey({ description: "One finding that stopped the read" })).pipe(
      S.annotateKey({ description: "The findings that stopped the read" })
    ),
  },
  $I.annoteError<CsvParseError>("CsvParseError", { description: "Why a CSV could not be read" })
) {
  /** The first finding, in words, with a 1-based position. */
  override get message(): string {
    return `CSV parse failed: ${O.getOrElse(
      O.map(A.head(this.diagnostics), (d) => describeFinding(d.finding)),
      () => "no finding"
    )}`;
  }
}
