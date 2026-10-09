import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Octokit } from "@octokit/core";
import { composePaginateRest } from "@octokit/plugin-paginate-rest";
import type { OctokitResponse } from "@octokit/types";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as O from "@beep/utils/Option";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitHubError, readRateLimitHeaders } from "../GitHubError.ts";
import { GitHubGraphQLError } from "../GraphQL.ts";
import type { RetryPolicy, RetryableFailure } from "../Resilience.ts";
import { RateLimitSnapshot } from "../Resilience.ts";
import type { PageSource } from "./paginate.ts";

const $I = $ScratchpadId.create("effected/github/internal/octokit");

const RequestMethod = LiteralKit(["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"]).pipe(
	$I.annoteSchema("RequestMethod", { description: "The standard GitHub REST request methods." }),
);

/**
 * The one place `@octokit/core` is constructed, and the one place its
 * throwables become typed errors.
 *
 * **Details**
 *
 * `@octokit/rest` is deliberately **not** used. Route-keyed typing comes from
 * `@octokit/types`' generated `Endpoints` map, which `@octokit/core`'s `request`
 * already consumes; the rest wrapper would add `plugin-request-log` (which this
 * package would immediately have to silence) plus a second, 1.4 MB spelling of
 * the same endpoint types.
 *
 * @internal
 */

/**
 * Configures transport authentication, retry behavior and HTTP overrides.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface TransportOptions {
	/**
	 * The bearer credential. Absent means **unauthenticated**, which GitHub
	 * serves at 60 requests per hour per IP — the only call that legitimately
	 * wants it is the bot-user lookup, which rejects an app JWT.
	 */
	readonly token?: Redacted.Redacted<string> | undefined;
	readonly retry: RetryPolicy;
	readonly baseUrl?: string | undefined;
	readonly userAgent?: string | undefined;
	readonly fetch?: typeof globalThis.fetch | undefined;
}

/**
 * Holds the request operations and shared rate-limit state of a client layer.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface Transport {
	/** One request: retried, classified, with its rate-limit headers recorded. */
	readonly request: <A>(
		operation: string,
		route: string,
		params: Record<string, unknown>,
	) => Effect.Effect<OctokitResponse<A>, GitHubError>;
	/** A single-use page cursor over a paginating route. */
	readonly pageSource: <A>(operation: string, route: string, params: Record<string, unknown>) => PageSource<A>;
	/** One GraphQL call: retried and classified. */
	readonly graphql: (
		operation: string,
		document: string,
		variables: Record<string, unknown>,
	) => Effect.Effect<unknown, GitHubGraphQLError>;
	/** The most recent rate-limit headers seen, if any. */
	readonly rateLimit: Effect.Effect<O.Option<RateLimitSnapshot>>;
}

class TransportFailure extends S.TaggedError<TransportFailure>($I`TransportFailure`)("TransportFailure", {
	error: S.Defect().annotateKey({ description: "The original throwable, preserved for transport classification." }),
}, $I.annote("TransportFailure", { description: "Carries an Octokit throwable until it is classified." })) {}

const SILENT_LOG = {
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
};

/**
 * Build the octokit instance.
 *
 * **Details**
 *
 * `auth` takes the raw token string. `@octokit/auth-token` inspects it and
 * emits `bearer` for a three-segment JWT and `token` otherwise — exactly the
 * distinction an app JWT and an installation token need, so the App path
 * requires no separate auth strategy.
 *
 * `log` is silenced. Retries log through `Effect.logDebug`, and an application
 * maps Effect's logs to whatever its runtime wants, so no GitHub Actions
 * knowledge lives in this client.
 */
const makeOctokit = (options: TransportOptions): Octokit =>
	new Octokit({
		// The one deliberate unwrap in this package: octokit needs the string.
		// Nothing downstream re-exposes it — errors, spans and logs never carry it.
		...O.getSomesStruct({ auth: O.map(O.fromUndefinedOr(options.token), Redacted.value) }),
		...O.getSomesStruct({ baseUrl: O.fromUndefinedOr(options.baseUrl) }),
		...O.getSomesStruct({ userAgent: O.fromUndefinedOr(options.userAgent) }),
		...O.getSomesStruct({ request: O.map(O.fromUndefinedOr(options.fetch), (fetch) => ({ fetch })) }),
		log: SILENT_LOG,
	});

