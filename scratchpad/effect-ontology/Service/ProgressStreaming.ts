/**
 * Progress Streaming Service
 *
 * Implements the progress streaming contract with Effect patterns.
 * Provides functional builders for creating progress events.
 *
 * @since 2.0.0
 * @module Service/ProgressStreaming
 */

import type { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { Percentage } from "@beep/schema/Percentage";
import { UUID } from "@beep/schema/String";
import { ISOStr } from "@beep/schema/Timestamp";
import { Chunk, Clock, Data, Effect, Ref, Stream } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import { v4 as uuidv4 } from "uuid";
import type { BackpressureConfig, ProgressEvent } from "../Contract/ProgressStreaming.ts";
import {
  BackpressureWarningEvent,
  ChunkingProgressEvent,
  ChunkProcessingCompleteEvent,
  ChunkProcessingStartedEvent,
  DefaultBackpressureConfig,
  EntityFoundEvent,
  ExtractionCompleteEvent,
  ExtractionFailedEvent,
  ExtractionFailedRetryStrategy,
  ExtractionStartedEvent,
  RecoverableErrorEvent,
  RelationFoundEvent,
} from "../Contract/ProgressStreaming.ts";
import type { ExtractionRunId } from "../Domain/Identity.ts";
import { dual2 } from "../Utils/Dual.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Extraction run ID type (mirrors the pattern from Contract)
 */
/**
 * Failure caused by progress-stream backpressure policy enforcement.
 *
 * @since 2.0.0
 * @category Errors
 */
export class ProgressStreamingError extends Data.TaggedError("ProgressStreamingError")<{
  readonly reason: "BackpressureTimeout" | "QueueOverflow";
  readonly message: string;
}> {}

/**
 * Progress builder state
 */
export interface ProgressBuilderState {
  readonly runId: ExtractionRunId;
  readonly totalChunks: PosInt;
  readonly processedChunks: NonNegativeInt;
  readonly currentPhaseProgress: Percentage;
}

// =============================================================================
// Progress Event Builder (Functional)
// =============================================================================

/**
 * Create a new progress builder state
 */
export const makeProgressBuilder = dual2(
  (runId: ExtractionRunId, totalChunks: number): Effect.Effect<Ref.Ref<ProgressBuilderState>> =>
    Ref.make<ProgressBuilderState>({
      runId,
      totalChunks: PosInt.make(totalChunks),
      processedChunks: NonNegativeInt.make(0),
      currentPhaseProgress: Percentage.make(0),
    })
);

/**
 * Calculate overall progress percentage
 */
const calculateOverallProgress = (state: ProgressBuilderState, phaseProgress: number): number => {
  const overall = ((state.processedChunks + phaseProgress / 100) / state.totalChunks) * 100;
  return Math.min(100, Math.max(0, Math.round(overall)));
};

/**
 * Create ExtractionStartedEvent
 */
export const createExtractionStarted: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    textMetadata: {
      characterCount: number;
      estimatedAvgChunkSize: number;
      contentType?: string;
    }
  ): Effect.Effect<ExtractionStartedEvent>;
  (textMetadata: {
    characterCount: number;
    estimatedAvgChunkSize: number;
    contentType?: string;
  }): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<ExtractionStartedEvent>;
} = dual(
  2,
  Effect.fn(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    textMetadata: {
      characterCount: number;
      estimatedAvgChunkSize: number;
      contentType?: string;
    }
  ): Effect.fn.Return<ExtractionStartedEvent> {
    const state = yield* Ref.get(ref);
    return ExtractionStartedEvent.make({
      _tag: "extraction_started",
      eventId: UUID.make(uuidv4()),
      runId: state.runId,
      timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
      overallProgress: Percentage.make(0),
      totalChunks: PosInt.make(state.totalChunks),
      textMetadata: {
        characterCount: PosInt.make(textMetadata.characterCount),
        estimatedAvgChunkSize: PosInt.make(textMetadata.estimatedAvgChunkSize),
        contentType: O.fromUndefinedOr(textMetadata.contentType),
      },
    });
  })
);

