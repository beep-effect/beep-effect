/**
 * Desktop sidecar RPC session authentication.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as HttpMethod from "@beep/schema/HttpMethod";
import { HttpStatus } from "@beep/schema/HttpStatus";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import { Headers, HttpMiddleware, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import type * as Layer from "effect/Layer";

const rpcAuthDecisions = Metric.counter("desktop_rpc_auth_decisions_total", { incremental: true });

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
export const rpcSessionAuthorizationHeader = (token: Redacted.Redacted): string => `Bearer ${Redacted.value(token)}`;

/**
 * Check whether HTTP headers carry the active desktop RPC session token.
 *
 * @category auth
 * @since 0.0.0
 */
export const isAuthorizedRpcSessionHeaders: {
  (headers: Headers.Headers, token: Redacted.Redacted): boolean;
  (token: Redacted.Redacted): (headers: Headers.Headers) => boolean;
} = dual(2, (headers: Headers.Headers, token: Redacted.Redacted): boolean =>
  O.contains(Headers.get(headers, "authorization"), rpcSessionAuthorizationHeader(token))
);

/**
 * Check the complete HTTP request auth decision. CORS preflight is intentionally
 * exempt so browsers can reach the authenticated POST path with Authorization.
 *
 * @category auth
 * @since 0.0.0
 */
export const isAuthorizedRpcSessionRequest: {
  (method: string, headers: Headers.Headers, token: Redacted.Redacted): boolean;
  (headers: Headers.Headers, token: Redacted.Redacted): (method: string) => boolean;
} = dual(
  3,
  (method: string, headers: Headers.Headers, token: Redacted.Redacted): boolean =>
    HttpMethod.Schema.is.OPTIONS(method) || isAuthorizedRpcSessionHeaders(headers, token)
);

/**
 * HTTP middleware requiring the active desktop RPC session token.
 *
 * @example
 * ```ts
 * import * as Redacted from "effect/Redacted";
 * import { requireRpcSessionToken } from "./RpcSessionAuth.ts"
 * console.log(requireRpcSessionToken(Redacted.make("test-token")))
 * ```
 *
 * @category auth
 * @since 0.0.0
 */
export const requireRpcSessionToken = (token: Redacted.Redacted) =>
  HttpMiddleware.make(
    <E, R>(
      effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R | HttpServerRequest.HttpServerRequest>
    ): Effect.Effect<HttpServerResponse.HttpServerResponse, E, R | HttpServerRequest.HttpServerRequest> =>
      Effect.withFiber((fiber) => {
        const request = Context.getUnsafe(fiber.context, HttpServerRequest.HttpServerRequest);
        const authorized = isAuthorizedRpcSessionRequest(request.method, request.headers, token);
        const attributes = {
          decision: authorized ? "allowed" : "denied",
          method: request.method,
        };
        return Metric.update(Metric.withAttributes(rpcAuthDecisions, attributes), 1).pipe(
          Effect.andThen(
            authorized
              ? effect
              : Effect.logWarning("desktop RPC session authorization denied").pipe(
                  Effect.annotateLogs({
                    method: request.method,
                    subsystem: "rpc_auth",
                  }),
                  Effect.as(
                    HttpServerResponse.text("Unauthorized desktop RPC session.", {
                      status: HttpStatus.From.Enum.Unauthorized,
                    })
                  )
                )
          ),
          Effect.withSpan("desktop.rpc.authorize", { attributes })
        );
      })
  );

/**
 * Router layer installing the desktop RPC session-token middleware globally.
 *
 * @category auth
 * @since 0.0.0
 */
export const RpcSessionAuthLayer = (token: Redacted.Redacted): Layer.Layer<never, never, HttpRouter.HttpRouter> =>
  HttpRouter.middleware(requireRpcSessionToken(token), { global: true });
