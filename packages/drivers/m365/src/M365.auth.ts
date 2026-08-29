/**
 * Delegated Microsoft Graph token acquisition for the Microsoft 365 driver.
 *
 * Implements OAuth2 authorization-code + PKCE as a public client via
 * `@azure/msal-node` with silent refresh, optionally persisting the MSAL token
 * cache encrypted via `@azure/msal-node-extensions` when `tokenCachePath` is
 * configured (DPAPI / Keychain / libsecret).
 * Interactive redirect capture is injected by the host; the driver never owns a
 * loopback HTTP server.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $M365Id } from "@beep/identity";
import { getSomesStruct } from "@beep/utils/Option";
import { Context, Effect, Layer, pipe, Redacted } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ResolvedM365Config, resolveM365Config } from "./M365.config.ts";
import { M365Error } from "./M365.errors.ts";
import type {
  AccountInfo,
  AuthenticationResult,
  Configuration,
  CryptoProvider,
  PublicClientApplication,
} from "@azure/msal-node";
import type { M365ConfigInput } from "./M365.config.ts";

const $I = $M365Id.create("M365.auth");

type ICachePlugin = NonNullable<NonNullable<Configuration["cache"]>["cachePlugin"]>;

// Opaque MSAL handles are constructed in-process (via a dynamic import, so no
// static constructor exists for `S.instanceOf`) and never decoded from external
// input; a structural `S.declare` carries them through the runtime schema.
const CryptoProviderFromSelf = S.declare((u: unknown): u is CryptoProvider => P.isObject(u)).pipe(
  $I.annoteSchema("CryptoProviderFromSelf", {
    description: "In-process MSAL CryptoProvider handle carried through the auth runtime.",
  })
);

const PublicClientApplicationFromSelf = S.declare((u: unknown): u is PublicClientApplication => P.isObject(u)).pipe(
  $I.annoteSchema("PublicClientApplicationFromSelf", {
    description: "In-process MSAL PublicClientApplication handle carried through the auth runtime.",
  })
);

const InteractiveAuthorizerFromSelf = S.declare((u: unknown): u is M365InteractiveAuthorizer => P.isFunction(u)).pipe(
  $I.annoteSchema("InteractiveAuthorizerFromSelf", {
    description: "Host-supplied interactive authorizer function carried through the auth runtime.",
  })
);

class M365AuthRuntime extends S.Class<M365AuthRuntime>($I`M365AuthRuntime`)(
  {
    crypto: CryptoProviderFromSelf,
    interactiveAuthorizer: S.Option(InteractiveAuthorizerFromSelf),
    pca: PublicClientApplicationFromSelf,
    resolved: ResolvedM365Config,
  },
  $I.annote("M365AuthRuntime", {
    description:
      "In-process MSAL auth runtime: crypto provider, public client, resolved config, and optional host authorizer.",
  })
) {}

/**
 * Authorization request passed from the MSAL token provider to the host-owned
 * redirect-capture flow.
 *
 * **Example** (Make authorization request)
 *
 * ```ts
 * import { M365AuthorizationRequest } from "@beep/m365"
 *
 * const request = M365AuthorizationRequest.make({
 *   authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
 *   redirectUri: "http://127.0.0.1:3939/m365/oauth/callback"
 * })
 *
 * console.log(request.redirectUri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365AuthorizationRequest extends S.Class<M365AuthorizationRequest>($I`M365AuthorizationRequest`)(
  {
    authUrl: S.String.annotateKey({
      description: "MSAL authorization URL the host should open for the user.",
    }),
    redirectUri: S.String.annotateKey({
      description: "Redirect URI registered with Entra and captured by the host-owned authorizer.",
    }),
  },
  $I.annote("M365AuthorizationRequest", {
    description: "Interactive authorization request handed to the host-owned redirect-capture flow.",
  })
) {}

/**
 * Host-supplied interactive authorizer.
 *
 * **Details**
 *
 * The host owns browser opening and loopback/sidecar redirect capture, then
 * returns only the authorization code to the driver.
 *
 * **Example** (Implement interactive authorizer)
 *
 * ```ts
 * import { M365AuthorizationRequest } from "@beep/m365"
 * import type { M365InteractiveAuthorizer } from "@beep/m365"
 * import { Effect } from "effect"
 *
 * const authorizer: M365InteractiveAuthorizer = (request) => {
 *   console.log(new URL(request.authUrl).hostname)
 *   return Effect.succeed("authorization-code")
 * }
 *
 * const code = await Effect.runPromise(
 *   authorizer(
 *     M365AuthorizationRequest.make({
 *       authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
 *       redirectUri: "http://127.0.0.1:3939/m365/oauth/callback"
 *     })
 *   )
 * )
 *
 * console.log(code) // "authorization-code"
 * ```
 *
 * @effects
 * - Delegates browser opening or equivalent user navigation to the host.
 * - Captures the authorization redirect at the host-owned redirect URI.
 * - Returns only the authorization code; token exchange and token persistence
 *   stay inside {@link M365Auth}.
 * @category services
 * @since 0.0.0
 */