/**
 * Create ChunkingProgressEvent
 */
export const createChunkingProgress: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    chunksCompleted: number,
    chunksProcessing: number,
    avgChunkSize: number
  ): Effect.Effect<ChunkingProgressEvent>;
  (
    chunksCompleted: number,
    chunksProcessing: number,
    avgChunkSize: number
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<ChunkingProgressEvent>;
} = dual(
  4,
  Effect.fn(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    chunksCompleted: number,
    chunksProcessing: number,
    avgChunkSize: number
  ): Effect.fn.Return<ChunkingProgressEvent> {
    const state = yield* Ref.get(ref);
    return ChunkingProgressEvent.make({
      _tag: "chunking_progress",
      eventId: UUID.make(uuidv4()),
      runId: state.runId,
      timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
      overallProgress: Percentage.make(calculateOverallProgress(state, 0)),
      chunksCompleted: NonNegativeInt.make(chunksCompleted),
      chunksProcessing: NonNegativeInt.make(chunksProcessing),
      avgChunkSize: PosInt.make(avgChunkSize),
    });
  })
);

/**
 * Create ChunkProcessingStartedEvent
 */
export const createChunkProcessingStarted: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: number,
    chunkTextLength: number,
    textPreview: string
  ): Effect.Effect<ChunkProcessingStartedEvent>;
  (
    chunkIndex: number,
    chunkTextLength: number,
    textPreview: string
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<ChunkProcessingStartedEvent>;
} = dual(
  4,
  Effect.fn(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: number,
    chunkTextLength: number,
    textPreview: string
  ): Effect.fn.Return<ChunkProcessingStartedEvent> {
    const state = yield* Ref.get(ref);
    return ChunkProcessingStartedEvent.make({
      _tag: "chunk_processing_started",
      eventId: UUID.make(uuidv4()),
      runId: state.runId,
      timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
      overallProgress: Percentage.make(calculateOverallProgress(state, 0)),
      chunkIndex: NonNegativeInt.make(chunkIndex),
      chunkTextLength: PosInt.make(chunkTextLength),
      textPreview,
    });
  })
);

/**
 * Create EntityFoundEvent
 */
export const createEntityFound: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: number,
    entityId: string,
    mention: string,
    types: ReadonlyArray<string>,
    confidence?: Confidence
  ): Effect.Effect<EntityFoundEvent>;
  (
    chunkIndex: number,
    entityId: string,
    mention: string,
    types: ReadonlyArray<string>,
    confidence?: Confidence
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<EntityFoundEvent>;
} = dual(
  5,
  Effect.fn(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: number,
    entityId: string,
    mention: string,
    types: ReadonlyArray<string>,
    confidence?: Confidence
  ): Effect.fn.Return<EntityFoundEvent> {
    const state = yield* Ref.get(ref);
    return EntityFoundEvent.make({
      _tag: "entity_found",
      eventId: UUID.make(uuidv4()),
      runId: state.runId,
      timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
      overallProgress: Percentage.make(calculateOverallProgress(state, 40)),
      chunkIndex: NonNegativeInt.make(chunkIndex),
      entityId,
      mention,
      types: A.fromIterable(types),
      confidence: O.fromUndefinedOr(confidence),
    });
  })
);

/**
 * Create RelationFoundEvent
 */
