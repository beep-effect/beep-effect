/**
 * Document intake use-case errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Effect, flow } from "effect";
import * as S from "effect/Schema";

const $I = $DocumentsUseCasesId.create("aggregates/Document/Document.errors");

/**
 * Raised when the FilingDecision port cannot classify a document.
 *
 * @category errors
 * @since 0.0.0
 */
export class FilingDecisionUnavailable extends TaggedErrorClass<FilingDecisionUnavailable>(
  $I`FilingDecisionUnavailable`
)(
  "FilingDecisionUnavailable",
  {
    reason: S.NonEmptyString,
  },
  $I.annote("FilingDecisionUnavailable", {
    description: "The FilingDecision port could not decide a taxonomy concept.",
  })
) {}

/**
 * Raised when workspace vault materialization fails.
 *
 * @category errors
 * @since 0.0.0
 */
export class DocumentMaterializationFailed extends TaggedErrorClass<DocumentMaterializationFailed>(
  $I`DocumentMaterializationFailed`
)(
  "DocumentMaterializationFailed",
  {
    reason: S.NonEmptyString,
  },
  $I.annote("DocumentMaterializationFailed", {
    description: "The workspace vault materialization write failed.",
  })
) {}

/**
 * Internal typed failure raised by document intake.
 *
 * @category errors
 * @since 0.0.0
 */
export const DocumentIntakeError = S.Union([FilingDecisionUnavailable, DocumentMaterializationFailed]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DocumentIntakeError", {
    description: "Internal typed failure raised by document intake.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Internal typed failure raised by document intake.
 *
 * @category errors
 * @since 0.0.0
 */
export type DocumentIntakeError = typeof DocumentIntakeError.Type;

/**
 * Client-safe failure raised when dropped-file intake cannot complete.
 *
 * @category errors
 * @since 0.0.0
 */
export class DocumentIntakeActionError extends TaggedErrorClass<DocumentIntakeActionError>(
  $I`DocumentIntakeActionError`
)(
  "DocumentIntakeActionError",
  {
    message: S.String,
  },
  $I.annote("DocumentIntakeActionError", {
    description: "Client-safe failure raised when dropped-file intake cannot complete.",
  })
) {
  static readonly new = (message: string) => DocumentIntakeActionError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);
}
