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
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GithubId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import { Octokit } from "@octokit/core";
import { composePaginateRest } from "@octokit/plugin-paginate-rest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { constVoid, dual, flow } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitHubError, readRateLimitHeaders } from "../GitHubError.ts";
import { GitHubGraphQLError } from "../GraphQL.ts";
import {
  credentialFingerprint,
  RateLimitCredential,
  RateLimitObservation,
  RateLimitOutcome,
  RateLimitSink,
  RateLimitSnapshot,
  RetryPolicy,
} from "../Resilience.ts";
import { headerNumber, headerString } from "./headers.ts";
import type { OctokitResponse } from "@octokit/types";
import type { GitHubRateLimitResource, RateLimitRequestKind, RetryableFailure } from "../Resilience.ts";
import type { PageSource } from "./paginate.ts";

const $I = $GithubId.create("internal/octokit");

const RequestMethod = LiteralKit(["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"]).pipe(
  $I.annoteSchema("RequestMethod", { description: "The standard GitHub REST request methods." })
);

/**
 * **Example** (Accept the global fetch)
 *
 * ```ts
 * import { FetchFunction } from "@beep/github/internal/octokit";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(FetchFunction)(globalThis.fetch)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FetchFunction = S.declare((u: unknown): u is typeof globalThis.fetch => P.isFunction(u)).pipe(
  $I.annoteSchema("FetchFunction", { description: "A replacement for the global fetch." })
);

/**
 * A constructed {@link RetryPolicy}, kept as the value it is.
 *
 * **Details**
 *
 * A policy carries a `Schedule` builder and a predicate, so it is service
 * configuration, never wire data: the encoded side is the policy itself.
 *
 * **Example** (Accept the default policy)
 *
 * ```ts
 * import { RetryPolicySchema } from "@beep/github/internal/octokit";
 * import { RetryPolicy } from "@beep/github/Resilience";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(RetryPolicySchema)(RetryPolicy.default)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RetryPolicySchema = RetryPolicy.pipe(
  S.is,
  S.declare,
  $I.annoteSchema("RetryPolicyValue", { description: "A constructed RetryPolicy, kept as the value it is." })
);

/**
 * **Details**
 *
 * Service options rather than wire data: every field's encoded side equals
 * its decoded side, and {@link makeTransport} takes
 * {@link TransportOptions.Encoded} so a caller passes an object literal.
 *
 * **Example** (Describe an unauthenticated transport)
 *
 * ```ts
 * import { TransportOptions } from "@beep/github/internal/octokit";
 * import { RetryPolicy } from "@beep/github/Resilience";
 *
 * const options = TransportOptions.make({ retry: RetryPolicy.none });
 * console.log(options.token === undefined) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class TransportOptions extends S.Opaque<TransportOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** A GitHub Enterprise API root. */
    baseUrl: S.optionalKey(S.String).pipe(
      $I.annoteKey("TransportOptions.baseUrl", { description: "A GitHub Enterprise API root." })
    ),
    /** A replacement for the global `fetch`. */
    fetch: S.optionalKey(FetchFunction).pipe(
      $I.annoteKey("TransportOptions.fetch", { description: "A replacement for the global fetch." })
    ),
    /** The resolved retry policy. */
    retry: RetryPolicySchema.pipe(
      $I.annoteKey("TransportOptions.retry", { description: "The resolved retry policy." })
    ),
    /**
     * The bearer credential. Absent means **unauthenticated**, which GitHub
     * serves at 60 requests per hour per IP — the only call that legitimately
     * wants it is the bot-user lookup, which rejects an app JWT.
     */
    token: S.String.pipe(
      S.Redacted,
      S.optionalKey,
      $I.annoteKey("TransportOptions.token", {
        description: "The bearer credential. Absent means unauthenticated.",
      })
    ),
    /** Appended to octokit's own user agent. */
    userAgent: S.optionalKey(S.String).pipe(
      $I.annoteKey("TransportOptions.userAgent", { description: "Appended to octokit's own user agent." })
    ),
    /**
     * An opaque, non-secret label naming whose rate-limit budget this client
     * spends. Passed verbatim on every observation; never parsed, composed or
     * sent in a header.
     */
    budgetLabel: S.optionalKey(S.String).pipe(
      $I.annoteKey("TransportOptions.budgetLabel", {
        description: "An opaque, non-secret label naming whose rate-limit budget this client spends.",
      })
    ),
    /**
     * The kind of credential the token is. Absent means derived: a non-empty
     * token is `token`, no token or an empty one is `unauthenticated`.
     */
    credential: S.optionalKey(RateLimitCredential).pipe(
      $I.annoteKey("TransportOptions.credential", {
        description: "The kind of credential the token is; derived from the token when absent.",
      })
    ),
  }).pipe(
    $I.annoteSchema("TransportOptions", {
      description: "Transport authentication, retry behavior and HTTP overrides.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TransportOptions {
  /**
   * The plain, unbranded options {@link makeTransport} accepts.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TransportOptions.Encoded;
}

/**
 * Holds the request operations and shared rate-limit state of a client layer.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface Transport {
  /** One GraphQL call: retried and classified. */
  readonly graphql: {
    (
      operation: string,
      document: string,
      variables: Record<string, unknown>
    ): Effect.Effect<unknown, GitHubGraphQLError>;
    (
      document: string,
      variables: Record<string, unknown>
    ): (operation: string) => Effect.Effect<unknown, GitHubGraphQLError>;
  };
  /** A single-use page cursor over a paginating route. */
  readonly pageSource: {
    <A>(operation: string, route: string, params: Record<string, unknown>): PageSource<A>;
    <A>(route: string, params: Record<string, unknown>): (operation: string) => PageSource<A>;
  };
  /** The most recent rate-limit headers seen, if any. */
  readonly rateLimit: Effect.Effect<O.Option<RateLimitSnapshot>>;
  /** One request: retried, classified, with its rate-limit headers recorded. */
  readonly request: {
    <A>(
      operation: string,
      route: string,
      params: Record<string, unknown>
    ): Effect.Effect<OctokitResponse<A>, GitHubError>;
    <A>(
      route: string,
      params: Record<string, unknown>
    ): (operation: string) => Effect.Effect<OctokitResponse<A>, GitHubError>;
  };
}

class TransportFailure extends S.TaggedError<TransportFailure, { readonly brand: unique symbol }>($I`TransportFailure`)(
  "TransportFailure",
  {
    error: S.Defect().pipe(
      $I.annoteKey("TransportFailure.error", {
        description: "The original throwable, preserved for transport classification.",
      })
    ),
  },
  $I.annoteError<TransportFailure>("TransportFailure", {
    description: "Carries an Octokit throwable until it is classified.",
  })
) {}

const SILENT_LOG = {
  debug: constVoid,
  info: constVoid,
  warn: constVoid,
  error: constVoid,
};

// decision: octokit-raw-token-auth
const makeOctokit = (options: TransportOptions.Encoded): Octokit =>
  new Octokit({
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
 * Interrupting a call's fiber aborts its HTTP request: the `AbortSignal`
 * `Effect.tryPromise` supplies is threaded into octokit's `request.signal`.
 *
 * GraphQL rate-limit headers are observed on success too, although
 * `@octokit/graphql` keeps response headers only on a failure: each attempt
 * wraps the fetch octokit would have used, read at call time (the caller's
 * per-request `request.fetch`, then `options.fetch`, then the global one).
 *
 * **Example** (Read the initial rate-limit state without a request)
 *
 * ```ts
 * import { makeTransport } from "@beep/github/internal/octokit";
 * import { RetryPolicy } from "@beep/github/Resilience";
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
export const makeTransport = Effect.fn("OctokitTransport.make")(function* (
  options: TransportOptions.Encoded
): Effect.fn.Return<Transport> {
  const octokit = makeOctokit(options);
  const snapshot = yield* Ref.make(O.none<RateLimitSnapshot>());
  const sink = yield* RateLimitSink;
  const policy = options.retry;
  const budgetLabel = O.fromUndefinedOr(options.budgetLabel);
  const credential = options.credential ?? credentialOfToken(options.token);
  const observed = sink !== Context.get(Context.empty(), RateLimitSink);

  const fingerprint =
    observed && credential === "token" && !O.exists(budgetLabel, Str.startsWith("app:")) && options.token !== undefined
      ? yield* credentialFingerprint(options.token).pipe(Effect.asSome)
      : O.none();

  const record = Effect.fnUntraced(function* (
    headers: Readonly<Record<string, unknown>> | undefined,
    meta: RecordMeta
  ): Effect.fn.Return<void> {
    const parsed = O.flatMap(readRateLimitHeaders(headers), (raw) =>
      S.decodeOption(RateLimitSnapshot)({ resource: DEFAULT_RESOURCE[meta.kind], ...raw })
    );
    if (O.isNone(parsed)) return;
    yield* Ref.set(snapshot, parsed);
    const at = yield* DateTime.now;
    yield* sink
      .record(RateLimitObservation.make({ snapshot: parsed.value, budgetLabel, credential, fingerprint, at, ...meta }))
      .pipe(
        Effect.timeoutOption(SINK_TIMEOUT),
        Effect.asVoid,
        Effect.catchCause((cause) => Effect.logDebug("github.rateLimitSink", cause))
      );
  });

  const attempt = <A, E>(
    observed: ObservedCall,
    call: (signal: AbortSignal) => Promise<A>,
    classify: (error: unknown, nowMillis: number) => E
  ): Effect.Effect<A, E> =>
    Effect.tryPromise({ try: call, catch: (error) => TransportFailure.make({ error }) }).pipe(
      Effect.catch(
        Effect.fnUntraced(function* ({ error }) {
          const now = yield* Clock.currentTimeMillis;
          const failure = classify(error, now);
          const headers = readThrownHeaders(error);
          yield* record(headers, { ...observed, status: thrownStatus(error), outcome: outcomeOf(error, headers) });
          return yield* Effect.fail(failure);
        })
      )
    );

  // decision: non-idempotent-writes-retry-rate-limits
  const withRetry = <A, E extends RetryableFailure.Encoded & { readonly kind: string }>(
    operation: string,
    write: WriteSafety,
    effect: Effect.Effect<A, E>
  ): Effect.Effect<A, E> => {
    const retriable = (error: E): boolean =>
      policy.retries(error) && (write === WriteSafety.Enum.idempotent || error.kind === "rateLimited");
    return effect.pipe(
      Effect.tapError((error) =>
        retriable(error) ? Effect.logDebug("github.retry").pipe(Effect.annotateLogs({ operation })) : Effect.void
      ),
      Effect.retry({ schedule: policy.schedule<E>(), while: retriable })
    );
  };

  const request: Transport["request"] = dual(
    3,
    <A>(
      operation: string,
      route: string,
      params: Record<string, unknown>
    ): Effect.Effect<OctokitResponse<A>, GitHubError> =>
      withRetry(
        operation,
        writeSafetyOfRoute(route),
        attempt(
          { operation, kind: "rest" },
          (signal) => octokit.request<A>({ ...octokitRouteOptions(route), ...withRequestOptions(params, { signal }) }),
          (error, now) => GitHubError.fromOctokit(operation, error, now)
        ).pipe(Effect.tap((response) => record(response.headers, restSuccess(operation, response.status))))
      )
  );

  const pageSource: Transport["pageSource"] = dual(
    3,
    <A>(operation: string, route: string, params: Record<string, unknown>): PageSource<A> => {
      // decision: octokit-iterator-pagination
      const paginationOctokit = makeOctokit(options);
      let currentSignal: AbortSignal | undefined;
      paginationOctokit.hook.wrap("request", (request, pageOptions): Promise<OctokitResponse<unknown>> => {
        pageOptions.request = {
          ...pageOptions.request,
          ...requestOptions(params),
          ...O.getSomesStruct({ signal: O.fromUndefinedOr(currentSignal) }),
        };
        return Promise.resolve(request(pageOptions));
      });
      const pages: AsyncIterable<OctokitResponse<ReadonlyArray<A>>> = composePaginateRest.iterator(
        paginationOctokit,
        route,
        params
      );
      const iterator = pages[Symbol.asyncIterator]();
      let finished = false;
      return {
        next: Effect.suspend(() =>
          finished
            ? Effect.succeedNone
            : withRetry(
                operation,
                WriteSafety.Enum.idempotent,
                attempt(
                  { operation, kind: "rest" },
                  (signal) => {
                    currentSignal = signal;
                    return iterator.next();
                  },
                  (error, now) => GitHubError.fromOctokit(operation, error, now)
                ).pipe(
                  Effect.flatMap((result) => {
                    if (result.done === true || result.value === undefined) {
                      finished = true;
                      return Effect.succeedNone;
                    }
                    const response = result.value;
                    return record(response.headers, restSuccess(operation, response.status)).pipe(
                      Effect.as(O.some(response.data))
                    );
                  })
                )
              )
        ),
      };
    }
  );

  const graphql: Transport["graphql"] = dual(
    3,
    (
      operation: string,
      document: string,
      variables: Record<string, unknown>
    ): Effect.Effect<unknown, GitHubGraphQLError> =>
      withRetry(
        operation,
        writeSafetyOfDocument(document),
        attempt(
          { operation, kind: "graphql" },
          (signal) => {
            let seen: Record<string, string> | undefined;
            const base = callerFetchOf(variables) ?? options.fetch ?? globalThis.fetch;
            const fetch = (input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit): Promise<Response> =>
              base(input, init).then((response) => {
                seen = R.fromEntries(response.headers.entries());
                return response;
              });
            return octokit
              .graphql<unknown>(document, withRequestOptions(variables, { signal, fetch }))
              .then((data) => ({ data, headers: seen }));
          },
          (error, now) => GitHubGraphQLError.fromThrowable(operation, error, now)
        ).pipe(
          Effect.tap((result) =>
            record(result.headers, { operation, kind: "graphql", status: 200, outcome: RateLimitOutcome.Enum.ok })
          ),
          Effect.map((result) => result.data)
        )
      )
  );

  return { request, pageSource, graphql, rateLimit: Ref.get(snapshot) };
});

const SINK_TIMEOUT = Duration.millis(250);

const DEFAULT_RESOURCE: Readonly<Record<RateLimitRequestKind, GitHubRateLimitResource>> = {
  rest: "unknown",
  graphql: "graphql",
};

interface ObservedCall {
  readonly kind: RateLimitRequestKind;
  readonly operation: string;
}

interface RecordMeta extends ObservedCall {
  readonly outcome: RateLimitOutcome;
  readonly status: number;
}

const credentialOfToken = (token: Redacted.Redacted<string> | undefined): RateLimitCredential =>
  O.exists(O.fromUndefinedOr(token), flow(Redacted.value, Str.isNonEmpty))
    ? RateLimitCredential.Enum.token
    : RateLimitCredential.Enum.unauthenticated;

const restSuccess = (operation: string, status: number): RecordMeta => ({
  operation,
  kind: "rest",
  status,
  outcome: status === 304 ? RateLimitOutcome.Enum["not-modified"] : RateLimitOutcome.Enum.ok,
});

const thrownGraphqlEntries = (error: unknown): ReadonlyArray<Readonly<Record<string, unknown>>> =>
  P.isObject(error) && A.isArray(error.errors) ? A.filter(error.errors, P.isObject) : [];

const thrownStatus = (error: unknown): number => {
  if (P.isObject(error) && P.isNumber(error.status)) return error.status;
  return A.isReadonlyArrayNonEmpty(thrownGraphqlEntries(error)) ? 200 : 0;
};

const thrownMessages = (error: unknown): ReadonlyArray<string> => {
  if (!P.isObject(error)) return [];
  const response = error.response;
  const data = P.isObject(response) ? response.data : undefined;
  return A.filter(
    [
      error.message,
      P.isObject(data) ? data.message : undefined,
      ...A.map(thrownGraphqlEntries(error), (entry) => entry.message),
    ],
    P.isString
  );
};

const SECONDARY_RATE_LIMIT = /\bsecondary rate\b/iu;

interface ThrownFacts {
  readonly graphqlErrors: boolean;
  readonly graphqlTypes: ReadonlyArray<unknown>;
  readonly remaining: number | undefined;
  readonly retryAfter: boolean;
  readonly secondaryMessage: boolean;
  readonly status: number;
}

const isLimitStatus = (status: number): boolean => status === 403 || status === 429;

const OUTCOME_RULES: ReadonlyArray<readonly [(facts: ThrownFacts) => boolean, RateLimitOutcome]> = [
  [(facts) => isLimitStatus(facts.status) && facts.remaining === 0, "rate-limited"],
  [(facts) => facts.status === 429 || (facts.status === 403 && facts.retryAfter), "secondary-limited"],
  [(facts) => (facts.status === 403 || facts.graphqlErrors) && facts.secondaryMessage, "secondary-limited"],
  [(facts) => A.contains(facts.graphqlTypes, "RATE_LIMITED"), "rate-limited"],
  [(facts) => facts.status === 304, "not-modified"],
];

const outcomeOf = (error: unknown, headers: Readonly<Record<string, unknown>> | undefined): RateLimitOutcome => {
  const entries = thrownGraphqlEntries(error);
  const facts: ThrownFacts = {
    status: thrownStatus(error),
    remaining: headerNumber(headers, "x-ratelimit-remaining"),
    retryAfter: headerString(headers, "retry-after") !== undefined,
    graphqlTypes: A.map(entries, (entry) => entry.type),
    graphqlErrors: A.isReadonlyArrayNonEmpty(entries),
    secondaryMessage: A.some(thrownMessages(error), (message) => SECONDARY_RATE_LIMIT.test(message)),
  };
  return O.getOrElse(
    O.map(
      A.findFirst(OUTCOME_RULES, ([applies]) => applies(facts)),
      ([, outcome]) => outcome
    ),
    () => RateLimitOutcome.Enum.error
  );
};

const WriteSafety = LiteralKit(["idempotent", "non-idempotent"]);
type WriteSafety = typeof WriteSafety.Type;

const NonIdempotentMethod = LiteralKit(["POST", "PATCH"]);

const writeSafetyOfRoute = (route: string): WriteSafety => {
  const options = octokitRouteOptions(route);
  return "method" in options && S.is(NonIdempotentMethod)(Str.toUpperCase(options.method))
    ? WriteSafety.Enum["non-idempotent"]
    : WriteSafety.Enum.idempotent;
};

const MUTATION_OPERATION = /(?:^|\})(?:\s|#[^\n]*\n)*mutation\b/u;

const writeSafetyOfDocument = (document: string): WriteSafety =>
  MUTATION_OPERATION.test(document) ? WriteSafety.Enum["non-idempotent"] : WriteSafety.Enum.idempotent;

const octokitRouteOptions = (route: string) => {
  const [methodOrUrl = "", url] = Str.split(route, " ");
  const normalized = Str.toUpperCase(methodOrUrl);
  return url !== undefined && Str.isNonEmpty(url)
    ? { method: S.is(RequestMethod)(normalized) ? normalized : methodOrUrl, url }
    : { url: methodOrUrl };
};

const requestOptions = (params: Record<string, unknown>) =>
  P.isObjectKeyword(params.request) && !P.isFunction(params.request) ? params.request : {};

const callerFetchOf = (params: Record<string, unknown>): typeof globalThis.fetch | undefined => {
  const options = requestOptions(params);
  return P.hasProperty(options, "fetch") && S.is(FetchFunction)(options.fetch) ? options.fetch : undefined;
};

const withRequestOptions: {
  (params: Record<string, unknown>, extra: Record<string, unknown>): Record<string, unknown>;
  (extra: Record<string, unknown>): (params: Record<string, unknown>) => Record<string, unknown>;
} = dual(
  2,
  (params: Record<string, unknown>, extra: Record<string, unknown>): Record<string, unknown> => ({
    ...params,
    request: { ...requestOptions(params), ...extra },
  })
);

const readThrownHeaders = (error: unknown): Record<string, unknown> | undefined => {
  if (!P.isObject(error)) return undefined;
  const response = error.response;
  const headers = P.isObject(response) ? response.headers : undefined;
  if (A.isArray(headers)) return undefined;
  if (P.isObject(headers)) return headers;
  return P.isObject(error.headers) ? error.headers : undefined;
};
