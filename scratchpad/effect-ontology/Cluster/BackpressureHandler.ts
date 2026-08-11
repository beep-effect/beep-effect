/**
 * Backpressure Handler for Progress Streaming
 *
 * Applies intelligent backpressure to progress event streams:
 * - Critical events (start, complete, fail, stage transitions) always pass
 * - Non-critical events sampled when queue load exceeds threshold
 * - Configurable queue size and sampling rates
 *
 * @since 2.0.0
 * @module Cluster/BackpressureHandler
 */

import { Effect, Fiber, Queue, Stream } from "effect";
import * as P from "effect/Predicate";
import type { ProgressEvent } from "../Contract/ProgressStreaming.ts";

/**
 * Alias for backward compatibility - maps to ProgressEvent from Contract
 */
export type ExtractionProgressEvent = ProgressEvent;

// =============================================================================
// Types
// =============================================================================

/**
 * Backpressure configuration
 */
export interface BackpressureConfig {
  /** Maximum queued events before dropping starts */
  readonly maxQueuedEvents: number;
  /** Queue load threshold (0-1) to start sampling */
  readonly samplingThreshold: number;
  /** Sampling rate when threshold exceeded (0-1, e.g., 0.1 = keep 10%) */
  readonly samplingRate: number;
}

/**
 * Default backpressure configuration
 */
export const DEFAULT_BACKPRESSURE_CONFIG: BackpressureConfig = {
  maxQueuedEvents: 1000,
  samplingThreshold: 0.8, // Start sampling at 80% capacity
  samplingRate: 0.1, // Keep 10% of non-critical events
};

// =============================================================================
// Critical Events
// =============================================================================

/**
 * Event types that should never be sampled
 *
 * These tags align with ProgressEventTag in Contract/ProgressStreaming.ts
 */
const CRITICAL_EVENT_TAGS = new Set([
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
  "rate_limited",
]);

/**
 * Check if an event is critical and should never be sampled
 */
const isCriticalEvent = (event: ExtractionProgressEvent): boolean => CRITICAL_EVENT_TAGS.has(event._tag);

// =============================================================================
// Backpressure Stream Operator
// =============================================================================

/**
 * Apply backpressure to an extraction progress event stream
 *
 * When the downstream consumer is slow:
 * 1. Critical events are always delivered immediately
 * 2. Non-critical events are sampled based on queue load
 * 3. Oldest non-critical events are dropped if queue is full
 *
 * @param source - Source stream of progress events
 * @param config - Backpressure configuration
 * @returns Stream with backpressure applied
 *
 * @example
 * ```typescript
 * const controlled = withBackpressure(progressStream, {
 *   maxQueuedEvents: 500,
 *   samplingThreshold: 0.7,
 *   samplingRate: 0.2
 * })
 * ```
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const withBackpressure = <E>(
  source: Stream.Stream<ExtractionProgressEvent, E>,
  config: BackpressureConfig = DEFAULT_BACKPRESSURE_CONFIG
): Stream.Stream<ExtractionProgressEvent, E> =>
  Stream.unwrap(
    Effect.gen(function* () {
      // Create bounded queue for backpressure
      const queue = yield* Queue.bounded<ExtractionProgressEvent>(config.maxQueuedEvents);

      // Track sampling state
      let sampleCounter = 0;

      // Producer: read from source and apply sampling
      const producer = source.pipe(
        Stream.tap((event) =>
          Effect.gen(function* () {
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
  );

// =============================================================================
// Metrics
// =============================================================================

/**
 * Backpressure metrics for monitoring
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
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const withBackpressureMetered = <E>(
  source: Stream.Stream<ExtractionProgressEvent, E>,
  config: BackpressureConfig = DEFAULT_BACKPRESSURE_CONFIG,
  onMetrics?: (metrics: BackpressureMetrics) => Effect.Effect<void>
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
        Stream.tap((event) =>
          Effect.gen(function* () {
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
  );
