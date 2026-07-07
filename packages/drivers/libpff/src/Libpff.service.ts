/**
 * libpff-backed file-processing engine scaffold.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ArtifactReference, deriveArtifactId } from "@beep/file-processing/Artifact";
import { ArchiveExportResult } from "@beep/file-processing/Extraction";
import { DetectionResult, FileProcessingOperationError } from "@beep/file-processing/Operation";
import { FileProcessingEngineDescriptor } from "@beep/file-processing/Strategy";
import { $LibpffId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { Effect, Match } from "effect";
import * as S from "effect/Schema";
import { makeLibpffError } from "./Libpff.errors.ts";
import type {
  DetectFileOperation,
  ExportArchiveOperation,
  ExtractFileOperation,
} from "@beep/file-processing/Operation";
import type { FileProcessingEngineShape } from "@beep/file-processing/Service";
import type * as Crypto from "effect/Crypto";
import type { LibpffError } from "./Libpff.errors.ts";

const $I = $LibpffId.create("Libpff.service");

/**
 * libpff file-processing engine descriptor.
 *
 * @example
 * ```ts
 * import { LibpffFileProcessingEngineDescriptor } from "@beep/libpff"
 *
 * console.log(LibpffFileProcessingEngineDescriptor.name)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const LibpffFileProcessingEngineDescriptor = FileProcessingEngineDescriptor.make({
  capabilities: ["detect", "export-children"],
  engine: "libpff",
  name: "libpff",
  supportedFormats: ["pst"],
});

const mapLibpffErrorToOperationError = (
  error: LibpffError,
  operation: ExportArchiveOperation
): FileProcessingOperationError =>
  Match.value(error.reason).pipe(
    Match.when("engine-unavailable", () =>
      FileProcessingOperationError.fromReason("engine-unavailable", {
        artifactId: operation.source.id,
        engine: LibpffFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "libpff export is deferred because no libpff runtime is configured for this proof.",
        operationId: operation.operationId,
      })
    ),
    Match.when("output-limit", () =>
      FileProcessingOperationError.fromReason("output-limit-exceeded", {
        artifactId: operation.source.id,
        engine: LibpffFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "libpff export exceeded the configured materialization limit.",
        operationId: operation.operationId,
      })
    ),
    Match.when("timeout", () =>
      FileProcessingOperationError.fromReason("operation-timed-out", {
        artifactId: operation.source.id,
        engine: LibpffFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "libpff export timed out.",
        operationId: operation.operationId,
      })
    ),
    Match.orElse(() =>
      FileProcessingOperationError.fromReason("archive-export-failed", {
        artifactId: operation.source.id,
        engine: LibpffFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "libpff export failed inside the driver boundary.",
        operationId: operation.operationId,
      })
    )
  );

const decodeLibpffArtifactPath = (
  path: string,
  operation: ExportArchiveOperation
): Effect.Effect<PosixPath, FileProcessingOperationError> =>
  S.decodeUnknownEffect(PosixPath)(path).pipe(
    Effect.mapError(() =>
      FileProcessingOperationError.fromReason("archive-export-failed", {
        artifactId: operation.source.id,
        engine: LibpffFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "libpff child artifact path was not POSIX-normalized.",
        operationId: operation.operationId,
      })
    )
  );

const deriveLibpffChildArtifactId = (
  operation: ExportArchiveOperation,
  relativePath: PosixPath
): Effect.Effect<ArtifactReference["id"], FileProcessingOperationError, Crypto.Crypto> =>
  deriveArtifactId([operation.source.id, relativePath]).pipe(
    Effect.mapError(() =>
      FileProcessingOperationError.fromReason("archive-export-failed", {
        artifactId: operation.source.id,
        engine: LibpffFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "libpff child artifact id could not be derived.",
        operationId: operation.operationId,
      })
    )
  );

/**
 * Options for the P1 libpff engine scaffold.
 *
 * @example
 * ```ts
 * import { LibpffFileProcessingEngineOptions } from "@beep/libpff"
 *
 * const options = LibpffFileProcessingEngineOptions.make({ syntheticExport: true })
 * console.log(options.syntheticExport) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class LibpffFileProcessingEngineOptions extends S.Class<LibpffFileProcessingEngineOptions>(
  $I`LibpffFileProcessingEngineOptions`
)(
  {
    syntheticExport: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Enables the proof-only synthetic export path instead of the default unavailable deferral.",
    }),
  },
  $I.annote("LibpffFileProcessingEngineOptions", {
    description: "Configuration options for the P1 libpff engine scaffold.",
  })
) {}

/**
 * Create the P1 libpff file-processing engine.
 *
 * @example
 * ```ts
 * import { makeLibpffFileProcessingEngine } from "@beep/libpff"
 *
 * const engine = makeLibpffFileProcessingEngine()
 * console.log(engine.descriptor.engine)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeLibpffFileProcessingEngine = (
  options: LibpffFileProcessingEngineOptions = LibpffFileProcessingEngineOptions.make({})
): FileProcessingEngineShape => ({
  descriptor: LibpffFileProcessingEngineDescriptor,
  detect: Effect.fn("LibpffFileProcessingEngine.detect")(function* (operation: DetectFileOperation) {
    return DetectionResult.make({
      confidence: operation.source.extension === "pst" ? 1 : 0,
      engine: LibpffFileProcessingEngineDescriptor.name,
      format: operation.source.extension === "pst" ? "pst" : "unknown",
      operationId: operation.operationId,
      sourceArtifactId: operation.source.id,
    });
  }),
  exportArchive: Effect.fn("LibpffFileProcessingEngine.exportArchive")(function* (operation: ExportArchiveOperation) {
    if (operation.format !== "pst") {
      return yield* FileProcessingOperationError.fromReason("unsupported-file-format", {
        artifactId: operation.source.id,
        engine: LibpffFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: `libpff only exports PST archives, not ${operation.format}.`,
        operationId: operation.operationId,
      });
    }

    if (!options.syntheticExport) {
      return yield* mapLibpffErrorToOperationError(makeLibpffError("engine-unavailable"), operation);
    }

    const childRelativePath = yield* decodeLibpffArtifactPath("children/synthetic-libpff-message.txt", operation);
    const childArtifactId = yield* deriveLibpffChildArtifactId(operation, childRelativePath);
    const child = ArtifactReference.make({
      id: childArtifactId,
      mediaType: "text/plain",
      relativePath: childRelativePath,
      sizeBytes: NonNegativeInt.make(34),
    });

    return ArchiveExportResult.make({
      children: [child],
      engine: LibpffFileProcessingEngineDescriptor.name,
      operationId: operation.operationId,
      sourceArtifactId: operation.source.id,
      warnings: [],
    });
  }),
  extract: Effect.fn("LibpffFileProcessingEngine.extract")(function* (operation: ExtractFileOperation) {
    return yield* FileProcessingOperationError.fromReason("unsupported-file-format", {
      artifactId: operation.source.id,
      engine: LibpffFileProcessingEngineDescriptor.name,
      format: operation.format,
      message: "libpff does not expose direct text extraction in the P1 proof.",
      operationId: operation.operationId,
    });
  }),
});

/**
 * P1 libpff file-processing engine value with typed unavailable deferrals.
 *
 * @example
 * ```ts
 * import { LibpffFileProcessingEngine } from "@beep/libpff"
 *
 * console.log(LibpffFileProcessingEngine.descriptor.engine) // "libpff"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const LibpffFileProcessingEngine: FileProcessingEngineShape = makeLibpffFileProcessingEngine();
