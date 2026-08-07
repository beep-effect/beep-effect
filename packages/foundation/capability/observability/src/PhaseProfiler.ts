/**
 * Phase profiling for named application lifecycle phases (startup, migrations, etc.).
 *
 * **Details**
 *
 * Wraps an effect with span annotations, structured logs, and optional metric
 * recording to produce a {@link PhaseProfile} summary upon completion.
 *
 * **Example** (Profile migrations phase)
 *
 * ```typescript
 * import { Effect, Metric } from "effect"
 * import { profilePhase } from "@beep/observability"
 *
 * const migrate = Effect.log("running migrations")
 *
 * const profiled = profilePhase(
 *   migrate,
 *   { phase: "migrations" }
 * )
 *
 * console.log(Effect.runPromise(profiled))
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { Clock, Duration, Effect, Exit, Match, Metric } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { LogRedactedCauseOptions, logRedactedCause } from "./CauseRedaction.ts";
import { decodeNonNegativeInt } from "./internal/decode.ts";

const $I = $ObservabilityId.create("PhaseProfiler");

interface ProfilePhaseOptions {
  readonly attributes?: Record<string, string> | undefined;
  readonly completed?: Metric.Counter<number> | undefined;
  readonly duration?: Metric.Metric<Duration.Duration, unknown> | undefined;
  readonly failed?: Metric.Counter<number> | undefined;
  readonly interrupted?: Metric.Counter<number> | undefined;
  readonly phase: string;
  readonly started?: Metric.Counter<number> | undefined;
}

const isProfilePhaseDataFirst = (args: IArguments): boolean => args.length >= 2 || Effect.isEffect(args[0]);

/**
 * Terminal outcomes for profiled phases: `"completed"`, `"failed"`, or `"interrupted"`.
 *
 * **Example** (Return completed outcome)
 *
 * ```typescript
 * import { PhaseOutcome, profilePhase } from "@beep/observability"
 * import { Effect } from "effect"
 *
 * const program = profilePhase(Effect.succeed(PhaseOutcome.Enum.completed), {
 *   phase: "startup"
 * })
 * const outcome = Effect.runSync(program)
 * console.log(outcome) // "completed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PhaseOutcome = LiteralKit(["completed", "failed", "interrupted"]).pipe(
  $I.annoteSchema("PhaseOutcome", {
    description: "Terminal outcomes for profiled phases.",
  })
);

/**
 * Runtime type for {@link PhaseOutcome}.
 *
 * **Example** (Annotate outcome type)
 *
 * ```typescript
 * import type { PhaseOutcome } from "@beep/observability"
 *
 * const outcome: PhaseOutcome = "completed"
 * console.log(outcome)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PhaseOutcome = typeof PhaseOutcome.Type;

/**
 * Deterministic summary of one profiled phase with outcome, duration, and attributes.
 *
 * **Example** (Construct a PhaseProfile)
 *
 * ```typescript
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 * import { PhaseProfile } from "@beep/observability"
 *
 * const durationMs = S.decodeUnknownSync(NonNegativeInt)(42)
 * const profile = PhaseProfile.make({
 *   attributes: {},
 *   durationMs,
 *   outcome: "completed",
 *   phase: "startup"
 * })
 *
 * console.log(profile.phase) // "startup"
 * console.log(profile.outcome) // "completed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhaseProfile extends S.Class<PhaseProfile>($I`PhaseProfile`)(
  {
    phase: S.NonEmptyString,
    outcome: PhaseOutcome,
    durationMs: NonNegativeInt,
    attributes: S.Record(S.String, S.String),
  },
  $I.annote("PhaseProfile", {
    description: "Deterministic summary of one profiled phase.",
  })
) {}

const metricWithAttributes = <Input, State>(
  metric: Metric.Metric<Input, State>,
  attributes: Record<string, string>
): Metric.Metric<Input, State> => Metric.withAttributes(metric, attributes);

const incrementMetric = (
  metric: Metric.Counter<number> | undefined,
  attributes: Record<string, string>
): Effect.Effect<void> =>
  metric === undefined ? Effect.void : Metric.update(metricWithAttributes(metric, attributes), 1);

const toPhaseOutcome = <A, E>(exit: Exit.Exit<A, E>): PhaseOutcome =>
  Match.value(exit).pipe(
    Match.when(Exit.isSuccess, () => "completed" as const),
    Match.when(Exit.hasInterrupts, () => "interrupted" as const),
    Match.orElse(() => "failed" as const)
  );

const logPhaseCause = <A, E>(
  profile: PhaseProfile,
  exit: Exit.Exit<A, E>,
  level: "Error" | "Warn"
): Effect.Effect<void> =>
  Exit.match(exit, {
    onSuccess: () => Effect.logError("phase outcome did not match successful exit"),
    onFailure: (cause) =>
      logRedactedCause(
        cause,
        LogRedactedCauseOptions.make({
          message: Match.value(level).pipe(
            Match.when("Warn", () => "phase interrupted" as const),
            Match.when("Error", () => "phase failed" as const),
            Match.exhaustive
          ),
          level,
          attributes: {
            ...profile.attributes,
            phase: profile.phase,
            phase_outcome: profile.outcome,
            phase_duration_ms: `${profile.durationMs}`,
          },
        })
      ),
  });

const logPhaseProfile = <A, E>(profile: PhaseProfile, exit: Exit.Exit<A, E>): Effect.Effect<void> =>
  Match.value(profile.outcome).pipe(
    Match.when("completed", () =>
      Effect.logInfo({
        message: "phase completed",
        phase: profile.phase,
        durationMs: profile.durationMs,
        attributes: profile.attributes,
      })
    ),
    Match.when("interrupted", () => logPhaseCause(profile, exit, "Warn")),
    Match.when("failed", () => logPhaseCause(profile, exit, "Error")),
    Match.exhaustive
  );

/**
 * Profile one named phase with spans, logs, and optional metrics.
 *
 * **Details**
 *
 * Wraps an effect and records:
 * - A `started` counter increment on entry
 * - Span annotations for `phase`, `phase_outcome`, and `phase_duration_ms`
 * - A structured log at the appropriate level on exit
 * - Optional `completed`, `failed`, `interrupted` counters and duration metric
 *
 * **Example** (Profile with custom metrics)
 *
 * ```typescript
 * import { Effect, Metric } from "effect"
 * import { profilePhase } from "@beep/observability"
 *
 * const completed = Metric.counter("phase_completed_total")
 *
 * const profiled = profilePhase(Effect.succeed("ok"), {
 *   completed,
 *   phase: "startup"
 * })
 *
 * console.log(Effect.runPromise(profiled))
 * ```
 *
 * @effects Logs the phase outcome, annotates the current span, and updates any supplied phase metrics.
 * @category observability
 * @since 0.0.0
 */
