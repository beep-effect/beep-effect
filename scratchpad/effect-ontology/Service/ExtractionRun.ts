/**
 * Service: Extraction Run Service
 *
 * **Details**
 *
 * Manages extraction runs with unique IDs and artifact storage in GCS.
 * Uses StorageService for cloud-native storage that works across multiple instances.
 *
 * Storage key structure:
 * - runs/{runId}/metadata.json - Run metadata and audit events
 * - runs/{runId}/input/document.txt - Original document
 * - runs/{runId}/input/chunks/chunk-{n}.txt - Text chunks
 * - runs/{runId}/outputs/{filename} - Output artifacts
 * - runs/key-index.json - Idempotency key lookup index
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils, Sha256Hex } from "@beep/schema";
import { NonNegativeInt } from "@beep/schema/Int";
import { Context, DateTime, Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ErrorMessage, OptionalErrorCause } from "../Domain/Error/Base.ts";
import type { ExtractionRunId, IdempotencyKey } from "../Domain/Identity.ts";
import {
  ChunkId,
  ContentHash,
  DocumentId,
  ExtractionRunId as ExtractionRunIdSchema,
  OntologyVersion,
} from "../Domain/Identity.ts";
import type { AuditErrorType, AuditEventType, RunConfig, RunStats } from "../Domain/Model/ExtractionRun.ts";
import { AuditError, AuditEvent, ExtractionRun, OutputMetadata, RunStatus } from "../Domain/Model/ExtractionRun.ts";
import { OutputType } from "../Domain/Model/OutputType.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ExtractionRun");

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate SHA-256 hash of content
 *
 * Uses cryptographic hash for collision resistance:
 * - 256-bit output space
 * - Birthday attack requires ~2^128 hashes
 *
 * @param content - Content to hash
 * @returns Full 64-character hex hash
 */
const sha256Hex = (content: string): string => createHash("sha256").update(content).digest("hex");

/**
 * Generate document ID from text using SHA-256
 *
 * Uses 32 hex characters (128 bits) for collision resistance.
 * Birthday attack threshold: ~2^64 documents before 50% collision probability.
 *
 * @param text - Document text to hash
 * @returns Deterministic document ID
 */
const generateDocumentId = (text: string): ExtractionRunId => {
  const documentId = DocumentId.fromContentHash(ContentHash.make(sha256Hex(text)));
  return ExtractionRunIdSchema.make(documentId);
};

/**
 * Get run ID from text (deterministic hash)
 *
 * **Example** (Derive a run id from source text)
 *
 * ```ts
 * import { getRunIdFromText } from "@effect-ontology/Service/ExtractionRun"
 *
 * const runId = getRunIdFromText("Ada founded Acme")
 * console.log(runId.startsWith("doc-")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const getRunIdFromText = (text: string): ExtractionRunId => generateDocumentId(text);

/**
 * Hash content for integrity checking
 */
const hashContent = (content: string): string => sha256Hex(content);

/**
 * Decode JSON string to ExtractionRun
 *
 * Uses S.decodeUnknownOption to properly construct all nested
 * S.Class instances (RunConfig, OntologyRef, etc.)
 */
const decodeExtractionRun = S.decodeUnknownEffect(S.fromJsonString(ExtractionRun));

// =============================================================================
// Storage Key Helpers
// =============================================================================

const RUNS_PREFIX = "runs";
const KEY_INDEX_FILE = "runs/key-index.json";

const runKey = (runId: ExtractionRunId, ...parts: Array<string>): string => [RUNS_PREFIX, runId, ...parts].join("/");

const metadataKey = (runId: ExtractionRunId): string => runKey(runId, "metadata.json");

const documentKey = (runId: ExtractionRunId): string => runKey(runId, "input", "document.txt");

const chunkKey = (runId: ExtractionRunId, chunkIndex: NonNegativeInt): string =>
  runKey(runId, "input", "chunks", `chunk-${chunkIndex}.txt`);

const outputKey = (runId: ExtractionRunId, filename: string): string => runKey(runId, "outputs", filename);

