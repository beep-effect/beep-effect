/**
 * Document intake use-case errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Effect, flow } from "effect";
import * as S from "effect/Schema";

const $I = $DocumentsUseCasesId.create("aggregates/Document/Document.errors");

/**
 * Raised when the FilingDecision port cannot classify a document.
 *
 * **Example** (Make FilingDecisionUnavailable error)
 *
 * ```ts
 * import { FilingDecisionUnavailable } from "@beep/documents-use-cases/public"
 *
 * const error = FilingDecisionUnavailable.make({ reason: "classifier unavailable" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FilingDecisionUnavailable extends S.TaggedError<FilingDecisionUnavailable>($I`FilingDecisionUnavailable`)(
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
 * **Example** (Make materialization failed error)
 *
 * ```ts
 * import { DocumentMaterializationFailed } from "@beep/documents-use-cases/public"
 *
 * const error = DocumentMaterializationFailed.make({ reason: "vault write failed" })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DocumentMaterializationFailed extends S.TaggedError<DocumentMaterializationFailed>(
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
 * **Example** (Decode DocumentIntakeError schema)
 *
 * ```ts
 * import { DocumentIntakeError, FilingDecisionUnavailable } from "@beep/documents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownSync(DocumentIntakeError)(
 *   FilingDecisionUnavailable.make({ reason: "classifier unavailable" })
 * )
 * console.log(decoded._tag)
 * ```
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
 * **Example** (Type annotate DocumentIntakeError)
 *
 * ```ts
 * import type { DocumentIntakeError } from "@beep/documents-use-cases/public"
 * import { FilingDecisionUnavailable } from "@beep/documents-use-cases/public"
 *
 * const error: DocumentIntakeError = FilingDecisionUnavailable.make({ reason: "classifier unavailable" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type DocumentIntakeError = typeof DocumentIntakeError.Type;

/**
 * Client-safe failure raised when dropped-file intake cannot complete.
 *
 * **Example** (Create action error message)
 *
 * ```ts
 * import { DocumentIntakeActionError } from "@beep/documents-use-cases/public"
 *
 * const error = DocumentIntakeActionError.new("Workspace vault is not configured.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DocumentIntakeActionError extends S.TaggedError<DocumentIntakeActionError>($I`DocumentIntakeActionError`)(
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
