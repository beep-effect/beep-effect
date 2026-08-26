/**
 * Shared, hand-authored HTTP transport transformer for gov/legal data drivers.
 *
 * Bundles the transport concerns — auth, rate-limit, retry, and an observable
 * rate-limit snapshot — onto native `effect/unstable/http` primitives
 * (`HttpClient.mapRequest`, `HttpClient.withRateLimiter`, `HttpClient.retryTransient`
 * with a jittered exponential `Schedule`). Incubated inside `@beep/govinfo` and
 * promoted here once a second driver (`@beep/ecfr`) consumed it — see this
 * package's README for the ≥2-consumer promotion record.
 *
 * The transformer never touches value-model decoding or `Context.Service` wiring;
 * those stay in each driver's hand-authored service. Response caching is layered
 * on top of this transformer at the operation level by each driver, keyed by the
 * decoded request so repeats are served without a second round-trip.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ApiTransportId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { O } from "@beep/utils";
import { Effect, Number as N, Redacted, Ref, Schedule } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as RateLimiter from "effect/unstable/persistence/RateLimiter";
import type * as Duration from "effect/Duration";
import type * as Headers from "effect/unstable/http/Headers";

const $I = $ApiTransportId.create("Transport");

/**
 * Auth strategy attached to each outgoing request by the shared transformer.
 *
 * **Details**
 *
 * Covers the three gov/legal auth families plus the keyless case:
 * `ApiKeyQueryAuth` (api.data.gov `api_key` query param — GovInfo/DOL by data.gov),
 * `TokenHeaderAuth` (`Authorization: Token <key>` — CourtListener, DRF token auth),
 * `ApiKeyHeaderAuth` (agency-native `X-API-KEY` — DOL), and `NoAuth` (eCFR/FedReg).
 * Only the query-param and keyless branches are exercised in P0–P1; the header
 * branches are designed in but not verified until the P2 authed drivers.
 *
 * **Example** (Create ApiKeyQueryAuth instance)
 *
 * ```ts
 * import { ApiAuth } from "@beep/api-transport"
 * import * as Redacted from "effect/Redacted"
 *
 * const auth = ApiAuth.ApiKeyQueryAuth({ param: "api_key", key: Redacted.make("secret") })
 * console.log(auth._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ApiAuth = S.TaggedUnion({
  NoAuth: {},
  ApiKeyQueryAuth: {
    key: S.Redacted(S.String),
    param: S.String,
  },
  TokenHeaderAuth: {
    key: S.Redacted(S.String),
  },
  ApiKeyHeaderAuth: {
    header: S.String,
    key: S.Redacted(S.String),
  },
}).pipe(
  SchemaUtils.withStatics((schema) => ({
    NoAuth: () => schema.cases.NoAuth.make({}),
    ApiKeyQueryAuth: (fields: { readonly key: Redacted.Redacted<string>; readonly param: string }) =>
      schema.cases.ApiKeyQueryAuth.make(fields),
    TokenHeaderAuth: (fields: { readonly key: Redacted.Redacted<string> }) => schema.cases.TokenHeaderAuth.make(fields),
    ApiKeyHeaderAuth: (fields: { readonly header: string; readonly key: Redacted.Redacted<string> }) =>
      schema.cases.ApiKeyHeaderAuth.make(fields),
    $is:
      <Tag extends (typeof schema)["Type"]["_tag"]>(tag: Tag) =>
      (value: unknown): value is Extract<(typeof schema)["Type"], { readonly _tag: Tag }> =>
        P.isTagged(tag)(value),
    $match: schema.match,
  })),
  $I.annoteSchema("ApiAuth", {
    description: "Authentication strategy attached to requests made by the shared API transport.",
  })
);

/**
 * Runtime authentication strategy represented by {@link ApiAuth}.
 *
 * **Example** (Type NoAuth as ApiAuth)
 *
 * ```ts
 * import { ApiAuth } from "@beep/api-transport"
 *
 * const auth: ApiAuth = ApiAuth.NoAuth()
 * console.log(auth._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ApiAuth = typeof ApiAuth.Type;

const applyAuth =
  (auth: ApiAuth) =>
  (request: HttpClientRequest.HttpClientRequest): HttpClientRequest.HttpClientRequest =>
    ApiAuth.match(auth, {
      ApiKeyHeaderAuth: ({ header, key }) => HttpClientRequest.setHeader(request, header, Redacted.value(key)),
      ApiKeyQueryAuth: ({ key, param }) => HttpClientRequest.setUrlParam(request, param, Redacted.value(key)),
      NoAuth: () => request,
      TokenHeaderAuth: ({ key }) =>
        HttpClientRequest.setHeader(request, "Authorization", `Token ${Redacted.value(key)}`),
    });

const rateLimitHeaderNumberPattern = /-?\d+(?:\.\d+)?/;

const parseHeaderNumber = (raw: string): O.Option<number> =>
  O.filter(
    O.flatMap(
      O.flatMap(Str.match(rateLimitHeaderNumberPattern)(raw), (match) => O.fromUndefinedOr(match[0])),
      N.parse
    ),
    S.is(S.Finite)
  );

const parseNumberHeader = (headers: Headers.Headers, ...keys: ReadonlyArray<string>): O.Option<number> =>
  O.flatten(
    A.findFirst(
      A.map(keys, (key) => O.flatMap(O.fromUndefinedOr(headers[key]), parseHeaderNumber)),
      O.isSome
    )
  );

const fromRateLimitHeaders = (headers: Headers.Headers): O.Option<RateLimitSnapshot> => {
  const limit = parseNumberHeader(headers, "x-ratelimit-limit", "ratelimit-limit");
  const remaining = parseNumberHeader(headers, "x-ratelimit-remaining", "ratelimit-remaining");
  const reset = parseNumberHeader(headers, "x-ratelimit-reset", "ratelimit-reset", "x-ratelimit-reset-after");

  return O.map(A.findFirst([limit, remaining, reset], O.isSome), () =>
    RateLimitSnapshot.make(O.getSomesStruct({ limit, remaining, reset }))
  );
};

/**
 * Observable snapshot of the latest parsed `X-RateLimit-*` response headers.
 *
 * **Details**
 *
 * The shared transformer records this after every completed response so callers
 * (and offline tests) can observe that rate-limit headers were honored, without
 * reaching into the native limiter's private state.
 *
 * **Example** (Make RateLimitSnapshot values)
 *
 * ```ts
 * import { RateLimitSnapshot } from "@beep/api-transport"
 *
 * const snapshot = RateLimitSnapshot.make({ limit: 1000, remaining: 999 })
 * console.log(snapshot.remaining)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RateLimitSnapshot extends S.Class<RateLimitSnapshot>($I`RateLimitSnapshot`)(
  {
    limit: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("RateLimitSnapshot.limit", {
        description: "Latest rate-limit ceiling reported by the upstream response headers.",
        examples: [1000],
      })
    ),
    remaining: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("RateLimitSnapshot.remaining", {
        description: "Latest remaining request count reported by the upstream response headers.",
        examples: [42],
      })
    ),
    reset: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("RateLimitSnapshot.reset", {
        description: "Latest reset delay or epoch reported by the upstream response headers.",
        examples: [60],
      })
    ),
  },
  $I.annote("RateLimitSnapshot", {
    description: "Latest parsed X-RateLimit-* response headers observed by the shared transport transformer.",
  })
) {
  static readonly fromHeaders = fromRateLimitHeaders;
}

const ApiTransportDurationNumber = S.declare<number>(P.isNumber, {
  identifier: $I`ApiTransportDurationNumber`,
  title: "API Transport Duration Number",
  description: "A JavaScript number, including the special values accepted by Effect duration inputs.",
});

const ApiTransportDurationObject = S.Struct({
  weeks: S.optional(ApiTransportDurationNumber),
  days: S.optional(ApiTransportDurationNumber),
  hours: S.optional(ApiTransportDurationNumber),
  minutes: S.optional(ApiTransportDurationNumber),
  seconds: S.optional(ApiTransportDurationNumber),
  milliseconds: S.optional(ApiTransportDurationNumber),
  microseconds: S.optional(ApiTransportDurationNumber),
  nanoseconds: S.optional(ApiTransportDurationNumber),
});

type ApiTransportDurationString = Extract<Duration.Input, string>;

const apiTransportDurationStringPattern =
  /^(-?\d+(?:\.\d+)?)\s+(nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks?)$/;

const ApiTransportDurationString = S.declare(
  (input: unknown): input is ApiTransportDurationString =>
    P.isString(input) &&
    (input === "Infinity" || input === "-Infinity" || O.isSome(Str.match(apiTransportDurationStringPattern)(input)))
).pipe(
  $I.annoteSchema("ApiTransportDurationString", {
    description: "A duration string accepted by Effect, including signed fractions, leading zeros, and infinities.",
  })
);

const ApiTransportDurationInput = S.Union([
  S.Duration,
  ApiTransportDurationNumber,
  S.BigInt,
  S.Tuple([ApiTransportDurationNumber, ApiTransportDurationNumber]),
  ApiTransportDurationString,
  ApiTransportDurationObject,
]).pipe(
  $I.annoteSchema("ApiTransportDurationInput", {
    description: "Every duration input shape accepted by Effect transport scheduling and rate limiting.",
  })
);

/**
 * Options accepted by {@link makeApiTransport}.
 *
 * **Details**
 *
 * `auth` selects the auth family, `key` is the rate-limit bucket key, and
 * `rateLimit` seeds the initial window/limit (the native limiter refines these
 * from response headers). `retryTimes`/`retryBaseDelay` tune the jittered
 * exponential retry over transient transport errors.
 *
 * **Example** (Build ApiTransportOptions object)
 *
 * ```ts
 * import { ApiAuth, type ApiTransportOptions } from "@beep/api-transport"
 *
 * const options: ApiTransportOptions = {
 *   auth: ApiAuth.NoAuth(),
 *   key: "govinfo",
 *   rateLimit: { limit: 1000, window: "1 hour" },
 * }
 *
 * console.log(options.key)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiTransportOptions extends S.Class<ApiTransportOptions>($I`ApiTransportOptions`)(
  {
    auth: ApiAuth.pipe(
      $I.annoteKey("ApiTransportOptions.auth", {
        description: "Authentication strategy attached to every outgoing request.",
      })
    ),
    key: S.String.pipe(
      $I.annoteKey("ApiTransportOptions.key", {
        description: "Stable key used to identify the transport's rate-limit bucket.",
      })
    ),
    rateLimit: S.Struct({
      limit: ApiTransportDurationNumber.pipe(
        $I.annoteKey("ApiTransportOptions.rateLimit.limit", {
          description: "Initial maximum number of requests permitted in the configured window.",
        })
      ),
      window: ApiTransportDurationInput.pipe(
        $I.annoteKey("ApiTransportOptions.rateLimit.window", {
          description: "Initial rate-limit window accepted by Effect's duration APIs.",
        })
      ),
    }),
    retryBaseDelay: S.optional(ApiTransportDurationInput).pipe(
      $I.annoteKey("ApiTransportOptions.retryBaseDelay", {
        description: "Optional base delay for the jittered exponential retry schedule.",
      })
    ),
    retryTimes: S.optional(ApiTransportDurationNumber).pipe(
      $I.annoteKey("ApiTransportOptions.retryTimes", {
        description: "Optional maximum number of transient transport retries.",
      })
    ),
  },
  $I.annote("ApiTransportOptions", {
    description: "Authentication, rate-limit, and retry options for the shared API transport.",
  })
) {}

/**
 * The shared transport transformer plus its observable rate-limit accessor.
 *
 * **Details**
 *
 * `transformClient` is fed to `HttpApiClient.make`'s `transformClient` seam
 * (keyed drivers) or applied to a raw `HttpClient` alongside `HttpClient.mapRequest`
 * (keyless drivers). `rateLimit` reads the latest {@link RateLimitSnapshot}.
 *
 * **Example** (Read rate-limit from transport)
 *
 * ```ts import.meta.vitest name="Read rate-limit from transport"
 * import { Effect } from "effect"
 * import * as RateLimiter from "effect/unstable/persistence/RateLimiter"
 * import { ApiAuth, type ApiTransport, makeApiTransport } from "@beep/api-transport"
 *
 * const readSnapshot = (transport: ApiTransport) => transport.rateLimit
 *
 * const program = Effect.gen(function* () {
 *   const transport = yield* makeApiTransport({
 *     auth: ApiAuth.NoAuth(),
 *     key: "example",
 *     rateLimit: { limit: 1000, window: "1 hour" },
 *   })
 *   return yield* readSnapshot(transport)
 * }).pipe(Effect.provide(RateLimiter.layerStoreMemory))
 *
 * void program
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ApiTransport {
  readonly rateLimit: Effect.Effect<O.Option<RateLimitSnapshot>>;
  readonly transformClient: (client: HttpClient.HttpClient) => HttpClient.HttpClient;
}

/**
 * Build the shared transport transformer over a backing `RateLimiterStore`.
 *
 * **Details**
 *
 * Composes auth → native rate limiting (which parses `X-RateLimit-*` and retries
 * `429`) → jittered exponential retry of transient transport errors → an
 * observable rate-limit snapshot. The resulting `transformClient` preserves the
 * `HttpClient.HttpClient` shape: the (in-memory-store) `RateLimiterError` is an
 * unrecoverable defect rather than a widened error channel.
 *
 * **Example** (Build transport transformClient)
 *
 * ```ts import.meta.vitest name="Build transport transformClient"
 * import { Effect } from "effect"
 * import * as RateLimiter from "effect/unstable/persistence/RateLimiter"
 * import { ApiAuth, makeApiTransport } from "@beep/api-transport"
 *
 * const program = Effect.gen(function* () {
 *   const transport = yield* makeApiTransport({
 *     auth: ApiAuth.NoAuth(),
 *     key: "example",
 *     rateLimit: { limit: 1000, window: "1 hour" },
 *   })
 *   return transport.transformClient
 * }).pipe(Effect.provide(RateLimiter.layerStoreMemory))
 *
 * void program
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeApiTransport = Effect.fnUntraced(function* (options: ApiTransportOptions) {
  const limiter = yield* RateLimiter.make;
  const snapshotRef = yield* Ref.make(O.none<RateLimitSnapshot>());
  const retrySchedule = Schedule.jittered(Schedule.exponential(options.retryBaseDelay ?? "200 millis"));
  const attachAuth = applyAuth(options.auth);

  const recordSnapshot = (response: { readonly headers: Headers.Headers }): Effect.Effect<void> =>
    O.match(RateLimitSnapshot.fromHeaders(response.headers), {
      onNone: () => Effect.void,
      onSome: (snapshot) => Ref.set(snapshotRef, O.some(snapshot)),
    });

  const transformClient = (client: HttpClient.HttpClient): HttpClient.HttpClient =>
    client.pipe(
      HttpClient.mapRequest(attachAuth),
      HttpClient.withRateLimiter({
        key: options.key,
        limit: options.rateLimit.limit,
        limiter,
        window: options.rateLimit.window,
      }),
      HttpClient.catchTag("RateLimiterError", Effect.die),
      HttpClient.retryTransient({
        retryOn: "errors-only",
        schedule: retrySchedule,
        times: options.retryTimes ?? 3,
      }),
      HttpClient.tap(recordSnapshot)
    );

  return { rateLimit: Ref.get(snapshotRef), transformClient } satisfies ApiTransport;
});
