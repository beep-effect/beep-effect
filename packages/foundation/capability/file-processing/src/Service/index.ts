/**
 * Effect service contracts for runtime-neutral file processing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ArchiveExportProcessFileResult,
  ExtractedProcessFileResult,
  SkippedProcessFileResult,
} from "@beep/file-processing/Extraction";
import { FileFormatFamily as FileFormatFamilySchema } from "@beep/file-processing/Strategy";
import { $FileProcessingId } from "@beep/identity";
import { A, O } from "@beep/utils";
import { Context, Effect, Layer, pipe } from "effect";
import { FileProcessingOperationError as OperationError } from "../Operation/index.ts";
import type {
  ArchiveExportResult,
  ExtractionResult,
  FileProcessingFailureRecord,
  ProcessFileResult,
  SourceProcessingRecord,
} from "@beep/file-processing/Extraction";
import type {
  DetectFileOperation,
  DetectionResult,
  ExportArchiveOperation,
  ExtractFileOperation,
  FileProcessingOperationError,
  ProcessFileOperation,
} from "@beep/file-processing/Operation";
import type {
  FileFormatFamily,
  FileProcessingCapability,
  FileProcessingEngineDescriptor,
} from "@beep/file-processing/Strategy";
import type * as Crypto from "effect/Crypto";

const $I = $FileProcessingId.create("Service");

/**
 * Runtime-neutral file-processing engine shape implemented by drivers.
 *
 * @example
 * ```ts
 * import type { FileProcessingEngineShape } from "@beep/file-processing/Service"
 *
 * type EngineMethod = keyof Pick<FileProcessingEngineShape, "detect" | "exportArchive" | "extract">
 * const method: EngineMethod = "detect"
 *
 * console.log(method) // "detect"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type FileProcessingEngineShape = {
  readonly descriptor: FileProcessingEngineDescriptor;
  readonly detect: (operation: DetectFileOperation) => Effect.Effect<DetectionResult, FileProcessingOperationError>;
  readonly exportArchive: (
    operation: ExportArchiveOperation
  ) => Effect.Effect<ArchiveExportResult, FileProcessingOperationError, Crypto.Crypto>;
  readonly extract: (operation: ExtractFileOperation) => Effect.Effect<ExtractionResult, FileProcessingOperationError>;
};

/**
 * Service contract exposed by the file-processing capability.
 *
 * @example
 * ```ts
 * import type { FileProcessingServiceShape } from "@beep/file-processing/Service"
 *
 * type ServiceMethod = keyof FileProcessingServiceShape
 * const method: ServiceMethod = "process"
 *
 * console.log(method) // "process"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type FileProcessingServiceShape = {
  readonly detect: (operation: DetectFileOperation) => Effect.Effect<DetectionResult, FileProcessingOperationError>;
  readonly exportArchive: (
    operation: ExportArchiveOperation
  ) => Effect.Effect<ArchiveExportResult, FileProcessingOperationError>;
  readonly extract: (operation: ExtractFileOperation) => Effect.Effect<ExtractionResult, FileProcessingOperationError>;
  readonly process: (operation: ProcessFileOperation) => Effect.Effect<ProcessFileResult, FileProcessingOperationError>;
};

/**
 * File-processing service tag.
 *
 * @example
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { FileProcessingService } from "@beep/file-processing/Service"
 * import { makeFileProcessingServiceLayer } from "@beep/file-processing/Service"
 * import { TestFileProcessingEngine } from "@beep/file-processing/test"
 * import { Effect } from "effect"
 *
 * const program = FileProcessingService.pipe(
 *   Effect.map((service) => typeof service.process),
 *   Effect.provide(makeFileProcessingServiceLayer([TestFileProcessingEngine])),
 *   Effect.provide(BunCrypto.layer)
 * )
 *
 * Effect.runPromise(program).then(console.log) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FileProcessingService extends Context.Service<FileProcessingService, FileProcessingServiceShape>()(
  $I`FileProcessingService`
) {}

const selectEngine = (
  engines: ReadonlyArray<FileProcessingEngineShape>,
  preferredEngine: FileProcessingEngineDescriptor["engine"],
  capability?: FileProcessingCapability,
  format?: FileFormatFamily
): Effect.Effect<FileProcessingEngineShape, FileProcessingOperationError> =>
  pipe(
    engines,
    A.findFirst(
      (engine) =>
        engine.descriptor.matchesPreference(preferredEngine) &&
        (capability === undefined || engine.descriptor.supportsCapability(capability)) &&
        (format === undefined || engine.descriptor.supportsFormat(format))
    ),
    O.match({
      onNone: () =>
        Effect.fail(
          OperationError.fromReason("engine-unavailable", {
            message: `No file-processing engine is available for preference "${preferredEngine}".`,
          })
        ),
      onSome: Effect.succeed,
    })
  );

const detectWithAvailableEngine = Effect.fn("FileProcessingService.detectWithAvailableEngine")(function* (
  engines: ReadonlyArray<FileProcessingEngineShape>,
  operation: ProcessFileOperation
): Effect.fn.Return<readonly [FileProcessingEngineShape, DetectionResult], FileProcessingOperationError> {
  const candidates = A.filter(
    engines,
    (engine) =>
      engine.descriptor.matchesPreference(operation.preference.engine) && engine.descriptor.supportsCapability("detect")
  );
  let lastDetected = O.none<readonly [FileProcessingEngineShape, DetectionResult]>();

  for (const engine of candidates) {
    const detected = yield* engine.detect({
      operationId: operation.operationId,
      operationKind: "detect",
      preference: operation.preference,
      source: operation.source,
    });

    if (detected.format !== "unknown") {
      return [engine, detected];
    }

    lastDetected = O.some([engine, detected]);
  }

  if (O.isSome(lastDetected)) {
    return lastDetected.value;
  }

  return yield* OperationError.fromReason("engine-unavailable", {
    message: `No file-processing detection engine is available for preference "${operation.preference.engine}".`,
  });
});

/**
 * Fold per-source processing outcomes into their source and failure records.
 *
 * @example
 * ```ts
 * import { collectSourceOutcomeRecords } from "@beep/file-processing/Service"
 *
 * const records = collectSourceOutcomeRecords([])
 * console.log(records.sourceRecords.length)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const collectSourceOutcomeRecords = (
  outcomes: ReadonlyArray<{
    readonly failure: O.Option<FileProcessingFailureRecord>;
    readonly sourceRecord: SourceProcessingRecord;
  }>
): {
  readonly failureRecords: Array<FileProcessingFailureRecord>;
  readonly sourceRecords: Array<SourceProcessingRecord>;
} => ({
  failureRecords: A.flatMap(outcomes, (outcome) => O.toArray(outcome.failure)),
  sourceRecords: A.map(outcomes, (outcome) => outcome.sourceRecord),
});

/**
 * Build a runtime-neutral file-processing service layer from concrete drivers.
 *
 * @param engines - Concrete driver engines available to this runtime.
 * @returns Layer for {@link FileProcessingService}.
 * @example
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { FileProcessingService, makeFileProcessingServiceLayer } from "@beep/file-processing/Service"
 * import { TestFileProcessingEngine } from "@beep/file-processing/test"
 * import { Effect } from "effect"
 *
 * const program = FileProcessingService.pipe(
 *   Effect.map((service) => typeof service.detect),
 *   Effect.provide(makeFileProcessingServiceLayer([TestFileProcessingEngine])),
 *   Effect.provide(BunCrypto.layer)
 * )
 *
 * Effect.runPromise(program).then(console.log) // "function"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeFileProcessingServiceLayer = (
  engines: ReadonlyArray<FileProcessingEngineShape>
): Layer.Layer<FileProcessingService, never, Crypto.Crypto> =>
  Layer.effect(
    FileProcessingService,
    Effect.gen(function* () {
      const cryptoContext = yield* Effect.context<Crypto.Crypto>();

      return FileProcessingService.of({
        detect: Effect.fn("FileProcessingService.detect")(function* (operation) {
          const engine = yield* selectEngine(engines, operation.preference.engine);
          return yield* engine.detect(operation);
        }),
        exportArchive: Effect.fn("FileProcessingService.exportArchive")(function* (operation) {
          const engine = yield* selectEngine(engines, operation.preference.engine);
          return yield* engine.exportArchive(operation).pipe(Effect.provide(cryptoContext));
        }),
        extract: Effect.fn("FileProcessingService.extract")(function* (operation) {
          const engine = yield* selectEngine(engines, operation.preference.engine);
          return yield* engine.extract(operation);
        }),
        process: Effect.fn("FileProcessingService.process")(function* (operation) {
          const [detectionEngine, detected] = yield* detectWithAvailableEngine(engines, operation);

          if (detected.format === "pst") {
            if (!operation.exportChildren) {
              return SkippedProcessFileResult.make({
                engine: detectionEngine.descriptor.name,
                format: detected.format,
                operationId: operation.operationId,
                resultKind: "skipped",
                skipReason: "operation-not-required",
                sourceArtifactId: operation.source.id,
                warnings: ["Archive export was not requested for this source."],
              });
            }

            const archiveEngine = yield* selectEngine(
              engines,
              operation.preference.engine,
              "export-children",
              detected.format
            );
            const archiveExport = yield* archiveEngine
              .exportArchive({
                format: detected.format,
                operationId: operation.operationId,
                operationKind: "export-archive",
                preference: operation.preference,
                source: operation.source,
                ...O.getSomesStruct({
                  maxMaterializedBytes: O.fromUndefinedOr(operation.maxMaterializedBytes),
                }),
              })
              .pipe(Effect.provide(cryptoContext));

            return ArchiveExportProcessFileResult.make({
              archiveExport,
              engine: archiveEngine.descriptor.name,
              format: detected.format,
              operationId: operation.operationId,
              resultKind: "archive-exported",
              sourceArtifactId: operation.source.id,
              warnings: archiveExport.warnings,
            });
          }

          const extractionEngine = yield* selectEngine(
            engines,
            operation.preference.engine,
            FileFormatFamilySchema.processCapability(detected.format),
            detected.format
          );
          const extraction = yield* extractionEngine.extract({
            format: detected.format,
            operationId: operation.operationId,
            operationKind: "extract",
            preference: operation.preference,
            source: operation.source,
            ...O.getSomesStruct({
              maxMaterializedBytes: O.fromUndefinedOr(operation.maxMaterializedBytes),
            }),
          });

          return ExtractedProcessFileResult.make({
            engine: extractionEngine.descriptor.name,
            extraction,
            format: extraction.format,
            operationId: operation.operationId,
            resultKind: "extracted",
            sourceArtifactId: operation.source.id,
            warnings: extraction.warnings,
          });
        }),
      });
    })
  );

/**
 * Detect a source artifact with the configured service.
 *
 * @example
 * ```ts
 * import { ArtifactId, ArtifactLocator, ContentDigest, SourceArtifact, OperationId } from "@beep/file-processing/Artifact"
 * import { DetectFileOperation } from "@beep/file-processing/Operation"
 * import { detectFile, makeFileProcessingServiceLayer } from "@beep/file-processing/Service"
 * import { TestFileProcessingEngine } from "@beep/file-processing/test"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const digest = yield* S.decodeUnknownEffect(ContentDigest)("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("README.md")
 *   const source = SourceArtifact.make({
 *     digest,
 *     extension: "md",
 *     id: artifactId,
 *     locator: ArtifactLocator.make({ kind: "synthetic", value: relativePath }),
 *     name: "README.md",
 *     relativePath,
 *     sizeBytes: NonNegativeInt.make(11),
 *     text: "hello"
 *   })
 *
 *   return yield* detectFile(DetectFileOperation.make({
 *     operationId,
 *     operationKind: "detect",
 *     preference: { engine: "test" },
 *     source
 *   })).pipe(Effect.provide(makeFileProcessingServiceLayer([TestFileProcessingEngine])))
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(BunCrypto.layer))).then((result) => console.log(result.format)) // "markdown"
 * ```
 *
 * @effects Requires {@link FileProcessingService}; delegates detection to the configured engine and fails through the operation error channel.
 * @category use-cases
 * @since 0.0.0
 */
