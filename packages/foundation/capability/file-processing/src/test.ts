/**
 * Synthetic file-processing fixtures and test engine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ArtifactId,
  ArtifactReference,
  ContentDigest,
  deriveArtifactId,
  OperationId,
} from "@beep/file-processing/Artifact";
import { ArchiveExportResult, ExtractionResult } from "@beep/file-processing/Extraction";
import { DetectionResult, FileProcessingOperationError } from "@beep/file-processing/Operation";
import { classifyFormatFromExtension, FileProcessingEngineDescriptor } from "@beep/file-processing/Strategy";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { A } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import type {
  DetectFileOperation,
  ExportArchiveOperation,
  ExtractFileOperation,
} from "@beep/file-processing/Operation";
import type { FileProcessingEngineShape } from "@beep/file-processing/Service";
import type * as Crypto from "effect/Crypto";

/**
 * Synthetic engine descriptor used by tests and proof fixtures.
 *
 * **Example** (Verify PST format support)
 *
 * ```ts import.meta.vitest name="Verify PST format support"
 * import { TestFileProcessingEngineDescriptor } from "@beep/file-processing/test"
 *
 * TestFileProcessingEngineDescriptor.supportedFormats.includes("pst") // => true
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const TestFileProcessingEngineDescriptor = FileProcessingEngineDescriptor.make({
  capabilities: ["detect", "extract-text", "extract-metadata", "export-children"],
  engine: "test",
  name: "beep-test-file-processing-engine",
  supportedFormats: ["html", "image-metadata", "markdown", "plain-text", "pst", "rtf", "doc", "docx", "pdf-text-layer"],
  version: "0.0.0",
});

const testIdentifierHex = "3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7";

/**
 * Decode the canonical synthetic artifact, digest, and operation identifiers
 * shared by driver test fixtures.
 *
 * **Example** (Decode synthetic identifiers)
 *
 * ```ts import.meta.vitest name="Decode synthetic identifiers"
 * import { decodeTestOperationIdentifiers } from "@beep/file-processing/test"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const identifiers = yield* decodeTestOperationIdentifiers()
 *   return identifiers.digest.startsWith("sha256:")
 * })
 *
 * await Effect.runPromise(program) // => true
 * ```
 *
 * @effects Decodes the fixed synthetic identifiers through the exported schemas and can fail with `SchemaError` if the fixture constants drift.
 * @category fixtures
 * @since 0.0.0
 */
export const decodeTestOperationIdentifiers = Effect.fn("FileProcessingTest.decodeTestOperationIdentifiers")(
  function* (): Effect.fn.Return<
    { readonly artifactId: ArtifactId; readonly digest: ContentDigest; readonly operationId: OperationId },
    S.SchemaError
  > {
    const artifactId = yield* S.decodeEffect(ArtifactId)(`artifact:${testIdentifierHex}`);
    const digest = yield* S.decodeEffect(ContentDigest)(`sha256:${testIdentifierHex}`);
    const operationId = yield* S.decodeEffect(OperationId)(`operation:${testIdentifierHex}`);
    return { artifactId, digest, operationId };
  }
);

// fallow-ignore-next-line code-duplication -- synthetic fixtures keep their own engine-specific error wording
const decodeTestArtifactPath = (
  path: string,
  operation: ExportArchiveOperation
): Effect.Effect<PosixPath, FileProcessingOperationError> =>
  S.decodeEffect(PosixPath)(path).pipe(
    Effect.mapError(() =>
      FileProcessingOperationError.fromReason("archive-export-failed", {
        artifactId: operation.source.id,
        format: operation.format,
        message: "Synthetic child artifact path was not POSIX-normalized.",
        operationId: operation.operationId,
      })
    )
  );

const deriveTestChildArtifactId = (
  operation: ExportArchiveOperation,
  relativePath: PosixPath
): Effect.Effect<ArtifactReference["id"], FileProcessingOperationError, Crypto.Crypto> =>
  deriveArtifactId([operation.source.id, relativePath]).pipe(
    Effect.mapError(() =>
      FileProcessingOperationError.fromReason("archive-export-failed", {
        artifactId: operation.source.id,
        format: operation.format,
        message: "Synthetic child artifact id could not be derived.",
        operationId: operation.operationId,
      })
    )
  );

/**
 * Synthetic file-processing engine for generated fixtures.
 *
 * **Example** (Log engine descriptor name)
 *
 * ```ts import.meta.vitest name="Log engine descriptor name"
 * import { TestFileProcessingEngine } from "@beep/file-processing/test"
 *
 * TestFileProcessingEngine.descriptor.engine // => "test"
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const TestFileProcessingEngine: FileProcessingEngineShape = {
  descriptor: TestFileProcessingEngineDescriptor,
  detect: Effect.fn("TestFileProcessingEngine.detect")(function* (operation: DetectFileOperation) {
    return DetectionResult.make({
      confidence: 1,
      engine: TestFileProcessingEngineDescriptor.name,
      format: classifyFormatFromExtension(operation.source.extension),
      operationId: operation.operationId,
      sourceArtifactId: operation.source.id,
    });
  }),
  exportArchive: Effect.fn("TestFileProcessingEngine.exportArchive")(function* (operation: ExportArchiveOperation) {
    if (operation.format !== "pst") {
      return yield* FileProcessingOperationError.fromReason("unsupported-file-format", {
        artifactId: operation.source.id,
        format: operation.format,
        message: `Synthetic export only supports PST archives, not ${operation.format}.`,
        operationId: operation.operationId,
      });
    }

    const childRelativePath = yield* decodeTestArtifactPath("children/synthetic-message.txt", operation);
    const childArtifactId = yield* deriveTestChildArtifactId(operation, childRelativePath);
    const child = ArtifactReference.make({
      id: childArtifactId,
      mediaType: "text/plain",
      relativePath: childRelativePath,
      sizeBytes: NonNegativeInt.make(29),
    });

    return ArchiveExportResult.make({
      children: [child],
      engine: TestFileProcessingEngineDescriptor.name,
      operationId: operation.operationId,
      sourceArtifactId: operation.source.id,
      warnings: [],
    });
  }),
  extract: Effect.fn("TestFileProcessingEngine.extract")(function* (operation: ExtractFileOperation) {
    const text = operation.source.text ?? "synthetic extraction";
    if (A.contains(["docm", "xls", "xlsx", "unknown"], operation.format)) {
      return yield* FileProcessingOperationError.fromReason("unsupported-file-format", {
        artifactId: operation.source.id,
        format: operation.format,
        message: `Synthetic extraction intentionally defers ${operation.format}.`,
        operationId: operation.operationId,
      });
    }

    return ExtractionResult.make({
      engine: TestFileProcessingEngineDescriptor.name,
      format: operation.format,
      metadata: {},
      operationId: operation.operationId,
      sourceArtifactId: operation.source.id,
      text,
      warnings: [],
    });
  }),
};