/**
 * Provides the extraction run error service capability.
 *
 * **Example** (Construct an extraction-run error)
 *
 * ```ts
 * import { ExtractionRunError } from "@effect-ontology/Service/ExtractionRun"
 *
 * const error = ExtractionRunError.make({
 *   message: "Run metadata is missing"
 * })
 * console.log(error._tag) // "ExtractionRunError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ExtractionRunError extends S.TaggedError<ExtractionRunError>($I`ExtractionRunError`)(
  "ExtractionRunError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable extraction-run failure diagnostic.",
    }),
    runId: S.OptionFromOptionalKey(ExtractionRunIdSchema).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional extraction run associated with the failure.",
      })
    ),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying storage or decoding defect.",
    }),
  },
  $I.annote("ExtractionRunError", {
    description: "Failure while reading, writing, or updating an extraction run.",
  })
) {
  static readonly is = S.is(this);
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Describes the extraction run service methods data exposed by this module.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ExtractionRunServiceMethods {
  /**
   * Create a new extraction run with embedded audit tracking
   */
  createRun(
    text: string,
    config: RunConfig,
    options?: {
      idempotencyKey?: IdempotencyKey;
      ontologyVersion?: string;
    }
  ): Effect.Effect<ExtractionRun, ExtractionRunError>;

  /**
   * Save a text chunk
   */
  saveChunk(
    runId: ExtractionRunId,
    chunkIndex: NonNegativeInt,
    chunkText: string
  ): Effect.Effect<ChunkId, ExtractionRunError>;

  /**
   * Save an output artifact
   */
  saveOutput(
    runId: ExtractionRunId,
    outputType: OutputType,
    content: string
  ): Effect.Effect<OutputMetadata, ExtractionRunError>;

  /**
   * Update run statistics
   */
  updateStats(runId: ExtractionRunId, stats: RunStats): Effect.Effect<void, ExtractionRunError>;

  /**
   * Complete the run
   */
  completeRun(runId: ExtractionRunId): Effect.Effect<ExtractionRun, ExtractionRunError>;

  /**
   * Get run by ID
   */
  getRun(runId: ExtractionRunId): Effect.Effect<ExtractionRun, ExtractionRunError>;

  /**
   * List all runs
   */
  readonly listRuns: Effect.Effect<ReadonlyArray<ExtractionRun>, ExtractionRunError>;

  // =========================================================================
  // Audit Methods (embedded in metadata.json)
  // =========================================================================

  /**
   * Check if a run exists by idempotency key
   */
  existsByKey(key: IdempotencyKey): Effect.Effect<boolean, ExtractionRunError>;

  /**
   * Get run by idempotency key
   */
  getByKey(key: IdempotencyKey): Effect.Effect<O.Option<ExtractionRun>, ExtractionRunError>;

  /**
   * Emit an audit event to the run's metadata
   */
  emitEvent(
    runId: ExtractionRunId,
    type: AuditEventType,
    data?: Record<string, unknown>
  ): Effect.Effect<void, ExtractionRunError>;

  /**
   * Record an audit error
   */
  recordError(
    runId: ExtractionRunId,
    type: AuditErrorType,
    message: string,
    context?: Record<string, unknown>
  ): Effect.Effect<void, ExtractionRunError>;

  /**
   * Update run status
   */
  setStatus(runId: ExtractionRunId, status: ExtractionRun["status"]): Effect.Effect<void, ExtractionRunError>;

  /**
   * Fail the run with an error
   */
  failRun(
    runId: ExtractionRunId,
    errorType: AuditErrorType,
    message: string,
    context?: Record<string, unknown>
  ): Effect.Effect<void, ExtractionRunError>;
}

