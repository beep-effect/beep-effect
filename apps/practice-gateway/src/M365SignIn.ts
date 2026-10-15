/**
 * Microsoft 365 sign-in for the practice gateway: the loopback authorizer
 * the M365 driver delegates redirect capture to, the DPAPI-protected MSAL
 * token cache, and the sign-in service the `m365-consented` repair runs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeGatewayId } from "@beep/identity/packages";
import { M365Auth, M365ConfigInput, M365Error } from "@beep/m365";
import { LiteralKit } from "@beep/schema";
import { WindowsSecretStore } from "@beep/windows-secrets";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as SynchronizedRef from "effect/SynchronizedRef";
import { GatewaySettings } from "./GatewaySettings.ts";
import { M365SignInFailure } from "./PracticeGateway.errors.ts";
import { SystemBrowser } from "./SystemBrowser.ts";
import type { M365AuthorizationRequest, M365InteractiveAuthorizer, M365TokenCachePersistence } from "@beep/m365";

const $I = $PracticeGatewayId.create("M365SignIn");

/**
 * Path segments, under the gateway data directory, of the DPAPI-protected
 * Microsoft 365 token cache.
 *
 * **Details**
 *
 * {@link M365SignIn} writes this file after the browser sign-in; the
 * `m365-consented` and `m365-token-cached` probes read it.
 *
 * **Example** (Join the token cache path)
 *
 * ```ts
 * import { M365_TOKEN_CACHE_SEGMENTS } from "@beep/practice-gateway/M365SignIn"
 *
 * console.log(M365_TOKEN_CACHE_SEGMENTS.join("/")) // "m365/token-cache.dpapi"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const M365_TOKEN_CACHE_SEGMENTS = ["m365", "token-cache.dpapi"] as const;

/**
 * Entra tenant the gateway signs in against: any work or school account,
 * resolved to the lawyer's own organization at sign-in.
 *
 * **Example** (Read the tenant)
 *
 * ```ts
 * import { M365_TENANT_ID } from "@beep/practice-gateway/M365SignIn"
 *
 * console.log(M365_TENANT_ID) // "organizations"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const M365_TENANT_ID = "organizations";

/**
 * How long `setup_repair` waits for the lawyer to finish the browser sign-in
 * before answering that the sign-in page is still open.
 *
 * **Details**
 *
 * MCP clients time a tool call out after about a minute, so the repair
 * answers before that and the sign-in keeps waiting in the background.
 *
 * **Example** (Read the wait)
 *
 * ```ts
 * import { M365_SIGN_IN_WAIT } from "@beep/practice-gateway/M365SignIn"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toSeconds(M365_SIGN_IN_WAIT)) // 45
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const M365_SIGN_IN_WAIT = Duration.seconds(45);

/**
 * How long one sign-in attempt keeps its loopback listener open.
 *
 * **Example** (Read the timeout)
 *
 * ```ts
 * import { M365_SIGN_IN_TIMEOUT } from "@beep/practice-gateway/M365SignIn"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMinutes(M365_SIGN_IN_TIMEOUT)) // 10
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const M365_SIGN_IN_TIMEOUT = Duration.minutes(10);

/**
 * Query parameters Microsoft sends to the loopback redirect.
 *
 * **Example** (Decode a successful redirect)
 *
 * ```ts
 * import { LoopbackCallback } from "@beep/practice-gateway/M365SignIn"
 * import * as S from "effect/Schema"
 *
 * const callback = S.decodeUnknownSync(LoopbackCallback)({ code: "abc", state: "xyz" })
 * console.log(callback.code) // "abc"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LoopbackCallback extends S.Opaque<LoopbackCallback, { readonly brand: unique symbol }>()(
  S.Struct({
    code: S.optionalKey(S.String).annotateKey({ description: "Authorization code, on success." }),
    state: S.optionalKey(S.String).annotateKey({ description: "State echoed from the authorization request." }),
    error: S.optionalKey(S.String).annotateKey({ description: "OAuth error code, on failure." }),
    error_description: S.optionalKey(S.String).annotateKey({ description: "OAuth error description, on failure." }),
  }).pipe(
    $I.annoteSchema("LoopbackCallback", {
      description: "Query parameters of the Microsoft sign-in redirect to the loopback listener.",
    })
  )
) {}

/**
 * What a sign-in request came to.
 *
 * **Details**
 *
 * `waiting-for-browser` means the sign-in page is open and the lawyer has not
 * finished it within {@link M365_SIGN_IN_WAIT}; the attempt keeps listening.
 *
 * **Example** (Check an outcome)
 *
 * ```ts
 * import { M365SignInOutcome } from "@beep/practice-gateway/M365SignIn"
 *
 * console.log(M365SignInOutcome.is.connected("connected")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const M365SignInOutcome = LiteralKit(["connected", "waiting-for-browser"]).pipe(
  $I.annoteSchema("M365SignInOutcome", {
    description: "What a Microsoft 365 sign-in request came to.",
  })
);

/**
 * Decoded type of {@link M365SignInOutcome}.
 *
 * **Example** (Type an outcome)
 *
 * ```ts
 * import type { M365SignInOutcome } from "@beep/practice-gateway/M365SignIn"
 *
 * const outcome: M365SignInOutcome = "waiting-for-browser"
 * console.log(outcome)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type M365SignInOutcome = typeof M365SignInOutcome.Type;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * MSAL token cache storage in a DPAPI-protected file.
 *
 * **Details**
 *
 * The serialized cache (refresh tokens included) is protected with
 * `WindowsSecretStore.protect` (DPAPI, current user) before it touches the
 * disk and written through a temporary file and a rename. With
 * `WindowsSecretStore.layerMemory` (tests) the "protection" is a copy.
 *
 * **Example** (Store the cache under a data directory)
 *
 * ```ts
 * import { makeDpapiTokenCache } from "@beep/practice-gateway/M365SignIn"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeDpapiTokenCache("/data/m365/token-cache.dpapi")))
 * ```
 *
 * @param filePath - Where the protected cache lives.
 * @category constructors
 * @since 0.0.0
 */