export const createRelationFound: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: number,
    subjectId: string,
    predicate: string,
    object: string | number | boolean,
    isEntityReference: boolean,
    confidence?: Confidence
  ): Effect.Effect<RelationFoundEvent>;
  (
    chunkIndex: number,
    subjectId: string,
    predicate: string,
    object: string | number | boolean,
    isEntityReference: boolean,
    confidence?: Confidence
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<RelationFoundEvent>;
} = dual(
  6,
  Effect.fn(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: number,
    subjectId: string,
    predicate: string,
    object: string | number | boolean,
    isEntityReference: boolean,
    confidence?: Confidence
  ): Effect.fn.Return<RelationFoundEvent> {
    const state = yield* Ref.get(ref);
    return RelationFoundEvent.make({
      _tag: "relation_found",
      eventId: UUID.make(uuidv4()),
      runId: state.runId,
      timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
      overallProgress: Percentage.make(calculateOverallProgress(state, 60)),
      chunkIndex: NonNegativeInt.make(chunkIndex),
      subjectId,
      predicate,
      object,
      isEntityReference,
      confidence: O.fromUndefinedOr(confidence),
    });
  })
);

/**
 * Create ChunkProcessingCompleteEvent
 */
export const createChunkProcessingComplete: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: number,
    entityCount: number,
    relationCount: number,
    durationMs: number,
    errors?: Array<{ readonly phase: string; readonly message: string }>
  ): Effect.Effect<ChunkProcessingCompleteEvent>;
  (
    chunkIndex: number,
    entityCount: number,
    relationCount: number,
    durationMs: number,
    errors?: Array<{ readonly phase: string; readonly message: string }>
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<ChunkProcessingCompleteEvent>;
} = dual(
  6,
  Effect.fn(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: number,
    entityCount: number,
    relationCount: number,
    durationMs: number,
    errors?: Array<{ readonly phase: string; readonly message: string }>
  ): Effect.fn.Return<ChunkProcessingCompleteEvent> {
    const state = yield* Ref.get(ref);
    return ChunkProcessingCompleteEvent.make({
      _tag: "chunk_processing_complete",
      eventId: UUID.make(uuidv4()),
      runId: state.runId,
      timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
      overallProgress: Percentage.make(calculateOverallProgress(state, 100)),
      chunkIndex: NonNegativeInt.make(chunkIndex),
      entityCount: NonNegativeInt.make(entityCount),
      relationCount: NonNegativeInt.make(relationCount),
      durationMs: PosInt.make(durationMs),
      errors: O.fromUndefinedOr(errors),
    });
  })
);

/**
 * Create ExtractionCompleteEvent
 */
export const createExtractionComplete: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    totalEntities: number,
    totalRelations: number,
    uniqueEntityTypes: number,
    totalDurationMs: number,
    successfulChunks: number,
    failedChunks: number
  ): Effect.Effect<ExtractionCompleteEvent>;
  (
    totalEntities: number,
    totalRelations: number,
    uniqueEntityTypes: number,
    totalDurationMs: number,
    successfulChunks: number,
    failedChunks: number
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<ExtractionCompleteEvent>;
} = dual(
  7,
  Effect.fn(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    totalEntities: number,
    totalRelations: number,
    uniqueEntityTypes: number,
    totalDurationMs: number,
    successfulChunks: number,
    failedChunks: number
  ): Effect.fn.Return<ExtractionCompleteEvent> {
    const state = yield* Ref.get(ref);
    return ExtractionCompleteEvent.make({
      _tag: "extraction_complete",
      eventId: UUID.make(uuidv4()),
      runId: state.runId,
      timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
      overallProgress: Percentage.make(100),
      totalEntities: NonNegativeInt.make(totalEntities),
      totalRelations: NonNegativeInt.make(totalRelations),
      uniqueEntityTypes: NonNegativeInt.make(uniqueEntityTypes),
      totalDurationMs: PosInt.make(totalDurationMs),
      successfulChunks: NonNegativeInt.make(successfulChunks),
      failedChunks: NonNegativeInt.make(failedChunks),
    });
  })
);

type CreateExtractionFailedOptions = {
  readonly isTemporary?: boolean;
  readonly retryAfterMs?: number;
  readonly partialResults?: {
    readonly entityCount: number;
    readonly relationCount: number;
    readonly processedChunks: number;
  };
  readonly lastSuccessfulChunkIndex?: number;
};

