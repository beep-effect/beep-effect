import { $ScratchpadId } from "@beep/identity/packages";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { headerNumber, headerString, retryAfterMillisFrom } from "./internal/headers.ts";

const $I = $ScratchpadId.create("effected/github/GitHubError");

/**
 * Why a GitHub call failed, as a value you can branch on.
 *
 * @remarks
 * Branch on this discriminant instead of string-matching an error message:
 * `alreadyExists` tells "someone else created it" apart from "that failed", so
 * an upsert needs no follow-up existence check.
 *
 * @public
 */
export const GitHubErrorKind = S.Literals([
	/** The resource is not there (404). Often not an error at all — see the `*Option` reads. */
	"notFound",
	/** The resource already exists (422/409 saying so). What makes `upsert` implementable. */
	"alreadyExists",
	/** GitHub understood and refused: validation, policy, conflict. */
	"rejected",
	/** Credentials are missing, wrong, or lack the required scope. */
	"unauthorized",
	/** A rate limit — primary or secondary. Retryable, usually with a server-advised delay. */
	"rateLimited",
	/** The request never got a usable answer: 5xx, a network failure, an abort. Retryable. */
	"transport",
	/** A response arrived but did not match the schema it was decoded against. */
	"decode",
]).pipe($I.annoteSchema("GitHubErrorKind", { description: "Why a GitHub call failed, as a value you can branch on." }));

/**
 * The validation codes GitHub documents for a 422's `errors[].code`.
 *
 * @remarks
 * The complete documented set. Only `already_exists` earns its own
 * {@link GitHubErrorKind}; every other code classifies as `rejected`, and a
 * caller that needs to tell them apart reads {@link GitHubError}'s `validation`
 * or uses {@link GitHubError.hasValidationCode}.
 *
 * `missing` is the one that looks like `notFound` and is not: it names a
 * resource the request *referred to* — a commit sha, an assignee — not the one
 * it acted on. Routing it to `notFound` would let every
 * `catchIf(GitHubError.hasKind("notFound"), …)` recovery swallow a bad argument.
 *
 * @public
 */
export const GitHubValidationCode = S.Literals([
	/** A resource the request referred to does not exist. */
	"missing",
	/** A required parameter was not sent. */
	"missing_field",
	/** A parameter is badly formatted. */
	"invalid",
	/** Another resource already has this value. Classifies as `alreadyExists`. */
	"already_exists",
	/** The parameters were invalid. */
	"unprocessable",
	/** No fixed meaning: read the entry's `message`. */
	"custom",
]).pipe($I.annoteSchema("GitHubValidationCode", { description: "The validation codes GitHub documents for a 422's `errors[].code`." }));

/**
 * One entry from a failed response's `data.errors` array, as GitHub sent it.
 *
 * @remarks
 * Every field is optional because GitHub's entries vary by endpoint: the
 * releases endpoint sends `resource`, `code` and `field` with no `message`,
 * while a `custom` entry may carry only a `message`. `code` is a plain string
 * rather than {@link GitHubValidationCode} so an unexpected code cannot make
 * the error itself fail to construct: a refused request must still surface as
 * a `GitHubError`, never as a defect.
 *
 * @public
 */
export class GitHubValidationEntry extends S.Class<GitHubValidationEntry>($I`GitHubValidationEntry`)({
	/** The resource type GitHub validated, e.g. `"Release"`. */
	resource: S.optionalKey(S.String).annotateKey({ description: "The resource type GitHub validated, e.g. `\"Release\"`." }),
	/** The parameter at fault, e.g. `"tag_name"`. */
	field: S.optionalKey(S.String).annotateKey({ description: "The parameter at fault, e.g. `\"tag_name\"`." }),
	/** GitHub's validation code — one of {@link GitHubValidationCode} when documented. */
	code: S.optionalKey(S.String).annotateKey({ description: "GitHub's validation code — one of GitHubValidationCode when documented." }),
	/** GitHub's prose, when it sent any. */
	message: S.optionalKey(S.String).annotateKey({ description: "GitHub's prose, when it sent any." }),
}, $I.annote("GitHubValidationEntry", { description: "One entry from a failed response's `data.errors` array, as GitHub sent it." })) {}

