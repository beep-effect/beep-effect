/**
 * Progress Streaming Service
 *
 * Implements the progress streaming contract with Effect patterns.
 * Provides functional builders for creating progress events.
 *
 * @since 2.0.0
 * @module Service/ProgressStreaming
 */

import { Array as A, Chunk, Clock, Effect, Option, Ref, Stream } from "effect"
import { v4 as uuidv4 } from "uuid"
import type { BackpressureConfig, ProgressEvent } from "../Contract/ProgressStreaming.ts"
import {
  BackpressureWarningEvent,
  ChunkingProgressEvent,
  ChunkProcessingCompleteEvent,
  ChunkProcessingStartedEvent,
  DefaultBackpressureConfig,
  EntityFoundEvent,
  ExtractionCompleteEvent,
  ExtractionFailedEvent,
  ExtractionStartedEvent,
  RecoverableErrorEvent,
  RelationFoundEvent
} from "../Contract/ProgressStreaming.ts"
import { PosInt, NonNegativeInt } from "@beep/schema/Int";

// =============================================================================
// Types
// =============================================================================

/**
 * Extraction run ID type (mirrors the pattern from Contract)
 */
export type ExtractionRunId = `doc-${string}`

/**
 * Progress builder state
 */
export interface ProgressBuilderState {
  readonly runId: ExtractionRunId
  readonly totalChunks: number
  readonly processedChunks: number
  readonly currentPhaseProgress: number
}

// =============================================================================
// Progress Event Builder (Functional)
// =============================================================================

/**
 * Create a new progress builder state
 */
export const makeProgressBuilder = (
  runId: ExtractionRunId,
  totalChunks: number
): Effect.Effect<Ref.Ref<ProgressBuilderState>> =>
  Ref.make<ProgressBuilderState>({
    runId,
    totalChunks,
    processedChunks: 0,
    currentPhaseProgress: 0
  })

/**
 * Calculate overall progress percentage
 */
const calculateOverallProgress = (state: ProgressBuilderState, phaseProgress: number): number => {
  const overall = (state.processedChunks + phaseProgress / 100) / state.totalChunks * 100
  return Math.min(100, Math.max(0, Math.round(overall)))
}

/**
 * Create ExtractionStartedEvent
 */
export const createExtractionStarted = (
  ref: Ref.Ref<ProgressBuilderState>,
  textMetadata: {
    characterCount: number
    estimatedAvgChunkSize: number
    contentType?: string
  }
): Effect.Effect<ExtractionStartedEvent> =>
  Effect.gen(function*() {
    const state = yield* Ref.get(ref)
    return ExtractionStartedEvent.make({
      _tag: "extraction_started",
      eventId: uuidv4(),
      runId: state.runId,
      timestamp: new Date().toISOString(),
      overallProgress: 0,
      totalChunks: PosInt.make(state.totalChunks),
      textMetadata: {
        characterCount: PosInt.make(textMetadata.characterCount),
        estimatedAvgChunkSize: PosInt.make(textMetadata.estimatedAvgChunkSize),
        contentType: Option.fromUndefinedOr(textMetadata.contentType)
      }
    })
  })

/**
 * Create ChunkingProgressEvent
 */
export const createChunkingProgress = (
  ref: Ref.Ref<ProgressBuilderState>,
  chunksCompleted: number,
  chunksProcessing: number,
  avgChunkSize: number
): Effect.Effect<ChunkingProgressEvent> =>
  Effect.gen(function*() {
    const state = yield* Ref.get(ref)
    return ChunkingProgressEvent.make({
      _tag: "chunking_progress",
      eventId: uuidv4(),
      runId: state.runId,
      timestamp: new Date().toISOString(),
      overallProgress: PosInt.make(NonNegativeInt.make(calculateOverallProgress(state, 0))),
      chunksCompleted: NonNegativeInt.make(chunksCompleted),
      chunksProcessing: NonNegativeInt.make(chunksProcessing),
      avgChunkSize: PosInt.make(avgChunkSize)
    })
  })

/**
 * Create ChunkProcessingStartedEvent
 */
export const createChunkProcessingStarted = (
  ref: Ref.Ref<ProgressBuilderState>,
  chunkIndex: number,
  chunkTextLength: number,
  textPreview: string
): Effect.Effect<ChunkProcessingStartedEvent> =>
  Effect.gen(function*() {
    const state = yield* Ref.get(ref)
    return ChunkProcessingStartedEvent.make({
      _tag: "chunk_processing_started",
      eventId: uuidv4(),
      runId: state.runId,
      timestamp: new Date().toISOString(),
      overallProgress: calculateOverallProgress(state, 0),
      chunkIndex: NonNegativeInt.make(chunkIndex),
      chunkTextLength: PosInt.make(chunkTextLength),
      textPreview
    })
  })

