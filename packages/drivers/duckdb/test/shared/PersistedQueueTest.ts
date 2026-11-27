/**
 * Vendored from Effect, tag effect@4.1.4, packages/effect/test/persistence/PersistedQueueTest.ts.
 * MIT License, Copyright (c) Effectful Technologies Inc. Adaptations carry // beep: markers.
 */
// beep: Effect helpers and persistent collections satisfy repository diagnostics.

import { assert } from "@effect/vitest";
import * as A from "effect/Array";
// beep: Effect public leaf imports replace upstream barrels.
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
// beep: Effect public leaf imports replace upstream barrels.
import * as PersistedQueue from "effect/persistence/PersistedQueue";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
// beep: Effect public leaf imports replace upstream barrels.
import * as TestClock from "effect/testing/TestClock";
import type { Vitest } from "@effect/vitest";

const Item = Schema.Struct({
  n: Schema.BigInt,
});

// beep: Share the offer-then-fail contract step to satisfy the duplication gate.
const failOnce = Effect.fnUntraced(function* (
  queue: PersistedQueue.PersistedQueue<{ readonly n: bigint }>,
  value: { readonly n: bigint },
  options?: Parameters<PersistedQueue.PersistedQueue<{ readonly n: bigint }>["offer"]>[1]
) {
  yield* queue.offer(value, options);
  const error = yield* queue.take(() => Effect.fail("boom")).pipe(Effect.flip);
  assert.strictEqual(error, "boom");
});

type SuiteOptions = {
  readonly timeout?: Duration.Input | undefined;
  readonly hookTimeout?: Duration.Input | undefined;
  readonly virtualTime?: boolean | undefined;
  readonly cleanupUsesClock?: boolean | undefined;
  readonly cleanup?: "supported" | "unsupported" | undefined;
};

