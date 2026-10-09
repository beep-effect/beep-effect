import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Random from "effect/Random";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";

/**
 * What GitHub's rate-limit headers said on the most recent REST response.
 *
 * @remarks
 * Every REST response carries `x-ratelimit-remaining`, `x-ratelimit-limit` and
 * `x-ratelimit-reset`; the client parses them into this and keeps the latest
 * one. Read it through the client's `rateLimit` member when you want to pace
 * yourself — **nothing in this package throttles on your behalf.**
 *
 * The cell lives inside the client layer that writes it, so there is nothing
 * extra to provide: reading it through the client is the only way.
 *
 * @public
 */
export class RateLimitSnapshot extends S.Class<RateLimitSnapshot>("RateLimitSnapshot")({
	/** Requests left in the current window. */
	remaining: S.Int,
	/** The window's ceiling. */
	limit: S.Int,
	/** When the window resets, as epoch **seconds** — GitHub's own unit. */
	resetEpochSeconds: S.Int,
}) {
	/** Milliseconds until the window resets, relative to `nowMillis`, floored at zero. */
	millisUntilReset(nowMillis: number): number {
		return Math.max(0, this.resetEpochSeconds * 1000 - nowMillis);
	}

	/** True when the budget is spent. */
	get isExhausted(): boolean {
		return this.remaining <= 0;
	}
}

/**
 * The shape {@link RetryPolicy} needs from a failure to decide anything.
 *
 * @remarks
 * Declared structurally so this module imports no error class. That keeps the
 * policy usable for both the REST and the GraphQL error without either of them
 * importing the other, and it makes every policy decision testable against a
 * two-field literal instead of a constructed error.
 *
 * @public
 */
export interface RetryableFailure {
	/** Whether retrying could plausibly succeed. */
	readonly retryable: boolean;
	/** A server-advised delay in milliseconds, when GitHub sent one. */
	readonly retryAfterMillis?: number | undefined;
}

/**
 * How the client retries a failed request.
 *
 * @remarks
 * There is exactly **one** retry policy in this package, and it is wired into
 * the client so every resource inherits it and no resource carries its own.
 *
 * Only failures that report `retryable` are retried, which for `GitHubError`
 * means a transport failure or a rate limit. A 404, a validation rejection and
 * an authorization failure fail on the first attempt.
 *
 * @example
 * ```ts
 * import { GitHubClient, RetryPolicy } from "./index.ts";
 * import { Duration, Redacted } from "effect";
 *
 * const layer = GitHubClient.layerFromToken({
 *   token: Redacted.make("ghp_example"),
 *   retry: RetryPolicy.make({ ...RetryPolicy.default, maxRetries: 2, maxDelay: Duration.seconds(10) }),
 * });
 * ```
 *
 * @public
 */
export class RetryPolicy extends S.Class<RetryPolicy>("RetryPolicy")({
	/** Retries after the first attempt. `0` disables retrying. */
	maxRetries: S.Int.check(S.isBetween({ minimum: 0, maximum: 10 })),
	/** The first backoff step; doubles per attempt. */
	baseDelay: S.DurationFromMillis,
	/** The computed backoff never exceeds this. */
	maxDelay: S.DurationFromMillis,
	/** Prefer GitHub's `retry-after` / rate-limit reset over the computed backoff. */
	respectRetryAfter: S.Boolean,
	/**
	 * Refuse to wait longer than this for a server-advised delay.
	 *
	 * @remarks
	 * A primary rate-limit window can be three quarters of an hour out. Sleeping
	 * through it converts a failure into a hang, so past this ceiling the error
	 * is re-failed immediately and the caller decides what to do.
	 */
	maxServerAdvisedDelay: S.DurationFromMillis,
}) {
	/** Four retries, 1s base, 30s cap, honoring server-advised delays up to a minute. */
	static readonly default: RetryPolicy = RetryPolicy.make({
		maxRetries: 4,
		baseDelay: Duration.seconds(1),
		maxDelay: Duration.seconds(30),
		respectRetryAfter: true,
		maxServerAdvisedDelay: Duration.seconds(60),
	});

	/** Retries nothing; every failure surfaces on the first attempt. */
	static readonly none: RetryPolicy = RetryPolicy.make({
		maxRetries: 0,
		baseDelay: Duration.zero,
		maxDelay: Duration.zero,
		respectRetryAfter: false,
		maxServerAdvisedDelay: Duration.zero,
	});

	/**
	 * Whether this policy would retry `failure` at all, ignoring attempt counts.
	 *
	 * @remarks
	 * Pure and total, so the classification is testable without a clock, a
	 * runtime or a schedule.
	 */
	retries(failure: RetryableFailure): boolean {
		if (this.maxRetries === 0 || !failure.retryable) return false;
		const advised = this.advisedMillis(failure);
		return advised === undefined || advised <= Duration.toMillis(this.maxServerAdvisedDelay);
	}

	/**
	 * The delay before the given attempt, for a failure and a `[0, 1)` draw.
	 *
	 * @remarks
	 * A server-advised delay wins outright when `respectRetryAfter`
	 * is set: GitHub knows when its window reopens and a computed backoff can only
	 * guess. Otherwise this is **full jitter** — a uniform draw from
	 * `[0, min(baseDelay * 2^(attempt-1), maxDelay)]` — which spreads a fleet of
	 * retrying callers rather than synchronizing them into a second herd.
	 *
	 * `random` is a parameter so the arithmetic is checkable without stubbing a
	 * generator.
	 */
	delayFor(failure: RetryableFailure, attempt: number, random: number): Duration.Duration {
		const advised = this.advisedMillis(failure);
		if (advised !== undefined) return Duration.millis(advised);
		const uncapped = Duration.toMillis(this.baseDelay) * 2 ** Math.max(0, attempt - 1);
		const capped = Math.min(uncapped, Duration.toMillis(this.maxDelay));
		return Duration.millis(Math.floor(capped * random));
	}

	/** The server-advised delay, when there is one and this policy honors it. */
	private advisedMillis(failure: RetryableFailure): number | undefined {
		return this.respectRetryAfter ? failure.retryAfterMillis : undefined;
	}

	/**
	 * The `Schedule` this policy compiles to, for `Effect.retry`.
	 *
	 * @remarks
	 * Built on `Schedule.modifyDelay`, whose callback receives the schedule's
	 * `Metadata` — including the **input that failed**. That is what makes a
	 * header-driven policy expressible as a `Schedule` at all: the delay is a
	 * function of the error, not only of the attempt number.
	 */
	schedule<E extends RetryableFailure>(): Schedule.Schedule<number, E> {
		return Schedule.forever.pipe(
			Schedule.modifyDelay(({ input, attempt }: Schedule.Metadata<number, E>) =>
				Effect.map(Random.next, (random) => this.delayFor(input, attempt, random)),
			),
			Schedule.while(
				({ input, attempt }: Schedule.Metadata<number, E>) => attempt <= this.maxRetries && this.retries(input),
			),
		);
	}
}
