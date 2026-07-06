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
import { O } from "@beep/utils";
import { Data, Effect, Redacted, Ref, Schedule } from "effect";
import * as A from "effect/Array";
import * as N from "effect/Number";
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
 * Covers the three gov/legal auth families plus the keyless case:
 * `ApiKeyQueryAuth` (api.data.gov `api_key` query param — GovInfo/DOL by data.gov),
 * `TokenHeaderAuth` (`Authorization: Token <key>` — CourtListener, DRF token auth),
 * `ApiKeyHeaderAuth` (agency-native `X-API-KEY` — DOL), and `NoAuth` (eCFR/FedReg).
 * Only the query-param and keyless branches are exercised in P0–P1; the header
 * branches are designed in but not verified until the P2 authed drivers.
 *
 * @example
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
export type ApiAuth = Data.TaggedEnum<{
  NoAuth: {};
  ApiKeyQueryAuth: { readonly param: string; readonly key: Redacted.Redacted<string> };
  TokenHeaderAuth: { readonly key: Redacted.Redacted<string> };
  ApiKeyHeaderAuth: { readonly header: string; readonly key: Redacted.Redacted<string> };
}>;

/**
 * Constructors and matchers for {@link ApiAuth}.
 *
 * @example
 * ```ts
 * import { ApiAuth } from "@beep/api-transport"
 *
 * console.log(ApiAuth.NoAuth()._tag)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ApiAuth = Data.taggedEnum<ApiAuth>();

const applyAuth =
  (auth: ApiAuth) =>
  (request: HttpClientRequest.HttpClientRequest): HttpClientRequest.HttpClientRequest =>
    ApiAuth.$match(auth, {
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
 * The shared transformer records this after every completed response so callers
 * (and offline tests) can observe that rate-limit headers were honored, without
 * reaching into the native limiter's private state.
 *
 * @example
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

/**
 * Options accepted by {@link makeApiTransport}.
 *
 * `auth` selects the auth family, `key` is the rate-limit bucket key, and
 * `rateLimit` seeds the initial window/limit (the native limiter refines these
 * from response headers). `retryTimes`/`retryBaseDelay` tune the jittered
 * exponential retry over transient transport errors.
 *
 * @example
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
export interface ApiTransportOptions {
  readonly auth: ApiAuth;
  readonly key: string;
  readonly rateLimit: { readonly limit: number; readonly window: Duration.Input };
  readonly retryBaseDelay?: Duration.Input | undefined;
  readonly retryTimes?: number | undefined;
}

/**
 * The shared transport transformer plus its observable rate-limit accessor.
 *
 * `transformClient` is fed to `HttpApiClient.make`'s `transformClient` seam
 * (keyed drivers) or applied to a raw `HttpClient` alongside `HttpClient.mapRequest`
 * (keyless drivers). `rateLimit` reads the latest {@link RateLimitSnapshot}.
 *
 * @example
 * ```ts
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
 * Composes auth → native rate limiting (which parses `X-RateLimit-*` and retries
 * `429`) → jittered exponential retry of transient transport errors → an
 * observable rate-limit snapshot. The resulting `transformClient` preserves the
 * `HttpClient.HttpClient` shape: the (in-memory-store) `RateLimiterError` is an
 * unrecoverable defect rather than a widened error channel.
 *
 * @example
 * ```ts
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
