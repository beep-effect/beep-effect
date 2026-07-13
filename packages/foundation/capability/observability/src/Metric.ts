/**
 * Effect metric observation helpers for duration tracking, workflow profiling,
 * and HTTP request instrumentation.
 *
 * All helpers wrap an inner `Effect` and transparently record metrics and span
 * annotations without altering the original success/failure semantics.
 *
 * @example
 * ```typescript
 * import { Effect, Metric, Duration } from "effect"
 * import { measureElapsedMillis, trackDuration } from "@beep/observability"
 *
 * const timer = Metric.timer("my_op_duration")
 *
 * const program = trackDuration(Effect.succeed("ok"), timer)
 *
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ObservabilityId } from "@beep/identity/packages";
import { P } from "@beep/utils";
import { Clock, Duration, Effect, Exit, Match, Metric, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { PhaseOutcome } from "./PhaseProfiler.ts";

const $I = $ObservabilityId.create("Metric");

/**
 * Options for the trackDuration metric helper.
 *
 * @example
 * ```typescript
 * import { TrackDurationOptions } from "@beep/observability"
 *
 * const options = TrackDurationOptions.make({ attributes: { op: "read" } })
 * console.log(options.attributes)
 * // { op: "read" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TrackDurationOptions extends S.Class<TrackDurationOptions>($I`TrackDurationOptions`)(
  {
    attributes: S.Record(S.String, S.String).pipe(S.optionalKey).annotateKey({
      description: "Metric attributes attached to the duration measurement.",
    }),
  },
  $I.annote("TrackDurationOptions", {
    description: "Options for tracking one duration metric around an Effect.",
  })
) {}

/**
 * Constructor input accepted by {@link trackDuration} before schema defaults are resolved.
 *
 * @example
 * ```typescript
 * import type { TrackDurationOptionsInput } from "@beep/observability"
 *
 * const input: TrackDurationOptionsInput = { attributes: { op: "read" } }
 * console.log(input.attributes)
 * // { op: "read" }
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type TrackDurationOptionsInput = typeof TrackDurationOptions.Encoded;

interface ObserveWorkflowOptions {
  readonly attributes?: Record<string, string> | undefined;
  readonly completed?: Metric.Counter<number> | undefined;
  readonly duration?: Metric.Metric<Duration.Duration, unknown> | undefined;
  readonly failed?: Metric.Counter<number> | undefined;
  readonly interrupted?: Metric.Counter<number> | undefined;
  readonly name: string;
  readonly started?: Metric.Counter<number> | undefined;
}

interface ObserveHttpRequestOptions {
  readonly method: string;
  readonly requestDuration: Metric.Metric<Duration.Duration, unknown>;
  readonly requestsTotal: Metric.Counter<number>;
  readonly route: string;
  readonly successStatus: number;
}

const normalizeTrackDurationOptions = (options?: TrackDurationOptionsInput | undefined): TrackDurationOptions =>
  TrackDurationOptions.make(options ?? {});

const isTrackDurationDataFirst = (args: IArguments): boolean => Effect.isEffect(args[0]) || Effect.isEffect(args[1]);

const isEffectPairDataFirst = (args: IArguments): boolean => args.length >= 2 || Effect.isEffect(args[0]);

const withMetricAttributes = <Input, State>(
  metric: Metric.Metric<Input, State>,
  attributes: undefined | Record<string, string>
): Metric.Metric<Input, State> => (P.isUndefined(attributes) ? metric : Metric.withAttributes(metric, attributes));

const incrementCounter = Effect.fn("incrementCounter")(function* (
  counter: undefined | Metric.Counter<number>,
  attributes: undefined | Record<string, string>
): Effect.fn.Return<void> {
  return yield* P.isUndefined(counter) ? Effect.void : Metric.update(withMetricAttributes(counter, attributes), 1);
});

const phaseOutcomeFromExit = <A, E>(exit: Exit.Exit<A, E>): PhaseOutcome =>
  Match.value(exit).pipe(
    Match.when(Exit.isSuccess, () => PhaseOutcome.Enum.completed),
    Match.when(Exit.hasInterrupts, () => PhaseOutcome.Enum.interrupted),
    Match.orElse(PhaseOutcome.thunk.failed)
  );

const incrementOutcomeCounter = (outcome: PhaseOutcome, options: ObserveWorkflowOptions): Effect.Effect<void> =>
  PhaseOutcome.$match({
    completed: () => incrementCounter(options.completed, options.attributes),
    failed: () => incrementCounter(options.failed, options.attributes),
    interrupted: () => incrementCounter(options.interrupted, options.attributes),
  })(outcome);

/**
 * Normalize an HTTP status code to its class label (e.g. `"2xx"`, `"4xx"`).
 *
 * Returns `"unknown"` for status codes outside the 100-599 range.
 *
 * @example
 * ```typescript
 * import { statusClass } from "@beep/observability"
 *
 * console.log(statusClass(200)) // "2xx"
 * console.log(statusClass(404)) // "4xx"
 * console.log(statusClass(503)) // "5xx"
 * console.log(statusClass(999)) // "unknown"
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const statusClass = (status: number): string => {
  if (status >= 100 && status < 600) {
    return `${Math.trunc(status / 100)}xx`;
  }

  return "unknown";
};

/**
 * Measure wall-clock elapsed milliseconds for an effect.
 *
 * Returns a tuple of `[result, elapsedMs]` without altering the inner
 * effect's success or failure semantics.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import { measureElapsedMillis } from "@beep/observability"
 *
 * const program = measureElapsedMillis(
 *   Effect.succeed("ok")
 * ).pipe(
 *   Effect.map(([value, elapsedMs]) => ({ value, elapsedMs }))
 * )
 *
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @effects Reads the clock before and after the wrapped effect while preserving the wrapped effect's error and service channels.
 *
 * @since 0.0.0
 * @category observability
 */
