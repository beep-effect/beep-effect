import { PosInt } from "@beep/schema/Int";
import { assert, describe, it } from "@effect/vitest";
import { Cause, Duration, Effect, Fiber, Ref } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { StageTimeoutService, StageTimeoutServiceTest, TimeoutError } from "../../Service/LlmControl/StageTimeout.ts";
import { RetryPolicy, retryEffect } from "../../Service/Retry.ts";

class TransientFailure extends S.TaggedError<TransientFailure>()("TransientFailure", {}) {}

const retryPolicy = RetryPolicy.make({
  attemptTimeout: Duration.seconds(1),
  overallTimeout: Duration.seconds(5),
  initialDelay: Duration.seconds(1),
  maxDelay: Duration.seconds(1),
  maxAttempts: PosInt.make(3),
  serviceName: "RetryDeadlineTest",
  jitter: false,
});

const succeedOnThirdAttempt = (attempts: Ref.Ref<number>) =>
  Ref.updateAndGet(attempts, (attempt) => attempt + 1).pipe(
    Effect.filterOrFail(
      (attempt) => !(attempt < retryPolicy.maxAttempts),
      () => TransientFailure.make({})
    )
  );

describe("RetryPolicy", () => {
  it.effect(
    "retries the configured number of attempts in both dual forms",
    Effect.fnUntraced(function* () {
      const dataFirstAttempts = yield* Ref.make(0);
      const dataFirstFiber = yield* retryEffect(succeedOnThirdAttempt(dataFirstAttempts), retryPolicy).pipe(
        Effect.forkChild
      );
      yield* TestClock.adjust(Duration.seconds(2));

      assert.strictEqual(yield* Fiber.join(dataFirstFiber), 3);
      assert.strictEqual(yield* Ref.get(dataFirstAttempts), 3);

      const dataLastAttempts = yield* Ref.make(0);
      const dataLastFiber = yield* succeedOnThirdAttempt(dataLastAttempts).pipe(
        retryEffect(retryPolicy),
        Effect.forkChild
      );
      yield* TestClock.adjust(Duration.seconds(2));

      assert.strictEqual(yield* Fiber.join(dataLastFiber), 3);
      assert.strictEqual(yield* Ref.get(dataLastAttempts), 3);
    })
  );

  it.effect(
    "applies the attempt timeout inside the bounded retry loop",
    Effect.fnUntraced(function* () {
      const attempts = yield* Ref.make(0);
      const policy = RetryPolicy.make({
        attemptTimeout: Duration.seconds(1),
        overallTimeout: Duration.seconds(3),
        initialDelay: Duration.millis(500),
        maxDelay: Duration.millis(500),
        maxAttempts: PosInt.make(2),
        serviceName: "SlowRetryDeadlineTest",
        jitter: false,
      });
      const slowAttempt = Ref.update(attempts, (attempt) => attempt + 1).pipe(
        Effect.andThen(Effect.sleep(Duration.seconds(2))),
        Effect.as("too late")
      );
      const fiber = yield* slowAttempt.pipe(retryEffect(policy), Effect.flip, Effect.forkChild);

      yield* TestClock.adjust(Duration.seconds(3));

      const error = yield* Fiber.join(fiber);
      assert.isTrue(Cause.isTimeoutError(error));
      assert.strictEqual(yield* Ref.get(attempts), 2);
    })
  );

  it.effect(
    "returns a typed schema failure before executing an invalid policy",
    Effect.fnUntraced(function* () {
      const invalidPolicy = {
        attemptTimeout: Duration.seconds(2),
        overallTimeout: Duration.seconds(6),
        initialDelay: Duration.seconds(1),
        maxDelay: Duration.seconds(2),
        maxAttempts: PosInt.make(3),
      };
      const result = S.decodeResult(RetryPolicy)(invalidPolicy);
      const attempts = yield* Ref.make(0);
      const error = yield* Ref.update(attempts, (attempt) => attempt + 1).pipe(retryEffect(invalidPolicy), Effect.flip);

      assert.isTrue(Result.isFailure(result));
      assert.isTrue(S.isSchemaError(error));
      assert.strictEqual(yield* Ref.get(attempts), 0);
    })
  );
});

describe("StageTimeoutService", () => {
  it.layer(
    StageTimeoutServiceTest({
      chunking: {
        softTimeout: Duration.seconds(1),
        hardTimeout: Duration.seconds(2),
      },
    })
  )("with deterministic stage deadlines", (it) => {
    it.effect(
      "runs the soft warning before returning the typed hard timeout",
      Effect.fnUntraced(function* () {
        const timeouts = yield* StageTimeoutService;
        const softWarningObserved = yield* Ref.make(false);
        const fiber = yield* timeouts
          .withTimeout("chunking", Effect.never, () => Ref.set(softWarningObserved, true))
          .pipe(Effect.flip, Effect.forkChild);

        yield* TestClock.adjust(Duration.seconds(1));
        assert.isTrue(yield* Ref.get(softWarningObserved));

        yield* TestClock.adjust(Duration.seconds(1));
        const error = yield* Fiber.join(fiber);
        assert.isTrue(TimeoutError.is(error));
        assert.strictEqual(error.stage, "chunking");
      })
    );

    it.effect(
      "interrupts the soft-warning watcher when the stage completes",
      Effect.fnUntraced(function* () {
        const timeouts = yield* StageTimeoutService;
        const softWarningObserved = yield* Ref.make(false);
        const result = yield* timeouts.withTimeout("chunking", Effect.succeed("complete"), () =>
          Ref.set(softWarningObserved, true)
        );

        yield* TestClock.adjust(Duration.seconds(2));

        assert.strictEqual(result, "complete");
        assert.isFalse(yield* Ref.get(softWarningObserved));
        assert.isFalse(yield* timeouts.wouldTimeout("chunking", Duration.seconds(2)));
        assert.isTrue(yield* timeouts.wouldTimeout("chunking", Duration.millis(2001)));
      })
    );
  });
});