/**
 * Create EntityFoundEvent
 */
export const createEntityFound = (
  ref: Ref.Ref<ProgressBuilderState>,
  chunkIndex: number,
  entityId: string,
  mention: string,
  types: ReadonlyArray<string>,
  confidence?: number
): Effect.Effect<EntityFoundEvent> =>
  Effect.gen(function*() {
    const state = yield* Ref.get(ref)
    return EntityFoundEvent.make({
      _tag: "entity_found",
      eventId: uuidv4(),
      runId: state.runId,
      timestamp: new Date().toISOString(),
      overallProgress: calculateOverallProgress(state, 40),
      chunkIndex: NonNegativeInt.make(chunkIndex),
      entityId,
      mention,
      types: A.fromIterable(types),
      confidence: Option.fromUndefinedOr(confidence)
    })
  })

/**
 * Create RelationFoundEvent
 */
export const createRelationFound = (
  ref: Ref.Ref<ProgressBuilderState>,
  chunkIndex: number,
  subjectId: string,
  predicate: string,
  object: string | number | boolean,
  isEntityReference: boolean,
  confidence?: number
): Effect.Effect<RelationFoundEvent> =>
  Effect.gen(function*() {
    const state = yield* Ref.get(ref)
    return RelationFoundEvent.make({
      _tag: "relation_found",
      eventId: uuidv4(),
      runId: state.runId,
      timestamp: new Date().toISOString(),
      overallProgress: calculateOverallProgress(state, 60),
      chunkIndex: NonNegativeInt.make(chunkIndex),
      subjectId,
      predicate,
      object,
      isEntityReference,
      confidence: Option.fromUndefinedOr(confidence)
    })
  })

/**
 * Create ChunkProcessingCompleteEvent
 */
export const createChunkProcessingComplete = (
  ref: Ref.Ref<ProgressBuilderState>,
  chunkIndex: number,
  entityCount: number,
  relationCount: number,
  durationMs: number,
  errors?: Array<{ phase: string; message: string }>
): Effect.Effect<ChunkProcessingCompleteEvent> =>
  Effect.gen(function*() {
    const state = yield* Ref.get(ref)
    return ChunkProcessingCompleteEvent.make({
      _tag: "chunk_processing_complete",
      eventId: uuidv4(),
      runId: state.runId,
      timestamp: new Date().toISOString(),
      overallProgress: calculateOverallProgress(state, 100),
      chunkIndex: NonNegativeInt.make(chunkIndex),
      entityCount: NonNegativeInt.make(entityCount),
      relationCount: NonNegativeInt.make(relationCount),
      durationMs: PosInt.make(durationMs),
      errors: Option.fromUndefinedOr(errors)
    })
  })

/**
 * Create ExtractionCompleteEvent
 */
export const createExtractionComplete = (
  ref: Ref.Ref<ProgressBuilderState>,
  totalEntities: number,
  totalRelations: number,
  uniqueEntityTypes: number,
  totalDurationMs: number,
  successfulChunks: number,
  failedChunks: number
): Effect.Effect<ExtractionCompleteEvent> =>
  Effect.gen(function*() {
    const state = yield* Ref.get(ref)
    return ExtractionCompleteEvent.make({
      _tag: "extraction_complete",
      eventId: uuidv4(),
      runId: state.runId,
      timestamp: new Date().toISOString(),
      overallProgress: 100,
      totalEntities: NonNegativeInt.make(totalEntities),
      totalRelations: NonNegativeInt.make(totalRelations),
      uniqueEntityTypes: NonNegativeInt.make(uniqueEntityTypes),
      totalDurationMs: PosInt.make(totalDurationMs),
      successfulChunks: NonNegativeInt.make(successfulChunks),
      failedChunks: NonNegativeInt.make(failedChunks)
    })
  })

/**
 * Create ExtractionFailedEvent
 */
export const createExtractionFailed = (
  ref: Ref.Ref<ProgressBuilderState>,
  errorType: string,
  errorMessage: string,
  isRecoverable: boolean,
  options?: {
    isTemporary?: boolean
    retryAfterMs?: number
    partialResults?: {
      entityCount: number
      relationCount: number
      processedChunks: number
    }
    lastSuccessfulChunkIndex?: number
  }
): Effect.Effect<ExtractionFailedEvent> =>
  Effect.gen(function*() {
    const state = yield* Ref.get(ref)
    return ExtractionFailedEvent.make({
      _tag: "extraction_failed",
      eventId: uuidv4(),
      runId: state.runId,
      timestamp: new Date().toISOString(),
      overallProgress: calculateOverallProgress(state, 0),
      errorType,
      errorMessage,
      isRecoverable,
      retryStrategy: options?.isTemporary
        ? Option.some({
            type: "exponential_backoff" as const,
            delayMs: Option.fromUndefinedOr(options.retryAfterMs).pipe(Option.map(PosInt.make)),
            maxAttempts: Option.some(PosInt.make(3))
          })
        : Option.none(),
      partialResults: Option.fromUndefinedOr(options?.partialResults).pipe(
        Option.map((results) => ({
          entityCount: NonNegativeInt.make(results.entityCount),
          relationCount: NonNegativeInt.make(results.relationCount),
          processedChunks: NonNegativeInt.make(results.processedChunks)
        }))
      ),
      lastSuccessfulChunkIndex: Option.fromUndefinedOr(options?.lastSuccessfulChunkIndex).pipe(
        Option.map(NonNegativeInt.make)
      )
    })
  })