export const detectFile = Effect.fn("FileProcessing.detectFile")(function* (
  operation: DetectFileOperation
): Effect.fn.Return<DetectionResult, FileProcessingOperationError, FileProcessingService> {
  const service = yield* FileProcessingService;
  return yield* service.detect(operation);
});

/**
 * Extract text and metadata from a source artifact with the configured service.
 *
 * @example
 * ```ts
 * import { ArtifactId, ArtifactLocator, ContentDigest, SourceArtifact, OperationId } from "@beep/file-processing/Artifact"
 * import { ExtractFileOperation } from "@beep/file-processing/Operation"
 * import { extractFile, makeFileProcessingServiceLayer } from "@beep/file-processing/Service"
 * import { TestFileProcessingEngine } from "@beep/file-processing/test"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const digest = yield* S.decodeUnknownEffect(ContentDigest)("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("note.txt")
 *   const source = SourceArtifact.make({
 *     digest,
 *     extension: "txt",
 *     id: artifactId,
 *     locator: ArtifactLocator.make({ kind: "synthetic", value: relativePath }),
 *     name: "note.txt",
 *     relativePath,
 *     sizeBytes: NonNegativeInt.make(5),
 *     text: "hello"
 *   })
 *
 *   return yield* extractFile(ExtractFileOperation.make({
 *     format: "plain-text",
 *     operationId,
 *     operationKind: "extract",
 *     preference: { engine: "test" },
 *     source
 *   })).pipe(Effect.provide(makeFileProcessingServiceLayer([TestFileProcessingEngine])))
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(BunCrypto.layer))).then((result) => console.log(result.text)) // "hello"
 * ```
 *
 * @effects Requires {@link FileProcessingService}; delegates extraction to the configured engine and fails through the operation error channel.
 * @category use-cases
 * @since 0.0.0
 */
