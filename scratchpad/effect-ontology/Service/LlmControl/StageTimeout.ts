/**
 * Stage Timeout Service
 *
 * **Details**
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
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { Context, Duration, Effect, Fiber, Layer } from "effect";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Service/LlmControl/StageTimeout");

// =============================================================================
// Types
// =============================================================================

/**
 * Stage names with timeout configuration
 *
 * **Example** (Inspect timed stage)
 *
 * ```ts
 * import { TimedStage } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * console.log(TimedStage)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const TimedStage = LiteralKit([
  "chunking",
  "entity_extraction",
  "relation_extraction",
  "grounding",
  "entity_verification",
  "serialization",
]);

/**
 * Describes the timed stage data exposed by this module.
 *
 *
 * **Example** (Use the TimedStage contract)
 *
 * ```ts
 * import type { TimedStage } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * const acceptsTimedStage = (_value: TimedStage): void => undefined
 *
 * console.log(acceptsTimedStage)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TimedStage = typeof TimedStage.Type;

const isTimedStage = S.is(TimedStage);

/**
 * Timeout configuration for a stage
 *
 *
 * **Example** (Use the StageTimeoutConfig contract)
 *
 * ```ts
 * import type { StageTimeoutConfig } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * const acceptsStageTimeoutConfig = (_value: StageTimeoutConfig): void => undefined
 *
 * console.log(acceptsStageTimeoutConfig)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface StageTimeoutConfig {
  /** Soft timeout in milliseconds - warning emitted but continues */
  readonly softMs: number;
  /** Hard timeout in milliseconds - fails with TimeoutError */
  readonly hardMs: number;
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
  serialization: { softMs: 7000, hardMs: 10000 },
};

/**
 * Default timeout for unknown stages
 */
const DEFAULT_TIMEOUT: StageTimeoutConfig = { softMs: 10000, hardMs: 15000 };
const getTimeoutConfig = (stage: string): StageTimeoutConfig =>
  isTimedStage(stage) ? STAGE_TIMEOUTS[stage] : DEFAULT_TIMEOUT;

// =============================================================================
// Errors
// =============================================================================

/**
 * Error thrown when a stage exceeds its hard timeout
 *
 * **Example** (Inspect timeout error)
 *
 * ```ts
 * import { TimeoutError } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * console.log(TimeoutError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TimeoutError extends S.TaggedError<TimeoutError>($I`TimeoutError`)(
  "TimeoutError",
  {
    stage: S.NonEmptyString.annotateKey({
      description: "Extraction stage that exceeded its hard timeout.",
    }),
    timeout: S.Duration.annotateKey({
      description: "Hard timeout duration exceeded by the extraction stage.",
    }),
  },
  $I.annote("TimeoutError", {
    description: "Failure raised when an extraction stage exceeds its hard timeout.",
  })
) {
  static readonly is = S.is(this);

  /**
   * Provides message behavior for timeout error values.
   *
   * **Example** (Inspect timeout error.message)
   *
   * ```ts
   * import { TimeoutError } from "@effect-ontology/Service/LlmControl/StageTimeout"
   *
   * console.log(TimeoutError)
   * ```
   *
   * @returns Result produced by this operation.
   */
  override get message() {
    return `Stage "${this.stage}" timed out after ${Duration.format(this.timeout)}`;
  }
}

// =============================================================================
// Service
// =============================================================================

/**
 * Stage timeout management for extraction stages
 *
 * **Details**
 *
 * Provides dual-timeout strategy:
 * 1. Soft timeout emits a warning callback (for logging, metrics)
 * 2. Hard timeout fails the effect with TimeoutError
 *
 * **Example** (Inspect the stage-timeout layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { StageTimeoutServiceLive } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * console.log(Layer.isLayer(StageTimeoutServiceLive)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class StageTimeoutService extends Context.Service<
  StageTimeoutService,
  {
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
    ) => Effect.Effect<A, E | TimeoutError, R>;

    /**
     * Get timeout configuration for a stage
     *
     * @param stage - Stage name
     * @returns Timeout configuration
     */
    readonly getConfig: (stage: string) => Effect.Effect<StageTimeoutConfig>;

    /**
     * Check if an effect would timeout
     *
     * @param stage - Stage name
     * @param durationMs - Estimated duration in milliseconds
     * @returns true if duration exceeds hard timeout
     */
    readonly wouldTimeout: (stage: string, durationMs: number) => Effect.Effect<boolean>;
  }