/**
 * Create RecoverableErrorEvent
 */
export const createRecoverableError = (
  ref: Ref.Ref<ProgressBuilderState>,
  chunkIndex: number,
  errorType: string,
  errorMessage: string,
  phase: string,
  recoveryAction: string
): Effect.Effect<RecoverableErrorEvent> =>
  Effect.gen(function*() {
    const state = yield* Ref.get(ref)
    return RecoverableErrorEvent.make({
      _tag: "error_recoverable",
      eventId: uuidv4(),
      runId: state.runId,
      timestamp: new Date().toISOString(),
      overallProgress: calculateOverallProgress(state, 50),
      chunkIndex: NonNegativeInt.make(chunkIndex),
      errorType,
      errorMessage,
      phase,
      recoveryAction
    })
  })

/**
 * Increment processed chunks
 */
export const markChunkProcessed = (
  ref: Ref.Ref<ProgressBuilderState>
): Effect.Effect<void> =>
  Ref.update(ref, (state) => ({
    ...state,
    processedChunks: state.processedChunks + 1
  }))

/**
 * Set phase progress
 */
export const setPhaseProgress = (
  ref: Ref.Ref<ProgressBuilderState>,
  progress: number
): Effect.Effect<void> =>
  Ref.update(ref, (state) => ({
    ...state,
    currentPhaseProgress: Math.min(100, Math.max(0, progress))
  }))

// =============================================================================
// Backpressure Handler (Functional)
// =============================================================================

/**
 * Backpressure handler state
 */
export interface BackpressureState {
  readonly config: BackpressureConfig
  readonly eventQueue: ReadonlyArray<ProgressEvent>
  readonly lastWarnTime: number
}

/**
 * Create backpressure handler state
 */
export const makeBackpressureHandler = (
  config: BackpressureConfig = DefaultBackpressureConfig
): Effect.Effect<Ref.Ref<BackpressureState>> =>
  Ref.make<BackpressureState>({
    config,
    eventQueue: [],
    lastWarnTime: 0
  })

/**
 * Check if event should be included based on sampling
 */
const shouldIncludeEvent = (event: ProgressEvent, sampleRate: number): boolean => {
  const tag = event._tag
  const detailedEventTags = new Set(["entity_found", "relation_found"])

  if (!detailedEventTags.has(tag)) {
    return true
  }

  return Math.random() < sampleRate
}

/**
 * Enqueue event with backpressure handling
 *
 * Returns Option.some with warning event if backpressure warning needed,
 * Option.none otherwise
 */
export const enqueueEvent = (
  ref: Ref.Ref<BackpressureState>,
  event: ProgressEvent
): Effect.Effect<Option.Option<BackpressureWarningEvent>, Error> =>
  Effect.gen(function*() {
    const state = yield* Ref.get(ref)

    // Check sampling
    if (!shouldIncludeEvent(event, state.config.detailedEventSampleRate)) {
      return Option.none()
    }

    const newQueue = [...state.eventQueue, event]
    const queueSize = newQueue.length
    const ratio = queueSize / state.config.maxQueueSize

    // Handle overflow
    if (ratio > 1.0) {
      switch (state.config.strategy) {
        case "drop_oldest": {
          yield* Ref.update(ref, (s) => ({
            ...s,
            eventQueue: [...s.eventQueue.slice(1), event]
          }))
          return Option.none()
        }
        case "drop_newest":
          return Option.none()
        case "block_producer": {
          yield* Effect.sleep(state.config.blockTimeoutMs ?? 5000)
          const afterWait = yield* Ref.get(ref)
          if (afterWait.eventQueue.length >= state.config.maxQueueSize) {
            return yield* Effect.fail(
              new Error("Backpressure timeout: client not consuming events fast enough")
            )
          }
          yield* Ref.update(ref, (s) => ({
            ...s,
            eventQueue: [...s.eventQueue, event]
          }))
          return Option.none()
        }
        case "close_stream":
          return yield* Effect.fail(
            new Error("Backpressure critical: stream closed due to queue overflow")
          )
      }
    }

    // Check warning threshold
    if (ratio >= state.config.warningThreshold) {
      const now = yield* Clock.currentTimeMillis
      if (now - state.lastWarnTime > 5000) {
        yield* Ref.update(ref, (s) => ({
          ...s,
          eventQueue: newQueue,
          lastWarnTime: now
        }))
        return Option.some(
          BackpressureWarningEvent.make({
            _tag: "backpressure_warning",
            eventId: `bp-${uuidv4()}`,
            runId: event.runId,
            timestamp: new Date().toISOString(),
            overallProgress: event.overallProgress,
            queuedEvents: PosInt.make(queueSize),
            maxQueueSize: PosInt.make(state.config.maxQueueSize),
            severity: ratio > 0.95 ? "critical" : "warning",
            recommendedAction: "Increase event consumption rate or enable parallelism"
          })
        )
      }
    }

    // Normal enqueue
    yield* Ref.update(ref, (s) => ({
      ...s,
      eventQueue: newQueue
    }))
    return Option.none()
  })

