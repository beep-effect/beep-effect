/**
 * Progress Streaming Service
 *
 * **Details**
 *
 * Implements the progress streaming contract with Effect patterns.
 * Provides functional builders for creating progress events.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { Percentage } from "@beep/schema/Percentage";
import { UUID } from "@beep/schema/String";
import { ISOStr } from "@beep/schema/Timestamp";
import { Chunk, Clock, DateTime, Duration, Effect, HashSet, Match, Random, Ref, Stream } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { v4 as uuidv4 } from "uuid";
import type { BackpressureConfigInput } from "../Contract/ProgressStreaming.ts";
import {
  BackpressureConfig,
  BackpressureWarningEvent,
  ChunkingProgressEvent,
  ChunkProcessingCompleteEvent,
  ChunkProcessingStartedEvent,
  EntityFoundEvent,
  ExtractionCompleteEvent,
  ExtractionFailedEvent,
  ExtractionFailedRetryStrategy,
  ExtractionStartedEvent,
  ProgressEvent,
  RecoverableErrorEvent,
  RelationFoundEvent,
} from "../Contract/ProgressStreaming.ts";
import { ExtractionRunId } from "../Domain/Identity.ts";
import { dual2 } from "../Utils/Dual.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ProgressStreaming");
const ProgressStreamingFailureReason = LiteralKit(["BackpressureTimeout", "QueueOverflow"]).pipe(
  $I.annoteSchema("ProgressStreamingFailureReason", {
    description: "Backpressure policy outcomes that stop progress delivery.",
  })
);

// =============================================================================
// Types
// =============================================================================

/**
 * Extraction run ID type (mirrors the pattern from Contract)
 */