export const measureElapsedMillis = Effect.fn("measureElapsedMillis")(function* <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.fn.Return<readonly [A, number], E, R> {
  return yield* pipe(
    Clock.currentTimeMillis,
    Effect.flatMap(
      Effect.fnUntraced(function* (startedAt) {
        return yield* effect.pipe(
          Effect.flatMap(
            Effect.fnUntraced(function* (value) {
              return yield* Clock.currentTimeMillis.pipe(
                Effect.map((endedAt) => [value, Math.max(0, endedAt - startedAt)] as const)
              );
            })
          )
        );
      })
    )
  );
});

/**
 * Track one timer metric around an effect.
 *
 * Records the wall-clock elapsed duration into the provided metric and
 * annotates the current span with `duration_ms`.
 *
 * @example
 * ```typescript
 * import { Effect, Metric } from "effect"
 * import { trackDuration } from "@beep/observability"
 *
 * const timer = Metric.timer("user_create_duration")
 *
 * const createUser = Effect.succeed({ id: "user__1", name: "Alice" })
 *
 * const tracked = trackDuration(timer, createUser, { attributes: { service: "iam" } })
 *
 * console.log(Effect.runPromise(tracked))
 * ```
 *
 * @since 0.0.0
 * @category observability
 */
const trackDurationImpl = Effect.fn("trackDurationImpl")(function* <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  metric: Metric.Metric<Duration.Duration, unknown>,
  options: TrackDurationOptions
): Effect.fn.Return<A, E, R> {
  const startedAt = yield* Clock.currentTimeMillis;
  const exit = yield* Effect.exit(effect);
  const endedAt = yield* Clock.currentTimeMillis;
  const elapsedMs = Math.max(0, endedAt - startedAt);

  yield* Metric.update(withMetricAttributes(metric, options.attributes), Duration.millis(elapsedMs));
  yield* Effect.annotateCurrentSpan("duration_ms", elapsedMs);

  return yield* Exit.match(exit, {
    onFailure: Effect.failCause,
    onSuccess: Effect.succeed,
  });
});

