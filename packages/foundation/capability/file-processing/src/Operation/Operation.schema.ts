/**
 * File-processing operation request and result schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { MimeType } from "@beep/schema/MimeType";
import * as S from "effect/Schema";
import { ArtifactId, OperationId, SourceArtifact } from "../Artifact/Artifact.schema.ts";
import { FileFormatFamily, StrategyPreference } from "../Strategy/Strategy.schema.ts";

const $I = $FileProcessingId.create("Operation");

/**
 * **Example** (Decode detect operation request)
 *
 * ```ts
 * import { DetectFileOperation } from "@beep/file-processing/Operation"
 * import * as Effect from "effect/Effect";
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
export class DetectFileOperation extends S.Opaque<DetectFileOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    operationId: OperationId,
    operationKind: S.tag("detect"),
    preference: StrategyPreference,
    source: SourceArtifact,
  }).pipe(
    $I.annoteSchema("DetectFileOperation", {
      description: "Runtime-neutral request to detect a source artifact format.",
    })
  )
) {}

/**
 * **Example** (Decode detection result payload)
 *
 * ```ts
 * import { DetectionResult } from "@beep/file-processing/Operation"
 * import * as Effect from "effect/Effect";
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
export class DetectionResult extends S.Opaque<DetectionResult, { readonly brand: unique symbol }>()(
  S.Struct({
    confidence: S.optionalKey(S.Finite),
    engine: S.String,
    format: FileFormatFamily,
    mediaType: S.optionalKey(MimeType),
    operationId: OperationId,
    sourceArtifactId: ArtifactId,
  }).pipe(
    $I.annoteSchema("DetectionResult", {
      description: "Detected format for a source artifact.",
    })
  )
) {}

/**
 * **Example** (Decode extract operation request)
 *
 * ```ts
 * import { ExtractFileOperation } from "@beep/file-processing/Operation"
 * import * as Effect from "effect/Effect";
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
export class ExtractFileOperation extends S.Opaque<ExtractFileOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    format: FileFormatFamily,
    maxMaterializedBytes: S.optionalKey(S.Finite),
    operationId: OperationId,
    operationKind: S.tag("extract"),
    preference: StrategyPreference,
    source: SourceArtifact,
  }).pipe(
    $I.annoteSchema("ExtractFileOperation", {
      description: "Runtime-neutral request to extract text and metadata from a source artifact.",
    })
  )
) {}

/**
 * **Example** (Decode export-archive request)
 *
 * ```ts
 * import { ExportArchiveOperation } from "@beep/file-processing/Operation"
 * import * as Effect from "effect/Effect";
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
export class ExportArchiveOperation extends S.Opaque<ExportArchiveOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    format: FileFormatFamily,
    maxMaterializedBytes: S.optionalKey(S.Finite),
    operationId: OperationId,
    operationKind: S.tag("export-archive"),
    preference: StrategyPreference,
    source: SourceArtifact,
  }).pipe(
    $I.annoteSchema("ExportArchiveOperation", {
      description: "Runtime-neutral request to export child artifacts from an archive source.",
    })
  )
) {}

/**
 * Operation request for a full source processing pass.
 *
 * **Example** (Decode process operation request)
 *
 * ```ts
 * import { ProcessFileOperation } from "@beep/file-processing/Operation"
 * import * as Effect from "effect/Effect";
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
export class ProcessFileOperation extends S.Opaque<ProcessFileOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    exportChildren: S.Boolean,
    maxMaterializedBytes: S.optionalKey(S.Finite),
    operationId: OperationId,
    operationKind: S.tag("process"),
    preference: StrategyPreference,
    source: SourceArtifact,
  }).pipe(
    $I.annoteSchema("ProcessFileOperation", {
      description: "Runtime-neutral request to run the minimum file-processing vertical slice for one source.",
    })
  )
) {}
