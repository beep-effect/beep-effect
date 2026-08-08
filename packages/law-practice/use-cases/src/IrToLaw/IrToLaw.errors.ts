/**
 * IR-to-law extraction failures.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { AlignmentStatus } from "@beep/langextract/Extraction";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("IrToLaw/IrToLaw.errors");

/**
 * Machine-readable reasons for rejecting span-bearing extraction output before
 * it becomes law-practice entities.
 *
 * **Example** (Decode extraction error reason)
 *
 * ```ts
 * import { IrToLawExtractionErrorReason } from "@beep/law-practice-use-cases/IrToLaw"
 * import * as S from "effect/Schema"
 *
 * const decodeReason = S.decodeUnknownSync(IrToLawExtractionErrorReason)
 * const reason = decodeReason("required-extraction-unaligned")
 *
 * console.log(IrToLawExtractionErrorReason.is["required-extraction-unaligned"](reason)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const IrToLawExtractionErrorReason = LiteralKit([
  "required-extraction-missing",
  "required-extraction-unaligned",
]).pipe(
  $I.annoteSchema("IrToLawExtractionErrorReason", {
    description: "Reasons the law-practice IR mapper rejects extraction output.",
  })
);

/**
 * Type for {@link IrToLawExtractionErrorReason}.
 *
 * **Example** (Map reasons to labels)
 *
 * ```ts
 * import type { IrToLawExtractionErrorReason } from "@beep/law-practice-use-cases/IrToLaw"
 *
 * const labels: Readonly<Record<IrToLawExtractionErrorReason, string>> = {
 *   "required-extraction-missing": "The model omitted a required legal label.",
 *   "required-extraction-unaligned": "The label could not be grounded to source text."
 * }
 *
 * console.log(labels["required-extraction-missing"])
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type IrToLawExtractionErrorReason = typeof IrToLawExtractionErrorReason.Type;

/**
 * Failure raised when required office-action extraction output is missing or
 * lacks a source-grounded span needed for legal evidence.
 *
 * **Example** (Catch extraction error reason)
 *
 * ```ts
 * import { IrToLawExtractionError } from "@beep/law-practice-use-cases/IrToLaw"
 * import { Effect } from "effect"
 *
 * const program = Effect.fail(
 *   IrToLawExtractionError.fromReason("required-extraction-missing", {
 *     label: "distinction",
 *     message: "Missing distinction extraction."
 *   })
 * ).pipe(
 *   Effect.catchTag("IrToLawExtractionError", (error) => Effect.succeed(error.reason))
 * )
 *
 * Effect.runPromise(program).then(console.log) // "required-extraction-missing"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IrToLawExtractionError extends TaggedErrorClass<IrToLawExtractionError>($I`IrToLawExtractionError`)(
  "IrToLawExtractionError",
  {
    alignmentStatus: S.OptionFromOptionalKey(AlignmentStatus).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional LangExtract alignment status copied from the rejected extraction.",
    }),
    label: S.NonEmptyString.annotateKey({
      description: "Required extraction label that failed validation.",
    }),
    message: S.NonEmptyString.annotateKey({
      description: "Sanitized diagnostic for the failed IR-to-law extraction boundary.",
    }),
    reason: IrToLawExtractionErrorReason.annotateKey({
      description: "Machine-readable reason for rejecting the extraction output.",
    }),
  },
  $I.annote("IrToLawExtractionError", {
    description: "Sanitized failure emitted when office-action extraction output cannot be grounded.",
  })
) {
  /**
   * Create a sanitized IR-to-law extraction error.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (
    reason: IrToLawExtractionErrorReason,
    options: {
      readonly alignmentStatus?: AlignmentStatus;
      readonly label: string;
      readonly message: string;
    }
  ): IrToLawExtractionError =>
    IrToLawExtractionError.make({
      alignmentStatus: O.fromUndefinedOr(options.alignmentStatus),
      label: options.label,
      message: options.message,
      reason,
    });
}