/**
 * Provides the extraction run service service capability.
 *
 * **Example** (List stored runs)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ExtractionRunService, ExtractionRunServiceDefault } from "@effect-ontology/Service/ExtractionRun"
 * import { StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * const program = Effect.gen(function* () {
 *   const runs = yield* ExtractionRunService
 *   return yield* runs.listRuns
 * }).pipe(Effect.provide(ExtractionRunServiceDefault), Effect.provide(StorageServiceTest))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ExtractionRunService extends Context.Service<ExtractionRunService, ExtractionRunServiceMethods>()(
  $I`ExtractionRunService`
) {}

// =============================================================================
// Implementation
// =============================================================================

const makeExtractionRunService = Effect.gen(function* () {
  const storage = yield* StorageService;

  const KeyIndex = S.Record(S.String, DocumentId).pipe(
    SchemaUtils.withCodecStatics(["decodeEffect"]),
  );
  const KeyIndexJson = S.fromJsonString(KeyIndex, { space: 2 }).pipe(
    SchemaUtils.withStatics((schema) => ({
      decodeKeyIndex: S.decodeUnknownEffect(schema),
      encodeKeyIndex: S.encodeEffect(schema),
    }))
  );

  const JsonRecord = S.Record(S.String, S.Json).pipe(
    SchemaUtils.withStatics((schema) => ({
      decodeUnknownEffect: S.decodeUnknownEffect(schema),
    }))
  );

  const mapRunError = (message: string, runId?: ExtractionRunId) => (cause: unknown) =>
    ExtractionRunError.is(cause)
      ? cause
      : ExtractionRunError.make({
          message,
          cause: O.some(cause),
          runId: O.fromUndefinedOr(runId),
        });

  const updateMetadata = Effect.fn("ExtractionRunService.updateMetadata")(function* (
    runId: ExtractionRunId,
    updater: (run: ExtractionRun) => ExtractionRun
  ) {
    const content = yield* storage.getOption(metadataKey(runId));
    if (O.isNone(content)) {
      return yield* ExtractionRunError.make({
        message: `Run not found: ${runId}`,
        runId: O.some(runId),
      });
    }
    const run = yield* decodeExtractionRun(content.value);
    const updated = updater(run);
    yield* storage.set(metadataKey(runId), yield* ExtractionRun.encodeJsonStringEffect(updated));
    return updated;
  });

  const getKeyIndex = storage.getOption(KEY_INDEX_FILE).pipe(
    Effect.mapError(mapRunError("Failed to read extraction idempotency index")),
    Effect.flatMap(
      O.match({
        onNone: () =>
          KeyIndex.decodeEffect({}).pipe(
            Effect.mapError(mapRunError("Failed to initialize extraction idempotency index"))
          ),
        onSome: (content) =>
          KeyIndexJson.decodeKeyIndex(content).pipe(
            Effect.mapError(mapRunError("Failed to decode extraction idempotency index"))
          ),
      })
    )
  );

  const updateKeyIndex = Effect.fn("ExtractionRunService.updateKeyIndex")(function* (
    key: IdempotencyKey,
    runId: ExtractionRunId
  ) {
    const index = yield* getKeyIndex;
    const updated = { ...index, [key]: runId };
    yield* storage.set(KEY_INDEX_FILE, yield* KeyIndexJson.encodeKeyIndex(updated));
  });

  const createRunRaw = Effect.fn("ExtractionRunService.createRun")(function* (
    text: string,
    runConfig: RunConfig,
    options?: { idempotencyKey?: IdempotencyKey; ontologyVersion?: string }
  ) {
    const runId = generateDocumentId(text);
    const existing = yield* storage.getOption(metadataKey(runId));
    if (O.isSome(existing)) {
      const existingText = yield* storage.getOption(documentKey(runId));
      if (O.isNone(existingText)) {
        return yield* ExtractionRunError.make({
          message: `Run document not found: ${runId}`,
          runId: O.some(runId),
        });
      }
      if (existingText.value === text) return yield* decodeExtractionRun(existing.value);
      yield* Effect.logWarning(`Hash collision detected for runId ${runId}; overwriting the existing run.`);
    }

    yield* storage.set(documentKey(runId), text);
    const now = yield* DateTime.now;
    const run = ExtractionRun.make({
      id: runId,
      createdAt: now,
      updatedAt: O.some(now),
      status: RunStatus.cases.Pending.make({}),
      config: runConfig,
      outputDir: runKey(runId),
      outputs: [],
      events: [AuditEvent.make({ timestamp: now, type: "started" })],
      errors: [],
      idempotencyKey: O.fromNullishOr(options?.idempotencyKey),
      ontologyVersion: O.map(O.fromNullishOr(options?.ontologyVersion), OntologyVersion.decodeUnknownSync),
    });
    yield* storage.set(metadataKey(runId), yield* ExtractionRun.encodeJsonStringEffect(run));
    if (P.isNotUndefined(options?.idempotencyKey)) yield* updateKeyIndex(options.idempotencyKey, runId);
    return run;
  });
  const createRun = (
    text: string,
    runConfig: RunConfig,
    options?: { idempotencyKey?: IdempotencyKey; ontologyVersion?: string }
  ) => createRunRaw(text, runConfig, options).pipe(Effect.mapError(mapRunError("Failed to create extraction run")));

  const saveChunkRaw = Effect.fn("ExtractionRunService.saveChunk")(function* (
    runId: ExtractionRunId,
    chunkIndex: NonNegativeInt,
    chunkText: string
  ) {
    const chunkId = ChunkId.fromDocument(runId, chunkIndex);
    yield* storage.set(chunkKey(runId, chunkIndex), chunkText);
    return chunkId;
  });
  const saveChunk = (runId: ExtractionRunId, chunkIndex: NonNegativeInt, chunkText: string) =>
    saveChunkRaw(runId, chunkIndex, chunkText).pipe(
      Effect.mapError(mapRunError("Failed to save extraction chunk", runId))
    );

  const saveOutputRaw = Effect.fn("ExtractionRunService.saveOutput")(function* (
    runId: ExtractionRunId,
    outputType: OutputType,
    content: string
  ) {
    const filename = OutputType.filename(outputType);
    yield* storage.set(outputKey(runId, filename), content);
    const now = yield* DateTime.now;
    const metadata = OutputMetadata.make({
      type: outputType,
      path: `outputs/${filename}`,
      hash: Sha256Hex.make(hashContent(content)),
      size: NonNegativeInt.make(Buffer.byteLength(content, "utf8")),
      savedAt: now,
    });
    yield* updateMetadata(runId, (run) =>
      ExtractionRun.make({
        ...run,
        outputs: [...run.outputs, metadata],
      })
    );
    return metadata;
  });
  const saveOutput = (runId: ExtractionRunId, outputType: OutputType, content: string) =>
    saveOutputRaw(runId, outputType, content).pipe(
      Effect.mapError(mapRunError("Failed to save extraction output", runId))
    );

  const updateStats = (runId: ExtractionRunId, stats: RunStats) =>
    updateMetadata(runId, (run) =>
      ExtractionRun.make({
        ...run,
        stats: O.some(stats),
      })
    ).pipe(Effect.asVoid, Effect.mapError(mapRunError("Failed to update extraction statistics", runId)));

  const completeRunRaw = Effect.fn("ExtractionRunService.completeRun")(function* (runId: ExtractionRunId) {
    const now = yield* DateTime.now;
    return yield* updateMetadata(runId, (run) =>
      ExtractionRun.make({
        ...run,
        status: RunStatus.cases.Complete.make({ completedAt: now }),
        updatedAt: O.some(now),
        events: [
          ...run.events,
          AuditEvent.make({
            timestamp: now,
            type: "completed",
          }),
        ],
      })
    );
  });
  const completeRun = (runId: ExtractionRunId) =>
    completeRunRaw(runId).pipe(Effect.mapError(mapRunError("Failed to complete extraction run", runId)));

  const getRun = Effect.fn("ExtractionRunService.getRun")(function* (
    runId: ExtractionRunId
  ): Effect.fn.Return<ExtractionRun, ExtractionRunError> {
    const mapError = mapRunError("Failed to read extraction run", runId);
    const content = yield* storage.getOption(metadataKey(runId)).pipe(Effect.mapError(mapError));
    if (O.isNone(content)) {
      return yield* ExtractionRunError.make({
        message: `Run not found: ${runId}`,
        runId: O.some(runId),
      });
    }
    return yield* decodeExtractionRun(content.value).pipe(Effect.mapError(mapError));
  });

  const listRuns = storage.list(RUNS_PREFIX).pipe(
    Effect.mapError(mapRunError("Failed to list extraction runs")),
    Effect.flatMap((keys) =>
      Effect.forEach(
        keys.flatMap((key): Array<ExtractionRunId> => {
          const match = /^runs\/([^/]+)\/metadata\.json$/.exec(key);
          const runId = match?.[1];
          return P.isUndefined(runId) || !DocumentId.is(runId) ? [] : [runId];
        }),
        (runId) => getRun(runId),
        { concurrency: 10 }
      )
    ),
    Effect.map((runs) =>
      [...runs].sort((left, right) => right.createdAt.epochMilliseconds - left.createdAt.epochMilliseconds)
    )
  );

  const existsByKeyRaw = Effect.fn("ExtractionRunService.existsByKey")(function* (key: IdempotencyKey) {
    const runId = R.get(yield* getKeyIndex, key);
    if (O.isNone(runId)) return false;
    return O.isSome(yield* storage.getOption(metadataKey(runId.value)));
  });
  const existsByKey = (key: IdempotencyKey) =>
    existsByKeyRaw(key).pipe(Effect.mapError(mapRunError("Failed to check extraction idempotency key")));

  const getByKeyRaw = Effect.fn("ExtractionRunService.getByKey")(function* (key: IdempotencyKey) {
    const runId = R.get(yield* getKeyIndex, key);
    if (O.isNone(runId)) return O.none<ExtractionRun>();
    const content = yield* storage.getOption(metadataKey(runId.value));
    return yield* O.match(content, {
      onNone: () => Effect.succeed(O.none<ExtractionRun>()),
      onSome: (value) => decodeExtractionRun(value).pipe(Effect.asSome),
    });
  });
  const getByKey = (key: IdempotencyKey) =>
    getByKeyRaw(key).pipe(Effect.mapError(mapRunError("Failed to read extraction run by idempotency key")));

  const emitEventRaw = Effect.fn("ExtractionRunService.emitEvent")(function* (
    runId: ExtractionRunId,
    type: AuditEventType,
    data?: Record<string, unknown>
  ) {
    const now = yield* DateTime.now;
    const decodedData = P.isUndefined(data) ? {} : yield* JsonRecord.decodeUnknownEffect(data);
    yield* updateMetadata(runId, (run) =>
      ExtractionRun.make({
        ...run,
        updatedAt: O.some(now),
        events: [
          ...run.events,
          AuditEvent.make({
            timestamp: now,
            type,
            data: decodedData,
          }),
        ],
      })
    );
  });
  const emitEvent = (runId: ExtractionRunId, type: AuditEventType, data?: Record<string, unknown>) =>
    emitEventRaw(runId, type, data).pipe(Effect.mapError(mapRunError("Failed to emit extraction audit event", runId)));

  const makeAuditError = Effect.fn("ExtractionRunService.makeAuditError")(function* (
    type: AuditErrorType,
    message: string,
    context?: Record<string, unknown>
  ) {
    const now = yield* DateTime.now;
    const decodedContext = P.isUndefined(context) ? {} : yield* JsonRecord.decodeUnknownEffect(context);
    return {
      now,
      error: AuditError.make({ timestamp: now, type, message, context: decodedContext }),
    };
  });

  const recordErrorRaw = Effect.fn("ExtractionRunService.recordError")(function* (
    runId: ExtractionRunId,
    type: AuditErrorType,
    message: string,
    context?: Record<string, unknown>
  ) {
    const { error, now } = yield* makeAuditError(type, message, context);
    yield* updateMetadata(runId, (run) =>
      ExtractionRun.make({
        ...run,
        updatedAt: O.some(now),
        errors: [...run.errors, error],
      })
    );
  });
  const recordError = (
    runId: ExtractionRunId,
    type: AuditErrorType,
    message: string,
    context?: Record<string, unknown>
  ) =>
    recordErrorRaw(runId, type, message, context).pipe(
      Effect.mapError(mapRunError("Failed to record extraction error", runId))
    );

  const setStatus = (runId: ExtractionRunId, status: ExtractionRun["status"]) =>
    updateMetadata(runId, (run) => ExtractionRun.make({ ...run, status })).pipe(
      Effect.asVoid,
      Effect.mapError(mapRunError("Failed to update extraction status", runId))
    );

  const failRunRaw = Effect.fn("ExtractionRunService.failRun")(function* (
    runId: ExtractionRunId,
    errorType: AuditErrorType,
    message: string,
    context?: Record<string, unknown>
  ) {
    const { error, now } = yield* makeAuditError(errorType, message, context);
    yield* updateMetadata(runId, (run) =>
      ExtractionRun.make({
        ...run,
        status: RunStatus.cases.Failed.make({ failedAt: now, error }),
        updatedAt: O.some(now),
        events: [
          ...run.events,
          AuditEvent.make({
            timestamp: now,
            type: "failed",
          }),
        ],
        errors: [...run.errors, error],
      })
    );
  });
  const failRun = (
    runId: ExtractionRunId,
    errorType: AuditErrorType,
    message: string,
    context?: Record<string, unknown>
  ) =>
    failRunRaw(runId, errorType, message, context).pipe(
      Effect.mapError(mapRunError("Failed to fail extraction run", runId))
    );

  return {
    createRun,
    saveChunk,
    saveOutput,
    updateStats,
    completeRun,
    getRun,
    listRuns,
    existsByKey,
    getByKey,
    emitEvent,
    recordError,
    setStatus,
    failRun,
  } satisfies ExtractionRunServiceMethods;
});

// =============================================================================
// Layer
// =============================================================================

/**
 * Provides the Effect layer for extraction run service live dependencies.
 *
 * **Example** (Provide the live run store)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ExtractionRunService, ExtractionRunServiceLive } from "@effect-ontology/Service/ExtractionRun"
 * import { StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * const program = Effect.gen(function* () {
 *   const runs = yield* ExtractionRunService
 *   return yield* runs.listRuns
 * }).pipe(Effect.provide(ExtractionRunServiceLive), Effect.provide(StorageServiceTest))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ExtractionRunServiceLive = Layer.effect(ExtractionRunService, makeExtractionRunService);

/**
 *  Alias for convenience
 *
 * **Example** (Use the default run-store alias)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ExtractionRunService, ExtractionRunServiceDefault } from "@effect-ontology/Service/ExtractionRun"
 * import { StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * const program = Effect.gen(function* () {
 *   const runs = yield* ExtractionRunService
 *   return yield* runs.listRuns
 * }).pipe(Effect.provide(ExtractionRunServiceDefault), Effect.provide(StorageServiceTest))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ExtractionRunServiceDefault = ExtractionRunServiceLive;
