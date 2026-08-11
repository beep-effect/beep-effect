/**
 * Service: Extraction Run Service
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
 * @since 2.0.0
 * @module Service/ExtractionRun
 */

import { Context, Effect, Layer, Option, Schema } from "effect"
import { createHash } from "node:crypto"
import type { ChunkId, ExtractionRunId, IdempotencyKey } from "../Domain/Identity.ts"
import type {
  AuditError,
  AuditErrorType,
  AuditEventType,
  OutputMetadata,
  RunConfig,
  RunStats
} from "../Domain/Model/ExtractionRun.ts"
import { AuditEvent, ExtractionRun } from "../Domain/Model/ExtractionRun.ts"
import type { OutputType } from "../Domain/Model/OutputType.ts"
import { getOutputFilename } from "../Domain/Model/OutputType.ts"
import { ConfigService } from "./Config.ts"
import { StorageService } from "./Storage.ts"
import { $ScratchpadId } from "@beep/identity";
import * as O from "effect/Option";
import { NonNegativeInt } from "@beep/schema/Int";

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
const sha256Hex = (content: string): string => {
  return createHash("sha256").update(content).digest("hex")
}

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
  const hash = sha256Hex(text)
  // Use first 12 hex chars to match DocumentId schema pattern
  // This gives 48 bits of entropy - sufficient for unique document identification
  const prefix = hash.slice(0, 12)
  return `doc-${prefix}` as ExtractionRunId
}

/**
 * Get run ID from text (deterministic hash)
 */
export const getRunIdFromText = (text: string): ExtractionRunId => generateDocumentId(text)

/**
 * Hash content for integrity checking
 */
const hashContent = (content: string): string => sha256Hex(content)

/**
 * Decode JSON string to ExtractionRun
 *
 * Uses Schema.decodeUnknownSync to properly construct all nested
 * Schema.Class instances (RunConfig, OntologyRef, etc.)
 */
const decodeExtractionRun = (json: string): ExtractionRun => Schema.decodeUnknownSync(ExtractionRun)(JSON.parse(json))

// =============================================================================
// Storage Key Helpers
// =============================================================================

const RUNS_PREFIX = "runs"
const KEY_INDEX_FILE = "runs/key-index.json"

const runKey = (runId: ExtractionRunId, ...parts: Array<string>): string => [RUNS_PREFIX, runId, ...parts].join("/")

const metadataKey = (runId: ExtractionRunId): string => runKey(runId, "metadata.json")

const documentKey = (runId: ExtractionRunId): string => runKey(runId, "input", "document.txt")

const chunkKey = (runId: ExtractionRunId, chunkIndex: number): string =>
  runKey(runId, "input", "chunks", `chunk-${chunkIndex}.txt`)

const outputKey = (runId: ExtractionRunId, filename: string): string => runKey(runId, "outputs", filename)

// =============================================================================
// Service Interface
// =============================================================================

export interface ExtractionRunService {
  /**
   * Create a new extraction run with embedded audit tracking
   */
  createRun(
    text: string,
    config: RunConfig,
    options?: {
      idempotencyKey?: IdempotencyKey
      ontologyVersion?: string
    }
  ): Effect.Effect<ExtractionRun, Error>

  /**
   * Save a text chunk
   */
  saveChunk(
    runId: ExtractionRunId,
    chunkIndex: number,
    chunkText: string
  ): Effect.Effect<ChunkId, Error>

  /**
   * Save an output artifact
   */
  saveOutput(
    runId: ExtractionRunId,
    outputType: OutputType,
    content: string
  ): Effect.Effect<OutputMetadata, Error>

  /**
   * Update run statistics
   */
  updateStats(runId: ExtractionRunId, stats: RunStats): Effect.Effect<void, Error>

  /**
   * Complete the run
   */
  completeRun(runId: ExtractionRunId): Effect.Effect<ExtractionRun, Error>

  /**
   * Get run by ID
   */
  getRun(runId: ExtractionRunId): Effect.Effect<ExtractionRun, Error>

  /**
   * List all runs
   */
  listRuns(): Effect.Effect<ReadonlyArray<ExtractionRun>, Error>

  // =========================================================================
  // Audit Methods (embedded in metadata.json)
  // =========================================================================

  /**
   * Check if a run exists by idempotency key
   */
  existsByKey(key: IdempotencyKey): Effect.Effect<boolean, Error>

  /**
   * Get run by idempotency key
   */
  getByKey(key: IdempotencyKey): Effect.Effect<ExtractionRun | null, Error>

  /**
   * Emit an audit event to the run's metadata
   */
  emitEvent(
    runId: ExtractionRunId,
    type: AuditEventType,
    data?: Record<string, unknown>
  ): Effect.Effect<void, Error>

