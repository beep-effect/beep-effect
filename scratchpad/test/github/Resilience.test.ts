import { assert, describe, it } from "@effect/vitest";
import { Duration, Effect, Fiber, Ref } from "effect";
import { TestClock } from "effect/testing";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import type { RetryableFailure } from "../../effected/github/Resilience.ts";
import { RateLimitSnapshot, RetryPolicy } from "../../effected/github/Resilience.ts";

const failure = (options: { retryable: boolean; retryAfterMillis?: number }): RetryableFailure => ({
	retryable: options.retryable,
	...(options.retryAfterMillis !== undefined ? { retryAfterMillis: options.retryAfterMillis } : {}),
});

describe("RateLimitSnapshot", () => {
	it("computes the milliseconds left in the window", () => {
		const snapshot = RateLimitSnapshot.make({ remaining: 10, limit: 5000, resetEpochSeconds: 1_000 });
		assert.strictEqual(snapshot.millisUntilReset(900_000), 100_000);
	});

	it("floors a window that has already reset at zero", () => {
		const snapshot = RateLimitSnapshot.make({ remaining: 0, limit: 5000, resetEpochSeconds: 1_000 });
		assert.strictEqual(snapshot.millisUntilReset(2_000_000), 0);
	});

	it("reports exhaustion on a zero or negative remaining count", () => {
		assert.isTrue(RateLimitSnapshot.make({ remaining: 0, limit: 60, resetEpochSeconds: 1 }).isExhausted);
		assert.isFalse(RateLimitSnapshot.make({ remaining: 1, limit: 60, resetEpochSeconds: 1 }).isExhausted);
	});
});

describe("RetryPolicy.retries", () => {
	const policy = RetryPolicy.default;

	it("retries a retryable failure", () => {
		assert.isTrue(policy.retries(failure({ retryable: true })));
	});

	it("refuses a non-retryable failure", () => {
		assert.isFalse(policy.retries(failure({ retryable: false })));
	});

	it("refuses everything when maxRetries is zero", () => {
		assert.isFalse(RetryPolicy.none.retries(failure({ retryable: true })));
	});

	it("refuses a server-advised delay beyond the ceiling", () => {
		// A primary rate-limit window can be 45 minutes out. Sleeping through it
		// turns a failure into a hang, so the policy declines and the caller decides.
		assert.isFalse(policy.retries(failure({ retryable: true, retryAfterMillis: 45 * 60 * 1000 })));
	});

	it("accepts a server-advised delay at exactly the ceiling", () => {
		assert.isTrue(policy.retries(failure({ retryable: true, retryAfterMillis: 60_000 })));
	});

	it("ignores the ceiling when it does not honor advised delays", () => {
		const ignoring = RetryPolicy.make({ ...RetryPolicy.default, respectRetryAfter: false });
		assert.isTrue(ignoring.retries(failure({ retryable: true, retryAfterMillis: 45 * 60 * 1000 })));
	});
});

describe("RetryPolicy.delayFor", () => {
	const policy = RetryPolicy.default;

	it("uses the server-advised delay verbatim, ignoring jitter", () => {
		const delay = policy.delayFor(failure({ retryable: true, retryAfterMillis: 7_500 }), 3, 0.1);
		assert.strictEqual(Duration.toMillis(delay), 7_500);
	});

	it("draws full jitter from the exponential window", () => {
		// attempt 1 -> [0, 1000]; the draw scales it linearly.
		assert.strictEqual(Duration.toMillis(policy.delayFor(failure({ retryable: true }), 1, 1)), 1_000);
		assert.strictEqual(Duration.toMillis(policy.delayFor(failure({ retryable: true }), 1, 0.5)), 500);
		assert.strictEqual(Duration.toMillis(policy.delayFor(failure({ retryable: true }), 1, 0)), 0);
	});

	it("doubles the window per attempt", () => {
		const full = (attempt: number) => Duration.toMillis(policy.delayFor(failure({ retryable: true }), attempt, 1));
		assert.strictEqual(full(1), 1_000);
		assert.strictEqual(full(2), 2_000);
		assert.strictEqual(full(3), 4_000);
		assert.strictEqual(full(4), 8_000);
	});

	it("caps the window at maxDelay", () => {
		const full = (attempt: number) => Duration.toMillis(policy.delayFor(failure({ retryable: true }), attempt, 1));
		assert.strictEqual(full(6), 30_000);
		assert.strictEqual(full(10), 30_000);
	});

	it("ignores an advised delay when it does not honor them", () => {
		const ignoring = RetryPolicy.make({ ...RetryPolicy.default, respectRetryAfter: false });
		const delay = ignoring.delayFor(failure({ retryable: true, retryAfterMillis: 7_500 }), 1, 1);
		assert.strictEqual(Duration.toMillis(delay), 1_000);
	});
});