export type M365InteractiveAuthorizer = (req: M365AuthorizationRequest) => Effect.Effect<string, M365Error>;

const importMsalNode = Effect.tryPromise({
  try: () => import("@azure/msal-node"),
  catch: (cause) => M365Error.fromReason("config", { cause }),
});

const nullAuthenticationResultCause = { _tag: "NullAuthenticationResult" };
const ambiguousCachedAccountsCause = { _tag: "AmbiguousCachedAccounts" };

const requireAuthenticationResult = (
  result: AuthenticationResult | null
): Effect.Effect<AuthenticationResult, M365Error> =>
  pipe(
    O.fromNullishOr(result),
    O.match({
      onNone: () => M365Error.failEffectFromReason("auth", { cause: nullAuthenticationResultCause }),
      onSome: Effect.succeed,
    })
  );

const cachedAccount = (accounts: ReadonlyArray<AccountInfo>): Effect.Effect<O.Option<AccountInfo>, M365Error> =>
  A.length(accounts) > 1
    ? M365Error.failEffectFromReason("auth", { cause: ambiguousCachedAccountsCause })
    : Effect.succeed(A.head(accounts));

const buildCachePlugin = (resolved: ResolvedM365Config): Effect.Effect<O.Option<ICachePlugin>, M365Error> =>
  O.match(resolved.tokenCachePath, {
    onNone: () => Effect.succeed(O.none<ICachePlugin>()),
    onSome: (cachePath) =>
      Effect.tryPromise({
        try: () => import("@azure/msal-node-extensions"),
        catch: (cause) => M365Error.fromReason("config", { cause }),
      }).pipe(
        Effect.flatMap((Ext) =>
          Effect.tryPromise({
            try: () =>
              Ext.PersistenceCreator.createPersistence({
                accountName: "beep-m365-token-cache",
                cachePath,
                dataProtectionScope: Ext.DataProtectionScope.CurrentUser,
                serviceName: "beep-m365",
                usePlaintextFileOnLinux: false,
              }).then((persistence) => O.some<ICachePlugin>(new Ext.PersistenceCachePlugin(persistence))),
            catch: (cause) => M365Error.fromReason("config", { cause }),
          })
        )
      ),
  });

const interactiveAcquire = Effect.fnUntraced(function* (
  runtime: M365AuthRuntime
): Effect.fn.Return<AuthenticationResult, M365Error> {
  const authorizer = yield* pipe(
    runtime.interactiveAuthorizer,
    O.match({
      onNone: () => M365Error.failEffectFromReason("auth"),
      onSome: Effect.succeed,
    })
  );
  const pkce = yield* Effect.tryPromise({
    try: () => runtime.crypto.generatePkceCodes(),
    catch: (cause) => M365Error.fromReason("auth", { cause }),
  });
  const authUrl = yield* Effect.tryPromise({
    try: () =>
      runtime.pca.getAuthCodeUrl({
        codeChallenge: pkce.challenge,
        codeChallengeMethod: "S256",
        redirectUri: runtime.resolved.redirectUri,
        scopes: [...runtime.resolved.scopes],
      }),
    catch: (cause) => M365Error.fromReason("auth", { cause }),
  });
  const code = yield* authorizer(
    M365AuthorizationRequest.make({
      authUrl,
      redirectUri: runtime.resolved.redirectUri,
    })
  );
  return yield* Effect.tryPromise({
    try: () =>
      runtime.pca.acquireTokenByCode({
        code,
        codeVerifier: pkce.verifier,
        redirectUri: runtime.resolved.redirectUri,
        scopes: [...runtime.resolved.scopes],
      }),
    catch: (cause) => M365Error.fromReason("auth", { cause }),
  }).pipe(Effect.flatMap(requireAuthenticationResult));
});

