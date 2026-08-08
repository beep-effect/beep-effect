/**
 * Operation request and boundary error schemas for file processing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ArtifactId, OperationId, SourceArtifact } from "@beep/file-processing/Artifact";
import { FileFormatFamily, StrategyPreference } from "@beep/file-processing/Strategy";
import { $FileProcessingId } from "@beep/identity";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { MimeType } from "@beep/schema/MimeType";
import * as S from "effect/Schema";
import type { TaggedErrorNewInput } from "@beep/schema/TaggedErrorClass";

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
export class FileProcessingOperationError extends TaggedErrorClass<FileProcessingOperationError>(
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
    options: Omit<TaggedErrorNewInput<typeof FileProcessingOperationError>, "reason">
  ): FileProcessingOperationError => FileProcessingOperationError.make({ reason, ...options });
}

/**
 * Operation request for format detection.
 *
 * **Example** (Decode detect operation request)
 *
 * ```ts
 * import { DetectFileOperation } from "@beep/file-processing/Operation"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(DetectFileOperation)({
 *   operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   operationKind: "detect",
 *   preference: { engine: "test" },
 *   source: {
 *     digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     extension: "txt",
 *     id: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     locator: { kind: "synthetic", value: "note.txt" },
 *     name: "note.txt",
 *     relativePath: "note.txt",
 *     sizeBytes: 5,
 *     text: "hello"
 *   }
 * })
 *
 * Effect.runPromise(program).then((operation) => console.log(operation.operationKind)) // "detect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectFileOperation extends S.Class<DetectFileOperation>($I`DetectFileOperation`)(
  {
    operationId: OperationId,
    operationKind: S.Literal("detect"),
    preference: StrategyPreference,
    source: SourceArtifact,
  },
  $I.annote("DetectFileOperation", {
    description: "Runtime-neutral request to detect a source artifact format.",
  })
) {}

/**
 * Result emitted by format detection.
 *
 * **Example** (Decode detection result payload)
 *
 * ```ts
 * import { DetectionResult } from "@beep/file-processing/Operation"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(DetectionResult)({
 *   engine: "beep-test",
 *   format: "markdown",
 *   operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   sourceArtifactId: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * })
 *
 * Effect.runPromise(program).then((result) => console.log(result.format)) // "markdown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectionResult extends S.Class<DetectionResult>($I`DetectionResult`)(
  {
    confidence: S.optionalKey(S.Finite),
    engine: S.String,
    format: FileFormatFamily,
    mediaType: S.optionalKey(MimeType),
    operationId: OperationId,
    sourceArtifactId: ArtifactId,
  },
  $I.annote("DetectionResult", {
    description: "Detected format for a source artifact.",
  })
) {}

/**
 * Operation request for text and metadata extraction.
 *
 * **Example** (Decode extract operation request)
 *
 * ```ts
 * import { ExtractFileOperation } from "@beep/file-processing/Operation"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(ExtractFileOperation)({
 *   format: "plain-text",
 *   operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   operationKind: "extract",
 *   preference: { engine: "test" },
 *   source: {
 *     digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     extension: "txt",
 *     id: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     locator: { kind: "synthetic", value: "note.txt" },
 *     name: "note.txt",
 *     relativePath: "note.txt",
 *     sizeBytes: 5,
 *     text: "hello"
 *   }
 * })
 *
 * Effect.runPromise(program).then((operation) => console.log(operation.format)) // "plain-text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFileOperation extends S.Class<ExtractFileOperation>($I`ExtractFileOperation`)(
  {
    format: FileFormatFamily,
    maxMaterializedBytes: S.optionalKey(S.Finite),
    operationId: OperationId,
    operationKind: S.Literal("extract"),
    preference: StrategyPreference,
    source: SourceArtifact,
  },
  $I.annote("ExtractFileOperation", {
    description: "Runtime-neutral request to extract text and metadata from a source artifact.",
  })
) {}

/**
 * Operation request for archive child export.
 *
 * **Example** (Decode export-archive request)
 *
 * ```ts
 * import { ExportArchiveOperation } from "@beep/file-processing/Operation"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(ExportArchiveOperation)({
 *   format: "pst",
 *   operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   operationKind: "export-archive",
 *   preference: { engine: "libpff" },
 *   source: {
 *     digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     extension: "pst",
 *     id: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     locator: { kind: "synthetic", value: "mailbox.pst" },
 *     name: "mailbox.pst",
 *     relativePath: "mailbox.pst",
 *     sizeBytes: 128
 *   }
 * })
 *
 * Effect.runPromise(program).then((operation) => console.log(operation.operationKind)) // "export-archive"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExportArchiveOperation extends S.Class<ExportArchiveOperation>($I`ExportArchiveOperation`)(
  {
    format: FileFormatFamily,
    maxMaterializedBytes: S.optionalKey(S.Finite),
    operationId: OperationId,
    operationKind: S.Literal("export-archive"),
    preference: StrategyPreference,
    source: SourceArtifact,
  },
  $I.annote("ExportArchiveOperation", {
    description: "Runtime-neutral request to export child artifacts from an archive source.",
  })
) {}

/**
 * Operation request for a full source processing pass.
 *
 * **Example** (Decode process operation request)
 *
 * ```ts
 * import { ProcessFileOperation } from "@beep/file-processing/Operation"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(ProcessFileOperation)({
 *   exportChildren: false,
 *   operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   operationKind: "process",
 *   preference: { engine: "test" },
 *   source: {
 *     digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     extension: "md",
 *     id: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     locator: { kind: "synthetic", value: "README.md" },
 *     name: "README.md",
 *     relativePath: "README.md",
 *     sizeBytes: 11,
 *     text: "hello"
 *   }
 * })
 *
 * Effect.runPromise(program).then((operation) => console.log(operation.exportChildren)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessFileOperation extends S.Class<ProcessFileOperation>($I`ProcessFileOperation`)(
  {
    exportChildren: S.Boolean,
    maxMaterializedBytes: S.optionalKey(S.Finite),
    operationId: OperationId,
    operationKind: S.Literal("process"),
    preference: StrategyPreference,
    source: SourceArtifact,
  },
  $I.annote("ProcessFileOperation", {
    description: "Runtime-neutral request to run the minimum file-processing vertical slice for one source.",
  })
) {}
