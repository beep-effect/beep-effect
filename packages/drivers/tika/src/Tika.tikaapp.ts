/**
 * Real tika-app-backed text and metadata extraction engine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ExtractionResult } from "@beep/file-processing/Extraction";
import { FileProcessingOperationError } from "@beep/file-processing/Operation";
import { $TikaId } from "@beep/identity";
import { PosInt, SchemaUtils } from "@beep/schema";
import { O } from "@beep/utils";
import { Effect, Stream } from "effect";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { tikaOperationError } from "./Tika.error-translation.ts";
import { makeTikaError } from "./Tika.errors.ts";
import { decodeTikaResponseRecord, readTikaContentText, stringifyTikaMetadata } from "./Tika.response.ts";
import { TikaFileProcessingEngine, TikaFileProcessingEngineDescriptor } from "./Tika.service.ts";
import type { ExportArchiveOperation, ExtractFileOperation } from "@beep/file-processing/Operation";
import type { FileProcessingEngineShape } from "@beep/file-processing/Service";
import type { TikaError } from "./Tika.errors.ts";

const $I = $TikaId.create("Tika.tikaapp");

const defaultJavaPath = "java";
const defaultTimeoutMillis = 120_000;
const defaultForceKillAfterMillis = 10_000;

/**
 * Configuration for the tika-app subprocess engine.
 *
 * @example
 * ```ts
 * import { TikaAppEngineConfig } from "@beep/tika"
 *
 * const config = TikaAppEngineConfig.make({ jarPath: "/opt/tika/tika-app.jar" })
 * console.log(config.jarPath)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class TikaAppEngineConfig extends S.Class<TikaAppEngineConfig>($I`TikaAppEngineConfig`)(
  {
    jarPath: S.NonEmptyString.annotateKey({
      description: "Path to the tika-app JAR file.",
    }),
    javaPath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults(defaultJavaPath)).annotateKey({
      description: "Java executable command or path used to run tika-app.",
    }),
    timeoutMillis: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(defaultTimeoutMillis))).annotateKey({
      description: "Per-file tika-app extraction timeout in milliseconds.",
    }),
  },
  $I.annote("TikaAppEngineConfig", {
    description: "Configuration for the real tika-app subprocess engine: jar path, java binary, and per-file timeout.",
  })
) {}

/**
 * Create the real tika-app-backed file-processing engine.
 *
 * Captures the process-spawner service at construction so the returned
 * engine satisfies the requirement-free {@link FileProcessingEngineShape}
 * contract. `extract` runs `java -jar tika-app.jar -J -t` against the
 * source file and returns trimmed text plus stringified metadata; the
 * `image-metadata` format returns metadata only.
 *
 * @example
 * ```ts
 * import { makeTikaAppFileProcessingEngine, TikaAppEngineConfig } from "@beep/tika"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const engine = yield* makeTikaAppFileProcessingEngine(
 *     TikaAppEngineConfig.make({ jarPath: "/opt/tika/tika-app.jar" })
 *   )
 *   return engine.descriptor.engine
 * })
 *
 * console.log(program)
 * ```
 *
 * @effects Requires {@link ChildProcessSpawner.ChildProcessSpawner}; the returned engine fails through the operation error channel only.
 * @category constructors
 * @since 0.0.0
 */
export const makeTikaAppFileProcessingEngine = Effect.fn("Tika.makeTikaAppFileProcessingEngine")(function* (
  config: TikaAppEngineConfig
): Effect.fn.Return<FileProcessingEngineShape, never, ChildProcessSpawner.ChildProcessSpawner> {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const runTika = Effect.fn("Tika.tikaapp.run")(function* (sourcePath: string): Effect.fn.Return<string, TikaError> {
    const command = ChildProcess.make(config.javaPath, ["-jar", config.jarPath, "-J", "-t", sourcePath], {
      forceKillAfter: `${defaultForceKillAfterMillis} millis`,
      stdin: "ignore",
      stderr: "ignore",
      stdout: "pipe",
    });

    const result = yield* Effect.scoped(
      spawner.spawn(command).pipe(
        Effect.flatMap((handle) =>
          Effect.all(
            {
              exitCode: handle.exitCode,
              stdout: handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
            },
            { concurrency: "unbounded" }
          )
        )
      )
    ).pipe(
      Effect.tapError((error) =>
        Effect.logDebug("Tika App process failed").pipe(
          Effect.annotateLogs({
            "process.error_kind": error.reason._tag,
            "process.method": error.reason.method,
            "process.module": error.reason.module,
            "tika.engine": "tika-app",
            "tika.operation": "extract",
          })
        )
      ),
      Effect.mapError(() => makeTikaError("engine-unavailable", { cause: "tika spawn failed" }))
    );

    if (result.exitCode !== 0) {
      return yield* makeTikaError("response-status", { cause: `exit ${result.exitCode}` });
    }

    return result.stdout;
  });

  const extractImpl = Effect.fn("TikaAppEngine.extractImpl")(function* (
    operation: ExtractFileOperation
  ): Effect.fn.Return<ExtractionResult, TikaError> {
    const stdout = yield* runTika(operation.source.locator.value).pipe(
      Effect.timeoutOrElse({
        duration: `${config.timeoutMillis} millis`,
        orElse: () => Effect.fail(makeTikaError("timeout")),
      })
    );
    const record = yield* decodeTikaResponseRecord(stdout);
    const text = readTikaContentText(record);

    return ExtractionResult.make({
      engine: TikaFileProcessingEngineDescriptor.name,
      format: operation.format,
      metadata: stringifyTikaMetadata(record),
      operationId: operation.operationId,
      sourceArtifactId: operation.source.id,
      warnings: [],
      ...(operation.format === "image-metadata" || O.isNone(text) ? {} : { text: text.value }),
    });
  });

  const engine: FileProcessingEngineShape = {
    descriptor: TikaFileProcessingEngineDescriptor,
    detect: TikaFileProcessingEngine.detect,
    exportArchive: Effect.fn("TikaAppEngine.exportArchive")(function* (operation: ExportArchiveOperation) {
      return yield* FileProcessingOperationError.fromReason("unsupported-file-format", {
        artifactId: operation.source.id,
        engine: TikaFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "tika-app does not export archive children.",
        operationId: operation.operationId,
      });
    }),
    extract: Effect.fn("TikaAppEngine.extract")(function* (operation: ExtractFileOperation) {
      if (operation.source.locator.kind !== "file") {
        return yield* FileProcessingOperationError.fromReason("file-extraction-failed", {
          artifactId: operation.source.id,
          engine: TikaFileProcessingEngineDescriptor.name,
          format: operation.format,
          message: "tika-app extraction requires a file locator for the source artifact.",
          operationId: operation.operationId,
        });
      }

      return yield* extractImpl(operation).pipe(Effect.mapError((error) => tikaOperationError(operation, error)));
    }),
  };

  return engine;
});