export const makeDpapiTokenCache = Effect.fnUntraced(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const store = yield* WindowsSecretStore;
  const failed = (cause: unknown) => M365Error.fromReason("config", { cause });
  const temporary = `${filePath}.tmp`;

  const load = fs.exists(filePath).pipe(
    Effect.flatMap((present) =>
      present
        ? fs.readFile(filePath).pipe(
            Effect.flatMap(store.unprotect),
            Effect.map((bytes) => O.some(decoder.decode(bytes)))
          )
        : Effect.succeedNone
    ),
    Effect.mapError(failed),
    Effect.withSpan("M365TokenCache.load")
  );

  const save = Effect.fn("M365TokenCache.save")(function* (contents: string) {
    const bytes = yield* store.protect(encoder.encode(contents));
    yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
    yield* fs.writeFile(temporary, bytes);
    yield* fs.rename(temporary, filePath);
  }, Effect.mapError(failed));

  const persistence: M365TokenCachePersistence = { load, save };
  return persistence;
});

// One open loopback listener and the authorizer that uses it.
interface LoopbackSignIn {
  /**
   * Opens the sign-in page and waits for its redirect; hand it to the driver.
   */
  readonly authorizer: M365InteractiveAuthorizer;
  /**
   * Why the last authorization failed, in plain language, when the
   * authorizer itself saw why.
   */
  readonly problem: Effect.Effect<O.Option<M365SignInFailure>>;
  /**
   * The redirect URI the listener answers: `http://127.0.0.1:<port>`.
   */
  readonly redirectUri: string;
}

const page = (title: string, body: string) =>
  HttpServerResponse.html(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui;margin:3rem"><h1>${title}</h1><p>${body}</p></body></html>`
  );

const notAuthorized = (callback: LoopbackCallback) =>
  M365SignInFailure.make({
    message:
      callback.error === "access_denied"
        ? "Access to Microsoft 365 was not approved in the browser, so nothing was connected."
        : `Microsoft did not finish the sign-in (${callback.error ?? "no code returned"}). Try again when you are ready.`,
  });

