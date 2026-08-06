/**
 * Tika Server HTTP text and metadata extraction engine.
 *
 * This is the default V1 runner: extraction happens over
 * `PUT {baseUrl}/rmeta/text` against a Tika Server sidecar, and the runtime
 * engine version is captured once from `GET {baseUrl}/version` at construction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ExtractionResult } from "@beep/file-processing/Extraction";
import { FileProcessingOperationError } from "@beep/file-processing/Operation";
import { FileProcessingEngineDescriptor } from "@beep/file-processing/Strategy";
import { NonNegativeInt } from "@beep/schema";
import { A, O } from "@beep/utils";
import { Config, Effect, flow, Order, pipe, Stream } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import {
  BEEP_TIKA_BASE_URL_ENV,
  BEEP_TIKA_MAX_OUTPUT_BYTES_ENV,
  BEEP_TIKA_TIMEOUT_MILLIS_ENV,
  TIKA_ENGINE_NAME,
  TIKA_SERVER_URL,
  TikaServerEngineConfig,
} from "./Tika.config.ts";
import { tikaOperationError } from "./Tika.error-translation.ts";
import { makeTikaError } from "./Tika.errors.ts";
import { decodeTikaResponseRecord, readTikaContentText, stringifyTikaMetadata } from "./Tika.response.ts";
import { TikaFileProcessingEngine, TikaFileProcessingEngineDescriptor } from "./Tika.service.ts";
import type { ExportArchiveOperation, ExtractFileOperation } from "@beep/file-processing/Operation";
import type { FileProcessingEngineShape } from "@beep/file-processing/Service";
import type { FileFormatFamily } from "@beep/file-processing/Strategy";
import type { TikaError } from "./Tika.errors.ts";

const versionPath = "/version";
const rmetaPath = "/rmeta/text";
const defaultMediaType = "application/octet-stream";
const headerUnsafePattern = /["\r\n]/g;
const textEncoder = new TextEncoder();

const outOfScopeFormats: ReadonlyArray<FileFormatFamily> = ["docm", "xls", "xlsx"];
const serverExtractionFormats: ReadonlyArray<FileFormatFamily> = [
  "doc",
  "docx",
  "rtf",
  "html",
  "xhtml",
  "pdf-text-layer",
  "plain-text",
  "markdown",
  "image-metadata",
];

const describeServerEngine = (version: O.Option<string>): FileProcessingEngineDescriptor =>
  FileProcessingEngineDescriptor.make({
    capabilities: TikaFileProcessingEngineDescriptor.capabilities,
    engine: TikaFileProcessingEngineDescriptor.engine,
    name: TikaFileProcessingEngineDescriptor.name,
    supportedFormats: TikaFileProcessingEngineDescriptor.supportedFormats,
    ...O.getSomesStruct({ version }),
  });

const contentDisposition = (name: string): string =>
  `attachment; filename="${Str.replace(headerUnsafePattern, "")(name)}"`;

// The effective budget is the smaller of the driver and per-operation values;
// when neither is present the extraction is unbounded.
const effectiveOutputBudget = (configBudget: O.Option<number>, operationBudget: O.Option<number>): O.Option<number> =>
  pipe(
    A.getSomes([configBudget, operationBudget]),
    A.match({
      onEmpty: O.none<number>,
      onNonEmpty: (budgets) => O.some(A.min(budgets, Order.Number)),
    })
  );

const unreadableBody = () => makeTikaError("response-decoding", { cause: "tika server response body was unreadable" });

// Enforces the budget against the RAW response body while it streams, so an
// oversized response fails before it is materialized or parsed. The budget
// therefore covers the whole `/rmeta/text` document — JSON envelope, metadata,
// and extracted text alike — not just the text Tika extracted. Peak memory is
// bounded by the budget plus one transport chunk.
const readBoundedBody = (
  response: HttpClientResponse.HttpClientResponse,
  budget: O.Option<number>
): Effect.Effect<string, TikaError> =>
  O.match(budget, {
    onNone: () => response.text.pipe(Effect.mapError(unreadableBody)),
    onSome: (limit) =>
      response.stream.pipe(
        Stream.mapError(unreadableBody),
        Stream.mapAccumEffect(
          () => 0,
          (total, chunk: Uint8Array) => {
            const seen = total + chunk.length;
            return seen > limit
              ? Effect.fail(makeTikaError("output-budget", { cause: `${seen} bytes exceeds budget ${limit}` }))
              : Effect.succeed([seen, [chunk]] as const);
          }
        ),
        Stream.decodeText(),
        Stream.mkString
      ),
  });

const operationFailure = (
  operation: ExtractFileOperation,
  reason: "file-extraction-failed" | "unsupported-file-format",
  message: string
): FileProcessingOperationError =>
  FileProcessingOperationError.fromReason(reason, {
    artifactId: operation.source.id,
    engine: TIKA_ENGINE_NAME,
    format: operation.format,
    message,
    operationId: operation.operationId,
  });

const configFromEnvironment: Effect.Effect<TikaServerEngineConfig, TikaError> = Effect.gen(function* () {
  const baseUrl = yield* Config.string(BEEP_TIKA_BASE_URL_ENV).pipe(Config.withDefault(TIKA_SERVER_URL));
  const maxOutputBytes = yield* Config.int(BEEP_TIKA_MAX_OUTPUT_BYTES_ENV).pipe(Config.option);
  const timeoutMillis = yield* Config.int(BEEP_TIKA_TIMEOUT_MILLIS_ENV).pipe(Config.option);

  return yield* S.decodeUnknownEffect(TikaServerEngineConfig)({
    baseUrl,
    ...O.getSomesStruct({ maxOutputBytes, timeoutMillis }),
  });
}).pipe(Effect.mapError(() => makeTikaError("config", { cause: "BEEP_TIKA_* configuration was unreadable" })));

/**
 * Create the Tika Server HTTP file-processing engine.
 *
 * Captures the HTTP client and filesystem at construction so the returned
 * engine satisfies the requirement-free {@link FileProcessingEngineShape}
 * contract, and probes `GET {baseUrl}/version` once to populate
 * `descriptor.version`. A failed probe leaves the version unset rather than
 * failing construction; later extractions then fail as `engine-unavailable`.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { makeTikaServerFileProcessingEngine, TikaServerEngineConfig } from "@beep/tika"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}))
 *   return engine.descriptor.engine
 * })
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param config - Base URL, per-file timeout, and output budget for the Tika Server sidecar.
 * @returns The constructed engine.
 * @effects Requires an `HttpClient`; the returned engine fails through the operation error channel only.
 * @category constructors
 * @since 0.0.0
 */
