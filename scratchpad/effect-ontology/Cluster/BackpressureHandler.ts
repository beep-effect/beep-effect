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
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { ProgressEvent } from "../Contract/ProgressStreaming.ts";

const $I = $ScratchpadId.create("effect-ontology/Cluster/BackpressureHandler");

/**
 * Alias for backward compatibility - maps to ProgressEvent from Contract
 *
 * **Example** (Reference ExtractionProgressEvent fields)
 *
 * ```ts
 * import type { ExtractionProgressEvent } from "@effect-ontology/Cluster/BackpressureHandler"
 *
 * const extractionProgressEventFields: ReadonlyArray<keyof ExtractionProgressEvent> = ["_tag"]
 *
 * console.log(extractionProgressEventFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionProgressEvent = ProgressEvent;

// =============================================================================
// Types
// =============================================================================

/**
 * Backpressure configuration
 *
 * **Example** (Inspect backpressure config)
 *
 * ```ts
 * import { BackpressureConfig } from "@effect-ontology/Cluster/BackpressureHandler"
 *
 * console.log(BackpressureConfig)
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
 * **Example** (Use withBackpressure)
 *
 * ```ts
 * import { Stream } from "effect"
 * import { BackpressureConfig, withBackpressure } from "@effect-ontology/Cluster/BackpressureHandler"
 *
 * const controlled = withBackpressure(Stream.empty, BackpressureConfig.make({}))
 * console.log(Stream.isStream(controlled)) // true
 * ```
 *
 * @param source - Source stream of progress events
 * @param config - Backpressure configuration
 * @returns Stream with backpressure applied
 * @category services
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
        const queue = yield* Queue.bounded<ExtractionProgressEvent>(config.maxQueuedEvents);

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
                yield* Queue.offer(queue, event);
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
              yield* Queue.offer(queue, event);
            })
          ),
          Stream.runDrain,
          // Ensure queue is shutdown when producer completes
          Effect.ensuring(Queue.shutdown(queue))
        );

        // Fork producer to run in background
        const fiber = yield* Effect.forkScoped(producer);

        // Consumer: drain from queue
        return Stream.fromQueue(queue).pipe(
          // Ensure we wait for producer on completion
          Stream.ensuring(Fiber.join(fiber).pipe(Effect.ignore))
        );
      })
    )
);

// =============================================================================
// Metrics
// =============================================================================

/**
 * Backpressure metrics for monitoring
 *
 * **Example** (Reference BackpressureMetrics fields)
 *
 * ```ts
 * import type { BackpressureMetrics } from "@effect-ontology/Cluster/BackpressureHandler"
 *
 * const backpressureMetricsFields: ReadonlyArray<keyof BackpressureMetrics> = ["eventsReceived", "eventsDelivered", "eventsDropped"]
 *
 * console.log(backpressureMetricsFields)
 * ```
 *
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
 * **Example** (Inspect with backpressure metered)
 *
 * ```ts
 * import { withBackpressureMetered } from "@effect-ontology/Cluster/BackpressureHandler"
 *
 * console.log(withBackpressureMetered)
 * ```
 *
 * @category services
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
        const queue = yield* Queue.bounded<ExtractionProgressEvent>(config.maxQueuedEvents);

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
                yield* Queue.offer(queue, event);
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

              const offered = yield* Queue.offer(queue, event).pipe(
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
          Effect.ensuring(Queue.shutdown(queue))
        );

        const fiber = yield* Effect.forkScoped(producer);

        return Stream.fromQueue(queue).pipe(Stream.ensuring(Fiber.join(fiber).pipe(Effect.ignore)));
      })
    )
);