/**
 * Create ExtractionFailedEvent
 */
export const createExtractionFailed: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    errorType: string,
    errorMessage: string,
    isRecoverable: boolean,
    options?: CreateExtractionFailedOptions
  ): Effect.Effect<ExtractionFailedEvent>;
  (
    errorType: string,
    errorMessage: string,
    isRecoverable: boolean,
    options?: CreateExtractionFailedOptions
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<ExtractionFailedEvent>;
} = dual(
  5,
  Effect.fn(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    errorType: string,
    errorMessage: string,
    isRecoverable: boolean,
    options?: CreateExtractionFailedOptions
  ): Effect.fn.Return<ExtractionFailedEvent> {
    const state = yield* Ref.get(ref);
    return ExtractionFailedEvent.make({
      eventId: UUID.make(uuidv4()),
      runId: state.runId,
      timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
      overallProgress: Percentage.make(calculateOverallProgress(state, 0)),
      errorType,
      errorMessage,
      isRecoverable,
      retryStrategy: P.isNotUndefined(options?.isTemporary)
        ? ExtractionFailedRetryStrategy.cases.exponential_backoff.makeOption({
            type: "exponential_backoff" as const,
            delayMs: O.fromUndefinedOr(options.retryAfterMs).pipe(O.map(PosInt.make)),
            maxAttempts: O.some(PosInt.make(3)),
          })
        : O.none(),
      partialResults: O.fromUndefinedOr(options?.partialResults).pipe(
        O.map((results) => ({
          entityCount: NonNegativeInt.make(results.entityCount),
          relationCount: NonNegativeInt.make(results.relationCount),
          processedChunks: NonNegativeInt.make(results.processedChunks),
        }))
      ),
      lastSuccessfulChunkIndex: O.fromUndefinedOr(options?.lastSuccessfulChunkIndex).pipe(O.map(NonNegativeInt.make)),
    });
  })
);

/**
 * Create RecoverableErrorEvent
 */
export const createRecoverableError: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: number,
    errorType: string,
    errorMessage: string,
    phase: string,
    recoveryAction: string
  ): Effect.Effect<RecoverableErrorEvent>;
  (
    chunkIndex: number,
    errorType: string,
    errorMessage: string,
    phase: string,
    recoveryAction: string
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<RecoverableErrorEvent>;
} = dual(
  6,
  Effect.fn(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: number,
    errorType: string,
    errorMessage: string,
    phase: string,
    recoveryAction: string
  ): Effect.fn.Return<RecoverableErrorEvent> {
    const state = yield* Ref.get(ref);
    return RecoverableErrorEvent.make({
      eventId: UUID.make(uuidv4()),
      runId: state.runId,
      timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
      overallProgress: Percentage.make(calculateOverallProgress(state, 50)),
      chunkIndex: NonNegativeInt.make(chunkIndex),
      errorType,
      errorMessage,
      phase,
      recoveryAction,
    });
  })
);

/**
 * Increment processed chunks
 */
export const markChunkProcessed = (ref: Ref.Ref<ProgressBuilderState>): Effect.Effect<void> =>
  Ref.update(ref, (state) => ({
    ...state,
    processedChunks: NonNegativeInt.make(state.processedChunks + 1),
  }));

/**
 * Set phase progress
 */
export const setPhaseProgress = dual2(
  (ref: Ref.Ref<ProgressBuilderState>, progress: number): Effect.Effect<void> =>
    Ref.update(ref, (state) => ({
      ...state,
      currentPhaseProgress: Percentage.make(Math.min(100, Math.max(0, progress))),
    }))
);

// =============================================================================
// Backpressure Handler (Functional)
// =============================================================================

/**
 * Backpressure handler state
 */
export interface BackpressureState {
  readonly config: BackpressureConfig;
  readonly eventQueue: ReadonlyArray<ProgressEvent>;
  readonly lastWarnTime: number;
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
    lastWarnTime: 0,
  });