/**
 * Dequeue next event
 */
export const dequeueEvent = (
  ref: Ref.Ref<BackpressureState>
): Effect.Effect<Option.Option<ProgressEvent>> =>
  Ref.modify(ref, (state) => {
    if (state.eventQueue.length === 0) {
      return [Option.none(), state]
    }
    const [first, ...rest] = state.eventQueue
    return [Option.some(first), { ...state, eventQueue: rest }]
  })

/**
 * Get current queue size
 */
export const getQueueSize = (
  ref: Ref.Ref<BackpressureState>
): Effect.Effect<number> => Effect.map(Ref.get(ref), (state) => state.eventQueue.length)

// =============================================================================
// Stream Combiners
// =============================================================================

/**
 * Default concurrency for stream merging
 * Using bounded concurrency to prevent resource exhaustion
 */
const DEFAULT_STREAM_CONCURRENCY = 16

/**
 * Combine multiple progress streams with backpressure handling
 */
export const combineProgressStreams = (
  streams: ReadonlyArray<Stream.Stream<ProgressEvent, Error>>,
  concurrency: number = DEFAULT_STREAM_CONCURRENCY
): Stream.Stream<ProgressEvent, Error> => {
  if (streams.length === 0) {
    return Stream.empty
  }

  if (streams.length === 1) {
    return streams[0]
  }

  // Merge all streams with bounded concurrency
  return Stream.mergeAll(streams, { concurrency })
}

/**
 * Apply backpressure to a stream
 */
export const withBackpressure = (
  stream: Stream.Stream<ProgressEvent, Error>,
  config: BackpressureConfig = DefaultBackpressureConfig
): Stream.Stream<ProgressEvent, Error> =>
  Stream.unwrap(
    Effect.gen(function*() {
      const handlerRef = yield* makeBackpressureHandler(config)

      return stream.pipe(
        Stream.mapEffect((event) =>
          Effect.gen(function*() {
            const warning = yield* enqueueEvent(handlerRef, event)
            if (Option.isSome(warning)) {
              // Emit warning followed by original event
              return Chunk.make(warning.value as ProgressEvent, event)
            }
            return Chunk.make(event)
          })
        ),
        Stream.flattenIterable
      )
    })
  )

// =============================================================================
// Resumable Extraction State
// =============================================================================

/**
 * State for resumable extractions
 */
export interface ResumableExtractionState {
  readonly runId: ExtractionRunId
  readonly lastSuccessfulChunkIndex: number
  readonly partialResults: {
    entityCount: number
    relationCount: number
  }
  readonly pausedAt: Date
  readonly pauseReason?: {
    errorType: string
    message: string
    isRecoverable: boolean
    retryAfterMs?: number
  }
}

/**
 * Extract resumable state from ExtractionFailedEvent
 */
export const extractResumableState = (
  runId: ExtractionRunId,
  event: ExtractionFailedEvent
): Option.Option<ResumableExtractionState> => {
  if (Option.isNone(event.lastSuccessfulChunkIndex) || Option.isNone(event.partialResults)) {
    return Option.none()
  }

  return Option.some({
    runId,
    lastSuccessfulChunkIndex: event.lastSuccessfulChunkIndex.value,
    partialResults: {
      entityCount: event.partialResults.value.entityCount,
      relationCount: event.partialResults.value.relationCount
    },
    pausedAt: new Date(event.timestamp),
    pauseReason: {
      errorType: event.errorType,
      message: event.errorMessage,
      isRecoverable: event.isRecoverable,
      ...Option.getOrUndefined(
        Option.flatMap(event.retryStrategy, (strategy) =>
          Option.map(strategy.delayMs, (retryAfterMs) => ({ retryAfterMs }))
        )
      )
    }
  })
}
