/**
 * Backpressure Handler for Progress Streaming
 *
 * **Details**
 *
 * Applies intelligent backpressure to progress event streams:
 * - Critical events (start, complete, fail, stage transitions) always pass
 * - Non-critical events sampled when queue load exceeds threshold
 * - Configurable queue size and sampling rates
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { PosInt } from "@beep/schema/Int";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Effect, Fiber, HashSet, Queue, Stream } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { ProgressEvent } from "../Contract/ProgressStreaming.ts";

const $I = $ScratchpadId.create("effect-ontology/Cluster/BackpressureHandler");

/**
 * Progress event accepted by {@link withBackpressure} and {@link withBackpressureMetered}.
 *
 * @see {@link ProgressEvent} for the tagged progress-event union and decoding.
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionProgressEvent = ProgressEvent;

// =============================================================================
// Types
// =============================================================================

/**
 * Queue capacity and sampling ratios applied when a progress consumer is slow.
 *
 * **Example** (Construct a tight sampling config)
 *
 * ```ts
 * import { PosInt } from "@beep/schema/Int"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { BackpressureConfig } from "@effect-ontology/Cluster/BackpressureHandler"
 *
 * const config = BackpressureConfig.make({
 *   maxQueuedEvents: PosInt.make(8),
 *   samplingThreshold: UnitInterval.make(0.5),
 *   samplingRate: UnitInterval.make(0.25)
 * })
 * console.log(config.maxQueuedEvents) // 8
 * console.log(config.samplingThreshold) // 0.5
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class BackpressureConfig extends S.Class<BackpressureConfig>($I`BackpressureConfig`)(
  {
    /** Maximum queued events before dropping starts */
    maxQueuedEvents: PosInt.pipe(
      SchemaUtils.withKeyDefaults(PosInt.make(1000)),
      $I.annoteKey("BackpressureConfig.maxQueuedEvents", {
        description: "Maximum queued events before dropping starts",
      })
    ),
    /** Queue load threshold (0-1) to start sampling */
    samplingThreshold: UnitInterval.pipe(
      SchemaUtils.withKeyDefaults(UnitInterval.make(0.8)),
      $I.annoteKey("BackpressureConfig.samplingThreshold", {
        description: "Queue load threshold (0-1) to start sampling",
      })
    ),
    /** Sampling rate when threshold exceeded (0-1, e.g., 0.1 = keep 10%) */
    samplingRate: UnitInterval.pipe(
      SchemaUtils.withKeyDefaults(UnitInterval.make(0.1)),
      $I.annoteKey("BackpressureConfig.samplingRate", {
        description: "Sampling rate when threshold exceeded (0-1, e.g., 0.1 = keep 10%)",
      })
    ),
  },
  $I.annote("BackpressureConfig", {
    description: "Queue capacity and bounded sampling ratios for extraction progress backpressure.",
  })
) {}

// =============================================================================
// Critical Events
// =============================================================================

/**
 * Event types that should never be sampled
 *
 * These tags align with ProgressEventTag in Contract/ProgressStreaming.ts
 */
const CRITICAL_EVENT_TAGS = HashSet.make(
  // Core lifecycle events
  "extraction_started",
  "extraction_complete",
  "extraction_failed",
  "extraction_cancelled",
  // Chunking lifecycle
  "chunking_started",
  "chunking_complete",
  // Chunk processing lifecycle
  "chunk_processing_started",
  "chunk_processing_complete",
  // Generic stage lifecycle (replaces grounding_started, etc.)
  "stage_started",
  "stage_completed",
  // Error and warning events
  "error_recoverable",
  "error_fatal",
  "backpressure_warning",
  "rate_limited"
);

/**
 * Check if an event is critical and should never be sampled
 */
const isCriticalEvent = (event: ExtractionProgressEvent): boolean => HashSet.has(CRITICAL_EVENT_TAGS, event._tag);

const consumeQueue = Effect.fn("BackpressureHandler.consumeQueue")(function* <A, E, R>(
  queue: Queue.Queue<O.Option<A>>,
  producer: Effect.Effect<void, E, R>
) {
  const fiber = yield* Effect.forkScoped(producer);
  return Stream.fromQueue(queue).pipe(
    Stream.takeWhile(O.isSome),
    Stream.map((option) => option.value),
    Stream.ensuring(Fiber.interrupt(fiber))
  );
});

// =============================================================================
// Backpressure Stream Operator
// =============================================================================