/**
 * Tracks the elapsed duration of an Effect with a metric.
 *
 * @example
 * ```typescript
 * import { Effect, Metric } from "effect"
 * import { trackDuration } from "@beep/observability"
 *
 * const timer = Metric.timer("task_duration")
 * const program = trackDuration(Effect.succeed("ok"), timer)
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @effects Updates the supplied metric and annotates the current span after the wrapped effect completes.
 *
 * @category observability
 * @since 0.0.0
 */
export const trackDuration: {
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    metric: Metric.Metric<Duration.Duration, unknown>,
    options: TrackDurationOptionsInput
  ): Effect.Effect<A, E, R>;
  <A, E, R>(effect: Effect.Effect<A, E, R>, metric: Metric.Metric<Duration.Duration, unknown>): Effect.Effect<A, E, R>;
  (
    metric: Metric.Metric<Duration.Duration, unknown>,
    options: TrackDurationOptionsInput
  ): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
  (
    metric: Metric.Metric<Duration.Duration, unknown>
  ): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
  <A, E, R>(
    metric: Metric.Metric<Duration.Duration, unknown>,
    effect: Effect.Effect<A, E, R>,
    options?: TrackDurationOptionsInput
  ): Effect.Effect<A, E, R>;
} = dual(
  isTrackDurationDataFirst,
  Effect.fn("trackDuration")(function* <A, E, R>(
    effect: Effect.Effect<A, E, R> | Metric.Metric<Duration.Duration, unknown>,
    metric: Metric.Metric<Duration.Duration, unknown> | Effect.Effect<A, E, R>,
    options?: TrackDurationOptionsInput | undefined
  ): Effect.fn.Return<A, E, R> {
    const normalizedOptions = normalizeTrackDurationOptions(options);

    if (Effect.isEffect(effect) && !Effect.isEffect(metric)) {
      return yield* trackDurationImpl(effect, metric, normalizedOptions);
    }

    if (Effect.isEffect(metric) && !Effect.isEffect(effect)) {
      return yield* trackDurationImpl(metric, effect, normalizedOptions);
    }

    return yield* Effect.die("Invalid trackDuration arguments");
  })
);

/**
 * Observe one workflow with start, terminal outcome, and duration metrics.
 *
 * Wraps an effect and records lifecycle counters (`started`, `completed`,
 * `failed`, `interrupted`) plus an optional duration metric. The current
 * span is annotated with `workflow_name`, `workflow_duration_ms`, and
 * `workflow_outcome`.
 *
 * @example
 * ```typescript
 * import { Effect, Metric } from "effect"
 * import { observeWorkflow } from "@beep/observability"
 *
 * const started = Metric.counter("workflow_started_total")
 * const completed = Metric.counter("workflow_completed_total")
 * const failed = Metric.counter("workflow_failed_total")
 * const duration = Metric.timer("workflow_duration")
 *
 * const myWorkflow = Effect.succeed("result")
 *
 * const observed = observeWorkflow()
 *
 * console.log(Effect.runPromise(observed))
 * ```
 *
 * @since 0.0.0
 * @category observability
 */
