/**
 * Runtime-neutral file-processing service Layer construction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O } from "@beep/utils";
import { Effect, Layer, pipe } from "effect";
import {
  ArchiveExportProcessFileResult,
  ExtractedProcessFileResult,
  SkippedProcessFileResult,
} from "../Extraction/Extraction.schema.ts";
import { FileProcessingOperationError } from "../Operation/Operation.errors.ts";
import { FileFormatFamily as FileFormatFamilySchema } from "../Strategy/Strategy.schema.ts";
import { FileProcessingService } from "./FileProcessing.service.ts";
import type * as Crypto from "effect/Crypto";
import type { DetectionResult, ProcessFileOperation } from "../Operation/Operation.schema.ts";
import type {
  FileFormatFamily,
  FileProcessingCapability,
  FileProcessingEngineDescriptor,
} from "../Strategy/Strategy.schema.ts";
import type { FileProcessingEngineShape } from "./FileProcessing.service.ts";

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
    Effect.fromOption(() =>
      FileProcessingOperationError.fromReason("engine-unavailable", {
        message: `No file-processing engine is available for preference "${preferredEngine}".`,
      })
    )
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

  return yield* FileProcessingOperationError.fromReason("engine-unavailable", {
    message: `No file-processing detection engine is available for preference "${operation.preference.engine}".`,
  });
});

/**
 * Build a runtime-neutral file-processing service layer from concrete drivers.
 *
 * **Example** (Layer from test engines)
 *
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
 * @param engines - Concrete driver engines available to this runtime.
 * @returns Layer for {@link FileProcessingService}.
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