/**
 * Build a transport over a freshly constructed octokit instance.
 *
 * **Details**
 *
 * The rate-limit cell lives here, in the closure of the layer that writes it,
 * so the writer and the reader can never see different cells.
 *
 * **Example** (Read the initial rate-limit state without a request)
 *
 * ```ts
 * import { makeTransport } from "@beep/scratchpad/effected/github/internal/octokit";
 * import { RetryPolicy } from "@beep/scratchpad/effected/github/Resilience";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 *
 * const program = Effect.gen(function* () {
 *   const transport = yield* makeTransport({ retry: RetryPolicy.default });
 *   return O.isNone(yield* transport.rateLimit);
 * });
 * console.log(Effect.runSync(program)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeTransport = Effect.fn("makeTransport")(function* (options: TransportOptions): Effect.fn.Return<Transport> {
		const octokit = makeOctokit(options);
		const snapshot = yield* Ref.make(O.none<RateLimitSnapshot>());
		const policy = options.retry;

		const record = (headers: Readonly<Record<string, unknown>> | undefined): Effect.Effect<void> => {
			const parsed = readRateLimitHeaders(headers);
			return parsed === undefined ? Effect.void : Ref.set(snapshot, O.some(RateLimitSnapshot.make(parsed)));
		};

		/**
   * Run one promise-producing call, classifying whatever it throws.
   *
   * **Details**
   *
   * The `AbortSignal` `Effect.tryPromise` supplies is threaded into octokit's
   * `request.signal`, so interrupting the fiber aborts the in-flight HTTP
   * request rather than leaving it running unobserved.
   */
		const attempt = <A, E>(
			call: (signal: AbortSignal) => Promise<A>,
			classify: (error: unknown, nowMillis: number) => E,
		): Effect.Effect<A, E> =>
			Effect.tryPromise({ try: call, catch: (error) => TransportFailure.make({ error }) }).pipe(
				Effect.catch(Effect.fnUntraced(function* ({ error }) {
						const now = yield* Clock.currentTimeMillis;
						yield* record(readThrownHeaders(error));
						return yield* Effect.fail(classify(error, now));
				})),
			);

		const withRetry = <A, E extends RetryableFailure>(
			operation: string,
			effect: Effect.Effect<A, E>,
		): Effect.Effect<A, E> =>
			effect.pipe(
				Effect.tapError((error) =>
					policy.retries(error)
						? Effect.logDebug("github.retry").pipe(Effect.annotateLogs({ operation }))
						: Effect.void,
				),
				Effect.retry(policy.schedule<E>()),
			);

		const request = <A>(operation: string, route: string, params: Record<string, unknown>) =>
			withRetry(
				operation,
				attempt(
					(signal) => octokit.request<A>({ ...routeOptions(route), ...withSignal(params, signal) }),
					(error, now) => GitHubError.fromOctokit(operation, error, now),
				).pipe(Effect.tap((response) => record(response.headers))),
			);

		const pageSource = <A>(operation: string, route: string, params: Record<string, unknown>): PageSource<A> => {
			// octokit's iterator advances its cursor only on a SUCCESSFUL page, so
			// retrying `next()` re-requests the same page rather than skipping it.
			// That is what makes per-page retry safe, and it is why this uses the
			// iterator rather than a hand-rolled Link-header walk: the iterator also
			// carries the compare endpoint's `total_commits` continuation, the
			// search-shaped `{ total_count, items }` normalization, and the
			// empty-repository 409 that GitHub answers commit listings with.
			const paginationOctokit = makeOctokit(options);
			let currentSignal: AbortSignal | undefined;
			// The iterator retains only method, url and headers. Wrap its request
			// method so each attempt keeps its signal and per-request options.
			paginationOctokit.hook.wrap("request", (request, pageOptions): Promise<OctokitResponse<unknown>> => {
				// Hook wrappers bind this options object, including the auth hook.
				pageOptions.request = {
						...pageOptions.request,
						...requestOptions(params),
						...O.getSomesStruct({ signal: O.fromUndefinedOr(currentSignal) }),
				};
				return Promise.resolve(request(pageOptions));
			});
			const pages: AsyncIterable<OctokitResponse<ReadonlyArray<A>>> = composePaginateRest.iterator(paginationOctokit, route, params);
			const iterator = pages[Symbol.asyncIterator]();
			let finished = false;
			return {
				next: Effect.suspend(() =>
					finished
						? Effect.succeedNone
						: withRetry(
								operation,
								attempt(
									(signal) => {
										currentSignal = signal;
										return iterator.next();
									},
									(error, now) => GitHubError.fromOctokit(operation, error, now),
								).pipe(
									Effect.flatMap((result) => {
										if (result.done === true || result.value === undefined) {
											finished = true;
											return Effect.succeedNone;
										}
										const response = result.value;
										return record(response.headers).pipe(Effect.as(O.some(response.data)));
									}),
								),
							),
				),
			};
		};

		const graphql = (operation: string, document: string, variables: Record<string, unknown>) =>
			withRetry(
				operation,
				attempt(
					(signal) => octokit.graphql<unknown>(document, withSignal(variables, signal)),
					(error, now) => GitHubGraphQLError.fromThrowable(operation, error, now),
				),
			);

		return { request, pageSource, graphql, rateLimit: Ref.get(snapshot) };
	});

/** Keep Octokit's first-two-space-separated-token route parsing and GET defaults. */
const routeOptions = (route: string) => {
	const [methodOrUrl = "", url] = Str.split(route, " ");
	const normalized = Str.toUpperCase(methodOrUrl);
	return url !== undefined && Str.isNonEmpty(url)
		? { method: S.is(RequestMethod)(normalized) ? normalized : methodOrUrl, url }
		: { url: methodOrUrl };
};

const requestOptions = (params: Record<string, unknown>) =>
	P.isObjectKeyword(params.request) && !P.isFunction(params.request) ? params.request : {};

/** Merge our abort signal into octokit's per-request options without clobbering them. */
const withSignal = (params: Record<string, unknown>, signal: AbortSignal): Record<string, unknown> =>
	({ ...params, request: { ...requestOptions(params), signal } });

/** Response headers off a throwable, when it carried any. */
const readThrownHeaders = (error: unknown): Record<string, unknown> | undefined => {
	if (!P.isObjectOrArray(error) || !P.hasProperty(error, "response")) return undefined;
	const response = error.response;
	if (!P.isObjectOrArray(response) || !P.hasProperty(response, "headers")) return undefined;
	const headers = response.headers;
	return P.isObjectOrArray(headers) && !A.isArray(headers) ? headers : undefined;
};