/**
 * Open a loopback listener on `127.0.0.1` (ephemeral port) for the Microsoft
 * sign-in redirect, and the authorizer that opens the sign-in page in the
 * system browser and waits for that redirect.
 *
 * **Details**
 *
 * The listener answers `/` once: a redirect with a code completes the
 * authorizer (PKCE stays inside the driver), one with an `error` fails it.
 * When the authorization URL carries a `state`, the redirect must echo it.
 * The listener closes with the surrounding scope.
 *
 * **Example** (Open the listener)
 *
 * ```ts
 * import { openLoopbackSignIn } from "@beep/practice-gateway/M365SignIn"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(openLoopbackSignIn))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const openLoopbackSignIn = Effect.gen(function* () {
  const browser = yield* SystemBrowser;
  const redirect = yield* Deferred.make<LoopbackCallback>();
  const problem = yield* Ref.make(O.none<M365SignInFailure>());

  const server = yield* BunHttpServer.make({ port: 0, hostname: "127.0.0.1" }).pipe(
    Effect.mapError((cause) =>
      M365SignInFailure.make({
        cause,
        message: "The gateway could not listen for the Microsoft sign-in on this computer.",
      })
    )
  );
  const port = server.address._tag === "UnixPathAddress" ? 0 : server.address.port;
  const redirectUri = `http://127.0.0.1:${port}`;

  yield* server.serve(
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const url = new URL(request.url, redirectUri);
      if (url.pathname !== "/") {
        return HttpServerResponse.empty({ status: 404 });
      }
      const callback = yield* S.decodeEffect(LoopbackCallback)(HttpServerRequest.searchParamsFromURL(url)).pipe(
        Effect.orElseSucceed(() => LoopbackCallback.make({ error: "invalid_request" }))
      );
      yield* Deferred.succeed(redirect, callback);
      return callback.code === undefined
        ? page("Microsoft 365 was not connected", "You can close this window and return to Claude.")
        : page("Microsoft 365 is connected", "You can close this window and return to Claude.");
    })
  );

  const fail = (failure: M365SignInFailure) =>
    Ref.set(problem, O.some(failure)).pipe(Effect.andThen(M365Error.failEffectFromReason("auth")));

  const authorizer: M365InteractiveAuthorizer = Effect.fn("M365SignIn.authorizer")(function* (
    request: M365AuthorizationRequest
  ) {
    const expectedState = O.fromNullishOr(new URL(request.authUrl).searchParams.get("state"));
    yield* browser
      .open(request.authUrl)
      .pipe(Effect.catchTag("BrowserOpenFailure", (error) => fail(M365SignInFailure.make({ message: error.message }))));
    const callback = yield* Deferred.await(redirect);
    if (O.isSome(expectedState) && callback.state !== expectedState.value) {
      return yield* fail(
        M365SignInFailure.make({ message: "The Microsoft sign-in answer did not match this request. Try again." })
      );
    }
    return callback.code === undefined ? yield* fail(notAuthorized(callback)) : callback.code;
  });

  const loopback: LoopbackSignIn = { redirectUri, authorizer, problem: Ref.get(problem) };
  return loopback;
});

const TokenCachePersistenceFromSelf = S.declare(
  (u: unknown): u is M365TokenCachePersistence =>
    P.isObject(u) &&
    P.hasProperty(u, "load") &&
    Effect.isEffect(u.load) &&
    P.hasProperty(u, "save") &&
    P.isFunction(u.save)
).pipe(
  $I.annoteSchema("TokenCachePersistenceFromSelf", {
    description: "In-process MSAL token cache storage handed to the Microsoft 365 driver.",
  })
);

/**
 * Microsoft 365 connection settings, present when the extension settings
 * name an app (client) id and the Windows secret store is available.
 *
 * **Example** (A connection over an in-memory cache)
 *
 * ```ts
 * import { M365ConfigInput } from "@beep/m365"
 * import { M365Connection } from "@beep/practice-gateway/M365SignIn"
 * import * as Effect from "effect/Effect"
 *
 * const connection = M365Connection.make({
 *   config: M365ConfigInput.make({ tenantId: "organizations", clientId: "client-id" }),
 *   tokenCache: { load: Effect.succeedNone, save: () => Effect.void },
 * })
 * console.log(connection.config.tenantId) // "organizations"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365Connection extends S.Opaque<M365Connection, { readonly brand: unique symbol }>()(
  S.Struct({
    config: M365ConfigInput.annotateKey({
      description: "Driver configuration: the configured client id and the organizations tenant.",
    }),
    tokenCache: TokenCachePersistenceFromSelf.annotateKey({ description: "The DPAPI-protected token cache." }),
  }).pipe(
    $I.annoteSchema("M365Connection", {
      description: "Microsoft 365 connection settings of the practice gateway.",
    })
  )
) {}

/**
 * Operations of {@link M365SignIn}.
 *
 * @category models
 * @since 0.0.0
 */
export interface M365SignInShape {
  /**
   * The connection settings, or why there are none in plain language.
   */
  readonly connection: Effect.Effect<M365Connection, M365SignInFailure>;
  /**
   * Run (or rejoin) the interactive sign-in: opens the browser and waits up
   * to {@link M365_SIGN_IN_WAIT} for the lawyer to finish.
   */
  readonly signIn: Effect.Effect<M365SignInOutcome, M365SignInFailure>;
}

const NOT_CONFIGURED =
  "Microsoft 365 is not configured for this practice gateway yet: the extension settings have no Microsoft 365 app ID.";