const observeWorkflowImpl = Effect.fn("observeWorkflowImpl")(function* <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options: ObserveWorkflowOptions
): Effect.fn.Return<A, E, R> {
  return yield* Clock.currentTimeMillis.pipe(
    Effect.flatMap(
      Effect.fnUntraced(function* (startedAt) {
        return yield* incrementCounter(options.started, options.attributes).pipe(
          Effect.andThen(Effect.annotateCurrentSpan("workflow_name", options.name)),
          Effect.andThen(effect),
          Effect.onExit(
            Effect.fnUntraced(function* (exit) {
              return yield* Clock.currentTimeMillis.pipe(
                Effect.flatMap(
                  Effect.fnUntraced(function* (endedAt) {
                    const durationMs = Math.max(0, endedAt - startedAt);
                    const outcome = phaseOutcomeFromExit(exit);
                    const outcomeEffect = incrementOutcomeCounter(outcome, options);
                    const durationEffect = P.isUndefined(options.duration)
                      ? Effect.void
                      : Metric.update(
                          withMetricAttributes(options.duration, options.attributes),
                          Duration.millis(durationMs)
                        );

                    return yield* Effect.annotateCurrentSpan({
                      workflow_duration_ms: durationMs,
                      workflow_outcome: outcome,
                    }).pipe(Effect.andThen(durationEffect), Effect.andThen(outcomeEffect));
                  })
                )
              );
            })
          )
        );
      })
    )
  );
});

/**
 * Observes workflow duration and outcome metrics for an Effect.
 *
 * @example
 * ```typescript
 * import { Effect, Metric } from "effect"
 * import { observeWorkflow } from "@beep/observability"
 *
 * const program = observeWorkflow(Effect.succeed("ok"), {
 *   completed: Metric.counter("workflow_completed_total"),
 *   name: "demo"
 * })
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @effects Updates workflow metrics and annotates the current span while preserving the wrapped effect's result.
 *
 * @category observability
 * @since 0.0.0
 */
