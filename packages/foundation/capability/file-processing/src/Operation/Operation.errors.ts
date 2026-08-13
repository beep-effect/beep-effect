/**
 * File-processing operation failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { ArtifactId, OperationId } from "../Artifact/Artifact.schema.ts";
import { FileFormatFamily } from "../Strategy/Strategy.schema.ts";

const $I = $FileProcessingId.create("Operation");

/**
 * Machine-readable file-processing operation failure reasons.
 *
 * **Example** (Check reason options membership)
 *
 * ```ts
 * import { FileProcessingOperationErrorReason } from "@beep/file-processing/Operation"
 *
 * console.log(FileProcessingOperationErrorReason.Options.includes("engine-unavailable")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const FileProcessingOperationErrorReason = LiteralKit([
  "file-detection-failed",
  "unsupported-file-format",
  "file-extraction-failed",
  "archive-export-failed",
  "engine-unavailable",
  "operation-timed-out",
  "output-limit-exceeded",
]).pipe(
  $I.annoteSchema("FileProcessingOperationErrorReason", {
    description:
      "Operation-level failure reasons that hide driver, process, HTTP, and filesystem implementation details.",
  })
);

/**
 * Type for {@link FileProcessingOperationErrorReason}.
 *
 * **Example** (Type and refine reason)
 *
 * ```ts
 * import { FileProcessingOperationErrorReason } from "@beep/file-processing/Operation"
 *
 * const reason: FileProcessingOperationErrorReason = "engine-unavailable"
 * console.log(FileProcessingOperationErrorReason.is["engine-unavailable"](reason)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type FileProcessingOperationErrorReason = typeof FileProcessingOperationErrorReason.Type;

/**
 * Sanitized file-processing operation error.
 *
 * **Example** (Create error from reason)
 *
 * ```ts
 * import { FileProcessingOperationError } from "@beep/file-processing/Operation"
 *
 * const error = FileProcessingOperationError.fromReason("engine-unavailable", {
 *   message: "No extraction engine is available"
 * })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FileProcessingOperationError extends S.TaggedError<FileProcessingOperationError>(
  $I`FileProcessingOperationError`
)(
  "FileProcessingOperationError",
  {
    artifactId: S.optionalKey(ArtifactId),
    details: S.optionalKey(S.Record(S.String, S.String)),
    engine: S.optionalKey(S.String),
    format: S.optionalKey(FileFormatFamily),
    message: S.String,
    operationId: S.optionalKey(OperationId),
    reason: FileProcessingOperationErrorReason,
  },
  $I.annote("FileProcessingOperationError", {
    description: "Sanitized operation-level error exposed by the file-processing capability boundary.",
  })
) {
  /**
   * Create an operation error from a reason and sanitized context.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (
    reason: FileProcessingOperationErrorReason,
    options: Omit<(typeof FileProcessingOperationError)["~type.make.in"], "reason">
  ): FileProcessingOperationError => FileProcessingOperationError.make({ reason, ...options });
}
