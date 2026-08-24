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
 * **Example** (Check model-output-parse-failed reason)
 *
 * ```ts
 * import { LangExtractErrorReason } from "@beep/langextract/Extraction"
 *
 * console.log(LangExtractErrorReason.is["model-output-parse-failed"]("model-output-parse-failed"))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const LangExtractErrorReason = LiteralKit([
  "remote-policy-denied",
  "model-generation-failed",
  "model-generation-timeout",
  "prompt-encoding-failed",
  "model-output-parse-failed",
  "model-output-schema-invalid",
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
const LangExtractErrorFields = {
  details: S.Record(S.String, S.String).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  message: S.String,
  reason: LangExtractErrorReason,
} satisfies S.Struct.Fields;
const sameLangExtractErrorFields = S.toEquivalence(S.TaggedStruct("LangExtractError", LangExtractErrorFields));
const sameLangExtractError = (self: LangExtractError, that: LangExtractError): boolean =>
  sameLangExtractErrorFields(self, that);

/**
 * Sanitized LangExtract capability error.
 *
 * **Example** (Create error from reason)
 *
 * ```ts
 * import { LangExtractError } from "@beep/langextract/Extraction"
 *
 * console.log(LangExtractError.fromReason("model-output-parse-failed", { message: "Could not parse output." }))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LangExtractError extends S.TaggedError<LangExtractError>($I`LangExtractError`)(
  "LangExtractError",
  LangExtractErrorFields,
  $I.annoteClass<
    S.declare<LangExtractError>,
    readonly [S.TaggedStruct<"LangExtractError", typeof LangExtractErrorFields>]
  >("LangExtractError", {
    description: "Sanitized error emitted by provider-neutral LangExtract operations.",
    toEquivalence: () => sameLangExtractError,
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
