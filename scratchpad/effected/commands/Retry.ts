import type * as Schedule from "effect/Schedule";
import * as Duration from "effect/Duration";
import * as PlatformError from "effect/PlatformError";
import * as Sched from "effect/Schedule";
import type { CommandFailedError } from "./Run.ts";

/**
 * Substrings that mark a failure as a transport hiccup rather than a verdict.
 *
 * **Details**
 *
 * Matched case-insensitively against captured stderr, captured stdout (npm and
 * friends route real errors there) and an absorbed spawn failure's message.
 * Exported so a caller extends the set through
 * {@link Retry.transient}'s `also` rather than forking the list.
 *
 * **Example** (Inspect a recognized network failure)
 *
 * ```ts
 * import { TRANSIENT_PATTERNS } from "@beep/scratchpad/effected/commands/Retry";
 * import * as A from "effect/Array";
 *
 * console.log(A.contains(TRANSIENT_PATTERNS, "ECONNRESET")) // true
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const TRANSIENT_PATTERNS: ReadonlyArray<string> = [
	"EAI_AGAIN",
	"ECONNABORTED",
	"ECONNREFUSED",
	"ECONNRESET",
	"EHOSTUNREACH",
	"ENETUNREACH",
	"ENOTFOUND",
	"EPIPE",
	"ETIMEDOUT",
	"fetch failed",
	"socket hang up",
];

/** Everything a classifier may read from one failure, lowercased once. */
const haystack = (error: CommandFailedError): string => {
	const parts = [error.stderr ?? "", error.stdout ?? ""];
	if (error.cause instanceof PlatformError.PlatformError) {
		parts.push(error.cause.message);
	}
	return parts.join("\n").toLowerCase();
};

/** Whether `error` matches any of `patterns`. */
const matches = (error: CommandFailedError, patterns: ReadonlyArray<string>): boolean => {
	const text = haystack(error);
	return patterns.some((pattern) => text.includes(pattern.toLowerCase()));
};

// Implementation of Retry.isTransient; the public contract lives on the static.
const isTransient = (error: CommandFailedError): boolean => {
	if (error.kind === "timeout") return false;
	if (error.kind === "spawn") return !error.notFound;
	return matches(error, TRANSIENT_PATTERNS);
};

// Implementation of Retry.transient; the public contract lives on the static.
const transient = (options?: {
	/** Retries after the first attempt. Defaults to 2 (three attempts total). */
	readonly times?: number | undefined;
	/** Extra patterns treated as transient, in addition to {@link TRANSIENT_PATTERNS}. */
	readonly also?: ReadonlyArray<string> | undefined;
}): {
	readonly while: (error: CommandFailedError) => boolean;
	readonly schedule: Schedule.Schedule<Duration.Duration>;
	readonly times: number;
} => {
	const extra = options?.also ?? [];
	return {
		while: (error: CommandFailedError) => isTransient(error) || (error.kind !== "timeout" && matches(error, extra)),
		schedule: Duration.millis(200).pipe(Sched.exponential, Sched.jittered),
		times: options?.times ?? 2,
	};
};

/**
 * Transience classification for command failures, and the retry policy built
 * on it.
 *
 * **Details**
 *
 * This is composable vocabulary rather than a retrying runner, because core's
 * `Effect.retry` already accepts `{ while, schedule, times }`.
 *
 * **Example** (Inspect the default retry budget)
 *
 * ```ts
 * import { Retry } from "@beep/scratchpad/effected/commands/Retry";
 *
 * console.log(Retry.transient().times) // 2
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class Retry {
	private constructor() {}

	/**
	 * Whether a failure looks like a transport hiccup worth retrying.
	 *
	 * **Details**
	 *
	 * Two classifications are structural rather than textual, and both matter more
	 * than the pattern list:
	 *
	 * - **A missing executable is never transient.** Retrying cannot install a
	 *   tool, so `kind: "spawn"` with {@link CommandFailedError.notFound} is
	 *   permanent however many attempts remain.
	 * - **A timeout is not transient by default.** A command that hangs
	 *   deterministically would burn its entire ceiling on every attempt; a caller
	 *   who knows better opts in via {@link Retry.transient}'s `while`.
	 *
	 * Any other spawn failure (a busy or momentarily locked binary) *is* treated as
	 * transient — that condition does clear.
	 *
	 * **Example** (Classify a reset connection)
	 *
	 * ```ts
	 * import { Retry } from "@beep/scratchpad/effected/commands/Retry";
	 * import { CommandFailedError } from "@beep/scratchpad/effected/commands/Run";
	 *
	 * const error = CommandFailedError.make({ command: "fetch", args: [], kind: "nonZero", stderr: "ECONNRESET" });
	 * console.log(Retry.isTransient(error)) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly isTransient = isTransient;

	/**
	 * A ready-made policy for `Effect.retry`: transient failures only, on a jittered
	 * exponential backoff, with a bounded attempt budget.
	 *
	 * **Details**
	 *
	 * This is vocabulary, not a runner — the caller keeps control of composition:
	 *
	 * A caller needing to repair state between attempts (resetting a working tree,
	 * say) composes `Effect.retryOrElse` or `Effect.tapError` itself; that reset is
	 * domain logic and does not belong in a retry policy.
	 *
	 * **Example** (Compose a bounded retry policy)
	 *
	 * ```ts
	 * import { Retry } from "@beep/scratchpad/effected/commands/Retry";
	 * import { CommandFailedError, Run } from "@beep/scratchpad/effected/commands/Run";
	 * import * as S from "effect/Schema";
	 * import * as Effect from "effect/Effect";
	 * import * as ChildProcess from "effect/process/ChildProcess";
	 *
	 * const command = ChildProcess.make("curl", ["https://example.com"]);
	 * const policy = Retry.transient();
	 * const program = Run.text(command).pipe(Effect.retry({
	 *   ...policy,
	 *   while: (error) => S.is(CommandFailedError)(error) && policy.while(error),
	 * }));
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly transient = transient;

	/**
	 * Substrings matched against a failure to classify it as transient. See {@link TRANSIENT_PATTERNS}.
	 *
	 * **Example** (Inspect the class network patterns)
	 *
	 * ```ts
	 * import { Retry } from "@beep/scratchpad/effected/commands/Retry";
	 * import * as A from "effect/Array";
	 *
	 * console.log(A.contains(Retry.TRANSIENT_PATTERNS, "EAI_AGAIN")) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly TRANSIENT_PATTERNS = TRANSIENT_PATTERNS;
}
