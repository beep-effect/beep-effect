/**
 * Stage Timeout Service
 *
 * Provides soft and hard timeouts for extraction stages:
 * - Soft timeout: Emit warning, continue execution
 * - Hard timeout: Fail with TimeoutError
 *
 * Timeout configuration by stage:
 * - Chunking: 3s soft / 5s hard
 * - Entity extraction: 45s soft / 60s hard
 * - Relation extraction: 45s soft / 60s hard
 * - Grounding: 20s soft / 30s hard
 * - Entity verification: 30s soft / 45s hard
 * - Serialization: 7s soft / 10s hard
 *
 * @since 2.0.0
 * @module Service/LlmControl/StageTimeout
 */

import { Context, Data, Duration, Effect, Fiber, Layer } from "effect"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/LlmControl/StageTimeout");

// =============================================================================
// Types
// =============================================================================

/**
 * Stage names with timeout configuration
 */
export type TimedStage =
  | "chunking"
  | "entity_extraction"
  | "relation_extraction"
  | "grounding"
  | "entity_verification"
  | "serialization"

/**
 * Timeout configuration for a stage
 */
export interface StageTimeoutConfig {
  /** Soft timeout in milliseconds - warning emitted but continues */
  readonly softMs: number
  /** Hard timeout in milliseconds - fails with TimeoutError */
  readonly hardMs: number
}

/**
 * Stage timeout configuration map
 */
const STAGE_TIMEOUTS: Record<TimedStage, StageTimeoutConfig> = {
  chunking: { softMs: 3000, hardMs: 5000 },
  entity_extraction: { softMs: 45000, hardMs: 60000 },
  relation_extraction: { softMs: 45000, hardMs: 60000 },
  grounding: { softMs: 20000, hardMs: 30000 },
  entity_verification: { softMs: 30000, hardMs: 45000 },
  serialization: { softMs: 7000, hardMs: 10000 }
}

/**
 * Default timeout for unknown stages
 */
const DEFAULT_TIMEOUT: StageTimeoutConfig = { softMs: 10000, hardMs: 15000 }

// =============================================================================
// Errors
// =============================================================================

/**
 * Error thrown when a stage exceeds its hard timeout
 */
export class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly stage: string
  readonly timeoutMs: number
}> {
  get message() {
    return `Stage "${this.stage}" timed out after ${this.timeoutMs}ms`
  }
}

// =============================================================================
// Service
// =============================================================================

/**
 * Stage timeout management for extraction stages
 *
 * Provides dual-timeout strategy:
 * 1. Soft timeout emits a warning callback (for logging, metrics)
 * 2. Hard timeout fails the effect with TimeoutError
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const timeout = yield* StageTimeoutService
 *
 *   const result = yield* timeout.withTimeout(
 *     "entity_extraction",
 *     extractEntities(text),
 *     () => Effect.logWarning("Entity extraction is taking longer than expected")
 *   )
 * })
 * ```
 */
export class StageTimeoutService extends Context.Service<StageTimeoutService, {
    /**
     * Wrap an effect with soft and hard timeouts
     *
     * @param stage - Stage name for timeout lookup
     * @param effect - Effect to wrap
     * @param onSoftTimeout - Optional callback when soft timeout is reached
     * @returns Effect that fails with TimeoutError on hard timeout
     */
    readonly withTimeout: <A, E, R>(
      stage: string,
      effect: Effect.Effect<A, E, R>,
      onSoftTimeout?: () => Effect.Effect<void>
    ) => Effect.Effect<A, E | TimeoutError, R>

    /**
     * Get timeout configuration for a stage
     *
     * @param stage - Stage name
     * @returns Timeout configuration
     */
    readonly getConfig: (stage: string) => Effect.Effect<StageTimeoutConfig>

    /**
     * Check if an effect would timeout
     *
     * @param stage - Stage name
     * @param durationMs - Estimated duration in milliseconds
     * @returns true if duration exceeds hard timeout
     */
    readonly wouldTimeout: (
      stage: string,
      durationMs: number
    ) => Effect.Effect<boolean>
  }>()($I`StageTimeoutService`) {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Default implementation
 */
const make = Effect.succeed({
  withTimeout: <A, E, R>(
    stage: string,
    effect: Effect.Effect<A, E, R>,
    onSoftTimeout?: () => Effect.Effect<void>
  ): Effect.Effect<A, E | TimeoutError, R> => {
    const config = STAGE_TIMEOUTS[stage as TimedStage] ?? DEFAULT_TIMEOUT

    return Effect.gen(function*() {
      // Start soft timeout watcher in background
      const softTimeoutFiber = yield* Effect.sleep(Duration.millis(config.softMs)).pipe(
        Effect.flatMap(() => onSoftTimeout?.() ?? Effect.void),
        Effect.forkChild
      )

      // Run the effect with hard timeout
      const result = yield* effect.pipe(
        Effect.timeoutOrElse({ duration: Duration.millis(config.hardMs), orElse: () => Effect.fail(new TimeoutError({ stage, timeoutMs: config.hardMs })) })
      )

      // Cancel soft timeout watcher if we completed in time
      yield* Fiber.interrupt(softTimeoutFiber)

      return result
    })
  },

  getConfig: (stage: string) => Effect.succeed(STAGE_TIMEOUTS[stage as TimedStage] ?? DEFAULT_TIMEOUT),

  wouldTimeout: (stage: string, durationMs: number) => {
    const config = STAGE_TIMEOUTS[stage as TimedStage] ?? DEFAULT_TIMEOUT
    return Effect.succeed(durationMs > config.hardMs)
  }
})

/**
 * Default layer providing StageTimeoutService
 */
export const StageTimeoutServiceLive = Layer.effect(StageTimeoutService, make)

/**
 * Test layer with configurable timeouts (useful for faster tests)
 */
export const StageTimeoutServiceTest = (
  overrides: Partial<Record<TimedStage, StageTimeoutConfig>> = {}
): Layer.Layer<StageTimeoutService> => {
  const testTimeouts = { ...STAGE_TIMEOUTS, ...overrides }

  return Layer.succeed(StageTimeoutService, {
    withTimeout: <A, E, R>(
      stage: string,
      effect: Effect.Effect<A, E, R>,
      onSoftTimeout?: () => Effect.Effect<void>
    ): Effect.Effect<A, E | TimeoutError, R> => {
      const config = testTimeouts[stage as TimedStage] ?? DEFAULT_TIMEOUT

      return Effect.gen(function*() {
        const softTimeoutFiber = yield* Effect.sleep(Duration.millis(config.softMs)).pipe(
          Effect.flatMap(() => onSoftTimeout?.() ?? Effect.void),
          Effect.forkChild
        )

        const result = yield* effect.pipe(
          Effect.timeoutOrElse({ duration: Duration.millis(config.hardMs), orElse: () => Effect.fail(new TimeoutError({ stage, timeoutMs: config.hardMs })) })
        )

        yield* Fiber.interrupt(softTimeoutFiber)
        return result
      })
    },

    getConfig: (stage: string) => Effect.succeed(testTimeouts[stage as TimedStage] ?? DEFAULT_TIMEOUT),

    wouldTimeout: (stage: string, durationMs: number) => {
      const config = testTimeouts[stage as TimedStage] ?? DEFAULT_TIMEOUT
      return Effect.succeed(durationMs > config.hardMs)
    }
  })
}
