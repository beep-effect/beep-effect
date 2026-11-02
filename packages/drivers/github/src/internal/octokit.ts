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
import * as Effect from "effect/Effect";
import { constVoid, dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitHubError, readRateLimitHeaders } from "../GitHubError.ts";
import { GitHubGraphQLError } from "../GraphQL.ts";
import { RateLimitSnapshot, RetryPolicy } from "../Resilience.ts";
import type { OctokitResponse } from "@octokit/types";
import type { RetryableFailure } from "../Resilience.ts";
import type { PageSource } from "./paginate.ts";

const $I = $GithubId.create("internal/octokit");

const RequestMethod = LiteralKit(["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"]).pipe(
  $I.annoteSchema("RequestMethod", { description: "The standard GitHub REST request methods." })
);

/**
 * A replacement for the global `fetch`, kept as the function it is.
 *
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
 * Configures transport authentication, retry behavior and HTTP overrides.
 *
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
  }).pipe(
    $I.annoteSchema("TransportOptions", {
      description: "Transport authentication, retry behavior and HTTP overrides.",
    })
  )
) {}

/**
 * Companion types for {@link TransportOptions}.
 *
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
const makeOctokit = (options: TransportOptions.Encoded): Octokit =>
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
  const policy = options.retry;

  const record = (headers: Readonly<Record<string, unknown>> | undefined): Effect.Effect<void> => {
    const parsed = O.flatMap(readRateLimitHeaders(headers), S.decodeUnknownOption(RateLimitSnapshot));
    return O.isNone(parsed) ? Effect.void : Ref.set(snapshot, parsed);
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
  const attempt: {
    <A, E>(
      call: (signal: AbortSignal) => Promise<A>,
      classify: (error: unknown, nowMillis: number) => E
    ): Effect.Effect<A, E>;
    <A, E>(
      classify: (error: unknown, nowMillis: number) => E
    ): (call: (signal: AbortSignal) => Promise<A>) => Effect.Effect<A, E>;
  } = dual(
    2,
    <A, E>(
      call: (signal: AbortSignal) => Promise<A>,
      classify: (error: unknown, nowMillis: number) => E
    ): Effect.Effect<A, E> =>
      Effect.tryPromise({ try: call, catch: (error) => TransportFailure.make({ error }) }).pipe(
        Effect.catch(
          Effect.fnUntraced(function* ({ error }) {
            const now = yield* Clock.currentTimeMillis;
            yield* record(readThrownHeaders(error));
            return yield* Effect.fail(classify(error, now));
          })
        )
      )
  );

  // A write GitHub may already have applied (a POST or PATCH, or a GraphQL mutation) is retried only
  // when GitHub refused it before doing anything, a rate limit; an ambiguous transport failure fails
  // at once instead of risking a second comment, reply or object. Reads and idempotent writes keep
  // the full policy.
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
          (signal) => octokit.request<A>({ ...routeOptions(route), ...withSignal(params, signal) }),
          (error, now) => GitHubError.fromOctokit(operation, error, now)
        ).pipe(Effect.tap((response) => record(response.headers)))
      )
  );

  const pageSource: Transport["pageSource"] = dual(
    3,
    <A>(operation: string, route: string, params: Record<string, unknown>): PageSource<A> => {
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
                    return record(response.headers).pipe(Effect.as(O.some(response.data)));
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
          (signal) => octokit.graphql<unknown>(document, withSignal(variables, signal)),
          (error, now) => GitHubGraphQLError.fromThrowable(operation, error, now)
        )
      )
  );

  return { request, pageSource, graphql, rateLimit: Ref.get(snapshot) };
});

/** Whether a request may be repeated without repeating its effect on GitHub. */
const WriteSafety = LiteralKit(["idempotent", "non-idempotent"]);
type WriteSafety = typeof WriteSafety.Type;

const NonIdempotentMethod = LiteralKit(["POST", "PATCH"]);

/** A REST route's write safety, from the method Octokit would send (GET when the route names none). */
const writeSafetyOfRoute = (route: string): WriteSafety => {
  const options = routeOptions(route);
  return "method" in options && S.is(NonIdempotentMethod)(Str.toUpperCase(options.method))
    ? WriteSafety.Enum["non-idempotent"]
    : WriteSafety.Enum.idempotent;
};

/**
 * A GraphQL document's write safety: a mutation operation, first or after a fragment, is not
 * idempotent; a query is.
 */
const writeSafetyOfDocument = (document: string): WriteSafety =>
  /(?:^|\})(?:\s|#[^\n]*\n)*mutation\b/u.test(document)
    ? WriteSafety.Enum["non-idempotent"]
    : WriteSafety.Enum.idempotent;

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
const withSignal: {
  (params: Record<string, unknown>, signal: AbortSignal): Record<string, unknown>;
  (signal: AbortSignal): (params: Record<string, unknown>) => Record<string, unknown>;
} = dual(
  2,
  (params: Record<string, unknown>, signal: AbortSignal): Record<string, unknown> => ({
    ...params,
    request: { ...requestOptions(params), signal },
  })
);

/** Response headers off a throwable, when it carried any. */
const readThrownHeaders = (error: unknown): Record<string, unknown> | undefined => {
  if (!P.isObject(error)) return undefined;
  const response = error.response;
  const headers = P.isObject(response) ? response.headers : undefined;
  if (A.isArray(headers)) return undefined;
  if (P.isObject(headers)) return headers;
  return P.isObject(error.headers) ? error.headers : undefined;
};