const suiteWithImpl = <R, E>(
  name: string,
  layer: Layer.Layer<PersistedQueue.PersistedQueueStore, E, R>,
  testApi: Vitest.MethodsNonLive<R>,
  options?: SuiteOptions
) => {
  const timeout = options?.timeout ?? "30 seconds";
  const hookTimeout = options?.hookTimeout ?? timeout;
  const testOptions = { timeout: Duration.toMillis(timeout) };

  // beep: Explicit `=== true` checks satisfy strictBooleanExpressions on the optional flags.
  const virtualTime = options?.virtualTime === true;
  const liveSleep = (millis: number) => (virtualTime ? Effect.yieldNow : Effect.sleep(millis).pipe(TestClock.withLive));

  const assertNotDelivered = Effect.fnUntraced(function* <A, E>(fiber: Fiber.Fiber<A, E>, message?: string) {
    yield* TestClock.adjust(1000);
    yield* liveSleep(1000);
    assert.isUndefined(fiber.pollUnsafe(), message);
  });

  const awaitDelivery = Effect.fnUntraced(function* <A, E>(fiber: Fiber.Fiber<A, E>) {
    for (let i = 0; i < 8 && fiber.pollUnsafe() === undefined; i++) {
      yield* TestClock.adjust(1000);
      yield* liveSleep(700);
    }
    assert.isDefined(
      fiber.pollUnsafe(),
      "an SQL poll can miss a virtual-clock wakeup and acknowledgement retries sleep on it, so both clocks advanced"
    );
    return yield* Fiber.join(fiber);
  });

  // decision: small-virtual-clock-jumps
  const advancePastTtl = Effect.gen(function* () {
    yield* TestClock.adjust("2 seconds");
    yield* liveSleep(1500);
  });

  // beep: Share the successful-delivery and subsequent non-redelivery assertion.
  const takeOnce = Effect.fnUntraced(function* (
    queue: PersistedQueue.PersistedQueue<{ readonly n: bigint }>,
    expected: { readonly n: bigint },
    message?: string
  ) {
    const take1 = yield* queue.take(Effect.succeed);
    assert.deepStrictEqual(take1, expected, message);
    const fiber = yield* queue.take(Effect.succeed).pipe(Effect.forkScoped);
    yield* assertNotDelivered(fiber);
  });

  // beep: Share the delayed-delivery assertion to satisfy the duplication gate.
  const takeAfterDelay = Effect.fnUntraced(function* (
    queue: PersistedQueue.PersistedQueue<{ readonly n: bigint }>,
    expected: { readonly n: bigint },
    message?: string
  ) {
    const fiber = yield* queue.take(Effect.succeed).pipe(Effect.forkScoped);
    yield* assertNotDelivered(fiber, message);
    const delivered = yield* awaitDelivery(fiber);
    assert.deepStrictEqual(delivered, expected);
  });

  return testApi.layer(PersistedQueue.layer.pipe(Layer.provideMerge(layer)), {
    timeout: hookTimeout,
    concurrent: false,
  })(`PersistedQueue (${name}), serial over one shared TestClock`, (it) => {
    it.effect(
      "offer + take",
      () =>
        Effect.gen(function* () {
          const queue = yield* PersistedQueue.make({
            name: "test-queue-a",
            schema: Item,
          });

          yield* queue.offer({ n: 42n });
          yield* queue.take(
            Effect.fnUntraced(function* (value, metadata) {
              assert.strictEqual(value.n, 42n);
              assert.strictEqual(metadata.attempts, 1);
            })
          );
        }),
      testOptions
    );

    it.effect(
      "delivers lone surrogates without losing concurrent elements",
      () =>
        Effect.gen(function* () {
          const queue = yield* PersistedQueue.make({
            name: "test-queue-lone-surrogate-batch",
            schema: Schema.Struct({ s: Schema.String }),
          });
          const surrogate = Str.slice(0, 1)("😀");
          yield* queue.offer({ s: surrogate });
          yield* queue.offer({ s: "ok" });

          const fiber = yield* Effect.all([queue.take(Effect.succeed), queue.take(Effect.succeed)], {
            concurrency: 2,
          }).pipe(Effect.forkScoped);

          const values = yield* awaitDelivery(fiber);
          assert.deepStrictEqual(
            A.sort(
              A.map(values, ({ s }) => s),
              Order.String
            ),
            A.sort([surrogate, "ok"], Order.String)
          );
        }),
      testOptions
    );

    it.effect(
      "delivers elements with lone-surrogate custom ids",
      () =>
        Effect.gen(function* () {
          const queue = yield* PersistedQueue.make({
            name: "test-queue-lone-surrogate-custom-id",
            schema: Item,
          });
          yield* queue.offer({ n: 42n }, { id: Str.slice(0, 1)("😀") });

          const fiber = yield* queue.take(Effect.succeed).pipe(Effect.forkScoped);
          const delivered = yield* awaitDelivery(fiber);
          assert.deepStrictEqual(delivered, { n: 42n });
        }),
      testOptions
    );

    it.effect(
      "interrupt",
      () =>
        Effect.gen(function* () {
          const queue = yield* PersistedQueue.make({
            name: "test-queue-b",
            schema: Item,
          });

          yield* queue.offer({ n: 42n });

          const latch = Latch.makeUnsafe();
          const fiber = yield* queue
            .take(
              Effect.fnUntraced(function* (_value) {
                yield* latch.open;
                return yield* Effect.never;
              })
            )
            .pipe(Effect.forkScoped);

          const fiber2 = yield* queue.take((val) => Effect.succeed(val)).pipe(Effect.forkScoped);

          yield* latch.await;

          yield* assertNotDelivered(fiber2, "the second take waits while the element is being processed");

          yield* Fiber.interrupt(fiber);

          yield* TestClock.adjust(1000);

          assert.strictEqual((yield* Fiber.join(fiber2)).n, 42n);
        }),
      testOptions
    );

    it.effect(
      "delays retries with the retry schedule",
      () =>
        Effect.gen(function* () {
          const queue = yield* PersistedQueue.make({
            name: "test-queue-retry-schedule",
            schema: Item,
            retrySchedule: Schedule.spaced("2 seconds"),
          });

          // beep: Reuse the failure setup required by the duplication gate.
          yield* failOnce(queue, { n: 42n });

          const fiber = yield* queue.take((_val, { attempts }) => Effect.succeed(attempts)).pipe(Effect.forkScoped);

          yield* TestClock.adjust(100);
          yield* liveSleep(100);
          assert.isUndefined(fiber.pollUnsafe(), "not redelivered before the retry delay elapses");

          const attempts = yield* awaitDelivery(fiber);
          assert.strictEqual(attempts, 2);
        }),
      testOptions
    );

    it.effect(
      "delays first delivery with the offer delay",
      () =>
        Effect.gen(function* () {
          const queue = yield* PersistedQueue.make({
            name: "test-queue-offer-delay",
            schema: Item,
          });

          yield* queue.offer({ n: 42n }, { delay: "3 seconds" });

          const fiber = yield* queue
            .take((value, { attempts }) => Effect.succeed({ value, attempts }))
            .pipe(Effect.forkScoped);

          yield* assertNotDelivered(
            fiber,
            "SQL stores round to whole seconds; the 3 second delay stays clear of this one-second check"
          );

          const delivered = yield* awaitDelivery(fiber);
          assert.deepStrictEqual(
            delivered,
            { value: { n: 42n }, attempts: 1 },
            "the delay does not consume an attempt"
          );
        }),
      testOptions
    );

    it.effect(
      "delivers zero and negative offer delays immediately",
      () =>
        Effect.gen(function* () {
          const queue = yield* PersistedQueue.make({
            name: "test-queue-offer-delay-immediate",
            schema: Item,
          });

          yield* queue.offer({ n: 1n }, { delay: 0 });
          yield* queue.offer({ n: 2n }, { delay: Duration.seconds(-5) });

          const first = yield* queue.take(Effect.succeed);
          const second = yield* queue.take(Effect.succeed);
          assert.deepStrictEqual([first.n, second.n].sort(), [1n, 2n]);
        }),
      testOptions
    );

    it.effect(
      "an infinite offer delay writes nothing",
      () =>
        Effect.gen(function* () {
          const queue = yield* PersistedQueue.make({
            name: "test-queue-offer-delay-infinite",
            schema: Item,
          });

          const id = yield* queue.offer({ n: 1n }, { id: "infinite-delay-id", delay: Duration.infinity });
          assert.strictEqual(id, "infinite-delay-id");
          const generatedId = yield* queue.offer({ n: 2n }, { delay: Duration.infinity });
          assert.isNotEmpty(generatedId);

          yield* queue.offer({ n: 3n }, { id: "infinite-delay-id" });
          // beep: Reuse the delivery/non-redelivery assertion.
          yield* takeOnce(queue, { n: 3n }, "no dedupe record was written, so the id could be offered again");
        }),
      testOptions
    );

    it.effect(
      "ignores the delay of a duplicate offer",
      () =>
        Effect.gen(function* () {
          const queue = yield* PersistedQueue.make({
            name: "test-queue-offer-delay-duplicate",
            schema: Item,
          });

          yield* queue.offer({ n: 1n }, { id: "delayed-duplicate-id", delay: "3 seconds" });
          yield* queue.offer({ n: 2n }, { id: "delayed-duplicate-id" });

          // beep: Reuse the delayed-delivery assertion.
          yield* takeAfterDelay(queue, { n: 1n }, "the undelayed duplicate does not make the element available early");

          const fiber2 = yield* queue.take(Effect.succeed).pipe(Effect.forkScoped);
          yield* assertNotDelivered(fiber2);
        }),
      testOptions
    );

    it.effect(
      "settling a custom id does not release the same id in another queue",
      () =>
        Effect.gen(function* () {
          const emails = yield* PersistedQueue.make({ name: "isolated-emails", schema: Item });
          const invoices = yield* PersistedQueue.make({ name: "isolated-invoices", schema: Item });
          yield* emails.offer({ n: 1n }, { id: "order-1" });
          yield* invoices.offer({ n: 2n }, { id: "order-1" });

          const taken = Latch.makeUnsafe();
          let invoice: typeof Item.Type | undefined;
          yield* invoices
            .take((value) => {
              invoice = value;
              return Effect.andThen(taken.open, Effect.never);
            })
            .pipe(Effect.forkScoped);
          yield* taken.await;
          assert.deepStrictEqual(
            invoice,
            { n: 2n },
            "each queue deduplicates its own ids, so the invoice is delivered"
          );

          yield* emails.take(Effect.succeed);
          const duplicate = yield* invoices.take(Effect.succeed).pipe(Effect.forkScoped);
          yield* assertNotDelivered(duplicate);
        }),
      testOptions
    );

    it.effect(
      "does not redeliver in-flight elements",
      () =>
        Effect.gen(function* () {
          const queue = yield* PersistedQueue.make({
            name: "test-queue-reset",
            schema: Item,
          });

          yield* queue.offer({ n: 42n });

          const taken = Latch.makeUnsafe();
          const release = Latch.makeUnsafe();
          const fiber = yield* queue.take(() => Effect.andThen(taken.open, release.await)).pipe(Effect.forkScoped);
          yield* taken.await;

          const fiber2 = yield* queue.take((val) => Effect.succeed(val)).pipe(Effect.forkScoped);

          yield* assertNotDelivered(
            fiber2,
            "allow any periodic store reset to run while the element is still being processed"
          );

          yield* release.open;
          yield* Fiber.join(fiber);
          yield* assertNotDelivered(fiber2, "after a successful take the element is not delivered again");

          yield* Fiber.interrupt(fiber2);
        }),
      testOptions
    );

    it.effect(
      "dead-letters elements that fail to decode",
      () =>
        Effect.gen(function* () {
          const store = yield* PersistedQueue.PersistedQueueStore;
          const queue = yield* PersistedQueue.make({
            name: "test-queue-decode-failure",
            schema: Item,
            retrySchedule: Schedule.spaced(0),
          });

          yield* store.offer({
            name: "test-queue-decode-failure",
            id: "poison",
            element: { n: null },
            isCustomId: true,
          });
          yield* queue.offer({ n: 42n });

          // beep: Assert poison skipping and non-redelivery through the shared contract step.
          yield* takeOnce(queue, { n: 42n });
        }),
      testOptions
    );

    if (options?.cleanup === "unsupported") {
      it.effect(
        "cleanup explicitly fails as unsupported",
        () =>
          Effect.gen(function* () {
            const store = yield* PersistedQueue.PersistedQueueStore;
            for (const failedTimeToLive of [undefined, Duration.seconds(1)]) {
              const error = yield* store
                .cleanup({
                  timeToLive: Duration.seconds(1),
                  failedTimeToLive,
                })
                .pipe(Effect.flip);
              assert.instanceOf(error, PersistedQueue.PersistedQueueError);
              assert.match(error.message, /unsupported|not supported/i);
            }
          }),
        testOptions
      );
    } else {
      it.effect(
        "cleanup removes expired completed elements",
        () =>
          Effect.gen(function* () {
            const store = yield* PersistedQueue.PersistedQueueStore;
            const queue = yield* PersistedQueue.make({
              name: "test-queue-cleanup",
              schema: Item,
            });

            yield* queue.offer({ n: 1n }, { id: "cleanup-id" });
            yield* queue.take(Effect.succeed);

            yield* store.cleanup({ timeToLive: Duration.days(30), failedTimeToLive: undefined });
            yield* queue.offer({ n: 2n }, { id: "cleanup-id" });
            const fiber = yield* queue.take(Effect.succeed).pipe(Effect.forkScoped);
            yield* assertNotDelivered(fiber, "within the ttl the dedupe entry survives, so the re-offer is ignored");

            yield* advancePastTtl;
            yield* store.cleanup({ timeToLive: Duration.seconds(1), failedTimeToLive: undefined });
            yield* queue.offer({ n: 3n }, { id: "cleanup-id" });
            const delivered = yield* awaitDelivery(fiber);
            assert.deepStrictEqual(
              delivered,
              { n: 3n },
              "after the ttl the completed element and its dedupe entry are gone"
            );
          }),
        testOptions
      );

      it.effect(
        "cleanup removes failed elements only with failedTimeToLive",
        () =>
          Effect.gen(function* () {
            const store = yield* PersistedQueue.PersistedQueueStore;
            const queue = yield* PersistedQueue.make({
              name: "test-queue-cleanup-failed",
              schema: Item,
              maxAttempts: 1,
              retrySchedule: Schedule.spaced(0),
            });

            // beep: Reuse the failure setup required by the duplication gate.
            yield* failOnce(queue, { n: 1n }, { id: "failed-cleanup-id" });

            yield* advancePastTtl;
            yield* store.cleanup({ timeToLive: Duration.seconds(1), failedTimeToLive: undefined });
            yield* queue.offer({ n: 2n }, { id: "failed-cleanup-id" });
            const fiber = yield* queue.take(Effect.succeed).pipe(Effect.forkScoped);
            yield* assertNotDelivered(
              fiber,
              "without failedTimeToLive the failed element is the kept dead-letter record, so its id stays deduplicated"
            );

            yield* store.cleanup({ timeToLive: Duration.days(30), failedTimeToLive: Duration.seconds(1) });
            yield* queue.offer({ n: 3n }, { id: "failed-cleanup-id" });
            const delivered = yield* awaitDelivery(fiber);
            assert.deepStrictEqual(
              delivered,
              { n: 3n },
              "with failedTimeToLive the failed element and its dedupe entry are gone"
            );
          }),
        testOptions
      );

      it.effect(
        "cleanup keeps dedupe entries for unprocessed elements",
        () =>
          Effect.gen(function* () {
            const store = yield* PersistedQueue.PersistedQueueStore;
            const queue = yield* PersistedQueue.make({
              name: "test-queue-cleanup-pending",
              schema: Item,
            });

            yield* queue.offer({ n: 1n }, { id: "pending-cleanup-id" });

            yield* advancePastTtl;
            yield* store.cleanup({ timeToLive: Duration.seconds(1), failedTimeToLive: undefined });
            yield* queue.offer({ n: 2n }, { id: "pending-cleanup-id" });

            // beep: Reuse the delivery/non-redelivery assertion after pending cleanup.
            yield* takeOnce(
              queue,
              { n: 1n },
              "an unprocessed element past the ttl keeps its dedupe entry, so the re-offer adds no duplicate"
            );
          }),
        testOptions
      );

      it.effect(
        "cleanup retains failed lone surrogates until the failed TTL releases their custom ids",
        () =>
          Effect.gen(function* () {
            const store = yield* PersistedQueue.PersistedQueueStore;
            const queue = yield* PersistedQueue.make({
              name: "test-queue-lone-surrogate-failed-id",
              schema: Schema.Struct({ s: Schema.String }),
              maxAttempts: 1,
            });
            const id = "lone-surrogate-failed-custom-id";
            yield* queue.offer({ s: Str.slice(0, 1)("😀") }, { id });
            const failed = yield* queue.take(() => Effect.fail("boom")).pipe(Effect.flip, Effect.forkScoped);
            const failure = yield* awaitDelivery(failed);
            assert.strictEqual(failure, "boom");

            yield* store.cleanup({ timeToLive: Duration.seconds(1), failedTimeToLive: Duration.days(30) });
            yield* queue.offer({ s: "duplicate" }, { id });
            const fiber = yield* queue.take(Effect.succeed).pipe(Effect.forkScoped);
            yield* assertNotDelivered(fiber, "an unexpired dead letter keeps its custom id deduplicated");

            yield* advancePastTtl;
            yield* store.cleanup({ timeToLive: Duration.days(30), failedTimeToLive: Duration.seconds(1) });
            yield* queue.offer({ s: "reoffered" }, { id });
            const delivered = yield* awaitDelivery(fiber);
            assert.deepStrictEqual(
              delivered,
              { s: "reoffered" },
              "expiring the dead letter releases the id even with an opaque surrogate payload"
            );
          }),
        testOptions
      );
    }

    it.effect(
      "untilExecuted coalesces an id until its element completes",
      () =>
        Effect.gen(function* () {
          const queue = yield* PersistedQueue.make({
            name: "test-queue-until-executed-completed",
            schema: Item,
          });
          const id = "until-executed-completed-id";
          const offerOptions = { id, deduplicate: "untilExecuted" } as const;

          yield* queue.offer({ n: 1n }, offerOptions);
          yield* queue.offer({ n: 2n }, offerOptions);
          const taken = Latch.makeUnsafe();
          const release = Latch.makeUnsafe();
          const first = yield* queue
            .take((value) => Effect.as(Effect.andThen(taken.open, release.await), value))
            .pipe(Effect.forkScoped);
          yield* taken.await;
          yield* queue.offer({ n: 3n }, offerOptions);
          yield* release.open;
          const firstValue = yield* Fiber.join(first);
          assert.deepStrictEqual(firstValue, { n: 1n });
          const next = yield* queue.take(Effect.succeed).pipe(Effect.forkScoped);
          yield* assertNotDelivered(next, "offers were coalesced while the element was pending and processing");

          yield* queue.offer({ n: 4n });
          yield* queue.offer({ n: 5n }, offerOptions);
          const nextValue = yield* awaitDelivery(next);
          assert.deepStrictEqual(
            nextValue,
            { n: 4n },
            "once completed the id is released, and the re-offer queues behind earlier work"
          );
          const reoffered = yield* queue.take(Effect.succeed).pipe(Effect.forkScoped);
          const reofferedValue = yield* awaitDelivery(reoffered);
          assert.deepStrictEqual(reofferedValue, { n: 5n });
        }),
      testOptions
    );

    it.effect(
      "untilExecuted releases the id of a failed element",
      () =>
        Effect.gen(function* () {
          const queue = yield* PersistedQueue.make({
            name: "test-queue-until-executed-failed",
            schema: Item,
            maxAttempts: 1,
          });
          const id = "until-executed-failed-id";
          const offerOptions = { id, deduplicate: "untilExecuted" } as const;

          // beep: Reuse the failure setup required by the duplication gate.
          yield* failOnce(queue, { n: 1n }, offerOptions);

          yield* queue.offer({ n: 2n }, { ...offerOptions, delay: "3 seconds" });
          // beep: Reuse the delayed-delivery assertion.
          yield* takeAfterDelay(queue, { n: 2n }, "the re-offer is new work and honours its own delay");
        }),
      testOptions
    );

    if (options?.cleanup !== "unsupported") {
      it.effect(
        "untilExecuted keeps an id reserved when cleanup expires an earlier failure",
        () =>
          Effect.gen(function* () {
            const store = yield* PersistedQueue.PersistedQueueStore;
            const queue = yield* PersistedQueue.make({
              name: "test-queue-until-executed-cleanup",
              schema: Item,
              maxAttempts: 1,
            });
            const id = "until-executed-cleanup-id";
            const offerOptions = { id, deduplicate: "untilExecuted" } as const;
            const fail = queue.take(() => Effect.fail("boom")).pipe(Effect.flip);
            const cleanupFailed = store.cleanup({
              timeToLive: Duration.days(30),
              failedTimeToLive: Duration.seconds(1),
            });

            yield* queue.offer({ n: 1n }, offerOptions);
            yield* fail;

            const cleanupTtlIsDeterministic = (options?.cleanupUsesClock ?? virtualTime) === true;
            if (cleanupTtlIsDeterministic) {
              yield* advancePastTtl;
              yield* queue.offer({ n: 2n }, offerOptions);
              yield* fail;
              yield* cleanupFailed;

              yield* queue.offer({ n: 9n }, { id });
            }

            yield* queue.offer({ n: 3n }, offerOptions);
            yield* advancePastTtl;
            yield* cleanupFailed;
            yield* queue.offer({ n: 4n }, offerOptions);

            // beep: Reuse the delivery/non-redelivery assertion.
            yield* takeOnce(
              queue,
              { n: 3n },
              "expiring failures keeps the pending replacement; retained failures reserve default ids; only injected cleanup clocks can retain the second failure reliably because SQL clocks can cross its one-second TTL before cleanup"
            );
          }),
        testOptions
      );
    }

    it.effect(
      "processes concurrent elements exactly once with retries",
      () =>
        Effect.gen(function* () {
          const queue = yield* PersistedQueue.make({
            name: "test-queue-soak",
            schema: Item,
            retrySchedule: Schedule.spaced(0),
          });

          const total = 24;
          let deliveries = HashMap.empty<bigint, number>();
          let succeeded = HashSet.empty<bigint>();
          const completed = Latch.makeUnsafe();

          yield* Effect.forEach(
            Array.from({ length: total }, (_, i) => BigInt(i)),
            (n) => queue.offer({ n }),
            { concurrency: 8, discard: true }
          );

          const worker = queue
            .take(({ n }) =>
              Effect.suspend(() => {
                const count = O.getOrElse(HashMap.get(deliveries, n), () => 0) + 1;
                deliveries = HashMap.set(deliveries, n, count);
                const failsFirstDelivery = n % 3n === 0n && count === 1;
                if (failsFirstDelivery) {
                  return Effect.fail("transient");
                }
                succeeded = HashSet.add(succeeded, n);
                if (HashSet.size(succeeded) === total) {
                  completed.openUnsafe();
                }
                return Effect.void;
              })
            )
            .pipe(Effect.ignore, Effect.forever);

          yield* Effect.forkScoped(worker);
          yield* Effect.forkScoped(worker);
          yield* Effect.forkScoped(worker);

          while (!completed.isOpen()) {
            yield* TestClock.adjust(1000);
            yield* liveSleep(250);
          }

          assert.strictEqual(HashSet.size(succeeded), total);
          for (const [n, count] of deliveries) {
            assert.strictEqual(count, n % 3n === 0n ? 2 : 1, `deliveries for element ${n}`);
          }
        }),
      testOptions
    );
  });
};

// beep: Dual signatures keep upstream suite registration compliant with repository diagnostics.
export const suiteWith: {
  <R, E>(
    layer: Layer.Layer<PersistedQueue.PersistedQueueStore, E, R>,
    testApi: Vitest.MethodsNonLive<R>,
    options?: SuiteOptions
  ): (name: string) => void;
  <R, E>(
    name: string,
    layer: Layer.Layer<PersistedQueue.PersistedQueueStore, E, R>,
    testApi: Vitest.MethodsNonLive<R>,
    options?: SuiteOptions
  ): void;
} = dual((args) => P.isString(args[0]), suiteWithImpl);
// beep: The upstream `suite` wrapper is dropped: nothing registers through it (dead-code gate).