/**
 * Check if event should be included based on sampling
 */
const shouldIncludeEvent = Effect.fn("ProgressStreaming.shouldIncludeEvent")(function* (
  event: ProgressEvent,
  sampleRate: number
) {
  const tag = event._tag;
  const detailedEventTags = HashSet.make("entity_found", "relation_found");

  if (!HashSet.has(detailedEventTags, tag)) {
    return true;
  }

  return (yield* Random.next) < sampleRate;
});

/**
 * Enqueue event with backpressure handling
 *
 * Returns O.some with warning event if backpressure warning needed,
 * O.none otherwise
 */
export const enqueueEvent: {
  (
    ref: Ref.Ref<BackpressureState>,
    event: ProgressEvent
  ): Effect.Effect<O.Option<BackpressureWarningEvent>, ProgressStreamingError>;
  (
    event: ProgressEvent
  ): (ref: Ref.Ref<BackpressureState>) => Effect.Effect<O.Option<BackpressureWarningEvent>, ProgressStreamingError>;
} = dual(
  2,
  Effect.fn(function* (
    ref: Ref.Ref<BackpressureState>,
    event: ProgressEvent
  ): Effect.fn.Return<O.Option<BackpressureWarningEvent>, ProgressStreamingError> {
    const state = yield* Ref.get(ref);

    // Check sampling
    if (!(yield* shouldIncludeEvent(event, state.config.detailedEventSampleRate))) {
      return O.none();
    }

    const newQueue = [...state.eventQueue, event];
    const queueSize = newQueue.length;
    const ratio = queueSize / state.config.maxQueueSize;

    // Handle overflow
    if (ratio > 1.0) {
      return yield* Match.value(state.config.strategy).pipe(
        Match.when("drop_oldest", () =>
          Ref.update(ref, (s) => ({
            ...s,
            eventQueue: [...s.eventQueue.slice(1), event],
          })).pipe(Effect.as(O.none()))
        ),
        Match.when("drop_newest", () => Effect.succeed(O.none())),
        Match.when("block_producer", () =>
          Effect.gen(function* () {
            yield* Effect.sleep(state.config.blockTimeoutMs ?? 5000);
            const afterWait = yield* Ref.get(ref);
            if (afterWait.eventQueue.length >= state.config.maxQueueSize) {
              return yield* new ProgressStreamingError({
                reason: "BackpressureTimeout",
                message: "Backpressure timeout: client not consuming events fast enough",
              });
            }
            yield* Ref.update(ref, (s) => ({
              ...s,
              eventQueue: [...s.eventQueue, event],
            }));
            return O.none();
          })
        ),
        Match.when("close_stream", () =>
          Effect.fail(
            new ProgressStreamingError({
              reason: "QueueOverflow",
              message: "Backpressure critical: stream closed due to queue overflow",
            })
          )
        ),
        Match.exhaustive
      );
    }

    // Check warning threshold
    if (ratio >= state.config.warningThreshold) {
      const now = yield* Clock.currentTimeMillis;
      if (now - state.lastWarnTime > 5000) {
        yield* Ref.update(ref, (s) => ({
          ...s,
          eventQueue: newQueue,
          lastWarnTime: now,
        }));
        return O.some(
          BackpressureWarningEvent.make({
            _tag: "backpressure_warning",
            eventId: UUID.make(uuidv4()),
            runId: event.runId,
            timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
            overallProgress: event.overallProgress,
            queuedEvents: PosInt.make(queueSize),
            maxQueueSize: PosInt.make(state.config.maxQueueSize),
            severity: ratio > 0.95 ? "critical" : "warning",
            recommendedAction: "Increase event consumption rate or enable parallelism",
          })
        );
      }
    }

    // Normal enqueue
    yield* Ref.update(ref, (s) => ({
      ...s,
      eventQueue: newQueue,
    }));
    return O.none();
  })
);

/**
 * Dequeue next event
 */