export const observeWorkflow: {
  <A, E, R>(effect: Effect.Effect<A, E, R>, options: ObserveWorkflowOptions): Effect.Effect<A, E, R>;
  <A, E, R>(options: ObserveWorkflowOptions, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R>;
  (options: ObserveWorkflowOptions): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
} = dual(
  isEffectPairDataFirst,
  Effect.fn("observeWorkflow")(function* <A, E, R>(
    effect: Effect.Effect<A, E, R> | ObserveWorkflowOptions,
    options: ObserveWorkflowOptions | Effect.Effect<A, E, R> | undefined
  ): Effect.fn.Return<A, E, R> {
    if (Effect.isEffect(effect) && P.isNotUndefined(options) && !Effect.isEffect(options)) {
      return yield* observeWorkflowImpl(effect, options);
    }

    if (!Effect.isEffect(effect) && Effect.isEffect(options)) {
      return yield* observeWorkflowImpl(options, effect);
    }

    return yield* Effect.die("Invalid observeWorkflow arguments");
  })
);

/**
 * Observe one HTTP request with success and failure metrics.
 *
 * Wraps an effect whose error type carries a `status` field. Records
 * `requestsTotal` and `requestDuration` metrics with `method`, `route`,
 * and `status_class` attributes. The current span is annotated with
 * `http_status`, `http_status_class`, and `http_request_duration_ms`.
 *
 * @example
 * ```typescript
 * import { Effect, Metric } from "effect"
 * import { observeHttpRequest } from "@beep/observability"
 *
 * const requestsTotal = Metric.counter("http_requests_total")
 * const requestDuration = Metric.timer("http_request_duration")
 *
 * const handler = Effect.succeed({ id: 1, name: "Alice" })
 *
 * const observed = observeHttpRequest()
 *
 * console.log(Effect.runPromise(observed))
 * ```
 *
 * @since 0.0.0
 * @category observability
 */
const observeHttpRequestImpl = Effect.fn("observeHttpRequestImpl")(function* <
  A,
  E extends {
    readonly status: number;
  },
  R,
>(effect: Effect.Effect<A, E, R>, options: ObserveHttpRequestOptions): Effect.fn.Return<A, E, R> {
  return yield* Clock.currentTimeMillis.pipe(
    Effect.flatMap(
      Effect.fnUntraced(function* (startedAt) {
        return yield* effect.pipe(
          Effect.matchEffect({
            onFailure: Effect.fnUntraced(function* (error) {
              return yield* Clock.currentTimeMillis.pipe(
                Effect.flatMap(
                  Effect.fnUntraced(function* (endedAt) {
                    const durationMs = Math.max(0, endedAt - startedAt);
                    const attributes = {
                      method: options.method,
                      route: options.route,
                      status_class: statusClass(error.status),
                    };

                    return yield* Effect.annotateCurrentSpan({
                      http_status: error.status,
                      http_status_class: statusClass(error.status),
                      http_request_duration_ms: durationMs,
                    }).pipe(
                      Effect.andThen(Metric.update(Metric.withAttributes(options.requestsTotal, attributes), 1)),
                      Effect.andThen(
                        Metric.update(
                          Metric.withAttributes(options.requestDuration, attributes),
                          Duration.millis(durationMs)
                        )
                      ),
                      Effect.andThen(Effect.fail(error))
                    );
                  })
                )
              );
            }),
            onSuccess: Effect.fnUntraced(function* (value) {
              return yield* Clock.currentTimeMillis.pipe(
                Effect.flatMap(
                  Effect.fnUntraced(function* (endedAt) {
                    const durationMs = Math.max(0, endedAt - startedAt);
                    const attributes = {
                      method: options.method,
                      route: options.route,
                      status_class: statusClass(options.successStatus),
                    };

                    return yield* Effect.annotateCurrentSpan({
                      http_status: options.successStatus,
                      http_status_class: statusClass(options.successStatus),
                      http_request_duration_ms: durationMs,
                    }).pipe(
                      Effect.andThen(Metric.update(Metric.withAttributes(options.requestsTotal, attributes), 1)),
                      Effect.andThen(
                        Metric.update(
                          Metric.withAttributes(options.requestDuration, attributes),
                          Duration.millis(durationMs)
                        )
                      ),
                      Effect.as(value)
                    );
                  })
                )
              );
            }),
          })
        );
      })
    )
  );
});

/**
 * Observes HTTP request duration and status metrics for an Effect.
 *
 * @example
 * ```typescript
 * import { Effect, Metric } from "effect"
 * import { observeHttpRequest } from "@beep/observability"
 *
 * const program = observeHttpRequest(Effect.succeed("ok"), {
 *   method: "GET",
 *   requestDuration: Metric.timer("http_request_duration"),
 *   requestsTotal: Metric.counter("http_requests_total"),
 *   route: "/health",
 *   successStatus: 200
 * })
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @effects Updates HTTP request metrics and annotates the current span with request status and duration.
 *
 * @category observability
 * @since 0.0.0
 */
export const observeHttpRequest: {
  <
    A,
    E extends {
      readonly status: number;
    },
    R,
  >(
    effect: Effect.Effect<A, E, R>,
    options: ObserveHttpRequestOptions
  ): Effect.Effect<A, E, R>;
  <
    A,
    E extends {
      readonly status: number;
    },
    R,
  >(
    options: ObserveHttpRequestOptions,
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R>;
  (
    options: ObserveHttpRequestOptions
  ): <
    A,
    E extends {
      readonly status: number;
    },
    R,
  >(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>;
} = dual(
  isEffectPairDataFirst,
  Effect.fn("observeHttpRequest")(function* <
    A,
    E extends {
      readonly status: number;
    },
    R,
  >(
    effect: Effect.Effect<A, E, R> | ObserveHttpRequestOptions,
    options: ObserveHttpRequestOptions | Effect.Effect<A, E, R> | undefined
  ): Effect.fn.Return<A, E, R> {
    if (Effect.isEffect(effect) && P.isNotUndefined(options) && !Effect.isEffect(options)) {
      return yield* observeHttpRequestImpl(effect, options);
    }

    if (!Effect.isEffect(effect) && Effect.isEffect(options)) {
      return yield* observeHttpRequestImpl(options, effect);
    }

    return yield* Effect.die("Invalid observeHttpRequest arguments");
  })
);