/**
 * Apply backpressure to an extraction progress event stream
 *
 * **Details**
 *
 * When the downstream consumer is slow:
 * 1. Critical events are always delivered immediately
 * 2. Non-critical events are sampled based on queue load
 * 3. Oldest non-critical events are dropped if queue is full
 *
 * **Example** (Deliver a critical start event)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import * as S from "effect/Schema"
 * import { BackpressureConfig, withBackpressure } from "@effect-ontology/Cluster/BackpressureHandler"
 * import { ExtractionStartedEvent } from "@effect-ontology/Contract/ProgressStreaming"
 *
 * const started = S.decodeUnknownSync(ExtractionStartedEvent)({
 *   _tag: "extraction_started",
 *   eventId: "00000000-0000-4000-8000-000000000001",
 *   runId: "doc-0123456789ab",
 *   timestamp: "2026-08-11T12:00:00Z",
 *   overallProgress: 0,
 *   totalChunks: 4,
 *   textMetadata: { characterCount: 1200, estimatedAvgChunkSize: 300 }
 * })
 * const tags = Effect.runPromise(
 *   Effect.scoped(
 *     Stream.make(started).pipe(
 *       withBackpressure(BackpressureConfig.make({})),
 *       Stream.map((event) => event._tag),
 *       Stream.runCollect
 *     )
 *   )
 * )
 * console.log(tags)
 * ```
 *
 * @param source - Source stream of progress events
 * @param config - Backpressure configuration
 * @returns Stream with backpressure applied
 * @category combinators
 * @since 0.0.0
 */
export const withBackpressure: {
  <E>(
    config: BackpressureConfig
  ): (source: Stream.Stream<ExtractionProgressEvent, E>) => Stream.Stream<ExtractionProgressEvent, E>;
  <E>(
    source: Stream.Stream<ExtractionProgressEvent, E>,
    config: BackpressureConfig
  ): Stream.Stream<ExtractionProgressEvent, E>;
} = dual(
  2,
  <E>(
    source: Stream.Stream<ExtractionProgressEvent, E>,
    config: BackpressureConfig
  ): Stream.Stream<ExtractionProgressEvent, E> =>
    Stream.unwrap(
      Effect.gen(function* () {
        // Create bounded queue for backpressure
        const queue = yield* Queue.bounded<O.Option<ExtractionProgressEvent>>(config.maxQueuedEvents);

        // Track sampling state
        let sampleCounter = 0;

        // Producer: read from source and apply sampling
        const producer = source.pipe(
          Stream.tap(
            Effect.fnUntraced(function* (event) {
              const size = yield* Queue.size(queue);
              const loadFactor = size / config.maxQueuedEvents;

              // Critical events always pass
              if (isCriticalEvent(event)) {
                // If queue is full, drop oldest to make room for critical event
                if (size >= config.maxQueuedEvents) {
                  yield* Queue.take(queue); // Drop oldest
                }
                yield* Queue.offer(queue, O.some(event));
                return;
              }

              // Apply sampling when queue is getting full
              if (loadFactor > config.samplingThreshold) {
                sampleCounter++;
                const sampleEvery = Math.floor(1 / config.samplingRate);
                if (sampleCounter % sampleEvery !== 0) {
                  // Drop this non-critical event
                  return;
                }
              }

              // Try to enqueue, drop if full
              yield* Queue.offer(queue, O.some(event));
            })
          ),
          Stream.runDrain,
          // Ensure queue is shutdown when producer completes
          Effect.ensuring(Queue.offer(queue, O.none()))
        );

        return yield* consumeQueue(queue, producer);
      })
    )
);

// =============================================================================
// Metrics
// =============================================================================

/**
 * Counters emitted by {@link withBackpressureMetered} as events are received, delivered, or dropped.
 *
 * @see {@link withBackpressureMetered} for the stream combinator that records these counters.
 * @category type-level
 * @since 0.0.0
 */
export interface BackpressureMetrics {
  /** Total events received */
  readonly eventsReceived: number;
  /** Events delivered to consumer */
  readonly eventsDelivered: number;
  /** Events dropped due to sampling */
  readonly eventsDropped: number;
  /** Current queue size */
  readonly currentQueueSize: number;
  /** Peak queue size reached */
  readonly peakQueueSize: number;
  /** Number of times sampling was triggered */
  readonly samplingTriggered: number;
}