describe("RetryPolicy.schedule under Effect.retry", () => {
	/**
	 * Every case here pins `retryAfterMillis`, which makes the delay exact and
	 * removes the jitter draw from the test. The jitter arithmetic is covered
	 * above, purely.
	 */
	const policy = RetryPolicy.make({ ...RetryPolicy.default, maxRetries: 3 });
	const rateLimited = GitHubError.make({
		kind: "rateLimited",
		operation: "probe",
		reason: "slow down",
		retryAfterMillis: 1_000,
	});

	it.effect("retries a retryable failure up to maxRetries, then surfaces it", () =>
		Effect.gen(function* () {
			const attempts = yield* Ref.make(0);
			const fiber = yield* Effect.forkChild(
				Effect.flip(
					Ref.update(attempts, (n) => n + 1).pipe(
						Effect.andThen(Effect.fail(rateLimited)),
						Effect.retry(policy.schedule<GitHubError>()),
					),
				),
			);
			// Four attempts, three 1s sleeps between them.
			yield* TestClock.adjust(Duration.seconds(10));
			const error = yield* Fiber.join(fiber);
			assert.strictEqual(error.kind, "rateLimited");
			assert.strictEqual(yield* Ref.get(attempts), 4);
		}),
	);

	it.effect("does not retry a non-retryable failure at all", () =>
		Effect.gen(function* () {
			const attempts = yield* Ref.make(0);
			const error = yield* Effect.flip(
				Ref.update(attempts, (n) => n + 1).pipe(
					Effect.andThen(Effect.fail(GitHubError.notFound("probe", "thing"))),
					Effect.retry(policy.schedule<GitHubError>()),
				),
			);
			assert.strictEqual(error.kind, "notFound");
			assert.strictEqual(yield* Ref.get(attempts), 1);
		}),
	);

	it.effect("stops immediately when the advised delay exceeds the ceiling", () =>
		Effect.gen(function* () {
			const attempts = yield* Ref.make(0);
			const tooLong = GitHubError.make({
				kind: "rateLimited",
				operation: "probe",
				reason: "come back later",
				retryAfterMillis: 45 * 60 * 1000,
			});
			const error = yield* Effect.flip(
				Ref.update(attempts, (n) => n + 1).pipe(
					Effect.andThen(Effect.fail(tooLong)),
					Effect.retry(policy.schedule<GitHubError>()),
				),
			);
			assert.strictEqual(error.retryAfterMillis, 45 * 60 * 1000);
			assert.strictEqual(yield* Ref.get(attempts), 1);
		}),
	);

	it.effect("waits the server-advised delay, not the computed backoff", () =>
		Effect.gen(function* () {
			const attempts = yield* Ref.make(0);
			const fiber = yield* Effect.forkChild(
				Effect.flip(
					Ref.update(attempts, (n) => n + 1).pipe(
						Effect.andThen(Effect.fail(rateLimited)),
						Effect.retry(policy.schedule<GitHubError>()),
					),
				),
			);
			yield* TestClock.adjust(Duration.millis(999));
			assert.strictEqual(yield* Ref.get(attempts), 1, "must not retry before the advised delay elapses");
			yield* TestClock.adjust(Duration.millis(1));
			assert.strictEqual(yield* Ref.get(attempts), 2, "must retry as soon as it does");
			yield* TestClock.adjust(Duration.seconds(10));
			yield* Fiber.join(fiber);
		}),
	);

	it.effect("succeeds without sleeping when the first attempt works", () =>
		Effect.gen(function* () {
			const attempts = yield* Ref.make(0);
			const value = yield* Ref.update(attempts, (n) => n + 1).pipe(
				Effect.andThen(Effect.succeed("ok")),
				Effect.retry(policy.schedule<GitHubError>()),
			);
			assert.strictEqual(value, "ok");
			assert.strictEqual(yield* Ref.get(attempts), 1);
		}),
	);
});
