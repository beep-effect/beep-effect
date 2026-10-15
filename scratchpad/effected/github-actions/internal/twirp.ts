// The Twirp JSON client the Actions results backend speaks.
//
// The cache, artifact and blob-store protocols are the same transport with a
// different service segment, so the RPC, the conflict sentinel and the retry
// policy live here once. Generic over nothing at all: each caller maps a
// `TwirpFailure` into its own typed error, because the failure a caller
// reports is about *its* operation, not about HTTP.
import type * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import type * as Redacted from "effect/Redacted";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Function from "effect/Function";
import * as P from "effect/Predicate";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/github-actions/internal/twirp");
const TwirpFailureKind = LiteralKit(["transport", "status", "malformed"]).annotate(
	$I.annote("TwirpFailureKind", { description: "The transport, HTTP status, or JSON decoding stage of a failed RPC." }),
);
const TwirpFailureFields = {
	method: S.String.annotateKey({ description: "The RPC that failed." }),
	status: S.optional(S.Finite).annotateKey({ description: "The finite HTTP status, when present; explicit undefined is accepted." }),
	cause: S.optionalKey(S.Unknown).annotateKey({ description: "The underlying failure, when present; explicit undefined is accepted." }),
};

/**
 * Returned instead of a failure when the backend answers HTTP 409.
 *
 * **Details**
 *
 * A conflict means "this already exists", which is a success for a save and a
 * miss for a lookup — two different answers that the *caller* has to choose
 * between, so the transport hands back a sentinel rather than deciding.
 *
 * **Example** (Recognize the shared conflict sentinel)
 *
 * ```ts
 * import { CONFLICT } from "@beep/scratchpad/effected/github-actions/internal/twirp"
 *
 * console.log(Symbol.keyFor(CONFLICT)) // @effected/github-actions/twirp/conflict
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const CONFLICT: unique symbol = Symbol.for("@effected/github-actions/twirp/conflict");

/**
 * A decoded body, or {@link CONFLICT}.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type TwirpResult<T> = T | typeof CONFLICT;

/**
 * Why an RPC did not produce a body.
 *
 * **Details**
 *
 * Structural rather than a formatted string. The predecessor decided
 * retryability by testing the *message* for `"HTTP 503"` and `"ECONNRESET"`,
 * which makes a reworded message a silent policy change.
 *
 * **Example** (Classify an unsupported HTTP status)
 *
 * ```ts
 * import { TwirpFailure } from "@beep/scratchpad/effected/github-actions/internal/twirp"
 * import * as S from "effect/Schema"
 *
 * const failure = S.decodeUnknownSync(TwirpFailure)({ kind: "status", method: "CreateCacheEntry", status: 503 })
 * console.log(failure.kind, failure.status) // status 503
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const TwirpFailure = TwirpFailureKind.mapMembers(([transport, status, malformed]) => [
	S.Struct({ ...TwirpFailureFields, kind: transport.annotateKey({ description: "The request never completed." }) }),
	S.Struct({ ...TwirpFailureFields, kind: status.annotateKey({ description: "The backend returned an unsupported HTTP status." }) }),
	S.Struct({ ...TwirpFailureFields, kind: malformed.annotateKey({ description: "The successful response was not JSON." }) }),
]).pipe(S.toTaggedUnion("kind")).annotate(
	$I.annote("TwirpFailure", { description: "Plain-object RPC failure variants preserving optional status and cause fields in every variant." }),
);

/**
 * The failure variants accepted by {@link TwirpFailure}.
 * @category type-level
 * @since 0.0.0
 */
export type TwirpFailure = typeof TwirpFailure.Type;

/**
 * The error fields a {@link TwirpFailure} contributes to a caller's own error
 * class — the cache, artifact and blob-store errors all carry `reason`,
 * `status`, `detail` and `cause` under the same names, so each spreads this
 * and adds its own identifier.
 *
 * **Example** (Map a refused RPC into error fields)
 *
 * ```ts
 * import { twirpFailureFields } from "@beep/scratchpad/effected/github-actions/internal/twirp"
 *
 * const fields = twirpFailureFields({ method: "CreateCacheEntry", kind: "status", status: 403 })
 * console.log(fields.reason) // refused
 * ```
 *
 * @internal
 * @category mapping
 * @since 0.0.0
 */
export const twirpFailureFields = (
	failure: TwirpFailure,
):
	| { readonly reason: "refused"; readonly detail: string; readonly status?: number }
	| { readonly reason: "unreachable"; readonly detail: string; readonly cause?: unknown } =>
	failure.kind === "status"
		? {
				reason: "refused",
				detail: failure.method,
				...O.getSomesStruct({ status: O.fromUndefinedOr(failure.status) }),
			}
		: {
				reason: "unreachable",
				detail: `${failure.method} did not answer with a Twirp body`,
				...O.getSomesStruct({ cause: O.fromUndefinedOr(failure.cause) }),
			};

/**
 * Whether retrying could plausibly help.
 *
 * **Details**
 *
 * A transport fault never completed, so nothing was observed; `408`, `429` and
 * `5xx` are the backend saying "later". Everything else — a `400`, a `403`, a
 * body that is not JSON — is the backend saying "never", and retrying it four
 * times only makes a broken call take half a minute to fail.
 *
 * **Example** (Distinguish transient and malformed failures)
 *
 * ```ts
 * import { isRetryable } from "@beep/scratchpad/effected/github-actions/internal/twirp"
 *
 * console.log(isRetryable({ method: "CreateCacheEntry", kind: "status", status: 503 })) // true
 * console.log(isRetryable({ method: "CreateCacheEntry", kind: "malformed" })) // false
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isRetryable = (failure: TwirpFailure): boolean => {
	if (failure.kind === "transport") {
		return true;
	}
	if (failure.kind === "malformed" || failure.status === undefined) {
		return false;
	}
	return failure.status >= 500 || failure.status === 408 || failure.status === 429;
};

/** How many times a retryable RPC is retried before giving up. */
const RETRIES = 4;

