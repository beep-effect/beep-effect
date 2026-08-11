/**
 * Runtime-neutral file-processing service contracts and accessors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { A, O } from "@beep/utils";
import { Context, Effect } from "effect";
import type * as Crypto from "effect/Crypto";
import type { FileProcessingFailureRecord, SourceProcessingRecord } from "../Extraction/Extraction.manifest.ts";
import type { ArchiveExportResult, ExtractionResult, ProcessFileResult } from "../Extraction/Extraction.schema.ts";
import type { FileProcessingOperationError } from "../Operation/Operation.errors.ts";
import type {
  DetectFileOperation,
  DetectionResult,
  ExportArchiveOperation,
  ExtractFileOperation,
  ProcessFileOperation,
} from "../Operation/Operation.schema.ts";
import type { FileProcessingEngineDescriptor } from "../Strategy/Strategy.schema.ts";

const $I = $FileProcessingId.create("Service");

/**
 * Runtime-neutral file-processing engine shape implemented by drivers.
 *
 * **Example** (Pick engine method keys)
 *
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
 * **Example** (Service method type keys)
 *
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
 * **Example** (Provide service with layer)
 *
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

/**
 * Fold per-source processing outcomes into their source and failure records.
 *
 * **Example** (Collect empty outcome records)
 *
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
 * Detect a source artifact with the configured service.
 *
 * **Example** (Detect markdown artifact)
 *
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
 * **Example** (Extract plain-text content)
 *
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
 * **Example** (Export PST archive children)
 *
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
 * **Example** (Process source to extract)
 *
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
