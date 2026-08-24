/**
 * Schema-backed retry and deadline policy for effectful service calls.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { PosInt, SchemaUtils } from "@beep/schema";
import type { Cause } from "effect";
import { Duration, Effect, Number as Num, Schedule } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CircuitOpenError } from "../Domain/Error/Circuit.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Retry");

const PositiveDuration = S.Duration.pipe(
  S.check(
    S.makeFilter(Duration.isGreaterThan(Duration.zero), {
      identifier: $I`PositiveRetryDurationCheck`,
      title: "Positive Retry Duration",
      description: "A finite retry duration greater than zero.",
      message: "Retry durations must be greater than zero.",
    })
  )
);

type RetryPolicyInvariantInput = {
  readonly attemptTimeout: Duration.Duration;
  readonly initialDelay: Duration.Duration;
  readonly maxAttempts: PosInt;
  readonly maxDelay: Duration.Duration;
  readonly overallTimeout: Duration.Duration;
};

const RetryPolicyInvariantCheck = S.makeFilter(
  (policy: RetryPolicyInvariantInput) => {
    if (!Duration.isGreaterThanOrEqualTo(policy.maxDelay, policy.initialDelay)) {
      return {
        path: ["maxDelay"],
        issue: "Maximum retry delay must be greater than or equal to the initial retry delay.",
      };
    }

    const retryCount = policy.maxAttempts - 1;
    const minimumOverallTimeout = Duration.sum(
      Duration.times(policy.attemptTimeout, policy.maxAttempts),
      Duration.times(policy.maxDelay, retryCount)
    );

    return Duration.isGreaterThanOrEqualTo(policy.overallTimeout, minimumOverallTimeout)
      ? undefined
      : {
          path: ["overallTimeout"],
          issue:
            "Overall timeout must accommodate every configured attempt plus the conservative maximum retry delays.",
        };
  },
  {
    identifier: $I`RetryPolicyInvariantCheck`,
    title: "Retry Policy Deadline Invariant",
    description: "Retry delays are ordered and the overall deadline can accommodate the complete attempt budget.",
    message: "Retry policy deadlines must accommodate every attempt and retry delay.",
  }
);

/**
 * Validated retry policy with per-attempt and overall deadlines.
 *
 * **Details**
 *
 * Construction rejects policies whose maximum delay is below the initial
 * delay or whose overall timeout cannot accommodate the complete attempt
 * budget. This prevents an outer deadline from silently making configured
 * retries impossible.
 *
 * **Example** (Create a retry policy)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { RetryPolicy } from "@effect-ontology/Service/Retry"
 *
 * const policy = RetryPolicy.make({
 *   attemptTimeout: Duration.seconds(20),
 *   overallTimeout: Duration.minutes(2),
 *   serviceName: "EntityExtractor"
 * })
 * console.log(policy.maxAttempts) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetryPolicy extends S.Class<RetryPolicy>($I`RetryPolicy`)(
  S.Struct({
    attemptTimeout: PositiveDuration.pipe(
      SchemaUtils.withKeyDefaults(Duration.seconds(60)),
      S.annotateKey({ description: "Maximum duration allowed for one attempt." })
    ),
    overallTimeout: PositiveDuration.pipe(
      SchemaUtils.withKeyDefaults(Duration.minutes(5)),
      S.annotateKey({ description: "Maximum duration allowed for all attempts and retry delays." })
    ),
    initialDelay: PositiveDuration.pipe(
      SchemaUtils.withKeyDefaults(Duration.seconds(1)),
      S.annotateKey({ description: "Delay before the first retry." })
    ),
    maxDelay: PositiveDuration.pipe(
      SchemaUtils.withKeyDefaults(Duration.seconds(30)),
      S.annotateKey({ description: "Upper bound applied to exponential retry delays." })
    ),
    maxAttempts: PosInt.pipe(
      SchemaUtils.withKeyDefaults(PosInt.make(3)),
      S.annotateKey({ description: "Maximum number of attempts, including the initial attempt." })
    ),
    serviceName: S.NonEmptyString.pipe(
      SchemaUtils.withKeyDefaults("LanguageModel"),
      S.annotateKey({ description: "Stable service name attached to retry diagnostics." })
    ),
    jitter: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(true),
      S.annotateKey({ description: "Whether retry delays receive random jitter to avoid synchronized retries." })
    ),
  }).pipe(S.check(RetryPolicyInvariantCheck)),
  $I.annote("RetryPolicy", {
    description: "Validated exponential-backoff policy with compatible attempt and overall deadlines.",
  })
) {
  static readonly decodeEffect = S.decodeEffect(RetryPolicy);
}

/**
 * Constructor input accepted by {@link RetryPolicy}.
 *
 * **Example** (Type a partial retry policy)
 *
 * ```ts
 * import { Duration } from "effect"
 * import type { RetryPolicyInput } from "@effect-ontology/Service/Retry"
 *
 * const input: RetryPolicyInput = { attemptTimeout: Duration.seconds(20) }
 * console.log(input.attemptTimeout)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RetryPolicyInput = Exclude<(typeof RetryPolicy)["~type.make.in"], void>;

const retryableNetworkCodes = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET", "EPIPE"];

const nonRetryableMessagePatterns = [
  "invalid api key",
  "unauthorized",
  "forbidden",
  "authentication failed",
  "request too large",
];

/**
 * Determines whether a failure represents a transient condition.
 *
 * **Details**
 *
 * Circuit-open, rate-limit, server, network, and timeout failures are retried.
 * Authentication, other client-status, and oversized-request failures stop
 * immediately. Unknown typed failures remain retryable so domain errors can
 * participate without being converted to native errors.
 *
 * **Example** (Classify an HTTP failure)
 *
 * ```ts
 * import { isRetryableError } from "@effect-ontology/Service/Retry"
 *
 * console.log(isRetryableError({ status: 503 })) // true
 * console.log(isRetryableError({ status: 401 })) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isRetryableError = (error: unknown): boolean => {
  if (CircuitOpenError.is(error)) {
    return true;
  }

  if (!P.isError(error)) {
    if (P.isObject(error) && "status" in error && P.isNumber(error.status)) {
      return error.status === 429 || (error.status >= 500 && error.status < 600);
    }
    return true;
  }

  const status = "status" in error && P.isNumber(error.status) ? error.status : undefined;
  if (P.isNumber(status)) {
    if (status === 429 || (status >= 500 && status < 600)) {
      return true;
    }
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  const code = "code" in error && P.isString(error.code) ? error.code : undefined;
  if (P.isString(code) && A.contains(retryableNetworkCodes, code)) {
    return true;
  }

  const message = P.isString(error.message) ? Str.toLowerCase(error.message) : "";
  return !A.some(nonRetryableMessagePatterns, (pattern) => Str.includes(pattern)(message));
};

/**
 * Creates the bounded `Effect.retry` options represented by a retry policy.
 *
 * **Example** (Build retry options)
 *
 * ```ts
 * import { makeRetryPolicy, RetryPolicy } from "@effect-ontology/Service/Retry"
 *
 * const options = makeRetryPolicy(RetryPolicy.make({ jitter: false }))
 * console.log(options.times) // 2
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeRetryPolicy = (policy: RetryPolicy) => {
  const uncappedSchedule = Schedule.exponential(policy.initialDelay).pipe(
    Schedule.modifyDelay(({ duration }) => Effect.succeed(Duration.min(duration, policy.maxDelay))),
    Schedule.tap(({ attempt }) => {
      const rawDelay = Duration.times(policy.initialDelay, 2 ** attempt);
      const nextDelay = Duration.min(rawDelay, policy.maxDelay);
      return Effect.logWarning("Service retry scheduled", {
        service: policy.serviceName,
        attempt: Num.increment(attempt),
        maxAttempts: policy.maxAttempts,
        nextDelay: Duration.format(nextDelay),
        delayCapped: Duration.isGreaterThan(rawDelay, policy.maxDelay),
      });
    })
  );
  const schedule = policy.jitter ? Schedule.jittered(uncappedSchedule) : uncappedSchedule;

  return {
    schedule,
    times: policy.maxAttempts - 1,
    while: isRetryableError,
  };
};

const retryEffectImpl = Effect.fn("Retry.retryEffect")(function* <A, E, R>(
  self: Effect.Effect<A, E, R>,
  policyInput: RetryPolicyInput
): Effect.fn.Return<A, E | Cause.TimeoutError | S.SchemaError, R> {
  const policy = yield* S.decodeEffect(RetryPolicy)(P.isUndefined(policyInput) ? {} : policyInput);
  return yield* self.pipe(
    Effect.timeout(policy.attemptTimeout),
    Effect.retry(makeRetryPolicy(policy)),
    Effect.timeout(policy.overallTimeout)
  );
});

/**
 * Runs an effect under one invariant-respecting attempt and overall deadline.
 *
 * **Details**
 *
 * The attempt timeout is applied inside `Effect.retry`; the overall timeout is
 * applied once outside the retry loop. Both data-first and data-last forms are
 * supported.
 *
 * **Example** (Apply a retry policy data-last)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { retryEffect } from "@effect-ontology/Service/Retry"
 *
 * const program = Effect.succeed("ok").pipe(retryEffect({ jitter: false }))
 * console.log(program)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const retryEffect = dual<
  (
    policy: RetryPolicyInput
  ) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E | Cause.TimeoutError | S.SchemaError, R>,
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    policy: RetryPolicyInput
  ) => Effect.Effect<A, E | Cause.TimeoutError | S.SchemaError, R>
>(2, retryEffectImpl);