/**
 * A Twirp RPC: `POST <baseUrl>twirp/<service>/<method>` with a JSON body.
 *
 * **Details**
 *
 * Retry is applied **here**, not by each caller, so no protocol can be shipped
 * without it. A non-retryable failure never sleeps, which is what keeps the
 * ordinary failure tests clock-free.
 *
 * **Example** (Construct an authenticated Twirp call)
 *
 * ```ts
 * import { twirpCall } from "@beep/scratchpad/effected/github-actions/internal/twirp"
 * import * as Effect from "effect/Effect"
 * import * as Redacted from "effect/Redacted"
 * import * as HttpClient from "effect/http/HttpClient";
 * const program = Effect.flatMap(HttpClient.HttpClient, (http) => twirpCall({
 *   http,
 *   baseUrl: "https://results.example.com/",
 *   service: "github.actions.results.api.v1.CacheService",
 *   token: Redacted.make("example-token"),
 *   method: "CreateCacheEntry",
 *   body: { key: "build-cache" }
 * }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @internal
 * @category clients
 * @since 0.0.0
 */
export const twirpCall = (options: {
	readonly http: HttpClient.HttpClient;
	readonly baseUrl: string;
	readonly service: string;
	readonly token: Redacted.Redacted<string>;
	readonly method: string;
	readonly body: Record<string, unknown>;
}): Effect.Effect<TwirpResult<unknown>, TwirpFailure> => {
	const { baseUrl, body, http, method, service, token } = options;
	const attempt = Effect.gen(function* () {
		const request = HttpClientRequest.post(`${baseUrl}twirp/${service}/${method}`).pipe(
			// The runtime token is never declassified: `bearerToken` takes a
			// `Redacted` and renders it at the boundary itself.
			HttpClientRequest.bearerToken(token),
			HttpClientRequest.bodyJsonUnsafe(body),
		);
		const response = yield* http
			.execute(request)
			.pipe(Effect.mapError((cause): TwirpFailure => ({ method, kind: "transport", cause })));
		if (response.status === 409) {
			return CONFLICT;
		}
		if (response.status < 200 || response.status >= 300) {
			return yield* Effect.fail<TwirpFailure>({ method, kind: "status", status: response.status });
		}
		return yield* response.json.pipe(Effect.mapError((cause): TwirpFailure => ({ method, kind: "malformed", cause })));
	});

	return attempt.pipe(
		Effect.retry({ schedule: Schedule.exponential("3 seconds", 1.5), times: RETRIES, while: isRetryable }),
	);
};

/** Check the property before reading an unknown JSON object, including inherited fields. */
const hasField = <Key extends string>(body: object, key: Key): body is object & Record<Key, unknown> => key in body;

/**
 * Read a Twirp JSON field under either spelling.
 *
 * **Details**
 *
 * The backend is an internal GitHub protocol reverse-engineered from
 * `actions/toolkit`, and the two halves of it do not agree: protobuf JSON emits
 * `signedUploadUrl` while the cache RPCs have been observed emitting
 * `signed_upload_url`. Reading both costs one function and removes a class of
 * failure that presents as "the cache silently never hits".
 *
 * **Example** (Read a snake-case backend field)
 *
 * ```ts
 * import { field } from "@beep/scratchpad/effected/github-actions/internal/twirp"
 *
 * console.log(field({ signed_upload_url: "https://example.com/upload" }, "signedUploadUrl")) // https://example.com/upload
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const field: {
	(body: unknown, name: string): unknown;
	(name: string): (body: unknown) => unknown;
} = Function.dual(2, (body: unknown, name: string): unknown => {
	if (!P.isObjectOrArray(body)) {
		return undefined;
	}
		const snake = name.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
	return (hasField(body, name) ? body[name] : undefined) ?? (hasField(body, snake) ? body[snake] : undefined);
});

/**
 * {@link field}, as a string, or `undefined` when absent or empty.
 *
 * **Example** (Reject empty strings while accepting snake case)
 *
 * ```ts
 * import { stringField } from "@beep/scratchpad/effected/github-actions/internal/twirp"
 *
 * console.log(stringField({ signed_upload_url: "https://example.com/upload" }, "signedUploadUrl")) // https://example.com/upload
 * console.log(stringField({ signedUploadUrl: "" }, "signedUploadUrl")) // undefined
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const stringField: {
	(body: unknown, name: string): string | undefined;
	(name: string): (body: unknown) => string | undefined;
} = Function.dual(2, (body: unknown, name: string): string | undefined => {
	const value = field(body, name);
	return P.isString(value) && value !== "" ? value : undefined;
});

/**
 * Whether a Twirp response carries `ok: true`.
 *
 * **Example** (Require a literal success flag)
 *
 * ```ts
 * import { isOk } from "@beep/scratchpad/effected/github-actions/internal/twirp"
 *
 * console.log(isOk({ ok: true })) // true
 * console.log(isOk({ ok: "true" })) // false
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isOk = (body: unknown): boolean => field(body, "ok") === true;