/**
 * Create a metered backpressure handler that tracks metrics
 *
 * **Example** (Record dropped non-critical events)
 *
 * ```ts
 * import { Effect, Ref, Stream } from "effect"
 * import * as S from "effect/Schema"
 * import { BackpressureConfig, withBackpressureMetered } from "@effect-ontology/Cluster/BackpressureHandler"
 * import { ChunkingProgressEvent } from "@effect-ontology/Contract/ProgressStreaming"
 *
 * const progress = S.decodeUnknownSync(ChunkingProgressEvent)({
 *   _tag: "chunking_progress",
 *   eventId: "00000000-0000-4000-8000-000000000001",
 *   runId: "doc-0123456789ab",
 *   timestamp: "2026-08-24T00:00:00.000Z",
 *   overallProgress: 5,
 *   chunksCompleted: 3,
 *   chunksProcessing: 1,
 *   avgChunkSize: 480
 * })
 * const dropped = Effect.runPromise(
 *   Effect.scoped(
 *     Effect.gen(function* () {
 *       const droppedRef = yield* Ref.make(0)
 *       yield* Stream.make(progress).pipe(
 *         withBackpressureMetered(BackpressureConfig.make({}), (metrics) =>
 *           Ref.set(droppedRef, metrics.eventsDropped)
 *         ),
 *         Stream.runDrain
 *       )
 *       return yield* Ref.get(droppedRef)
 *     })
 *   )
 * )
 * console.log(dropped)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const withBackpressureMetered: {
  <E>(
    config: BackpressureConfig,
    onMetrics: ((metrics: BackpressureMetrics) => Effect.Effect<void>) | undefined
  ): (source: Stream.Stream<ExtractionProgressEvent, E>) => Stream.Stream<ExtractionProgressEvent, E>;
  <E>(
    source: Stream.Stream<ExtractionProgressEvent, E>,
    config: BackpressureConfig,
    onMetrics: ((metrics: BackpressureMetrics) => Effect.Effect<void>) | undefined
  ): Stream.Stream<ExtractionProgressEvent, E>;
} = dual(
  3,
  <E>(
    source: Stream.Stream<ExtractionProgressEvent, E>,
    config: BackpressureConfig,
    onMetrics: ((metrics: BackpressureMetrics) => Effect.Effect<void>) | undefined
  ): Stream.Stream<ExtractionProgressEvent, E> =>
    Stream.unwrap(
      Effect.gen(function* () {
        const queue = yield* Queue.bounded<O.Option<ExtractionProgressEvent>>(config.maxQueuedEvents);

        // Metrics tracking
        let eventsReceived = 0;
        let eventsDelivered = 0;
        let eventsDropped = 0;
        let peakQueueSize = 0;
        let samplingTriggered = 0;
        let sampleCounter = 0;

        const getMetrics = (): BackpressureMetrics => ({
          eventsReceived,
          eventsDelivered,
          eventsDropped,
          currentQueueSize: 0, // Will be updated
          peakQueueSize,
          samplingTriggered,
        });

        const producer = source.pipe(
          Stream.tap(
            Effect.fnUntraced(function* (event) {
              eventsReceived++;
              const size = yield* Queue.size(queue);
              peakQueueSize = Math.max(peakQueueSize, size);

              const loadFactor = size / config.maxQueuedEvents;

              if (isCriticalEvent(event)) {
                if (size >= config.maxQueuedEvents) {
                  yield* Queue.take(queue);
                  eventsDropped++;
                }
                yield* Queue.offer(queue, O.some(event));
                eventsDelivered++;
                return;
              }

              if (loadFactor > config.samplingThreshold) {
                if (sampleCounter === 0) samplingTriggered++;
                sampleCounter++;
                const sampleEvery = Math.floor(1 / config.samplingRate);
                if (sampleCounter % sampleEvery !== 0) {
                  eventsDropped++;
                  return;
                }
              }

              const offered = yield* Queue.offer(queue, O.some(event)).pipe(
                Effect.map(() => true),
                Effect.orElseSucceed(() => false)
              );

              if (offered) {
                eventsDelivered++;
              } else {
                eventsDropped++;
              }

              // Emit metrics periodically
              if (P.isNotUndefined(onMetrics) && eventsReceived % 100 === 0) {
                yield* onMetrics({
                  ...getMetrics(),
                  currentQueueSize: size,
                });
              }
            })
          ),
          Stream.runDrain,
          Effect.ensuring(Queue.offer(queue, O.none()))
        );

        return yield* consumeQueue(queue, producer);
      })
    )
);
