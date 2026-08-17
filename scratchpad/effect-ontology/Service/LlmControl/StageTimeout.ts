/**
 * Soft-warning and hard-deadline policy for non-retrying workflow stages.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { Context, Duration, Effect, Fiber, Layer } from "effect";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Service/LlmControl/StageTimeout");

/**
 * Workflow stages that may use the stage-timeout service.
 *
 * **Example** (Check a timed stage)
 *
 * ```ts
 * import { TimedStage } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * console.log(TimedStage.is.chunking("chunking")) // true
 * ```
 *
 * @category models
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
 * Type of values accepted by {@link TimedStage}.
 *
 * **Example** (Type a timed stage)
 *
 * ```ts
 * import type { TimedStage } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * const stage: TimedStage = "chunking"
 * console.log(stage)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TimedStage = typeof TimedStage.Type;

type StageTimeoutInvariantInput = {
  readonly hardTimeout: Duration.Duration;
  readonly softTimeout: Duration.Duration;
};

const StageTimeoutInvariantCheck = S.makeFilter(
  (config: StageTimeoutInvariantInput) =>
    Duration.isGreaterThanOrEqualTo(config.hardTimeout, config.softTimeout)
      ? undefined
      : {
          path: ["hardTimeout"],
          issue: "Hard timeout must be greater than or equal to the soft warning timeout.",
        },
  {
    identifier: $I`StageTimeoutInvariantCheck`,
    title: "Stage Timeout Ordering",
    description: "A stage hard deadline cannot precede its soft warning deadline.",
    message: "Stage hard timeout must be greater than or equal to the soft timeout.",
  }
);

/**
 * Validated soft-warning and hard-deadline policy for one stage.
 *
 * **Example** (Create a stage-timeout policy)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { StageTimeoutConfig } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * const config = StageTimeoutConfig.make({
 *   softTimeout: Duration.seconds(2),
 *   hardTimeout: Duration.seconds(3)
 * })
 * console.log(Duration.toSeconds(config.hardTimeout)) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StageTimeoutConfig extends S.Class<StageTimeoutConfig>($I`StageTimeoutConfig`)(
  S.Struct({
    softTimeout: S.Duration.annotateKey({ description: "Delay before the soft-timeout callback runs." }),
    hardTimeout: S.Duration.annotateKey({ description: "Deadline after which the stage fails." }),
  }).pipe(S.check(StageTimeoutInvariantCheck)),
  $I.annote("StageTimeoutConfig", {
    description: "Ordered soft-warning and hard-deadline durations for a workflow stage.",
  })
) {}

/**
 * Constructor input accepted by {@link StageTimeoutConfig}.
 *
 * **Example** (Type a stage-timeout input)
 *
 * ```ts
 * import { Duration } from "effect"
 * import type { StageTimeoutConfigInput } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * const input: StageTimeoutConfigInput = {
 *   softTimeout: Duration.seconds(1),
 *   hardTimeout: Duration.seconds(2)
 * }
 * console.log(input)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type StageTimeoutConfigInput = (typeof StageTimeoutConfig)["~type.make.in"];

const STAGE_TIMEOUTS: Record<TimedStage, StageTimeoutConfig> = {
  chunking: StageTimeoutConfig.make({ softTimeout: Duration.seconds(3), hardTimeout: Duration.seconds(5) }),
  entity_extraction: StageTimeoutConfig.make({
    softTimeout: Duration.seconds(45),
    hardTimeout: Duration.seconds(60),
  }),
  relation_extraction: StageTimeoutConfig.make({
    softTimeout: Duration.seconds(45),
    hardTimeout: Duration.seconds(60),
  }),
  grounding: StageTimeoutConfig.make({ softTimeout: Duration.seconds(20), hardTimeout: Duration.seconds(30) }),
  entity_verification: StageTimeoutConfig.make({
    softTimeout: Duration.seconds(30),
    hardTimeout: Duration.seconds(45),
  }),
  serialization: StageTimeoutConfig.make({ softTimeout: Duration.seconds(7), hardTimeout: Duration.seconds(10) }),
};

/**
 * Failure raised when a stage exceeds its hard deadline.
 *
 * **Example** (Construct a stage timeout)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { TimeoutError } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * const error = TimeoutError.make({ stage: "chunking", timeout: Duration.seconds(5) })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TimeoutError extends S.TaggedError<TimeoutError>($I`TimeoutError`)(
  "TimeoutError",
  {
    stage: TimedStage.annotateKey({ description: "Workflow stage that exceeded its hard deadline." }),
    timeout: S.Duration.annotateKey({ description: "Hard deadline exceeded by the workflow stage." }),
  },
  $I.annote("TimeoutError", {
    description: "Failure raised when a workflow stage exceeds its hard deadline.",
  })
) {
  static readonly is = S.is(this);

  /**
   * Human-readable stage deadline diagnostic.
   *
   * **Example** (Read a stage timeout message)
   *
   * ```ts
   * import { Duration } from "effect"
   * import { TimeoutError } from "@effect-ontology/Service/LlmControl/StageTimeout"
   *
   * const error = TimeoutError.make({ stage: "chunking", timeout: Duration.seconds(5) })
   * console.log(error.message)
   * ```
   *
   * @returns A stable diagnostic derived from the stage and hard deadline.
   * @category errors
   * @since 0.0.0
   */
  override get message(): string {
    return `Stage "${this.stage}" timed out after ${Duration.format(this.timeout)}`;
  }
}

