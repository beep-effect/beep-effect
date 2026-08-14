/**
 * Typed boundary errors for the LangExtract capability.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as O from "@beep/utils/Option";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as R from "effect/Record";

const $I = $LangExtractId.create("Extraction");

/**
 * Machine-readable LangExtract failure reasons.
 *
 * **Example** (Check alignment-failed reason)
 *
 * ```ts
 * import { LangExtractErrorReason } from "@beep/langextract/Extraction"
 *
 * console.log(LangExtractErrorReason.is["alignment-failed"]("alignment-failed"))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const LangExtractErrorReason = LiteralKit([
  "remote-policy-denied",
  "model-generation-failed",
  "model-generation-timeout",
  "model-output-parse-failed",
  "model-output-schema-invalid",
  "alignment-failed",
  "handoff-failed",
]).pipe(
  $I.annoteSchema("LangExtractErrorReason", {
    description: "Sanitized failure reasons exposed by the LangExtract capability boundary.",
  })
);

type FromReasonOptions = {
  readonly details?: R.ReadonlyRecord<string, string>;
  readonly message: string;
};

/**
 * {@inheritDoc LangExtractErrorReason}
 * @category errors
 * @since 0.0.0
 */
export type LangExtractErrorReason = typeof LangExtractErrorReason.Type;

type LangExtractErrorFromReason = {
  (reason: LangExtractErrorReason, options: FromReasonOptions): LangExtractError;
  (options: FromReasonOptions): (reason: LangExtractErrorReason) => LangExtractError;
};

/**
 * Sanitized LangExtract capability error.
 *
 * **Example** (Create error from reason)
 *
 * ```ts
 * import { LangExtractError } from "@beep/langextract/Extraction"
 *
 * console.log(LangExtractError.fromReason("alignment-failed", { message: "Could not align output." }))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LangExtractError extends S.TaggedError<LangExtractError>($I`LangExtractError`)(
  "LangExtractError",
  {
    details: S.Record(S.String, S.String).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    message: S.String,
    reason: LangExtractErrorReason,
  },
  $I.annote("LangExtractError", {
    description: "Sanitized error emitted by provider-neutral LangExtract operations.",
  })
) {
  /**
   * Create a sanitized LangExtract error from a reason and message.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason: LangExtractErrorFromReason = dual(
    2,
    (reason: LangExtractErrorReason, { message, details }: FromReasonOptions): LangExtractError =>
      LangExtractError.make({
        reason,
        message,
        details: O.fromUndefinedOr(details),
      })
  );
}
