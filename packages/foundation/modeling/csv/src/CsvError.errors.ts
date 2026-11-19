/**
 * The error a CSV read fails with.
 *
 * @packageDocumentation
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
 * **Example** (Read the message)
 *
 * ```ts
 * import { Csv } from "@beep/csv/Csv"
 * import * as Result from "effect/Result"
 *
 * const read = Csv.parseResult('a,"b\nc')
 * if (Result.isFailure(read)) read.failure.message // => 'CSV parse failed: a quote (") opened at 1:3 ...'
 * ```
 *
 * @category errors
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