type StageTimeoutServiceShape = {
  readonly withTimeout: <A, E, R>(
    stage: TimedStage,
    effect: Effect.Effect<A, E, R>,
    onSoftTimeout?: () => Effect.Effect<void>
  ) => Effect.Effect<A, E | TimeoutError, R>;
  readonly getConfig: (stage: TimedStage) => Effect.Effect<StageTimeoutConfig>;
  readonly wouldTimeout: (stage: TimedStage, duration: Duration.Duration) => Effect.Effect<boolean>;
};

/**
 * Timeout management for finite, non-retrying workflow stages.
 *
 * **Gotchas**
 *
 * Retrying provider calls must use the retry policy's attempt and overall
 * deadlines directly. Wrapping them in this service would create competing
 * nested deadlines.
 *
 * **Example** (Access the stage-timeout service)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { StageTimeoutService } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * const program = Effect.gen(function* () {
 *   const timeouts = yield* StageTimeoutService
 *   return yield* timeouts.getConfig("chunking")
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class StageTimeoutService extends Context.Service<StageTimeoutService, StageTimeoutServiceShape>()(
  $I`StageTimeoutService`
) {}

const makeStageTimeoutService = (
  timeouts: Readonly<Record<TimedStage, StageTimeoutConfig>>
): StageTimeoutServiceShape => ({
  withTimeout: <A, E, R>(
    stage: TimedStage,
    effect: Effect.Effect<A, E, R>,
    onSoftTimeout?: () => Effect.Effect<void>
  ): Effect.Effect<A, E | TimeoutError, R> => {
    const config = timeouts[stage];
    return Effect.gen(function* () {
      const softTimeoutFiber = yield* Effect.sleep(config.softTimeout).pipe(
        Effect.andThen(onSoftTimeout?.() ?? Effect.void),
        Effect.forkChild
      );

      return yield* effect.pipe(
        Effect.timeoutOrElse({
          duration: config.hardTimeout,
          orElse: () => Effect.fail(TimeoutError.make({ stage, timeout: config.hardTimeout })),
        }),
        Effect.ensuring(Fiber.interrupt(softTimeoutFiber))
      );
    });
  },
  getConfig: (stage) => Effect.succeed(timeouts[stage]),
  wouldTimeout: (stage, duration) => Effect.succeed(Duration.isGreaterThan(duration, timeouts[stage].hardTimeout)),
});

/**
 * Live stage-timeout layer.
 *
 * **Example** (Inspect the live layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { StageTimeoutServiceLive } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * console.log(Layer.isLayer(StageTimeoutServiceLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const StageTimeoutServiceLive = Layer.succeed(StageTimeoutService, makeStageTimeoutService(STAGE_TIMEOUTS));

/**
 * Builds a stage-timeout layer with validated test overrides.
 *
 * **Example** (Override one stage for a test)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { StageTimeoutServiceTest } from "@effect-ontology/Service/LlmControl/StageTimeout"
 *
 * const layer = StageTimeoutServiceTest({
 *   chunking: { softTimeout: Duration.millis(10), hardTimeout: Duration.millis(20) }
 * })
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const StageTimeoutServiceTest = (
  overrides: Partial<Record<TimedStage, StageTimeoutConfigInput>> = {}
): Layer.Layer<StageTimeoutService> => {
  const timeouts: Record<TimedStage, StageTimeoutConfig> = {
    ...STAGE_TIMEOUTS,
    ...(overrides.chunking === undefined ? {} : { chunking: StageTimeoutConfig.make(overrides.chunking) }),
    ...(overrides.entity_extraction === undefined
      ? {}
      : { entity_extraction: StageTimeoutConfig.make(overrides.entity_extraction) }),
    ...(overrides.relation_extraction === undefined
      ? {}
      : { relation_extraction: StageTimeoutConfig.make(overrides.relation_extraction) }),
    ...(overrides.grounding === undefined ? {} : { grounding: StageTimeoutConfig.make(overrides.grounding) }),
    ...(overrides.entity_verification === undefined
      ? {}
      : { entity_verification: StageTimeoutConfig.make(overrides.entity_verification) }),
    ...(overrides.serialization === undefined
      ? {}
      : { serialization: StageTimeoutConfig.make(overrides.serialization) }),
  };
  return Layer.succeed(StageTimeoutService, makeStageTimeoutService(timeouts));
};