/**
 * Microsoft 365 sign-in for the gateway.
 *
 * **Example** (A sign-in that is already connected)
 *
 * ```ts
 * import { M365SignIn } from "@beep/practice-gateway/M365SignIn"
 * import { M365SignInFailure } from "@beep/practice-gateway/PracticeGateway.errors"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const layer = Layer.succeed(
 *   M365SignIn,
 *   M365SignIn.of({
 *     connection: Effect.fail(M365SignInFailure.make({ message: "Not configured." })),
 *     signIn: Effect.succeed("connected"),
 *   })
 * )
 * console.log(Layer.isLayer(layer))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class M365SignIn extends Context.Service<M365SignIn, M365SignInShape>()($I`M365SignIn`) {
  /**
   * The live sign-in: loopback listener, system browser and the DPAPI token
   * cache at `<dataDir>/m365/token-cache.dpapi`.
   *
   * **Details**
   *
   * One attempt runs at a time and outlives the tool call that started it
   * (it is forked into the layer's scope), so a lawyer who takes longer than
   * {@link M365_SIGN_IN_WAIT} can still finish; asking again rejoins the
   * same attempt instead of opening a second page. Without a client id the
   * connection reports "not configured"; without the Windows secret store
   * (anywhere but Windows) sign-in is refused, so tokens never reach a file
   * unprotected.
   *
   * **Example** (Compose the live sign-in)
   *
   * ```ts
   * import { M365SignIn } from "@beep/practice-gateway/M365SignIn"
   * import * as Layer from "effect/Layer"
   *
   * console.log(Layer.isLayer(M365SignIn.layer))
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(
    M365SignIn,
    Effect.gen(function* () {
      const settings = yield* GatewaySettings;
      const path = yield* Path.Path;
      const browser = yield* SystemBrowser;
      const platform = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
      const secrets = yield* Effect.serviceOption(WindowsSecretStore);
      const scope = yield* Effect.scope;
      const attempt = yield* SynchronizedRef.make(O.none<Fiber.Fiber<void, M365SignInFailure>>());
      const clearAttempt = SynchronizedRef.set(attempt, O.none<Fiber.Fiber<void, M365SignInFailure>>());
      const cachePath = path.join(settings.dataDir, ...M365_TOKEN_CACHE_SEGMENTS);

      const connection = Effect.gen(function* () {
        const clientId = yield* Effect.fromOption(settings.m365ClientId).pipe(
          Effect.mapError(() => M365SignInFailure.make({ message: NOT_CONFIGURED }))
        );
        const store = yield* Effect.fromOption(secrets).pipe(
          Effect.mapError(() =>
            M365SignInFailure.make({
              message: "Microsoft 365 sign-in needs Windows' protected storage, which is not available here.",
            })
          )
        );
        const tokenCache = yield* makeDpapiTokenCache(cachePath).pipe(
          Effect.provideService(WindowsSecretStore, store),
          Effect.provideContext(platform)
        );
        const config = M365ConfigInput.make({ tenantId: M365_TENANT_ID, clientId });
        return M365Connection.make({ config, tokenCache });
      });

      const didNotFinish = M365SignInFailure.make({
        message: "The Microsoft 365 sign-in did not finish. Start it again when you are ready.",
      });

      const runAttempt = Effect.fn("M365SignIn.attempt")(
        function* (current: M365Connection) {
          const loopback = yield* openLoopbackSignIn;
          const config = M365ConfigInput.make({
            tenantId: current.config.tenantId,
            clientId: current.config.clientId,
            redirectUri: loopback.redirectUri,
          });
          const services = yield* Layer.build(
            M365Auth.makeLayer(config, { interactiveAuthorizer: loopback.authorizer, tokenCache: current.tokenCache })
          );
          const finished = yield* Context.get(services, M365Auth).acquireToken.pipe(
            Effect.timeoutOption(M365_SIGN_IN_TIMEOUT),
            // The driver's error is technical; the authorizer recorded the plain reason when it saw one.
            Effect.catchTag("M365Error", () =>
              Effect.flatMap(
                loopback.problem,
                flow(
                  O.getOrElse(() => didNotFinish),
                  Effect.fail
                )
              )
            )
          );
          if (O.isNone(finished)) {
            return yield* M365SignInFailure.make({
              message:
                "The Microsoft sign-in page was not finished in time. Start the sign-in again when you are ready.",
            });
          }
        },
        Effect.catchTag("M365Error", () => Effect.fail(didNotFinish)),
        Effect.provideService(SystemBrowser, browser),
        Effect.scoped
      );

      const signIn = Effect.gen(function* () {
        const current = yield* connection;
        const fiber = yield* SynchronizedRef.modifyEffect(attempt, (running) =>
          O.match(running, {
            onSome: (fiber) => Effect.succeed([fiber, running] as const),
            onNone: () =>
              runAttempt(current).pipe(
                Effect.ensuring(clearAttempt),
                Effect.forkIn(scope),
                Effect.map((fiber) => [fiber, O.some(fiber)] as const)
              ),
          })
        );
        const exit = yield* Fiber.await(fiber).pipe(Effect.timeoutOption(M365_SIGN_IN_WAIT));
        return yield* O.match(exit, {
          onNone: () => Effect.succeed(M365SignInOutcome.Enum["waiting-for-browser"]),
          onSome: Effect.as(M365SignInOutcome.Enum.connected),
        });
      });

      return M365SignIn.of({ connection, signIn });
    })
  );
}
