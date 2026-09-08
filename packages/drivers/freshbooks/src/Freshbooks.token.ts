/**
 * FreshBooks OAuth token helper with single-refresh-owner rotation.
 *
 * FreshBooks refresh tokens are single-use: every token exchange returns a new
 * access token **and a new refresh token**, and all prior refresh tokens are
 * immediately invalidated (see the P0 spike report). Rotation is therefore a
 * serialization problem, not merely a persistence one — two fibers presenting
 * the same refresh token strand one of them.
 *
 * {@link FreshbooksAuth} makes that misuse unrepresentable: every token
 * exchange runs behind a one-permit {@link Semaphore}, and the refresh path
 * re-reads the persisted token inside the critical section before deciding to
 * hit the network. Queued fibers that arrive after a rotation observe the
 * freshly persisted token and skip the network call, so a consumed refresh
 * token is never replayed. The rotated token is persisted to the
 * {@link FreshbooksTokenStore} before the permit is released.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FreshbooksId } from "@beep/identity";
import { O } from "@beep/utils";
import { Clock, Context, Effect, Layer, pipe, Redacted, Ref, Semaphore } from "effect";
import * as S from "effect/Schema";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { FreshbooksError } from "./Freshbooks.errors.ts";
import type * as HttpClient from "effect/unstable/http/HttpClient";
import type { ResolvedFreshbooksConfig } from "./Freshbooks.service.ts";

const $I = $FreshbooksId.create("Freshbooks.token");

/**
 * Clock skew margin: a token within this window of expiry is treated as
 * already expired so a refresh happens before a call can fail mid-flight.
 *
 * **Example** (Log the skew margin)
 *
 * ```ts
 * import { FRESHBOOKS_TOKEN_SKEW_MILLIS } from "@beep/freshbooks"
 *
 * console.log(FRESHBOOKS_TOKEN_SKEW_MILLIS) // 60000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FRESHBOOKS_TOKEN_SKEW_MILLIS = 60_000;

/**
 * Decoded FreshBooks OAuth token endpoint response.
 *
 * **Example** (Decode token response)
 *
 * ```ts
 * import { FreshbooksTokenResponse } from "@beep/freshbooks"
 * import { Redacted } from "effect"
 * import * as S from "effect/Schema"
 *
 * const token = S.decodeUnknownSync(FreshbooksTokenResponse)({
 *   access_token: "access",
 *   token_type: "Bearer",
 *   expires_in: 43200,
 *   refresh_token: "refresh"
 * })
 *
 * console.log(token.expires_in) // 43200
 * console.log(Redacted.value(token.access_token)) // "access"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FreshbooksTokenResponse extends S.Class<FreshbooksTokenResponse>($I`FreshbooksTokenResponse`)(
  {
    access_token: S.String.pipe(S.RedactedFromValue).annotateKey({
      description: "Redacted bearer access token.",
    }),
    token_type: S.optionalKey(S.String).annotateKey({
      description: "Token type, always Bearer.",
    }),
    expires_in: S.Int.annotateKey({
      description: "Access-token lifetime in seconds.",
    }),
    refresh_token: S.String.pipe(S.RedactedFromValue).annotateKey({
      description: "Redacted single-use refresh token.",
    }),
    scope: S.optionalKey(S.String).annotateKey({
      description: "Granted scope string.",
    }),
    created_at: S.optionalKey(S.Int).annotateKey({
      description: "Token issuance time in epoch seconds.",
    }),
  },
  $I.annote("FreshbooksTokenResponse", {
    description: "Decoded FreshBooks OAuth token endpoint response.",
  })
) {}

const decodeTokenResponse = S.decodeUnknownEffect(FreshbooksTokenResponse);

/**
 * Persisted FreshBooks token state, including the absolute access-token expiry
 * in epoch milliseconds computed at issuance.
 *
 * **Example** (Make stored token)
 *
 * ```ts
 * import { FreshbooksStoredToken } from "@beep/freshbooks"
 * import { Redacted } from "effect"
 *
 * const stored = FreshbooksStoredToken.make({
 *   accessToken: Redacted.make("access"),
 *   refreshToken: Redacted.make("refresh"),
 *   expiresAt: 1_700_000_000_000
 * })
 *
 * console.log(stored.expiresAt) // 1700000000000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FreshbooksStoredToken extends S.Class<FreshbooksStoredToken>($I`FreshbooksStoredToken`)(
  {
    accessToken: S.String.pipe(S.RedactedFromValue).annotateKey({
      description: "Redacted bearer access token.",
    }),
    refreshToken: S.String.pipe(S.RedactedFromValue).annotateKey({
      description: "Redacted single-use refresh token most recently issued.",
    }),
    expiresAt: S.Int.annotateKey({
      description: "Absolute access-token expiry in epoch milliseconds.",
    }),
    scope: S.optionalKey(S.String).annotateKey({
      description: "Granted scope string.",
    }),
  },
  $I.annote("FreshbooksStoredToken", {
    description: "Persisted FreshBooks token state with absolute expiry.",
  })
) {}

/**
 * Persistence boundary for the rotated FreshBooks token. Runtime deployments
 * back this with the recorded 1Password reference; tests back it with an
 * in-memory {@link FreshbooksTokenStore.layerMemory}. The store's `write` must
 * be atomic: the auth service persists the rotated token through it before
 * releasing the refresh permit.
 *
 * **Example** (Read from a seeded memory store)
 *
 * ```ts
 * import { FreshbooksStoredToken, FreshbooksTokenStore } from "@beep/freshbooks"
 * import { Effect, Redacted } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const store = yield* FreshbooksTokenStore
 *   return yield* store.read
 * }).pipe(
 *   Effect.provide(
 *     FreshbooksTokenStore.layerMemory(
 *       FreshbooksStoredToken.make({
 *         accessToken: Redacted.make("a"),
 *         refreshToken: Redacted.make("r"),
 *         expiresAt: 0
 *       })
 *     )
 *   )
 * )
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FreshbooksTokenStore extends Context.Service<FreshbooksTokenStore, FreshbooksTokenStoreShape>()(
  $I`FreshbooksTokenStore`
) {
  /**
   * In-memory token store seeded with an optional initial token. Intended for
   * tests and the concurrent-refresh proof.
   *
   * **Example** (Empty memory store)
   *
   * ```ts
   * import { FreshbooksTokenStore } from "@beep/freshbooks"
   *
   * console.log(FreshbooksTokenStore.layerMemory())
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerMemory = (initial?: FreshbooksStoredToken): Layer.Layer<FreshbooksTokenStore> =>
    Layer.effect(
      FreshbooksTokenStore,
      Effect.gen(function* () {
        const ref = yield* Ref.make<O.Option<FreshbooksStoredToken>>(O.fromUndefinedOr(initial));
        return FreshbooksTokenStore.of({
          read: Ref.get(ref),
          write: Effect.fn("FreshbooksTokenStore.write")(function* (token) {
            yield* Ref.set(ref, O.some(token));
          }),
        });
      })
    );
}

/**
 * Shape of {@link FreshbooksTokenStore}.
 *
 * **Example** (Satisfy the store shape)
 *
 * ```ts
 * import { type FreshbooksTokenStoreShape } from "@beep/freshbooks"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const store = {
 *   read: Effect.succeed(O.none()),
 *   write: () => Effect.void
 * } satisfies FreshbooksTokenStoreShape
 *
 * console.log(store)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type FreshbooksTokenStoreShape = {
  readonly read: Effect.Effect<O.Option<FreshbooksStoredToken>, FreshbooksError>;
  readonly write: (token: FreshbooksStoredToken) => Effect.Effect<void, FreshbooksError>;
};

/**
 * Public shape of {@link FreshbooksAuth}.
 *
 * **Example** (Read a bearer token from the service)
 *
 * ```ts
 * import { FreshbooksAuth } from "@beep/freshbooks"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const auth = yield* FreshbooksAuth
 *   return yield* auth.accessToken
 * })
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type FreshbooksAuthShape = {
  readonly accessToken: Effect.Effect<Redacted.Redacted<string>, FreshbooksError>;
  readonly refresh: Effect.Effect<Redacted.Redacted<string>, FreshbooksError>;
  readonly exchangeCode: (code: string) => Effect.Effect<FreshbooksStoredToken, FreshbooksError>;
  readonly authorizeUrl: (state?: string) => string;
};

const tokenEndpoint = (config: ResolvedFreshbooksConfig): string => `${config.apiUrl}/auth/oauth/token`;

const toStored = (response: FreshbooksTokenResponse, now: number): FreshbooksStoredToken =>
  FreshbooksStoredToken.make({
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: now + response.expires_in * 1_000,
    ...O.getSomesStruct({ scope: O.fromUndefinedOr(response.scope) }),
  });

const isFresh = (token: FreshbooksStoredToken, now: number): boolean =>
  token.expiresAt - FRESHBOOKS_TOKEN_SKEW_MILLIS > now;

const callTokenEndpoint = Effect.fn("callTokenEndpoint")(function* (
  client: HttpClient.HttpClient,
  config: ResolvedFreshbooksConfig,
  grant: Record<string, string>
) {
  const url = tokenEndpoint(config);
  const request = yield* pipe(
    HttpClientRequest.post(url),
    HttpClientRequest.accept("application/json"),
    HttpClientRequest.setHeaders(config.headers),
    (base) =>
      HttpClientRequest.bodyJson(base, {
        client_id: config.clientId,
        client_secret: Redacted.value(config.clientSecret),
        redirect_uri: config.redirectUri,
        ...grant,
      }),
    Effect.mapError((cause) => FreshbooksError.fromReason("request encoding", { cause, resource: "oauth/token", url }))
  );
  const response = yield* client
    .execute(request)
    .pipe(Effect.mapError((cause) => FreshbooksError.fromReason("transport", { cause, resource: "oauth/token", url })));
  if (response.status < 200 || response.status >= 300) {
    return yield* FreshbooksError.fromReason("token refresh", {
      resource: "oauth/token",
      status: response.status,
      url,
    });
  }
  const body = yield* response.json.pipe(
    Effect.mapError((cause) => FreshbooksError.fromReason("response decoding", { cause, resource: "oauth/token", url }))
  );
  return yield* decodeTokenResponse(body).pipe(
    Effect.mapError((cause) => FreshbooksError.fromReason("response decoding", { cause, resource: "oauth/token", url }))
  );
});

/**
 * Build a {@link FreshbooksAuth} service value from its dependencies.
 *
 * **Details**
 *
 * The refresh permit is created once per service instance, so the single
 * refresh owner is scoped to one layer instance. This is the intended
 * deployment shape: provide exactly one FreshBooks driver layer per runtime
 * (Effect layers are memoized singletons), and every fiber sharing that layer
 * shares the one permit and the one {@link FreshbooksTokenStore}, so the
 * single-owner guarantee holds process-wide. Two independent layers (or two
 * processes) would each hold their own permit; cross-process single-ownership
 * is the token store's responsibility, not this permit's — back it with a
 * store whose `write` is atomic and whose reads reflect the latest rotation.
 *
 * **Example** (Reference the constructor)
 *
 * ```ts
 * import { makeFreshbooksAuth } from "@beep/freshbooks"
 *
 * console.log(typeof makeFreshbooksAuth) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeFreshbooksAuth = Effect.fn("Freshbooks.makeAuth")(function* (
  client: HttpClient.HttpClient,
  config: ResolvedFreshbooksConfig,
  store: FreshbooksTokenStoreShape
): Effect.fn.Return<FreshbooksAuthShape, never> {
  const permit = yield* Semaphore.make(1);

  const rotate = Effect.fn("Freshbooks.rotate")(function* (grant: Record<string, string>) {
    const now = yield* Clock.currentTimeMillis;
    const response = yield* callTokenEndpoint(client, config, grant);
    const stored = toStored(response, now);
    // A write failure here is a stranded rotation: FreshBooks has already
    // consumed the old single-use refresh token and issued this replacement,
    // so a persistence failure means the new token is lost and the caller must
    // re-authorize. Surface it as `token refresh` regardless of the store's own
    // failure reason so callers do not retry the now-invalid credential.
    yield* store
      .write(stored)
      .pipe(
        Effect.mapError((error) =>
          FreshbooksError.fromReason("token refresh", { cause: error, resource: "oauth/token/persist" })
        )
      );
    return stored;
  });

  // Refresh-if-stale, used by `accessToken`: re-reads the store inside the
  // critical section so queued fibers observe a token another owner already
  // rotated and skip the network call.
  const refreshLocked: Effect.Effect<FreshbooksStoredToken, FreshbooksError> = permit.withPermit(
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const current = yield* store.read;
      return yield* O.match(current, {
        onNone: () => FreshbooksError.failFromReason("token refresh"),
        onSome: (token) =>
          isFresh(token, now)
            ? Effect.succeed(token)
            : rotate({ grant_type: "refresh_token", refresh_token: Redacted.value(token.refreshToken) }),
      });
    })
  );

  // Force a rotation regardless of recorded expiry, for the revoked/rejected
  // token case where the stored token still looks fresh. Serialized through the
  // same one-permit owner.
  const forceRefresh: Effect.Effect<FreshbooksStoredToken, FreshbooksError> = permit.withPermit(
    Effect.gen(function* () {
      const current = yield* store.read;
      return yield* O.match(current, {
        onNone: () => FreshbooksError.failFromReason("token refresh"),
        onSome: (token) => rotate({ grant_type: "refresh_token", refresh_token: Redacted.value(token.refreshToken) }),
      });
    })
  );

  const accessToken: Effect.Effect<Redacted.Redacted<string>, FreshbooksError> = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const current = yield* store.read;
    const token = yield* O.match(current, {
      onNone: () => refreshLocked,
      onSome: (value) => (isFresh(value, now) ? Effect.succeed(value) : refreshLocked),
    });
    return token.accessToken;
  });

  return {
    accessToken,
    refresh: Effect.map(forceRefresh, (token) => token.accessToken),
    exchangeCode: (code) => permit.withPermit(rotate({ grant_type: "authorization_code", code })),
    authorizeUrl: (state) =>
      `${config.authUrl}/oauth/authorize/?response_type=code&redirect_uri=${encodeURIComponent(config.redirectUri)}&client_id=${config.clientId}${
        state === undefined ? "" : `&state=${encodeURIComponent(state)}`
      }`,
  };
});

/**
 * Effect service that owns FreshBooks token acquisition and single-use
 * refresh-token rotation.
 *
 * **Example** (Read the token-store type)
 *
 * ```ts
 * import { FreshbooksAuth } from "@beep/freshbooks"
 *
 * console.log(FreshbooksAuth.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FreshbooksAuth extends Context.Service<FreshbooksAuth, FreshbooksAuthShape>()($I`FreshbooksAuth`) {}
