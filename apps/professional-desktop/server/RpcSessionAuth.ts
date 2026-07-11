/**
 * Desktop sidecar RPC session authentication.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Config, Context, Effect, Redacted } from "effect";
import * as O from "effect/Option";
import { Headers, HttpMiddleware, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import type { Layer } from "effect";

/**
 * Environment variable carrying the per-launch sidecar RPC session token.
 *
 * @category configuration
 * @since 0.0.0
 */
const DESKTOP_RPC_SESSION_TOKEN_ENV = "BEEP_DESKTOP_RPC_SESSION_TOKEN" as const;

/**
 * Optional redacted session token read by the sidecar on boot.
 *
 * @category configuration
 * @since 0.0.0
 */
export const DesktopRpcSessionToken = Config.redacted(DESKTOP_RPC_SESSION_TOKEN_ENV).pipe(Config.option);

/**
 * Build the HTTP Authorization header value for a desktop RPC session token.
 *
 * @category auth
 * @since 0.0.0
 */
export const rpcSessionAuthorizationHeader = (token: Redacted.Redacted<string>): string =>
  `Bearer ${Redacted.value(token)}`;

/**
 * Check whether HTTP headers carry the active desktop RPC session token.
 *
 * @category auth
 * @since 0.0.0
 */
export const isAuthorizedRpcSessionHeaders = (headers: Headers.Headers, token: Redacted.Redacted<string>): boolean =>
  O.contains(Headers.get(headers, "authorization"), rpcSessionAuthorizationHeader(token));

/**
 * Check the complete HTTP request auth decision. CORS preflight is intentionally
 * exempt so browsers can reach the authenticated POST path with Authorization.
 *
 * @category auth
 * @since 0.0.0
 */
export const isAuthorizedRpcSessionRequest = (
  method: string,
  headers: Headers.Headers,
  token: Redacted.Redacted<string>
): boolean => method === "OPTIONS" || isAuthorizedRpcSessionHeaders(headers, token);

/**
 * HTTP middleware requiring the active desktop RPC session token.
 *
 * @example
 * ```ts
 * import { Redacted } from "effect"
 * import { requireRpcSessionToken } from "./RpcSessionAuth.ts"
 * console.log(requireRpcSessionToken(Redacted.make("test-token")))
 * ```
 *
 * @category auth
 * @since 0.0.0
 */
export const requireRpcSessionToken = (token: Redacted.Redacted<string>) =>
  HttpMiddleware.make(
    <E, R>(
      effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R | HttpServerRequest.HttpServerRequest>
    ): Effect.Effect<HttpServerResponse.HttpServerResponse, E, R | HttpServerRequest.HttpServerRequest> =>
      Effect.withFiber((fiber) => {
        const request = Context.getUnsafe(fiber.context, HttpServerRequest.HttpServerRequest);
        return isAuthorizedRpcSessionRequest(request.method, request.headers, token)
          ? effect
          : Effect.succeed(HttpServerResponse.text("Unauthorized desktop RPC session.", { status: 401 }));
      })
  );

/**
 * Router layer installing the desktop RPC session-token middleware globally.
 *
 * @category auth
 * @since 0.0.0
 */
export const RpcSessionAuthLayer = (
  token: Redacted.Redacted<string>
): Layer.Layer<never, never, HttpRouter.HttpRouter> =>
  HttpRouter.middleware(requireRpcSessionToken(token), { global: true });