>()($I`StageTimeoutService`) {}

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
    const config = getTimeoutConfig(stage);

    return Effect.gen(function* () {
      // Start soft timeout watcher in background
      const softTimeoutFiber = yield* Effect.sleep(Duration.millis(config.softMs)).pipe(
        Effect.flatMap(() => onSoftTimeout?.() ?? Effect.void),
        Effect.forkChild
      );

      // Run the effect with hard timeout
      const result = yield* effect.pipe(
        Effect.timeoutOrElse({
          duration: Duration.millis(config.hardMs),
          orElse: () => Effect.fail(TimeoutError.make({ stage, timeout: Duration.millis(config.hardMs) })),
        })
      );

      // Cancel soft timeout watcher if we completed in time
      yield* Fiber.interrupt(softTimeoutFiber);

      return result;
    });
  },

  getConfig: (stage: string) => Effect.succeed(getTimeoutConfig(stage)),

  wouldTimeout: (stage: string, durationMs: number) => {
    const config = getTimeoutConfig(stage);
    return Effect.succeed(durationMs > config.hardMs);
  },
});

/**
 * Default layer providing StageTimeoutService
 *
 * **Example** (Inspect stage timeout service live)
 *
 * ```ts
 * import { StageTimeoutServiceLive } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * console.log(StageTimeoutServiceLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const StageTimeoutServiceLive = Layer.effect(StageTimeoutService, make);

/**
 * Test layer with configurable timeouts (useful for faster tests)
 *
 * **Example** (Inspect stage timeout service test)
 *
 * ```ts
 * import { StageTimeoutServiceTest } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * console.log(StageTimeoutServiceTest)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const StageTimeoutServiceTest = (
  overrides: Partial<Record<TimedStage, StageTimeoutConfig>> = {}
): Layer.Layer<StageTimeoutService> => {
  const testTimeouts = { ...STAGE_TIMEOUTS, ...overrides };
  const getTestTimeoutConfig = (stage: string): StageTimeoutConfig =>
    isTimedStage(stage) ? testTimeouts[stage] : DEFAULT_TIMEOUT;

  return Layer.succeed(StageTimeoutService, {
    withTimeout: <A, E, R>(
      stage: string,
      effect: Effect.Effect<A, E, R>,
      onSoftTimeout?: () => Effect.Effect<void>
    ): Effect.Effect<A, E | TimeoutError, R> => {
      const config = getTestTimeoutConfig(stage);

      return Effect.gen(function* () {
        const softTimeoutFiber = yield* Effect.sleep(Duration.millis(config.softMs)).pipe(
          Effect.flatMap(() => onSoftTimeout?.() ?? Effect.void),
          Effect.forkChild
        );

        const result = yield* effect.pipe(
          Effect.timeoutOrElse({
            duration: Duration.millis(config.hardMs),
            orElse: () => Effect.fail(TimeoutError.make({ stage, timeout: Duration.millis(config.hardMs) })),
          })
        );

        yield* Fiber.interrupt(softTimeoutFiber);
        return result;
      });
    },

    getConfig: Effect.fn("StageTimeoutService.getConfig")((stage: string) =>
      Effect.succeed(getTestTimeoutConfig(stage))
    ),

    wouldTimeout: Effect.fn("StageTimeoutService.wouldTimeout")((stage: string, durationMs: number) => {
      const config = getTestTimeoutConfig(stage);
      return Effect.succeed(durationMs > config.hardMs);
    }),
  });
};
