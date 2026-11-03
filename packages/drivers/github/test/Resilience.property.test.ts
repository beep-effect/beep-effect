import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { RateLimitSnapshot, RetryPolicy } from "@beep/github/Resilience";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name} preserves values and encoded output through encode/decode`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("Resilience schema property floor", () => {
  roundTrips("RateLimitSnapshot", RateLimitSnapshot);
  // DurationFromMillis has a millisecond wire representation. Compare every
  // policy field in those units, including nano-backed arbitrary durations.
  const policyStructure = (policy: RetryPolicy) => ({
    maxRetries: policy.maxRetries,
    baseDelay: Duration.toMillis(policy.baseDelay),
    maxDelay: Duration.toMillis(policy.maxDelay),
    respectRetryAfter: policy.respectRetryAfter,
    maxServerAdvisedDelay: Duration.toMillis(policy.maxServerAdvisedDelay),
  });
  it.effect.prop(
    "RetryPolicy preserves every policy field in its declared millisecond units",
    [
      Arbitrary.schema(RetryPolicy),
      Arbitrary.schema(S.Struct({ retryable: S.Boolean, retryAfterMillis: S.optionalKey(S.Int) })),
    ],
    ([value, failure]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(RetryPolicy)(value);
        const decoded = yield* S.decodeEffect(RetryPolicy)(encoded);
        assert.deepStrictEqual(policyStructure(decoded), policyStructure(value));
        const value2 = yield* S.encodeEffect(RetryPolicy)(decoded);
        assert.deepStrictEqual(value2, encoded);
        assert.strictEqual(decoded.retries(failure), value.retries(failure));
        assert.strictEqual(
          Duration.toMillis(decoded.delayFor(failure, 2, 0.5)),
          Duration.toMillis(value.delayFor(failure, 2, 0.5))
        );
      }),
    runs
  );
});