export const makeTikaServerFileProcessingEngine = Effect.fn("Tika.makeTikaServerFileProcessingEngine")(function* (
  config: TikaServerEngineConfig
): Effect.fn.Return<FileProcessingEngineShape, never, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;

  const timeout = `${config.timeoutMillis} millis` as const;

  const version = yield* client.execute(HttpClientRequest.get(`${config.baseUrl}${versionPath}`)).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap((response) => response.text),
    Effect.timeoutOrElse({ duration: timeout, orElse: () => Effect.fail(makeTikaError("timeout")) }),
    Effect.option,
    Effect.map(O.flatMap(flow(Str.trim, O.liftPredicate(Str.isNonEmpty))))
  );

  const descriptor = describeServerEngine(version);

  const readSourceBytes = Effect.fn("TikaServerEngine.readSourceBytes")(function* (
    operation: ExtractFileOperation
  ): Effect.fn.Return<Uint8Array, FileProcessingOperationError> {
    const { source } = operation;

    if (source.bytes !== undefined) {
      return source.bytes;
    }

    if (source.text !== undefined) {
      return textEncoder.encode(source.text);
    }

    return yield* operationFailure(
      operation,
      "file-extraction-failed",
      "Tika extraction requires caller-supplied bytes or text; file locators are not trusted read authority."
    );
  });

  const requestRmeta = Effect.fn("TikaServerEngine.requestRmeta")(function* (
    operation: ExtractFileOperation,
    bytes: Uint8Array
  ): Effect.fn.Return<string, TikaError> {
    const mediaType = operation.source.mediaType ?? defaultMediaType;
    const request = HttpClientRequest.put(`${config.baseUrl}${rmetaPath}`, {
      acceptJson: true,
      headers: { "content-disposition": contentDisposition(operation.source.name) },
    }).pipe(HttpClientRequest.bodyUint8Array(bytes, mediaType));

    const response = yield* client
      .execute(request)
      .pipe(Effect.mapError(() => makeTikaError("transport", { cause: "tika server request failed" })));

    if (response.status < 200 || response.status >= 300) {
      return yield* makeTikaError("response-status", { statusCode: NonNegativeInt.make(response.status) });
    }

    return yield* readBoundedBody(
      response,
      effectiveOutputBudget(config.maxOutputBytes, O.fromUndefinedOr(operation.maxMaterializedBytes))
    );
  });

  const extractImpl = Effect.fn("TikaServerEngine.extractImpl")(function* (
    operation: ExtractFileOperation,
    bytes: Uint8Array
  ): Effect.fn.Return<ExtractionResult, TikaError> {
    const payload = yield* requestRmeta(operation, bytes).pipe(
      Effect.timeoutOrElse({ duration: timeout, orElse: () => Effect.fail(makeTikaError("timeout")) })
    );
    const record = yield* decodeTikaResponseRecord(payload);
    const text = operation.format === "image-metadata" ? O.none<string>() : readTikaContentText(record);

    return ExtractionResult.make({
      engine: TIKA_ENGINE_NAME,
      format: operation.format,
      metadata: stringifyTikaMetadata(record),
      operationId: operation.operationId,
      sourceArtifactId: operation.source.id,
      warnings: [],
      ...O.getSomesStruct({ text }),
    });
  });

  const engine: FileProcessingEngineShape = {
    descriptor,
    detect: TikaFileProcessingEngine.detect,
    exportArchive: Effect.fn("TikaServerEngine.exportArchive")(function* (operation: ExportArchiveOperation) {
      return yield* FileProcessingOperationError.fromReason("unsupported-file-format", {
        artifactId: operation.source.id,
        engine: TIKA_ENGINE_NAME,
        format: operation.format,
        message: "Tika Server does not export archive children.",
        operationId: operation.operationId,
      });
    }),
    extract: Effect.fn("TikaServerEngine.extract")(function* (operation: ExtractFileOperation) {
      if (A.contains(outOfScopeFormats, operation.format)) {
        return yield* operationFailure(
          operation,
          "unsupported-file-format",
          `${operation.format} is classified deterministically but deep extraction is out of scope for V1.`
        );
      }

      if (!A.contains(serverExtractionFormats, operation.format)) {
        return yield* operationFailure(
          operation,
          "unsupported-file-format",
          `Tika Server extraction does not support ${operation.format}.`
        );
      }

      const bytes = yield* readSourceBytes(operation);

      return yield* extractImpl(operation, bytes).pipe(
        Effect.tapError((error) => Effect.logDebug("Tika Server extraction failed", error)),
        Effect.mapError((error) => tikaOperationError(operation, error))
      );
    }),
  };

  return engine;
});

/**
 * Create the Tika Server engine from the `BEEP_TIKA_*` environment.
 *
 * Reads `BEEP_TIKA_BASE_URL`, `BEEP_TIKA_TIMEOUT_MILLIS`, and
 * `BEEP_TIKA_MAX_OUTPUT_BYTES` through Effect `Config`, falling back to the
 * schema defaults for absent keys.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { makeTikaServerFileProcessingEngineFromEnv } from "@beep/tika"
 * import { Effect } from "effect"
 *
 * const program = makeTikaServerFileProcessingEngineFromEnv()
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @returns The constructed engine.
 * @effects Requires an `HttpClient` and a `FileSystem`; fails with a `config` {@link TikaError} when the environment cannot be read or decoded.
 * @category constructors
 * @since 0.0.0
 */
export const makeTikaServerFileProcessingEngineFromEnv = Effect.fn("Tika.makeTikaServerFileProcessingEngineFromEnv")(
  function* (): Effect.fn.Return<FileProcessingEngineShape, TikaError, HttpClient.HttpClient> {
    return yield* makeTikaServerFileProcessingEngine(yield* configFromEnvironment);
  }
);