  /**
   * Record an audit error
   */
  recordError(
    runId: ExtractionRunId,
    type: AuditErrorType,
    message: string,
    context?: Record<string, unknown>
  ): Effect.Effect<void, Error>

  /**
   * Update run status
   */
  setStatus(
    runId: ExtractionRunId,
    status: ExtractionRun["status"]
  ): Effect.Effect<void, Error>

  /**
   * Fail the run with an error
   */
  failRun(
    runId: ExtractionRunId,
    errorType: AuditErrorType,
    message: string,
    context?: Record<string, unknown>
  ): Effect.Effect<void, Error>
}

export const ExtractionRunService = Context.Service<ExtractionRunService>($I`ExtractionRunService`)

// =============================================================================
// Implementation
// =============================================================================

const makeExtractionRunService = Effect.gen(function*() {
  const storage = yield* StorageService
  const config = yield* ConfigService
  // Use a prefix for runs storage (could be made configurable)
  const _basePrefix = config.extraction.runsDir.replace(/^\/+|\/+$/g, "") || "extraction-runs"

  // Helper: Read and update metadata atomically
  const updateMetadata = (
    runId: ExtractionRunId,
    updater: (run: ExtractionRun) => ExtractionRun
  ) =>
    Effect.gen(function*() {
      const key = metadataKey(runId)
      const contentOpt = yield* storage.get(key)
      if ((contentOpt === undefined)) {
        return yield* Effect.fail(new Error(`Run not found: ${runId}`))
      }
      const run = decodeExtractionRun(contentOpt)
      const updatedRun = updater(run)
      yield* storage.set(key, JSON.stringify(updatedRun, null, 2))
      return updatedRun
    })

  // Helper: Get key index
  const getKeyIndex = () =>
    storage.get(KEY_INDEX_FILE).pipe(
      Effect.map((opt) =>
        (opt !== undefined)
          ? JSON.parse(opt) as Record<string, ExtractionRunId>
          : {} as Record<string, ExtractionRunId>
      ),
      Effect.catch(() => Effect.succeed({} as Record<string, ExtractionRunId>))
    )

  // Helper: Update key index
  const updateKeyIndex = (key: string, runId: ExtractionRunId) =>
    Effect.gen(function*() {
      const index = yield* getKeyIndex()
      index[key] = runId
      yield* storage.set(KEY_INDEX_FILE, JSON.stringify(index, null, 2))
    })

  return {
    createRun: (
      text: string,
      runConfig: RunConfig,
      options?: { idempotencyKey?: IdempotencyKey; ontologyVersion?: string }
    ) =>
      Effect.gen(function*() {
        const documentId = generateDocumentId(text)
        const runId = documentId

        // COLLISION DETECTION: Check if run already exists
        const existingOpt = yield* storage.get(metadataKey(runId))
        if ((existingOpt !== undefined)) {
          // Run exists - verify content matches (idempotency check)
          const existingDocOpt = yield* storage.get(documentKey(runId))
          const existingText = (existingDocOpt !== undefined) ? existingDocOpt : ""

          if (existingText === text) {
            // Same content - return existing run (idempotent)
            return decodeExtractionRun(existingOpt)
          } else {
            // Different content with same hash - true collision (extremely rare with SHA-256)
            yield* Effect.logWarning(
              `Hash collision detected for runId ${runId}. ` +
                `Existing content length: ${existingText.length}, new content length: ${text.length}. ` +
                `This should be extremely rare with SHA-256. Overwriting.`
            )
          }
        }

        // Store document
        yield* storage.set(documentKey(runId), text)

        const now = new Date().toISOString()
        const run = ExtractionRun.make({
          id: documentId,
          createdAt: now,
          updatedAt: now,
          status: "pending",
          config: runConfig,
          outputDir: runKey(runId), // Use storage key prefix as "outputDir"
          outputs: [],
          events: [AuditEvent.make({ timestamp: now, type: "started" })],
          errors: [],
          idempotencyKey: options?.idempotencyKey,
          ontologyVersion: options?.ontologyVersion
        })

        yield* storage.set(metadataKey(runId), JSON.stringify(run, null, 2))

        // Update key index if idempotency key provided
        if (options?.idempotencyKey) {
          yield* updateKeyIndex(options.idempotencyKey, runId)
        }

        return run
      }),

    saveChunk: (runId: ExtractionRunId, chunkIndex: number, chunkText: string) =>
      Effect.gen(function*() {
        const chunkIdValue = ExtractionRun.chunkId(runId, chunkIndex) as ChunkId
        yield* storage.set(chunkKey(runId, chunkIndex), chunkText)
        return chunkIdValue
      }),

    saveOutput: (runId: ExtractionRunId, outputType: OutputType, content: string) =>
              Effect.gen(function*() {
                const filename = getOutputFilename(outputType)
                yield* storage.set(outputKey(runId, filename), content)

                const hash = hashContent(content)
                const size = Buffer.byteLength(content, "utf8")
                const savedAt = new Date().toISOString()

                const metadata: OutputMetadata = {
                  type: outputType,
                  path: `outputs/${filename}`,
                  hash,
                  size: NonNegativeInt.make(size),
                  savedAt
                }

                yield* updateMetadata(runId, (run) =>
                  ExtractionRun.make({
                    ...run,
                    outputs: [...run.outputs, metadata]
                  }))

                return metadata
              }),

    updateStats: (runId: ExtractionRunId, stats: RunStats) =>
      updateMetadata(runId, (run) => ExtractionRun.make({ ...run, stats: O.some(stats) })).pipe(Effect.asVoid),

    completeRun: (runId: ExtractionRunId) =>
      updateMetadata(runId, (run) => {
        const now = new Date().toISOString()
        return ExtractionRun.make({
          ...run,
          status: "complete",
          completedAt: now,
          events: [...run.events, AuditEvent.make({ timestamp: now, type: "completed" })]
        })
      }),

    getRun: (runId: ExtractionRunId) =>
      Effect.gen(function*() {
        const contentOpt = yield* storage.get(metadataKey(runId))
        if ((contentOpt === undefined)) {
          return yield* Effect.fail(new Error(`Run not found: ${runId}`))
        }
        return decodeExtractionRun(contentOpt)
      }),

    listRuns: () =>
      Effect.gen(function*() {
        // List all keys under the runs prefix
        const keys = yield* storage.list(RUNS_PREFIX).pipe(
          Effect.catch(() => Effect.succeed([] as Array<string>))
        )

        // Extract unique run IDs from metadata.json keys
        const runIds = new Set<string>()
        for (const key of keys) {
          // Pattern: runs/{runId}/metadata.json
          const match = key.match(/^runs\/([^/]+)\/metadata\.json$/)
          if (match) {
            runIds.add(match[1])
          }
        }

        const runs: Array<ExtractionRun> = []
        for (const runId of runIds) {
          const contentOpt = yield* storage.get(metadataKey(runId as ExtractionRunId))
          if ((contentOpt !== undefined)) {
            runs.push(decodeExtractionRun(contentOpt))
          }
        }

        return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      }),

    // =========================================================================
    // Audit Methods
    // =========================================================================

    existsByKey: (key: IdempotencyKey) =>
      Effect.gen(function*() {
        const index = yield* getKeyIndex()
        const runId = index[key]
        if (!runId) return false
        const contentOpt = yield* storage.get(metadataKey(runId))
        return (contentOpt !== undefined)
      }),

    getByKey: (key: IdempotencyKey) =>
      Effect.gen(function*() {
        const index = yield* getKeyIndex()
        const runId = index[key]
        if (!runId) return null

        const contentOpt = yield* storage.get(metadataKey(runId))
        if ((contentOpt === undefined)) return null

        return decodeExtractionRun(contentOpt)
      }),

    emitEvent: (
      runId: ExtractionRunId,
      type: AuditEventType,
      data?: Record<string, unknown>
    ) =>
      updateMetadata(runId, (run) => {
        const event: AuditEvent = {
          timestamp: new Date().toISOString(),
          type,
          data
        }
        return ExtractionRun.make({
          ...run,
          events: [...run.events, event]
        })
      }).pipe(Effect.asVoid),

    recordError: (
      runId: ExtractionRunId,
      type: AuditErrorType,
      message: string,
      context?: Record<string, unknown>
    ) =>
      updateMetadata(runId, (run) => {
        const error: AuditError = {
          timestamp: new Date().toISOString(),
          type,
          message,
          context
        }
        return ExtractionRun.make({
          ...run,
          errors: [...run.errors, error]
        })
      }).pipe(Effect.asVoid),

    setStatus: (runId: ExtractionRunId, status: ExtractionRun["status"]) =>
      updateMetadata(runId, (run) => ExtractionRun.make({ ...run, status })).pipe(Effect.asVoid),

    failRun: (
      runId: ExtractionRunId,
      errorType: AuditErrorType,
      message: string,
      context?: Record<string, unknown>
    ) =>
      updateMetadata(runId, (run) => {
        const now = new Date().toISOString()
        const error: AuditError = {
          timestamp: now,
          type: errorType,
          message,
          context
        }
        return ExtractionRun.make({
          ...run,
          status: "failed",
          completedAt: now,
          events: [...run.events, AuditEvent.make({ timestamp: now, type: "failed" })],
          errors: [...run.errors, error]
        })
      }).pipe(Effect.asVoid)
  } satisfies ExtractionRunService
})

// =============================================================================
// Layer
// =============================================================================

export const ExtractionRunServiceLive = Layer.effect(
  ExtractionRunService,
  makeExtractionRunService
)

/** Alias for convenience */
export const ExtractionRunServiceDefault = ExtractionRunServiceLive
