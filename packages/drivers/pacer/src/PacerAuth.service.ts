/**
 * PACER Authentication service over the lower-level `effect/unstable/http`
 * client.
 *
 * The Authentication API returns failures as HTTP 200 with a body-level
 * `loginResult` code, so this path does NOT use `httpapi` (whose error model is
 * status-driven). {@link PacerAuth} exposes raw `login`/`logout`; {@link
 * PacerSession} is a scoped layer that logs in on acquire, holds the token in a
 * {@link Ref} (so the PCL client can read + refresh it), and logs out on
 * release.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PacerId } from "@beep/identity";
import { Context, Duration, Effect, Layer, pipe, Redacted, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import { CsoAuthRequest, CsoAuthResponse, CsoLogoutRequest, CsoLogoutResponse } from "./CsoAuth.models.ts";
import { PacerAuthError } from "./Pacer.errors.ts";
import { pacerCauseMessage } from "./Pacer.http.ts";
import { NextGenCsoToken } from "./Pacer.tokens.ts";
import type { PacerConfig } from "./Pacer.config.ts";

const $I = $PacerId.create("pacer/auth/PacerAuth.service");

interface PacerAuthShape {
  /** Authenticate with the configured credentials, returning a fresh token. */
  readonly login: Effect.Effect<NextGenCsoToken, PacerAuthError>;
  /** Invalidate a token via cso-logout. */
  readonly logout: (token: NextGenCsoToken) => Effect.Effect<void, PacerAuthError>;
}

const transport = (cause: unknown): PacerAuthError =>
  PacerAuthError.fromReason("transport", { cause: pacerCauseMessage(cause) });
const decoding = (cause: unknown): PacerAuthError =>
  PacerAuthError.fromReason("response-decoding", { cause: pacerCauseMessage(cause) });

/** Per-request timeout so a hung PACER auth endpoint can never block forever. */
const REQUEST_TIMEOUT = Duration.seconds(30);

const executeAuthRequest = <A, E>(
  client: HttpClient.HttpClient,
  request: HttpClientRequest.HttpClientRequest,
  decode: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, E>
): Effect.Effect<A, PacerAuthError> =>
  client.execute(request).pipe(
    Effect.timeout(REQUEST_TIMEOUT),
    Effect.mapError(transport),
    Effect.flatMap((response) => decode(response).pipe(Effect.mapError(decoding)))
  );

const logAuthWarning = (operation: "login" | "logout", description: O.Option<string>): Effect.Effect<void> =>
  pipe(
    description,
    O.filter(Str.isNonEmpty),
    O.match({
      onNone: () => Effect.void,
      onSome: (message) => Effect.logWarning(`PACER ${operation} succeeded with a warning: ${message}`),
    })
  );

const encodeAuthRequest = S.encodeEffect(CsoAuthRequest);
const encodeLogoutRequest = S.encodeEffect(CsoLogoutRequest);