/**
 * Failure caused by progress-stream backpressure policy enforcement.
 *
 * **Example** (Construct a backpressure timeout)
 *
 * ```ts
 * import { ProgressStreamingError } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const error = ProgressStreamingError.make({
 *   reason: "BackpressureTimeout",
 *   message: "Client stopped consuming events"
 * })
 * console.log(error._tag) // "ProgressStreamingError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProgressStreamingError extends S.TaggedError<ProgressStreamingError>($I`ProgressStreamingError`)(
  "ProgressStreamingError",
  {
    reason: ProgressStreamingFailureReason.annotateKey({
      description: "Backpressure policy outcome that stopped progress delivery.",
    }),
    message: S.NonEmptyString.annotateKey({
      description: "Human-readable progress-streaming failure diagnostic.",
    }),
  },
  $I.annote("ProgressStreamingError", {
    description: "Failure caused by progress-stream backpressure policy enforcement.",
  })
) {
  static readonly is = S.is(this);
}

/**
 * Progress builder state
 *
 * **Example** (Start a four-chunk run)
 *
 * ```ts
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import { Percentage } from "@beep/schema/Percentage"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { ProgressBuilderState } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const state = ProgressBuilderState.make({
 *   runId: ExtractionRunId.make("doc-deadbeefcafe"),
 *   totalChunks: PosInt.make(4),
 *   processedChunks: NonNegativeInt.make(0),
 *   currentPhaseProgress: Percentage.make(0)
 * })
 * console.log(state.totalChunks) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProgressBuilderState extends S.Class<ProgressBuilderState>($I`ProgressBuilderState`)(
  {
    runId: ExtractionRunId,
    totalChunks: PosInt,
    processedChunks: NonNegativeInt,
    currentPhaseProgress: Percentage,
  },
  $I.annote("ProgressBuilderState", {
    description: "Extraction run identity, chunk counts, and current phase progress held by the event builder.",
  })
) {}

// =============================================================================
// Progress Event Builder (Functional)
// =============================================================================

/**
 * Create a new progress builder state
 *
 * **Example** (Create a progress builder)
 *
 * ```ts
 * import { Effect, Ref } from "effect"
 * import { PosInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { makeProgressBuilder } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const totalChunks = Effect.runSync(
 *   Effect.gen(function* () {
 *     const builder = yield* makeProgressBuilder(ExtractionRunId.make("doc-deadbeefcafe"), PosInt.make(4))
 *     const state = yield* Ref.get(builder)
 *     return state.totalChunks
 *   })
 * )
 * console.log(totalChunks) // 4
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeProgressBuilder = dual2(
  (runId: ExtractionRunId, totalChunks: PosInt): Effect.Effect<Ref.Ref<ProgressBuilderState>> =>
    Ref.make(
      ProgressBuilderState.make({
        runId,
        totalChunks,
        processedChunks: NonNegativeInt.make(0),
        currentPhaseProgress: Percentage.make(0),
      })
    )
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
 *
 * **Example** (Emit extraction started)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { PosInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { createExtractionStarted, makeProgressBuilder } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const tag = Effect.runSync(
 *   Effect.gen(function* () {
 *     const builder = yield* makeProgressBuilder(ExtractionRunId.make("doc-deadbeefcafe"), PosInt.make(4))
 *     const event = yield* createExtractionStarted(builder, {
 *       characterCount: PosInt.make(1200),
 *       estimatedAvgChunkSize: PosInt.make(300)
 *     })
 *     return event._tag
 *   })
 * )
 * console.log(tag) // "extraction_started"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const createExtractionStarted: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    textMetadata: {
      characterCount: PosInt;
      estimatedAvgChunkSize: PosInt;
      contentType?: string;
    }
  ): Effect.Effect<ExtractionStartedEvent>;
  (textMetadata: {
    characterCount: PosInt;
    estimatedAvgChunkSize: PosInt;
    contentType?: string;
  }): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<ExtractionStartedEvent>;
} = dual(
  2,
  Effect.fn("ProgressStreaming.createExtractionStarted")(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    textMetadata: {
      characterCount: PosInt;
      estimatedAvgChunkSize: PosInt;
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
      totalChunks: state.totalChunks,
      textMetadata: {
        characterCount: textMetadata.characterCount,
        estimatedAvgChunkSize: textMetadata.estimatedAvgChunkSize,
        contentType: O.fromUndefinedOr(textMetadata.contentType),
      },
    });
  })
);

/**
 * Create ChunkingProgressEvent
 *
 * **Example** (Emit chunking progress)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { createChunkingProgress, makeProgressBuilder } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const tag = Effect.runSync(
 *   Effect.gen(function* () {
 *     const builder = yield* makeProgressBuilder(ExtractionRunId.make("doc-deadbeefcafe"), PosInt.make(4))
 *     const event = yield* createChunkingProgress(
 *       builder,
 *       NonNegativeInt.make(1),
 *       NonNegativeInt.make(1),
 *       PosInt.make(300)
 *     )
 *     return event._tag
 *   })
 * )
 * console.log(tag) // "chunking_progress"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const createChunkingProgress: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    chunksCompleted: NonNegativeInt,
    chunksProcessing: NonNegativeInt,
    avgChunkSize: PosInt
  ): Effect.Effect<ChunkingProgressEvent>;
  (
    chunksCompleted: NonNegativeInt,
    chunksProcessing: NonNegativeInt,
    avgChunkSize: PosInt
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<ChunkingProgressEvent>;
} = dual(
  4,
  Effect.fn("ProgressStreaming.createChunkingProgress")(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    chunksCompleted: NonNegativeInt,
    chunksProcessing: NonNegativeInt,
    avgChunkSize: PosInt
  ): Effect.fn.Return<ChunkingProgressEvent> {
    const state = yield* Ref.get(ref);
    return ChunkingProgressEvent.make({
      _tag: "chunking_progress",
      eventId: UUID.make(uuidv4()),
      runId: state.runId,
      timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
      overallProgress: Percentage.make(calculateOverallProgress(state, 0)),
      chunksCompleted,
      chunksProcessing,
      avgChunkSize,
    });
  })
);

/**
 * Create ChunkProcessingStartedEvent
 *
 * **Example** (Start processing a chunk)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { createChunkProcessingStarted, makeProgressBuilder } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const tag = Effect.runSync(
 *   Effect.gen(function* () {
 *     const builder = yield* makeProgressBuilder(ExtractionRunId.make("doc-deadbeefcafe"), PosInt.make(4))
 *     const event = yield* createChunkProcessingStarted(
 *       builder,
 *       NonNegativeInt.make(0),
 *       PosInt.make(18),
 *       "Ada founded Acme."
 *     )
 *     return event._tag
 *   })
 * )
 * console.log(tag) // "chunk_processing_started"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const createChunkProcessingStarted: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: NonNegativeInt,
    chunkTextLength: PosInt,
    textPreview: string
  ): Effect.Effect<ChunkProcessingStartedEvent>;
  (
    chunkIndex: NonNegativeInt,
    chunkTextLength: PosInt,
    textPreview: string
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<ChunkProcessingStartedEvent>;
} = dual(
  4,
  Effect.fn("ProgressStreaming.createChunkProcessingStarted")(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: NonNegativeInt,
    chunkTextLength: PosInt,
    textPreview: string
  ): Effect.fn.Return<ChunkProcessingStartedEvent> {
    const state = yield* Ref.get(ref);
    return ChunkProcessingStartedEvent.make({
      _tag: "chunk_processing_started",
      eventId: UUID.make(uuidv4()),
      runId: state.runId,
      timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
      overallProgress: Percentage.make(calculateOverallProgress(state, 0)),
      chunkIndex,
      chunkTextLength,
      textPreview,
    });
  })
);

/**
 * Create EntityFoundEvent
 *
 * **Example** (Emit an entity-found event)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { createEntityFound, makeProgressBuilder } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const tag = Effect.runSync(
 *   Effect.gen(function* () {
 *     const builder = yield* makeProgressBuilder(ExtractionRunId.make("doc-deadbeefcafe"), PosInt.make(4))
 *     const event = yield* createEntityFound(
 *       builder,
 *       NonNegativeInt.make(0),
 *       "https://example.org/Ada",
 *       "Ada",
 *       ["Person"]
 *     )
 *     return event._tag
 *   })
 * )
 * console.log(tag) // "entity_found"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const createEntityFound: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: NonNegativeInt,
    entityId: string,
    mention: string,
    types: ReadonlyArray<string>,
    confidence?: Confidence
  ): Effect.Effect<EntityFoundEvent>;
  (
    chunkIndex: NonNegativeInt,
    entityId: string,
    mention: string,
    types: ReadonlyArray<string>,
    confidence?: Confidence
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<EntityFoundEvent>;
} = dual(
  5,
  Effect.fn("ProgressStreaming.createEntityFound")(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: NonNegativeInt,
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
      chunkIndex,
      entityId,
      mention,
      types: A.fromIterable(types),
      confidence: O.fromUndefinedOr(confidence),
    });
  })
);

/**
 * Create RelationFoundEvent
 *
 * **Example** (Emit a relation-found event)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { createRelationFound, makeProgressBuilder } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const tag = Effect.runSync(
 *   Effect.gen(function* () {
 *     const builder = yield* makeProgressBuilder(ExtractionRunId.make("doc-deadbeefcafe"), PosInt.make(4))
 *     const event = yield* createRelationFound(
 *       builder,
 *       NonNegativeInt.make(0),
 *       "https://example.org/Ada",
 *       "https://example.org/founded",
 *       "https://example.org/Acme",
 *       true
 *     )
 *     return event._tag
 *   })
 * )
 * console.log(tag) // "relation_found"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const createRelationFound: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: NonNegativeInt,
    subjectId: string,
    predicate: string,
    object: string | number | boolean,
    isEntityReference: boolean,
    confidence?: Confidence
  ): Effect.Effect<RelationFoundEvent>;
  (
    chunkIndex: NonNegativeInt,
    subjectId: string,
    predicate: string,
    object: string | number | boolean,
    isEntityReference: boolean,
    confidence?: Confidence
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<RelationFoundEvent>;
} = dual(
  6,
  Effect.fn("ProgressStreaming.createRelationFound")(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: NonNegativeInt,
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
      chunkIndex,
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
 *
 * **Example** (Complete a chunk)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { createChunkProcessingComplete, makeProgressBuilder } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const tag = Effect.runSync(
 *   Effect.gen(function* () {
 *     const builder = yield* makeProgressBuilder(ExtractionRunId.make("doc-deadbeefcafe"), PosInt.make(4))
 *     const event = yield* createChunkProcessingComplete(
 *       builder,
 *       NonNegativeInt.make(0),
 *       NonNegativeInt.make(1),
 *       NonNegativeInt.make(1),
 *       PosInt.make(40)
 *     )
 *     return event._tag
 *   })
 * )
 * console.log(tag) // "chunk_processing_complete"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const createChunkProcessingComplete: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: NonNegativeInt,
    entityCount: NonNegativeInt,
    relationCount: NonNegativeInt,
    durationMs: PosInt,
    errors?: Array<{ readonly phase: string; readonly message: string }>
  ): Effect.Effect<ChunkProcessingCompleteEvent>;
  (
    chunkIndex: NonNegativeInt,
    entityCount: NonNegativeInt,
    relationCount: NonNegativeInt,
    durationMs: PosInt,
    errors?: Array<{ readonly phase: string; readonly message: string }>
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<ChunkProcessingCompleteEvent>;
} = dual(
  6,
  Effect.fn("ProgressStreaming.createChunkProcessingComplete")(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: NonNegativeInt,
    entityCount: NonNegativeInt,
    relationCount: NonNegativeInt,
    durationMs: PosInt,
    errors?: Array<{ readonly phase: string; readonly message: string }>
  ): Effect.fn.Return<ChunkProcessingCompleteEvent> {
    const state = yield* Ref.get(ref);
    return ChunkProcessingCompleteEvent.make({
      _tag: "chunk_processing_complete",
      eventId: UUID.make(uuidv4()),
      runId: state.runId,
      timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
      overallProgress: Percentage.make(calculateOverallProgress(state, 100)),
      chunkIndex,
      entityCount,
      relationCount,
      durationMs,
      errors: O.fromUndefinedOr(errors),
    });
  })
);

/**
 * Create ExtractionCompleteEvent
 *
 * **Example** (Complete an extraction)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { createExtractionComplete, makeProgressBuilder } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const tag = Effect.runSync(
 *   Effect.gen(function* () {
 *     const builder = yield* makeProgressBuilder(ExtractionRunId.make("doc-deadbeefcafe"), PosInt.make(4))
 *     const event = yield* createExtractionComplete(
 *       builder,
 *       NonNegativeInt.make(2),
 *       NonNegativeInt.make(1),
 *       NonNegativeInt.make(1),
 *       PosInt.make(250),
 *       NonNegativeInt.make(4),
 *       NonNegativeInt.make(0)
 *     )
 *     return event._tag
 *   })
 * )
 * console.log(tag) // "extraction_complete"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const createExtractionComplete: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    totalEntities: NonNegativeInt,
    totalRelations: NonNegativeInt,
    uniqueEntityTypes: NonNegativeInt,
    totalDurationMs: PosInt,
    successfulChunks: NonNegativeInt,
    failedChunks: NonNegativeInt
  ): Effect.Effect<ExtractionCompleteEvent>;
  (
    totalEntities: NonNegativeInt,
    totalRelations: NonNegativeInt,
    uniqueEntityTypes: NonNegativeInt,
    totalDurationMs: PosInt,
    successfulChunks: NonNegativeInt,
    failedChunks: NonNegativeInt
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<ExtractionCompleteEvent>;
} = dual(
  7,
  Effect.fn("ProgressStreaming.createExtractionComplete")(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    totalEntities: NonNegativeInt,
    totalRelations: NonNegativeInt,
    uniqueEntityTypes: NonNegativeInt,
    totalDurationMs: PosInt,
    successfulChunks: NonNegativeInt,
    failedChunks: NonNegativeInt
  ): Effect.fn.Return<ExtractionCompleteEvent> {
    const state = yield* Ref.get(ref);
    return ExtractionCompleteEvent.make({
      _tag: "extraction_complete",
      eventId: UUID.make(uuidv4()),
      runId: state.runId,
      timestamp: ISOStr.make(DateTime.toDateUtc(yield* DateTime.now).toISOString()),
      overallProgress: Percentage.make(100),
      totalEntities,
      totalRelations,
      uniqueEntityTypes,
      totalDurationMs,
      successfulChunks,
      failedChunks,
    });
  })
);

type CreateExtractionFailedOptions = {
  readonly isTemporary?: boolean;
  readonly retryAfterMs?: PosInt;
  readonly partialResults?: {
    readonly entityCount: NonNegativeInt;
    readonly relationCount: NonNegativeInt;
    readonly processedChunks: NonNegativeInt;
  };
  readonly lastSuccessfulChunkIndex?: NonNegativeInt;
};

/**
 * Create ExtractionFailedEvent
 *
 * **Example** (Emit extraction failed)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { PosInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { createExtractionFailed, makeProgressBuilder } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const tag = Effect.runSync(
 *   Effect.gen(function* () {
 *     const builder = yield* makeProgressBuilder(ExtractionRunId.make("doc-deadbeefcafe"), PosInt.make(4))
 *     const event = yield* createExtractionFailed(
 *       builder,
 *       "LanguageModelError",
 *       "The model returned empty output",
 *       true
 *     )
 *     return event._tag
 *   })
 * )
 * console.log(tag) // "extraction_failed"
 * ```
 *
 * @category constructors
 * @since 0.0.0
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
  Effect.fn("ProgressStreaming.createExtractionFailed")(function* (
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
            type: "exponential_backoff",
            delayMs: O.fromUndefinedOr(options.retryAfterMs),
            maxAttempts: O.some(PosInt.make(3)),
          })
        : O.none(),
      partialResults: O.fromUndefinedOr(options?.partialResults),
      lastSuccessfulChunkIndex: O.fromUndefinedOr(options?.lastSuccessfulChunkIndex),
    });
  })
);

/**
 * Create RecoverableErrorEvent
 *
 * **Example** (Emit a recoverable error)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { createRecoverableError, makeProgressBuilder } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const tag = Effect.runSync(
 *   Effect.gen(function* () {
 *     const builder = yield* makeProgressBuilder(ExtractionRunId.make("doc-deadbeefcafe"), PosInt.make(4))
 *     const event = yield* createRecoverableError(
 *       builder,
 *       NonNegativeInt.make(0),
 *       "Timeout",
 *       "Chunk processing timed out",
 *       "extracting",
 *       "Retry the chunk"
 *     )
 *     return event._tag
 *   })
 * )
 * console.log(tag) // "error_recoverable"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const createRecoverableError: {
  (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: NonNegativeInt,
    errorType: string,
    errorMessage: string,
    phase: string,
    recoveryAction: string
  ): Effect.Effect<RecoverableErrorEvent>;
  (
    chunkIndex: NonNegativeInt,
    errorType: string,
    errorMessage: string,
    phase: string,
    recoveryAction: string
  ): (ref: Ref.Ref<ProgressBuilderState>) => Effect.Effect<RecoverableErrorEvent>;
} = dual(
  6,
  Effect.fn("ProgressStreaming.createRecoverableError")(function* (
    ref: Ref.Ref<ProgressBuilderState>,
    chunkIndex: NonNegativeInt,
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
      chunkIndex,
      errorType,
      errorMessage,
      phase,
      recoveryAction,
    });
  })
);

/**
 * Increment processed chunks
 *
 * **Example** (Increment processed chunks)
 *
 * ```ts
 * import { Effect, Ref } from "effect"
 * import { PosInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { makeProgressBuilder, markChunkProcessed } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const processed = Effect.runSync(
 *   Effect.gen(function* () {
 *     const builder = yield* makeProgressBuilder(ExtractionRunId.make("doc-deadbeefcafe"), PosInt.make(4))
 *     yield* markChunkProcessed(builder)
 *     return (yield* Ref.get(builder)).processedChunks
 *   })
 * )
 * console.log(processed) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const markChunkProcessed = (ref: Ref.Ref<ProgressBuilderState>): Effect.Effect<void> =>
  Ref.update(ref, (state) => ({
    ...state,
    processedChunks: NonNegativeInt.make(state.processedChunks + 1),
  }));

/**
 * Set phase progress
 *
 * **Example** (Set phase progress)
 *
 * ```ts
 * import { Effect, Ref } from "effect"
 * import { PosInt } from "@beep/schema"
 * import { Percentage } from "@beep/schema/Percentage"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { makeProgressBuilder, setPhaseProgress } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const progress = Effect.runSync(
 *   Effect.gen(function* () {
 *     const builder = yield* makeProgressBuilder(ExtractionRunId.make("doc-deadbeefcafe"), PosInt.make(4))
 *     yield* setPhaseProgress(builder, Percentage.make(50))
 *     return (yield* Ref.get(builder)).currentPhaseProgress
 *   })
 * )
 * console.log(progress) // 50
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const setPhaseProgress = dual2(
  (ref: Ref.Ref<ProgressBuilderState>, progress: Percentage): Effect.Effect<void> =>
    Ref.update(ref, (state) => ({
      ...state,
      currentPhaseProgress: progress,
    }))
);

// =============================================================================
// Backpressure Handler (Functional)
// =============================================================================

/**
 * Backpressure handler state
 *
 * **Example** (Create an empty backpressure queue)
 *
 * ```ts
 * import { BackpressureConfig } from "@effect-ontology/Contract/ProgressStreaming"
 * import { BackpressureState } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const state = BackpressureState.make({
 *   config: BackpressureConfig.make({}),
 *   eventQueue: [],
 *   lastWarnTime: 0
 * })
 * console.log(state.eventQueue.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BackpressureState extends S.Class<BackpressureState>($I`BackpressureState`)(
  {
    config: BackpressureConfig,
    eventQueue: S.Array(ProgressEvent),
    lastWarnTime: S.Finite.check(
      S.isGreaterThanOrEqualTo(0, { message: "Expected a non-negative backpressure warning timestamp" })
    ),
  },
  $I.annote("BackpressureState", {
    description: "Resolved queue policy, queued progress events, and the last warning timestamp.",
  })
) {}

/**
 * Create backpressure handler state
 *
 * **Example** (Create a backpressure handler)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { getQueueSize, makeBackpressureHandler } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const size = Effect.runSync(
 *   Effect.gen(function* () {
 *     const handler = yield* makeBackpressureHandler({})
 *     return yield* getQueueSize(handler)
 *   })
 * )
 * console.log(size) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeBackpressureHandler = (
  input: BackpressureConfigInput = {}
): Effect.Effect<Ref.Ref<BackpressureState>> =>
  Ref.make(
    BackpressureState.make({
      config: BackpressureConfig.make(input),
      eventQueue: [],
      lastWarnTime: 0,
    })
  );

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

type BackpressureOverflowContext = {
  readonly ref: Ref.Ref<BackpressureState>;
  readonly event: ProgressEvent;
  readonly state: BackpressureState;
};

const backpressureOverflow = Match.type<BackpressureConfig["strategy"]>().pipe(
  Match.when(
    "drop_oldest",
    () =>
      ({ ref, event }: BackpressureOverflowContext) =>
        Ref.update(ref, (state) => ({
          ...state,
          eventQueue: [...state.eventQueue.slice(1), event],
        })).pipe(Effect.as(O.none()))
  ),
  Match.when("drop_newest", () => (_context: BackpressureOverflowContext) => Effect.succeedNone),
  Match.when("block_producer", () =>
    Effect.fn("ProgressStreaming.backpressureOverflow.blockProducer")(function* ({
      ref,
      event,
      state,
    }: BackpressureOverflowContext): Effect.fn.Return<O.Option<BackpressureWarningEvent>, ProgressStreamingError> {
      yield* Effect.sleep(state.config.blockTimeout);
      const afterWait = yield* Ref.get(ref);
      if (afterWait.eventQueue.length >= state.config.maxQueueSize) {
        return yield* ProgressStreamingError.make({
          reason: "BackpressureTimeout",
          message: "Backpressure timeout: client not consuming events fast enough",
        });
      }
      yield* Ref.update(ref, (current) => ({
        ...current,
        eventQueue: [...current.eventQueue, event],
      }));
      return O.none();
    })
  ),
  Match.when(
    "close_stream",
    () => (_context: BackpressureOverflowContext) =>
      Effect.fail(
        ProgressStreamingError.make({
          reason: "QueueOverflow",
          message: "Backpressure critical: stream closed due to queue overflow",
        })
      )
  ),
  Match.exhaustive
);

/**
 * Enqueue event with backpressure handling
 *
 * **Details**
 *
 * Returns O.some with warning event if backpressure warning needed,
 * O.none otherwise
 *
 * **Example** (Enqueue a started event)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { PosInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import {
 *   createExtractionStarted,
 *   enqueueEvent,
 *   getQueueSize,
 *   makeBackpressureHandler,
 *   makeProgressBuilder
 * } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const size = Effect.runSync(
 *   Effect.gen(function* () {
 *     const handler = yield* makeBackpressureHandler({})
 *     const builder = yield* makeProgressBuilder(ExtractionRunId.make("doc-deadbeefcafe"), PosInt.make(1))
 *     const started = yield* createExtractionStarted(builder, {
 *       characterCount: PosInt.make(18),
 *       estimatedAvgChunkSize: PosInt.make(18)
 *     })
 *     yield* enqueueEvent(handler, started)
 *     return yield* getQueueSize(handler)
 *   }).pipe(Effect.orDie)
 * )
 * console.log(size) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
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
  Effect.fn("ProgressStreaming.enqueueEvent")(function* (
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
      return yield* backpressureOverflow(state.config.strategy)({ ref, event, state });
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
 *
 * **Example** (Dequeue from an empty handler)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { dequeueEvent, makeBackpressureHandler } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const empty = Effect.runSync(
 *   Effect.gen(function* () {
 *     const handler = yield* makeBackpressureHandler({})
 *     return yield* dequeueEvent(handler)
 *   })
 * )
 * console.log(O.isNone(empty)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const dequeueEvent = (ref: Ref.Ref<BackpressureState>): Effect.Effect<O.Option<ProgressEvent>> =>
  Ref.modify(ref, (state) =>
    A.match(state.eventQueue, {
      onEmpty: () => [O.none(), state],
      onNonEmpty: ([first, ...rest]) => [O.some(first), { ...state, eventQueue: rest }],
    })
  );

/**
 * Get current queue size
 *
 * **Example** (Read queue size)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { getQueueSize, makeBackpressureHandler } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const size = Effect.runSync(
 *   Effect.gen(function* () {
 *     const handler = yield* makeBackpressureHandler({})
 *     return yield* getQueueSize(handler)
 *   })
 * )
 * console.log(size) // 0
 * ```
 *
 * @category services
 * @since 0.0.0
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
 *
 * **Example** (Merge an empty stream list)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { combineProgressStreams } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const count = Effect.runSync(Stream.runCount(combineProgressStreams([], 1)))
 * console.log(count) // 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const combineProgressStreams: {
  <E, R>(
    concurrency: number
  ): (streams: ReadonlyArray<Stream.Stream<ProgressEvent, E, R>>) => Stream.Stream<ProgressEvent, E, R>;
  <E, R>(
    streams: ReadonlyArray<Stream.Stream<ProgressEvent, E, R>>,
    concurrency: number
  ): Stream.Stream<ProgressEvent, E, R>;
} = dual(
  2,
  <E, R>(
    streams: ReadonlyArray<Stream.Stream<ProgressEvent, E, R>>,
    concurrency: number
  ): Stream.Stream<ProgressEvent, E, R> => Stream.mergeAll(streams, { concurrency })
);

/**
 * Apply backpressure to a stream
 *
 * **Example** (Apply backpressure to an empty stream)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { BackpressureConfig } from "@effect-ontology/Contract/ProgressStreaming"
 * import { withBackpressure } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const count = Effect.runSync(
 *   Stream.runCount(withBackpressure(Stream.empty, BackpressureConfig.make({}))).pipe(Effect.orDie)
 * )
 * console.log(count) // 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const withBackpressure: {
  <E, R>(
    config: BackpressureConfig
  ): (stream: Stream.Stream<ProgressEvent, E, R>) => Stream.Stream<ProgressEvent, E | ProgressStreamingError, R>;
  <E, R>(
    stream: Stream.Stream<ProgressEvent, E, R>,
    config: BackpressureConfig
  ): Stream.Stream<ProgressEvent, E | ProgressStreamingError, R>;
} = dual(
  2,
  <E, R>(
    stream: Stream.Stream<ProgressEvent, E, R>,
    config: BackpressureConfig
  ): Stream.Stream<ProgressEvent, E | ProgressStreamingError, R> =>
    Stream.unwrap(
      Effect.gen(function* () {
        const handlerRef = yield* makeBackpressureHandler(config);

        return stream.pipe(
          Stream.mapEffect(
            Effect.fn("ProgressStreaming.withBackpressure.event")(function* (event) {
              const warning = yield* enqueueEvent(handlerRef, event);
              if (O.isSome(warning)) {
                // Emit warning followed by original event
                return Chunk.make(warning.value, event);
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
 *
 *
 * **Example** (Checkpoint a paused extraction)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { ResumableExtractionState } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const state = ResumableExtractionState.make({
 *   runId: ExtractionRunId.make("doc-deadbeefcafe"),
 *   lastSuccessfulChunkIndex: NonNegativeInt.make(2),
 *   partialResults: { entityCount: NonNegativeInt.make(4), relationCount: NonNegativeInt.make(1) },
 *   pausedAt: new Date("2026-01-01T00:00:00.000Z")
 * })
 * console.log(state.lastSuccessfulChunkIndex) // 2
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
class ResumablePartialResults extends S.Class<ResumablePartialResults>($I`ResumablePartialResults`)(
  {
    entityCount: NonNegativeInt,
    relationCount: NonNegativeInt,
  },
  $I.annote("ResumablePartialResults", {
    description: "Entity and relation counts retained at an extraction pause point.",
  })
) {}

class PauseReason extends S.Class<PauseReason>($I`PauseReason`)(
  {
    errorType: S.NonEmptyString,
    message: S.NonEmptyString,
    isRecoverable: S.Boolean,
    retryAfter: S.Duration.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("PauseReason", {
    description: "Failure and optional retry delay that caused extraction to pause.",
  })
) {}

/**
 * Checkpoint and recovery context retained for a resumable extraction.
 *
 * **Example** (Create a resume checkpoint)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import { ResumableExtractionState } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const state = ResumableExtractionState.make({
 *   runId: ExtractionRunId.make("doc-deadbeefcafe"),
 *   lastSuccessfulChunkIndex: NonNegativeInt.make(2),
 *   partialResults: { entityCount: NonNegativeInt.make(4), relationCount: NonNegativeInt.make(1) },
 *   pausedAt: new Date("2026-01-01T00:00:00.000Z")
 * })
 * console.log(state.runId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResumableExtractionState extends S.Class<ResumableExtractionState>($I`ResumableExtractionState`)(
  {
    runId: ExtractionRunId,
    lastSuccessfulChunkIndex: NonNegativeInt,
    partialResults: ResumablePartialResults,
    pausedAt: S.Date,
    pauseReason: PauseReason.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ResumableExtractionState", {
    description: "Checkpoint, partial counts, pause time, and recovery reason for a resumable extraction.",
  })
) {}

/**
 * Extract resumable state from ExtractionFailedEvent
 *
 * **Example** (Extract resume state from a failure)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { PosInt } from "@beep/schema"
 * import { ExtractionRunId } from "@effect-ontology/Identity"
 * import {
 *   createExtractionFailed,
 *   extractResumableState,
 *   makeProgressBuilder
 * } from "@effect-ontology/Service/ProgressStreaming"
 *
 * const resumable = Effect.runSync(
 *   Effect.gen(function* () {
 *     const runId = ExtractionRunId.make("doc-deadbeefcafe")
 *     const builder = yield* makeProgressBuilder(runId, PosInt.make(4))
 *     const failed = yield* createExtractionFailed(builder, "Timeout", "The extractor timed out", true)
 *     return extractResumableState(runId, failed)
 *   })
 * )
 * console.log(O.isNone(resumable)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const extractResumableState: {
  (runId: ExtractionRunId, event: ExtractionFailedEvent): O.Option<ResumableExtractionState>;
  (event: ExtractionFailedEvent): (runId: ExtractionRunId) => O.Option<ResumableExtractionState>;
} = dual(2, (runId: ExtractionRunId, event: ExtractionFailedEvent): O.Option<ResumableExtractionState> => {
  if (O.isNone(event.lastSuccessfulChunkIndex) || O.isNone(event.partialResults)) {
    return O.none();
  }

  return O.some(
    ResumableExtractionState.make({
      runId,
      lastSuccessfulChunkIndex: event.lastSuccessfulChunkIndex.value,
      partialResults: {
        entityCount: event.partialResults.value.entityCount,
        relationCount: event.partialResults.value.relationCount,
      },
      pausedAt: DateTime.toDateUtc(DateTime.makeUnsafe(event.timestamp)),
      pauseReason: O.some(
        PauseReason.make({
          errorType: event.errorType,
          message: event.errorMessage,
          isRecoverable: event.isRecoverable,
          retryAfter: O.flatMap(event.retryStrategy, (strategy) =>
            O.map(strategy.delayMs, (retryAfterMs) => Duration.millis(retryAfterMs))
          ),
        })
      ),
    })
  );
});
