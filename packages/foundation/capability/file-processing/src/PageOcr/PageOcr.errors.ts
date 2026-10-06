/**
 * Page OCR failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { ArtifactId, OperationId } from "../Artifact/Artifact.schema.ts";
import { PosInt } from "../internal/PosInt.ts";

const $I = $FileProcessingId.create("PageOcr");

/**
 * Reasons a page OCR request can fail.
 *
 * **Details**
 *
 * The reasons hide process, HTTP and device detail. `engine-not-found` means
 * no configured engine has the requested id; `engine-unavailable` means the
 * engine exists but cannot serve now (server down, device busy or absent).
 *
 * **Example** (Check timeout reason option)
 *
 * ```ts
 * import { PageOcrErrorReason } from "@beep/file-processing/PageOcr"
 *
 * console.log(PageOcrErrorReason.is["recognition-timed-out"]("recognition-timed-out")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PageOcrErrorReason = LiteralKit([
  "engine-not-found",
  "engine-unavailable",
  "image-rejected",
  "recognition-failed",
  "recognition-timed-out",
  "output-limit-exceeded",
]).pipe(
  $I.annoteSchema("PageOcrErrorReason", {
    description: "Failure reasons for one page OCR request, free of driver and device detail.",
  })
);

/**
 * Type for {@link PageOcrErrorReason}.
 *
 * **Example** (Type an error reason)
 *
 * ```ts
 * import type { PageOcrErrorReason } from "@beep/file-processing/PageOcr"
 *
 * const reason: PageOcrErrorReason = "engine-unavailable"
 * console.log(reason) // "engine-unavailable"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PageOcrErrorReason = typeof PageOcrErrorReason.Type;

/**
 * Sanitized failure of one page OCR request.
 *
 * **Example** (Report an unavailable engine)
 *
 * ```ts
 * import { PageOcrError } from "@beep/file-processing/PageOcr"
 *
 * const error = PageOcrError.fromReason("engine-unavailable", {
 *   engineId: "llama-server/example-ocr",
 *   message: "The OCR server did not answer."
 * })
 * console.log(error.reason) // "engine-unavailable"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PageOcrError extends S.TaggedError<PageOcrError>($I`PageOcrError`)(
  "PageOcrError",
  {
    engineId: S.optionalKey(S.NonEmptyString),
    message: S.String,
    operationId: S.optionalKey(OperationId),
    pageNumber: S.optionalKey(PosInt),
    reason: PageOcrErrorReason,
    sourceArtifactId: S.optionalKey(ArtifactId),
  },
  $I.annoteError<PageOcrError>("PageOcrError", {
    description: "Sanitized failure of one page OCR request exposed at the capability boundary.",
  })
) {
  /**
   * Builds an error from its reason and the remaining fields.
   *
   * @since 0.0.0
   */
  static readonly fromReason = (
    reason: PageOcrErrorReason,
    options: Omit<(typeof PageOcrError)["~type.make.in"], "reason">
  ): PageOcrError => PageOcrError.make({ reason, ...options });
}