export const extractFile = Effect.fn("FileProcessing.extractFile")(function* (
  operation: ExtractFileOperation
): Effect.fn.Return<ExtractionResult, FileProcessingOperationError, FileProcessingService> {
  const service = yield* FileProcessingService;
  return yield* service.extract(operation);
});

/**
 * Export child artifacts from an archive source with the configured service.
 *
 * @example
 * ```ts
 * import { ArtifactId, ArtifactLocator, ContentDigest, SourceArtifact, OperationId } from "@beep/file-processing/Artifact"
 * import { ExportArchiveOperation } from "@beep/file-processing/Operation"
 * import { exportArchive, makeFileProcessingServiceLayer } from "@beep/file-processing/Service"
 * import { TestFileProcessingEngine } from "@beep/file-processing/test"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const digest = yield* S.decodeUnknownEffect(ContentDigest)("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("mailbox.pst")
 *   const source = SourceArtifact.make({
 *     digest,
 *     extension: "pst",
 *     id: artifactId,
 *     locator: ArtifactLocator.make({ kind: "synthetic", value: relativePath }),
 *     name: "mailbox.pst",
 *     relativePath,
 *     sizeBytes: NonNegativeInt.make(128)
 *   })
 *
 *   return yield* exportArchive(ExportArchiveOperation.make({
 *     format: "pst",
 *     operationId,
 *     operationKind: "export-archive",
 *     preference: { engine: "test" },
 *     source
 *   })).pipe(Effect.provide(makeFileProcessingServiceLayer([TestFileProcessingEngine])))
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(BunCrypto.layer))).then((result) => console.log(result.children.length)) // 1
 * ```
 *
 * @effects Requires {@link FileProcessingService}; delegates archive export to the configured engine and fails through the operation error channel.
 * @category use-cases
 * @since 0.0.0
 */