export const dequeueEvent = (ref: Ref.Ref<BackpressureState>): Effect.Effect<O.Option<ProgressEvent>> =>
  Ref.modify(ref, (state) => {
    if (state.eventQueue.length === 0) {
      return [O.none(), state];
    }
    const [first, ...rest] = state.eventQueue;
    return [O.some(first), { ...state, eventQueue: rest }];
  });

/**
 * Get current queue size
 */
export const getQueueSize = (ref: Ref.Ref<BackpressureState>): Effect.Effect<number> =>
  Effect.map(Ref.get(ref), (state) => state.eventQueue.length);

// =============================================================================
// Stream Combiners
// =============================================================================

/**
 * Default concurrency for stream merging
 * Using bounded concurrency to prevent resource exhaustion
 */
/**
 * Combine multiple progress streams with backpressure handling
 */
export const combineProgressStreams = dual2(
  (
    streams: ReadonlyArray<Stream.Stream<ProgressEvent, Error>>,
    concurrency: number
  ): Stream.Stream<ProgressEvent, Error> => {
    if (streams.length === 0) {
      return Stream.empty;
    }

    if (streams.length === 1) {
      return streams[0];
    }

    // Merge all streams with bounded concurrency
    return Stream.mergeAll(streams, { concurrency });
  }
);

/**
 * Apply backpressure to a stream
 */
export const withBackpressure = dual2(
  (stream: Stream.Stream<ProgressEvent, Error>, config: BackpressureConfig): Stream.Stream<ProgressEvent, Error> =>
    Stream.unwrap(
      Effect.gen(function* () {
        const handlerRef = yield* makeBackpressureHandler(config);

        return stream.pipe(
          Stream.mapEffect(
            Effect.fn(function* (event) {
              const warning = yield* enqueueEvent(handlerRef, event);
              if (O.isSome(warning)) {
                // Emit warning followed by original event
                return Chunk.make(warning.value as ProgressEvent, event);
              }
              return Chunk.make(event);
            })
          ),
          Stream.flattenIterable
        );
      })
    )
);

// =============================================================================
// Resumable Extraction State
// =============================================================================

/**
 * State for resumable extractions
 */
export interface ResumableExtractionState {
  readonly runId: ExtractionRunId;
  readonly lastSuccessfulChunkIndex: NonNegativeInt;
  readonly partialResults: {
    entityCount: NonNegativeInt;
    relationCount: NonNegativeInt;
  };
  readonly pausedAt: Date;
  readonly pauseReason?: {
    errorType: string;
    message: string;
    isRecoverable: boolean;
    retryAfterMs?: PosInt;
  };
}

/**
 * Extract resumable state from ExtractionFailedEvent
 */
export const extractResumableState: {
  (runId: ExtractionRunId, event: ExtractionFailedEvent): O.Option<ResumableExtractionState>;
  (event: ExtractionFailedEvent): (runId: ExtractionRunId) => O.Option<ResumableExtractionState>;
} = dual(2, (runId: ExtractionRunId, event: ExtractionFailedEvent): O.Option<ResumableExtractionState> => {
  if (O.isNone(event.lastSuccessfulChunkIndex) || O.isNone(event.partialResults)) {
    return O.none();
  }

  return O.some({
    runId,
    lastSuccessfulChunkIndex: event.lastSuccessfulChunkIndex.value,
    partialResults: {
      entityCount: event.partialResults.value.entityCount,
      relationCount: event.partialResults.value.relationCount,
    },
    pausedAt: DateTime.toDateUtc(DateTime.makeUnsafe(event.timestamp)),
    pauseReason: {
      errorType: event.errorType,
      message: event.errorMessage,
      isRecoverable: event.isRecoverable,
      ...O.getOrUndefined(
        O.flatMap(event.retryStrategy, (strategy) => O.map(strategy.delayMs, (retryAfterMs) => ({ retryAfterMs })))
      ),
    },
  });
});