const makeService = (client: HttpClient.HttpClient, cfg: PacerConfig): PacerAuthShape => {
  const login: Effect.Effect<NextGenCsoToken, PacerAuthError> = Effect.gen(function* () {
    const requestBody = yield* encodeAuthRequest(
      CsoAuthRequest.make({
        loginId: Redacted.value(cfg.loginId),
        password: Redacted.value(cfg.password),
        clientCode: cfg.clientCode,
        otpCode: O.map(cfg.otpCode, Redacted.value),
        // Filers (e-filing accounts) must attest redaction compliance; PACER returns
        // loginResult "1" if a filer omits it. Search-only accounts leave it off.
        redactFlag: O.flatMap(cfg.isFiler, (isFiler) => (isFiler ? O.some("1") : O.none<string>())),
      })
    ).pipe(Effect.mapError(transport));
    const baseRequest = HttpClientRequest.post(`${cfg.authBaseUrl}/services/cso-auth`).pipe(
      HttpClientRequest.accept("application/json")
    );
    const request = yield* HttpClientRequest.bodyJson(baseRequest, requestBody).pipe(Effect.mapError(transport));
    const body = yield* executeAuthRequest(client, request, HttpClientResponse.schemaBodyJson(CsoAuthResponse));

    if (body.loginResult !== "0" || body.nextGenCSO === "") {
      return yield* PacerAuthError.fromLoginResult(body.loginResult, body.errorDescription.pipe(O.getOrUndefined));
    }
    // loginResult "0" can still carry a non-fatal search-privilege warning.
    yield* logAuthWarning("login", body.errorDescription);
    return NextGenCsoToken.make(body.nextGenCSO);
  });

  const logout: PacerAuthShape["logout"] = Effect.fnUntraced(function* (token: NextGenCsoToken) {
    const baseRequest = HttpClientRequest.post(`${cfg.authBaseUrl}/services/cso-logout`).pipe(
      HttpClientRequest.accept("application/json")
    );
    const requestBody = yield* encodeLogoutRequest(CsoLogoutRequest.make({ nextGenCSO: token })).pipe(
      Effect.mapError(transport)
    );
    const request = yield* HttpClientRequest.bodyJson(baseRequest, requestBody).pipe(Effect.mapError(transport));
    const body = yield* executeAuthRequest(client, request, HttpClientResponse.schemaBodyJson(CsoLogoutResponse));
    const loginResult = O.getOrElse(body.loginResult, () => "0");
    if (loginResult !== "0") {
      return yield* PacerAuthError.fromLoginResult(loginResult, body.errorDescription.pipe(O.getOrUndefined));
    }
    yield* logAuthWarning("logout", body.errorDescription);
  });

  return { login, logout };
};

/**
 * PACER Authentication service: raw `login` / `logout` over an HTTP client.
 *
 * @example
 * ```ts
 * import { makePacerLayer, makePacerMockHttpClient, mockPacerConfig } from "@beep/pacer"
 *
 * const layers = makePacerLayer(mockPacerConfig(), makePacerMockHttpClient())
 * console.log(Boolean(layers.auth))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PacerAuth extends Context.Service<PacerAuth, PacerAuthShape>()($I`PacerAuth`) {
  /**
   * Build a layer from explicit configuration; requires an `HttpClient`.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (cfg: PacerConfig): Layer.Layer<PacerAuth, never, HttpClient.HttpClient> =>
    Layer.effect(
      PacerAuth,
      Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        return PacerAuth.of(makeService(client, cfg));
      })
    );
}

interface PacerSessionShape {
  /** The current auth token, refreshable by the PCL client on token rotation. */
  readonly tokenRef: Ref.Ref<Redacted.Redacted<NextGenCsoToken>>;
}

/**
 * A scoped authenticated session: logs in on layer acquire, exposes the token
 * via a {@link Ref}, and logs out on layer release.
 *
 * @example
 * ```ts
 * import { makePacerLayer, makePacerMockHttpClient, mockPacerConfig } from "@beep/pacer"
 *
 * const layers = makePacerLayer(mockPacerConfig(), makePacerMockHttpClient())
 * console.log(Boolean(layers.session))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PacerSession extends Context.Service<PacerSession, PacerSessionShape>()($I`PacerSession`) {
  /**
   * Scoped layer that authenticates on acquire and logs out on release.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<PacerSession, PacerAuthError, PacerAuth> = Layer.effect(
    PacerSession,
    Effect.gen(function* () {
      const auth = yield* PacerAuth;
      const token = yield* auth.login;
      yield* Effect.logInfo("PacerSession: authenticated (nextGenCSO acquired)");
      const tokenRef = yield* Ref.make(Redacted.make(token));
      yield* Effect.addFinalizer(() =>
        Ref.get(tokenRef).pipe(
          Effect.map(Redacted.value),
          Effect.flatMap(auth.logout),
          Effect.tap(() => Effect.logInfo("PacerSession: logged out (cso-logout)")),
          Effect.tapError((error) => Effect.logWarning(`PacerSession: cso-logout failed: ${error.reason}`)),
          Effect.ignore
        )
      );
      return PacerSession.of({ tokenRef });
    })
  );
}