const acquireToken = Effect.fn("M365Auth.acquireToken")(function* (
  runtime: M365AuthRuntime
): Effect.fn.Return<Redacted.Redacted<string>, M365Error> {
  const accounts = yield* Effect.tryPromise({
    try: () => runtime.pca.getTokenCache().getAllAccounts(),
    catch: (cause) => M365Error.fromReason("auth", { cause }),
  });
  const account = yield* cachedAccount(accounts);
  const result = yield* pipe(
    account,
    O.match({
      onNone: () => interactiveAcquire(runtime),
      onSome: (account) =>
        Effect.tryPromise({
          try: () => runtime.pca.acquireTokenSilent({ account, scopes: [...runtime.resolved.scopes] }),
          catch: (cause) => M365Error.fromReason("auth", { cause }),
        }).pipe(
          Effect.flatMap(requireAuthenticationResult),
          Effect.catch(() => interactiveAcquire(runtime))
        ),
    })
  );
  return Redacted.make(result.accessToken);
});

/**
 * The token-provider contract consumed by the {@link M365} service: a
 * re-runnable Effect yielding a redacted Graph access token (silent when a
 * cached account exists, interactive otherwise).
 *
 * **Example** (Satisfy auth shape contract)
 *
 * ```ts
 * import type { M365AuthShape } from "@beep/m365"
 * import { Effect, Redacted } from "effect"
 *
 * const auth = { acquireToken: Effect.succeed(Redacted.make("token")) } satisfies M365AuthShape
 * console.log(auth)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type M365AuthShape = {
  readonly acquireToken: Effect.Effect<Redacted.Redacted<string>, M365Error>;
};

/**
 * Delegated Microsoft Graph token provider service.
 *
 * **Example** (Create static token layer)
 *
 * ```ts
 * import { M365Auth } from "@beep/m365"
 * import { Redacted } from "effect"
 *
 * const layer = M365Auth.layerStatic(Redacted.make("graph-access-token"))
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class M365Auth extends Context.Service<M365Auth, M365AuthShape>()($I`M365Auth`) {
  /**
   * Build a token provider that returns a fixed token. Use for tests or when an
   * external component already minted a delegated Graph token.
   *
   * **Example** (Build fixed token provider)
   *
   * ```ts
   * import { M365Auth } from "@beep/m365"
   * import { Redacted } from "effect"
   *
   * const layer = M365Auth.layerStatic(Redacted.make("graph-access-token"))
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerStatic = (token: Redacted.Redacted<string>): Layer.Layer<M365Auth> =>
    Layer.succeed(M365Auth, M365Auth.of({ acquireToken: Effect.succeed(token) }));

  /**
   * Build the live MSAL-backed token provider (auth-code + PKCE, silent refresh,
   * encrypted cache when `tokenCachePath` is configured).
   *
   * **Example** (Build live MSAL layer)
   *
   * ```ts
   * import { M365Auth, M365ConfigInput } from "@beep/m365"
   *
   * const layer = M365Auth.makeLayer(
   *   M365ConfigInput.make({ tenantId: "common", clientId: "client-id" })
   * )
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config: M365ConfigInput,
    options: { readonly interactiveAuthorizer?: M365InteractiveAuthorizer } = {}
  ): Layer.Layer<M365Auth, M365Error> =>
    Layer.effect(
      M365Auth,
      Effect.gen(function* () {
        const resolved = resolveM365Config(config);
        const Msal = yield* importMsalNode;
        const cachePlugin = yield* buildCachePlugin(resolved);
        const pca = new Msal.PublicClientApplication({
          auth: { authority: resolved.authority, clientId: resolved.clientId },
          cache: getSomesStruct({ cachePlugin }),
          system: {
            loggerOptions: {
              logLevel: Msal.LogLevel.Error,
              loggerCallback: () => {},
              piiLoggingEnabled: false,
            },
          },
        });
        const crypto = new Msal.CryptoProvider();
        const runtime = M365AuthRuntime.make({
          crypto,
          interactiveAuthorizer: O.fromUndefinedOr(options.interactiveAuthorizer),
          pca,
          resolved,
        });
        return M365Auth.of({ acquireToken: acquireToken(runtime) });
      })
    );
}
