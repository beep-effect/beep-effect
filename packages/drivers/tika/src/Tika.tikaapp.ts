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
import { A, O } from "@beep/utils";
import { Effect, Match, Stream } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { makeTikaError } from "./Tika.errors.js";
import { TikaFileProcessingEngine, TikaFileProcessingEngineDescriptor } from "./Tika.service.js";
import type { ExportArchiveOperation, ExtractFileOperation } from "@beep/file-processing/Operation";
import type { FileProcessingEngineShape } from "@beep/file-processing/Service";
import type { TikaError } from "./Tika.errors.js";

const $I = $TikaId.create("Tika.tikaapp");

const defaultJavaPath = "java";
const defaultTimeoutMillis = 120_000;
const defaultForceKillAfterMillis = 10_000;
const tikaContentKey = "X-TIKA:content";

/**
 * Trim-normalized text emitted from tika-app JSON content.
 *
 * @example
 * ```ts
 * import { TikaContentText } from "@beep/tika"
 *
 * const text = TikaContentText.fromUnknown("  hello corpus\n")
 * console.log(text) // "hello corpus"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const TikaContentText = S.Trim.pipe(
  $I.annoteSchema("TikaContentText", {
    description: "Trim-normalized text emitted from the Apache Tika JSON content field.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link TikaContentText}.
 *
 * @example
 * ```ts
 * import type { TikaContentText } from "@beep/tika"
 *
 * const text: TikaContentText = "hello corpus"
 * console.log(text)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type TikaContentText = typeof TikaContentText.Type;

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

const operationFailure = (operation: ExtractFileOperation, error: TikaError): FileProcessingOperationError =>
  Match.value(error.reason).pipe(
    Match.when("engine-unavailable", () =>
      FileProcessingOperationError.fromReason("engine-unavailable", {
        artifactId: operation.source.id,
        engine: TikaFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "The Tika runtime is not available on this host.",
        operationId: operation.operationId,
      })
    ),
    Match.when("timeout", () =>
      FileProcessingOperationError.fromReason("operation-timed-out", {
        artifactId: operation.source.id,
        engine: TikaFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "Tika extraction timed out.",
        operationId: operation.operationId,
      })
    ),
    Match.orElse(() =>
      FileProcessingOperationError.fromReason("file-extraction-failed", {
        artifactId: operation.source.id,
        engine: TikaFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "Tika extraction failed inside the driver boundary.",
        operationId: operation.operationId,
        ...O.getSomesStruct({ details: O.map(error.cause, (cause) => ({ cause })) }),
      })
    )
  );

const metadataValueToString = (value: unknown): O.Option<string> => {
  if (P.isString(value)) {
    return O.some(value);
  }
  if (A.isArray(value)) {
    const strings = A.filter(value, P.isString);
    return A.length(strings) === 0 ? O.none() : O.some(A.join(strings, "; "));
  }
  if (P.isNumber(value) || P.isBoolean(value)) {
    return O.some(`${value}`);
  }
  return O.none();
};

const decodeTikaJsonRows = S.decodeUnknownEffect(S.fromJsonString(S.Array(S.Record(S.String, S.Unknown))));

const parseTikaJson = (stdout: string): Effect.Effect<Readonly<Record<string, unknown>>, TikaError> =>
  decodeTikaJsonRows(stdout).pipe(
    Effect.mapError(() => makeTikaError("response-decoding")),
    Effect.flatMap((rows) =>
      A.head(rows).pipe(
        O.match({
          onNone: () => Effect.fail(makeTikaError("response-decoding", { cause: "empty tika -J array" })),
          onSome: Effect.succeed,
        })
      )
    )
  );

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
      stderr: "pipe",
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
    ).pipe(Effect.mapError(() => makeTikaError("engine-unavailable", { cause: "tika spawn failed" })));

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
    const record = yield* parseTikaJson(stdout);
    const metadata = R.getSomes(R.map(R.remove(record, tikaContentKey), (value) => metadataValueToString(value)));
    const text = O.fromUndefinedOr(record[tikaContentKey]).pipe(O.flatMap(TikaContentText.decodeOption));

    return ExtractionResult.make({
      engine: TikaFileProcessingEngineDescriptor.name,
      format: operation.format,
      metadata,
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

      return yield* extractImpl(operation).pipe(Effect.mapError((error) => operationFailure(operation, error)));
    }),
  };

  return engine;
});
