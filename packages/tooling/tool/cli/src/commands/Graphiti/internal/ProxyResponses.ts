/**
 * HTTP response builders for the Graphiti proxy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Match, pipe } from "effect";
import { dual } from "effect/Function";
import { HttpServerResponse } from "effect/unstable/http";
import { ProxyErrorPayload } from "./ProxySchemas.js";
import type * as S from "effect/Schema";
import type { Headers, HttpClientError } from "effect/unstable/http";
import type { ProxyErrorKind, ProxyHealthPayload, ProxyLane } from "./ProxySchemas.js";

type ProxyErrorResponseOptions = {
  readonly headers?: Headers.Input | undefined;
  readonly status: number;
};
const matchHttpClientErrorToRes = Match.type<HttpClientError.HttpClientError["reason"]>().pipe(
  Match.withReturnType<HttpServerResponse.HttpServerResponse>(),
  Match.tags({
    TransportError: (error) => proxyErrorResponse("upstream_failure", error.message, { status: 502 }),
    EncodeError: (error) => proxyErrorResponse("upstream_failure", error.message, { status: 502 }),
    InvalidUrlError: (error) => proxyErrorResponse("upstream_failure", error.message, { status: 500 }),
    StatusCodeError: (error) => proxyErrorResponse("upstream_failure", error.message, { status: 502 }),
    DecodeError: (error) => proxyErrorResponse("upstream_failure", error.message, { status: 502 }),
    EmptyBodyError: (error) => proxyErrorResponse("upstream_failure", error.message, { status: 502 }),
  }),
  Match.orElse(() => proxyErrorResponse("upstream_failure", "Unknown error", { status: 502 }))
);
/**
 * Convert an Effect HTTP client failure into a Graphiti proxy response.
 *
 * @example
 * ```ts
 * import { mapHttpClientErrorToResponse } from "@beep/repo-cli/commands/Graphiti/internal/ProxyResponses"
 *
 * const mapper = mapHttpClientErrorToResponse
 * console.log(typeof mapper === "function")
 * ```
 * @category error-handling
 * @since 0.0.0
 */
export const mapHttpClientErrorToResponse = (
  error: HttpClientError.HttpClientError
): HttpServerResponse.HttpServerResponse => matchHttpClientErrorToRes(error.reason);

/**
 * Build a structured proxy error HTTP response.
 *
 * @param error - Structured proxy error kind.
 * @param message - Human-readable error message.
 * @param options - HTTP response options.
 * @returns Http server response with JSON error body.
 * @example
 * ```ts
 * console.log("proxyErrorResponse")
 * ```
 * @category models
 * @since 0.0.0
 */
export const proxyErrorResponse: {
  (
    error: S.Schema.Type<typeof ProxyErrorKind>,
    message: string,
    options: ProxyErrorResponseOptions
  ): HttpServerResponse.HttpServerResponse;
  (
    message: string,
    options: ProxyErrorResponseOptions
  ): (error: S.Schema.Type<typeof ProxyErrorKind>) => HttpServerResponse.HttpServerResponse;
} = dual(
  3,
  (
    error: S.Schema.Type<typeof ProxyErrorKind>,
    message: string,
    options: ProxyErrorResponseOptions
  ): HttpServerResponse.HttpServerResponse =>
    HttpServerResponse.jsonUnsafe(
      ProxyErrorPayload.make({
        error,
        message,
      }),
      {
        status: options.status,
        headers: options.headers,
      }
    )
);

/**
 * Build a structured proxy health HTTP response.
 *
 * @param payload - Structured proxy health payload.
 * @param status - HTTP response status code.
 * @returns Http server response with JSON health body.
 * @example
 * ```ts
 * console.log("proxyHealthResponse")
 * ```
 * @category models
 * @since 0.0.0
 */
export const proxyHealthResponse: {
  (payload: ProxyHealthPayload, status: number): HttpServerResponse.HttpServerResponse;
  (status: number): (payload: ProxyHealthPayload) => HttpServerResponse.HttpServerResponse;
} = dual(
  2,
  (payload: ProxyHealthPayload, status: number): HttpServerResponse.HttpServerResponse =>
    HttpServerResponse.jsonUnsafe(payload, { status })
);

type ProxyHeaderOptions = {
  readonly active: number;
  readonly lane: ProxyLane;
  readonly queued: number;
};

/**
 * Stamp proxy queue accounting headers onto a response.
 *
 * @example
 * ```ts
 * import { addProxyHeaders, proxyHealthResponse } from "@beep/repo-cli/commands/Graphiti/internal/ProxyResponses"
 * import { ProxyHealthPayload } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * const response = addProxyHeaders(proxyHealthResponse(ProxyHealthPayload.make({ status: "ok", active: 0, queued: 0, peakQueueDepth: 0, processed: 0, failed: 0, rejected: 0, concurrency: 1, maxQueue: 10, upstream: "http://127.0.0.1:8000/mcp", dependencies: { falkor: "healthy", graphiti: "healthy" } }), 200), { active: 0, lane: "fast", queued: 0 })
 * console.log(response.headers.get("x-graphiti-proxy-lane"))
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const addProxyHeaders: {
  (response: HttpServerResponse.HttpServerResponse, options: ProxyHeaderOptions): HttpServerResponse.HttpServerResponse;
  (
    options: ProxyHeaderOptions
  ): (response: HttpServerResponse.HttpServerResponse) => HttpServerResponse.HttpServerResponse;
} = dual(
  2,
  (
    response: HttpServerResponse.HttpServerResponse,
    options: ProxyHeaderOptions
  ): HttpServerResponse.HttpServerResponse =>
    pipe(
      response,
      HttpServerResponse.setHeader("x-graphiti-proxy-queued", `${options.queued}`),
      HttpServerResponse.setHeader("x-graphiti-proxy-active", `${options.active}`),
      HttpServerResponse.setHeader("x-graphiti-proxy-lane", options.lane)
    )
);
