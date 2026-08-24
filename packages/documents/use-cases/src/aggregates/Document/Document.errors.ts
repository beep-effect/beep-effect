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

const FilingDecisionUnavailableFields = {
  reason: S.NonEmptyString,
} satisfies S.Struct.Fields;
const sameFilingDecisionUnavailableFields = S.toEquivalence(
  S.TaggedStruct("FilingDecisionUnavailable", FilingDecisionUnavailableFields)
);
const sameFilingDecisionUnavailable = (self: FilingDecisionUnavailable, that: FilingDecisionUnavailable): boolean =>
  sameFilingDecisionUnavailableFields(self, that);

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
  FilingDecisionUnavailableFields,
  $I.annoteClass<
    S.declare<FilingDecisionUnavailable>,
    readonly [S.TaggedStruct<"FilingDecisionUnavailable", typeof FilingDecisionUnavailableFields>]
  >("FilingDecisionUnavailable", {
    description: "The FilingDecision port could not decide a taxonomy concept.",
    toEquivalence: () => sameFilingDecisionUnavailable,
  })
) {}

const DocumentMaterializationFailedFields = {
  reason: S.NonEmptyString,
} satisfies S.Struct.Fields;
const sameDocumentMaterializationFailedFields = S.toEquivalence(
  S.TaggedStruct("DocumentMaterializationFailed", DocumentMaterializationFailedFields)
);
const sameDocumentMaterializationFailed = (
  self: DocumentMaterializationFailed,
  that: DocumentMaterializationFailed
): boolean => sameDocumentMaterializationFailedFields(self, that);

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
  DocumentMaterializationFailedFields,
  $I.annoteClass<
    S.declare<DocumentMaterializationFailed>,
    readonly [S.TaggedStruct<"DocumentMaterializationFailed", typeof DocumentMaterializationFailedFields>]
  >("DocumentMaterializationFailed", {
    description: "The workspace vault materialization write failed.",
    toEquivalence: () => sameDocumentMaterializationFailed,
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

const DocumentIntakeActionErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameDocumentIntakeActionErrorFields = S.toEquivalence(
  S.TaggedStruct("DocumentIntakeActionError", DocumentIntakeActionErrorFields)
);
const sameDocumentIntakeActionError = (self: DocumentIntakeActionError, that: DocumentIntakeActionError): boolean =>
  sameDocumentIntakeActionErrorFields(self, that);

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
  DocumentIntakeActionErrorFields,
  $I.annoteClass<
    S.declare<DocumentIntakeActionError>,
    readonly [S.TaggedStruct<"DocumentIntakeActionError", typeof DocumentIntakeActionErrorFields>]
  >("DocumentIntakeActionError", {
    description: "Client-safe failure raised when dropped-file intake cannot complete.",
    toEquivalence: () => sameDocumentIntakeActionError,
  })
) {
  static readonly new = (message: string) => DocumentIntakeActionError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);
}