/**
 * Every REST failure this package produces, from every resource.
 *
 * @remarks
 * One error class, not one per resource: {@link GitHubErrorKind} routes and
 * `operation` identifies what was attempted. This mirrors `@effected/git`,
 * where classification happens once so no consumer string-matches stderr.
 *
 * @public
 */
export class GitHubError extends S.TaggedError<GitHubError>($I`GitHubError`)("GitHubError", {
	/** Structural routing. Branch on this, never on the rendered message. */
	kind: GitHubErrorKind.annotateKey({ description: "Structural routing. Branch on this, never on the rendered message." }),
	/** What was attempted: a resource method (`"GitBranch.upsert"`) or a raw route. */
	operation: S.String.annotateKey({ description: "What was attempted: a resource method (`\"GitBranch.upsert\"`) or a raw route." }),
	/** Human-readable cause, for logs and messages. Never a routing surface. */
	reason: S.String.annotateKey({ description: "Human-readable cause, for logs and messages. Never a routing surface." }),
	/** GitHub's HTTP status, when the request reached GitHub at all. */
	status: S.optionalKey(S.Int).annotateKey({ description: "GitHub's HTTP status, when the request reached GitHub at all." }),
	/**
	 * A server-advised delay before retrying, in milliseconds.
	 *
	 * @remarks
	 * Written by the client from `retry-after` or the rate-limit reset, and read
	 * by exactly one thing: the retry `Schedule`. It is a policy input, not
	 * information for a caller. Whether a failure is worth retrying at all is the
	 * derived `retryable` getter.
	 */
	retryAfterMillis: S.optionalKey(S.Int).annotateKey({ description: "A server-advised delay before retrying, in milliseconds." }),
	/**
	 * GitHub's validation entries, when the failed response carried any.
	 *
	 * @remarks
	 * The structured half of a 422: branch on an entry's `code` and `field`
	 * rather than on `reason`. Absent when GitHub sent no `errors` array — some
	 * 422s ("Update is not a fast forward") are prose only.
	 */
	validation: GitHubValidationEntry.pipe(S.Array, S.optionalKey).annotateKey({ description: "GitHub's validation entries, when the failed response carried any." }),
	/** The underlying throwable, when one exists. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying throwable, when one exists." }),
}, $I.annote("GitHubError", { description: "Every REST failure this package produces, from every resource." })) {
	/** `"GitBranch.upsert failed (422): Reference already exists"`. */
	override get message(): string {
		return this.status === undefined
			? `${this.operation} failed: ${this.reason}`
			: `${this.operation} failed (${this.status}): ${this.reason}`;
	}

	/**
	 * Whether retrying could plausibly succeed.
	 *
	 * @remarks
	 * Derived from `kind` rather than stored. A 404 or a
	 * validation rejection will fail identically on every attempt; only a
	 * transport failure or a rate limit can change its mind.
	 */
	get retryable(): boolean {
		return this.kind === "transport" || this.kind === "rateLimited";
	}

	/** The requested thing is not there. */
	static notFound(operation: string, subject: string): GitHubError {
		return GitHubError.make({ kind: "notFound", operation, reason: `${subject} not found`, status: 404 });
	}

	/** The thing you asked to create is already there. */
	static alreadyExists(operation: string, subject: string): GitHubError {
		return GitHubError.make({
    kind: "alreadyExists",
    operation,
    reason: `${subject} already exists`,
    status: 422,
});
	}

	/** GitHub understood the request and refused it. */
	static rejected(operation: string, status: number, reason: string): GitHubError {
		return GitHubError.make({ kind: "rejected", operation, reason, status });
	}

	/** A response did not match the schema it was decoded against. */
	static decode(operation: string, reason: string, cause?: unknown): GitHubError {
		return GitHubError.make({
			kind: "decode",
			operation,
			reason,
			...(cause !== undefined ? { cause } : {}),
		});
	}

	/**
	 * Classify anything octokit threw.
	 *
	 * @remarks
	 * The single classification step for the whole package — every resource
	 * method's failures come through here, so the taxonomy cannot drift between
	 * resources.
	 *
	 * `nowMillis` is passed in rather than read from the wall clock so the
	 * function stays pure and total: the rate-limit reset header is an absolute
	 * epoch second, and turning it into a delay needs a "now" the caller controls.
	 * The client supplies `Clock.currentTimeMillis`, which is the `TestClock`
	 * under test.
	 */
	static fromOctokit(operation: string, error: unknown, nowMillis: number): GitHubError {
		const facts = readThrowable(error);
		const retryAfterMillis = retryAfterMillisFrom(facts.headers, nowMillis);
		const kind = classify(facts, retryAfterMillis);
		return GitHubError.make({
    kind,
    operation,
    reason: facts.reason,
    ...(facts.status !== undefined ? { status: facts.status } : {}),
    ...(retryAfterMillis !== undefined ? { retryAfterMillis } : {}),
    ...(facts.validation.length > 0 ? { validation: facts.validation } : {}),
    cause: error,
});
	}

	/**
	 * A predicate over one or more kinds, for `Effect.catchIf`.
	 *
	 * @example
	 * ```ts
	 * import { GitHubError } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * declare const read: Effect.Effect<string, GitHubError>;
	 *
	 * const orDefault = read.pipe(
	 *   Effect.catchIf(GitHubError.hasKind("notFound"), () => Effect.succeed("")),
	 * );
	 * ```
	 */
	static hasKind(...kinds: ReadonlyArray<(typeof GitHubErrorKind.literals)[number]>): (error: GitHubError) => boolean {
		const set = new Set<string>(kinds);
		return (error) => set.has(error.kind);
	}

	/**
	 * A predicate over GitHub's validation codes, for `Effect.catchIf`.
	 *
	 * @remarks
	 * Matches when any entry in {@link GitHubError}'s `validation` carries one of
	 * the codes. Use it for the distinctions {@link GitHubErrorKind} deliberately
	 * does not draw, such as a `missing_field` against an `invalid`.
	 *
	 * @example
	 * ```ts
	 * import { GitHubError } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * declare const create: Effect.Effect<void, GitHubError>;
	 *
	 * const tolerant = create.pipe(
	 *   Effect.catchIf(GitHubError.hasValidationCode("missing"), () => Effect.void),
	 * );
	 * ```
	 */
	static hasValidationCode(
		...codes: ReadonlyArray<(typeof GitHubValidationCode.literals)[number]>
	): (error: GitHubError) => boolean {
		const set = new Set<string>(codes);
		return (error) => error.validation?.some((entry) => entry.code !== undefined && set.has(entry.code)) ?? false;
	}
}

/** What classification needs out of an unknown throwable. */
interface Throwable {
	readonly status: number | undefined;
	readonly headers: Readonly<Record<string, unknown>> | undefined;
	readonly reason: string;
	readonly validation: ReadonlyArray<GitHubValidationEntry>;
}

/**
 * Read an unknown throwable structurally.
 *
 * @remarks
 * Deliberately structural rather than `instanceof RequestError`:
 * `@octokit/request-error` is a transitive dependency this package does not
 * declare, and importing a package you did not declare is how a peer closure
 * rots. The shape it throws — `{ status, response: { headers, data } }` — is
 * stable and public.
 */
const readThrowable = (error: unknown): Throwable => {
	if (!isRecord(error)) {
		return { status: undefined, headers: undefined, reason: String(error), validation: [] };
	}
	const record = error;
	const response = asRecord(record.response);
	const headers = asRecord(response?.headers);
	const data = asRecord(response?.data);
	return {
		status: typeof record.status === "number" ? record.status : undefined,
		headers,
		reason: sanitizeReason(typeof record.message === "string" ? record.message : String(error)),
		validation: readValidation(data),
	};
};

const isRecord = (value: unknown): value is Record<string, unknown> => P.isObjectOrArray(value);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
	isRecord(value) ? value : undefined;

/**
 * GitHub answers some requests with an HTML error page whose body becomes a
 * multi-kilobyte "message".
 *
 * @remarks
 * An HTML body is never a useful reason string, and letting one through means
 * a log line with a whole web page in it.
 */
const sanitizeReason = (message: string): string => {
	const trimmed = message.trim();
	if (trimmed.startsWith("<") || trimmed.length > MAX_REASON_LENGTH) {
		return trimmed.startsWith("<")
			? "GitHub returned an HTML error page instead of a JSON response"
			: `${trimmed.slice(0, MAX_REASON_LENGTH)}…`;
	}
	return trimmed;
};

const MAX_REASON_LENGTH = 500;

/** GitHub's validation failures arrive as `data.errors[]` entries. */
const readValidation = (data: Record<string, unknown> | undefined): ReadonlyArray<GitHubValidationEntry> => {
	const errors = data?.errors;
	if (!Array.isArray(errors)) return [];
	const entries: Array<GitHubValidationEntry> = [];
	for (const raw of errors) {
		const record = asRecord(raw);
		if (record === undefined) continue;
		const resource = stringField(record, "resource");
		const field = stringField(record, "field");
		const code = stringField(record, "code");
		const message = stringField(record, "message");
		if (resource === undefined && field === undefined && code === undefined && message === undefined) continue;
		entries.push(
			GitHubValidationEntry.make({
				...(resource !== undefined ? { resource } : {}),
				...(field !== undefined ? { field } : {}),
				...(code !== undefined ? { code } : {}),
				...(message !== undefined ? { message } : {}),
			}),
		);
	}
	return entries;
};

const stringField = (record: Record<string, unknown>, key: string): string | undefined =>
	typeof record[key] === "string" ? record[key] : undefined;

const ALREADY_EXISTS = "already exists";

/** GitHub's documented validation-error code for a duplicate resource. */
const ALREADY_EXISTS_CODE = "already_exists";

const classify = (
	facts: Throwable,
	retryAfterMillis: number | undefined,
): (typeof GitHubErrorKind.literals)[number] => {
	const { status } = facts;
	if (status === undefined) return "transport";
	if (status === 404) return "notFound";
	if (status >= 500) return "transport";
	if (status === 429) return "rateLimited";
	if (status === 403) {
		// A 403 is GitHub's answer to BOTH "you may not" and "you have asked too
		// often". Only the headers tell them apart: an exhausted budget carries a
		// zeroed remaining count or an explicit delay.
		return retryAfterMillis !== undefined ? "rateLimited" : "unauthorized";
	}
	if (status === 401) return "unauthorized";
	if (status === 422 || status === 409) {
		return saysAlreadyExists(facts) ? "alreadyExists" : "rejected";
	}
	return "rejected";
};

/**
 * @remarks
 * The structured code is the authority — the releases endpoint sends it with
 * no message at all. The prose checks cover endpoints that say so only in
 * words, such as `/git/refs` answering "Reference already exists".
 */
const saysAlreadyExists = (facts: Throwable): boolean => {
	if (facts.validation.some((entry) => entry.code === ALREADY_EXISTS_CODE)) return true;
	const reason = facts.reason.toLowerCase();
	if (reason.includes(ALREADY_EXISTS)) return true;
	return facts.validation.some((entry) => entry.message?.toLowerCase().includes(ALREADY_EXISTS) ?? false);
};

/**
 * Re-exported for the client, which reads the same headers on the **success**
 * path to keep its rate-limit snapshot current.
 *
 * @internal
 */
export const readRateLimitHeaders = (
	headers: Readonly<Record<string, unknown>> | undefined,
): { remaining: number; limit: number; resetEpochSeconds: number } | undefined => {
	const remaining = headerNumber(headers, "x-ratelimit-remaining");
	const limit = headerNumber(headers, "x-ratelimit-limit");
	const reset = headerNumber(headers, "x-ratelimit-reset");
	if (remaining === undefined || limit === undefined || reset === undefined) return undefined;
	return { remaining, limit, resetEpochSeconds: reset };
};

/** @internal */
export const readHeaderString = headerString;