export const exportArchive = Effect.fn("FileProcessing.exportArchive")(function* (
  operation: ExportArchiveOperation
): Effect.fn.Return<ArchiveExportResult, FileProcessingOperationError, FileProcessingService> {
  const service = yield* FileProcessingService;
  return yield* service.exportArchive(operation);
});

/**
 * Process a source artifact with the configured service.
 *
 * @example
 * ```ts
 * import { ArtifactId, ArtifactLocator, ContentDigest, SourceArtifact, OperationId } from "@beep/file-processing/Artifact"
 * import { ProcessFileOperation } from "@beep/file-processing/Operation"
 * import { makeFileProcessingServiceLayer, processFile } from "@beep/file-processing/Service"
 * import { TestFileProcessingEngine } from "@beep/file-processing/test"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const artifactId = yield* S.decodeUnknownEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const digest = yield* S.decodeUnknownEffect(ContentDigest)("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const operationId = yield* S.decodeUnknownEffect(OperationId)("operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   const relativePath = yield* S.decodeUnknownEffect(PosixPath)("note.txt")
 *   const source = SourceArtifact.make({
 *     digest,
 *     extension: "txt",
 *     id: artifactId,
 *     locator: ArtifactLocator.make({ kind: "synthetic", value: relativePath }),
 *     name: "note.txt",
 *     relativePath,
 *     sizeBytes: NonNegativeInt.make(5),
 *     text: "hello"
 *   })
 *
 *   return yield* processFile(ProcessFileOperation.make({
 *     exportChildren: false,
 *     operationId,
 *     operationKind: "process",
 *     preference: { engine: "test" },
 *     source
 *   })).pipe(Effect.provide(makeFileProcessingServiceLayer([TestFileProcessingEngine])))
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(BunCrypto.layer))).then((result) => console.log(result.resultKind)) // "extracted"
 * ```
 *
 * @effects Requires {@link FileProcessingService}; detects the source and then delegates extraction or archive export to configured engines.
 * @category use-cases
 * @since 0.0.0
 */
export const processFile = Effect.fn("FileProcessing.processFile")(function* (
  operation: ProcessFileOperation
): Effect.fn.Return<ProcessFileResult, FileProcessingOperationError, FileProcessingService> {
  const service = yield* FileProcessingService;
  return yield* service.process(operation);
});