const profilePhaseImpl = Effect.fn("profilePhaseImpl")(function* <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options: ProfilePhaseOptions
): Effect.fn.Return<A, E, R> {
  return yield* Clock.currentTimeMillis.pipe(
    Effect.flatMap(
      Effect.fnUntraced(function* (startedAt) {
        const baseAttributes = {
          phase: options.phase,
          ...options.attributes,
        };

        return yield* Effect.annotateCurrentSpan(baseAttributes).pipe(
          Effect.andThen(incrementMetric(options.started, baseAttributes)),
          Effect.andThen(effect),
          Effect.onExit((exit) =>
            Clock.currentTimeMillis.pipe(
              Effect.flatMap(
                Effect.fnUntraced(function* (endedAt) {
                  const durationMs = Math.max(0, endedAt - startedAt);
                  const outcome = toPhaseOutcome(exit);
                  const profile = PhaseProfile.make({
                    phase: options.phase,
                    outcome,
                    durationMs: decodeNonNegativeInt(durationMs),
                    attributes: baseAttributes,
                  });
                  const outcomeAttributes = {
                    ...baseAttributes,
                    outcome,
                  };
                  const durationEffect =
                    options.duration === undefined
                      ? Effect.void
                      : Metric.update(
                          metricWithAttributes(options.duration, outcomeAttributes),
                          Duration.millis(durationMs)
                        );
                  const outcomeEffect = Match.value(outcome).pipe(
                    Match.when("completed", () => incrementMetric(options.completed, outcomeAttributes)),
                    Match.when("failed", () => incrementMetric(options.failed, outcomeAttributes)),
                    Match.when("interrupted", () => incrementMetric(options.interrupted, outcomeAttributes)),
                    Match.exhaustive
                  );

                  return yield* Effect.annotateCurrentSpan({
                    phase: options.phase,
                    phase_outcome: outcome,
                    phase_duration_ms: durationMs,
                  }).pipe(
                    Effect.andThen(durationEffect),
                    Effect.andThen(outcomeEffect),
                    Effect.andThen(logPhaseProfile(profile, exit))
                  );
                })
              )
            )
          )
        );
      })
    )
  );
});

/**
 * Profiles an Effect phase and records its duration and outcome.
 *
 * **Example** (Profile a startup phase)
 *
 * ```typescript
 * import { Effect } from "effect"
 * import { profilePhase } from "@beep/observability"
 *
 * const program = profilePhase(Effect.succeed("ok"), { phase: "startup" })
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @effects Logs the phase outcome, annotates the current span, and updates any supplied phase metrics.
 * @category observability
 * @since 0.0.0
 */
export const profilePhase: {
  <A, E, R>(effect: Effect.Effect<A, E, R>, options: ProfilePhaseOptions): Effect.Effect<A, E, R>;
  <A, E, R>(options: ProfilePhaseOptions, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R>;
  (options: ProfilePhaseOptions): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
} = dual(
  isProfilePhaseDataFirst,
  Effect.fn("profilePhase")(function* <A, E, R>(
    effect: Effect.Effect<A, E, R> | ProfilePhaseOptions,
    options: ProfilePhaseOptions | Effect.Effect<A, E, R> | undefined
  ): Effect.fn.Return<A, E, R> {
    if (Effect.isEffect(effect) && P.isNotUndefined(options) && !Effect.isEffect(options)) {
      return yield* profilePhaseImpl(effect, options).pipe(
        Effect.withSpan("observability.phase", { attributes: { phase: options.phase } })
      );
    }

    if (!Effect.isEffect(effect) && Effect.isEffect(options)) {
      return yield* profilePhaseImpl(options, effect).pipe(
        Effect.withSpan("observability.phase", { attributes: { phase: effect.phase } })
      );
    }

    return yield* Effect.die("Invalid profilePhase arguments");
  })
);
