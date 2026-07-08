/**
 * Upstream forwarding implementation for the Graphiti proxy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str } from "@beep/utils";
import { Duration, Effect, flow, Inspectable, Match, pipe, Result, Stream } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import {
  Headers,
  HttpBody,
  HttpClient,
  HttpClientError,
  HttpClientRequest,
  HttpMethod,
  HttpServerResponse,
} from "effect/unstable/http";
import { mapHttpClientErrorToResponse, proxyErrorResponse } from "./ProxyResponses.js";
import { decodeUrlSearchParams } from "./ProxySchemas.js";
import { GraphitiProxyForwarderService } from "./ProxyServices.js";
import type { HttpServerRequest } from "effect/unstable/http";
import type { GraphitiProxyConfig } from "./ProxyConfig.js";

const absoluteRequestTargetPattern = /^(?:[a-zA-Z][a-zA-Z\d+.-]*:|\/\/)/;

const normalizeEndpointPath = (value: string): string => {
  const normalized = pipe(value, Str.replace(/\/+$/, ""));
  return Str.isNonEmpty(normalized) ? normalized : "/";
};

const isAllowedEndpointPath = (allowedPath: string, inboundPath: string): boolean =>
  allowedPath === "/" || inboundPath === allowedPath || pipe(inboundPath, Str.startsWith(`${allowedPath}/`));

const isAbsoluteRequestTarget = (value: string): boolean => O.isSome(Str.match(absoluteRequestTargetPattern)(value));

/**
 * Settle a forwarded response against the concurrency accounting slot.
 *
 * Streaming MCP/SSE responses complete their headers while the body keeps
 * flowing to the downstream client. To keep `GRAPHITI_PROXY_CONCURRENCY` and
 * `active` accounting honest, the release effect is deferred to the body
 * stream finalizer so the worker slot stays accounted until the stream closes,
 * errors, or is interrupted. Non-streaming responses release the slot
 * immediately.
 *
 * @param response - Forwarded upstream response.
 * @param release - Effect that releases the accounting slot exactly once.
 * @returns Effect producing the response with slot release wired to its body.
 * @example
 * ```ts
 * import { settleForwardedResponse } from "@beep/repo-cli/commands/Graphiti/internal/ProxyForwarder"
 * import { Effect } from "effect"
 * import { HttpServerResponse } from "effect/unstable/http"
 *
 * const response = HttpServerResponse.empty()
 * const settled = settleForwardedResponse(response, Effect.void)
 * console.log(settled.pipe !== undefined)
 * ```
 * @category concurrency
 * @since 0.0.0
 */
export const settleForwardedResponse: {
  (
    response: HttpServerResponse.HttpServerResponse,
    release: Effect.Effect<void>
  ): Effect.Effect<HttpServerResponse.HttpServerResponse>;
  (
    release: Effect.Effect<void>
  ): (response: HttpServerResponse.HttpServerResponse) => Effect.Effect<HttpServerResponse.HttpServerResponse>;
} = dual(
  2,
  Effect.fnUntraced(function* (response: HttpServerResponse.HttpServerResponse, release: Effect.Effect<void>) {
    return yield* Match.value(response.body).pipe(
      Match.tag("Stream", (body) =>
        Effect.succeed(
          HttpServerResponse.setBody(
            response,
            HttpBody.stream(Stream.ensuring(body.stream, release), body.contentType, body.contentLength)
          )
        )
      ),
      Match.orElse(() => Effect.as(release, response))
    );
  })
);

/**
 * Construct upstream forwarder service implementation.
 *
 * @param config - Runtime graphiti proxy config.
 * @returns Forwarder service implementation.
 * @example
 * ```ts
 * console.log("makeGraphitiProxyForwarderService")
 * ```
 * @category models
 * @since 0.0.0
 */
export const makeGraphitiProxyForwarderService = (
  config: GraphitiProxyConfig
): GraphitiProxyForwarderService["Service"] => {
  const upstreamBase = new URL(config.upstream);
  const allowedEndpointPath = normalizeEndpointPath(upstreamBase.pathname);

  const rejectDisallowedTarget = (request: HttpServerRequest.HttpServerRequest) => {
    if (isAbsoluteRequestTarget(request.url)) {
      return O.some({
        response: proxyErrorResponse("upstream_failure", "Graphiti proxy rejects absolute-form request targets.", {
          status: 400,
        }),
      });
    }

    const inboundUrl = new URL(request.url, "http://graphiti-proxy.local");
    const inboundPath = normalizeEndpointPath(inboundUrl.pathname);
    if (!isAllowedEndpointPath(allowedEndpointPath, inboundPath)) {
      return O.some({
        response: proxyErrorResponse("upstream_failure", `Graphiti proxy only forwards ${allowedEndpointPath}.`, {
          status: 404,
        }),
      });
    }

    return O.none();
  };

  const forward: (
    request: HttpServerRequest.HttpServerRequest,
    bodyBytes?: O.Option<Uint8Array>
  ) => Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpClient.HttpClient> = Effect.fnUntraced(
    function* (request, bodyBytes = O.none<Uint8Array>()) {
      const targetRejection = rejectDisallowedTarget(request);
      if (O.isSome(targetRejection)) {
        return targetRejection.value.response;
      }

      const inboundUrl = new URL(request.url, "http://graphiti-proxy.local");
      const inboundPath = normalizeEndpointPath(inboundUrl.pathname);

      const destination = new URL(upstreamBase.href);
      destination.pathname = inboundPath;
      destination.search = "";
      const urlParamsResult = yield* decodeUrlSearchParams(inboundUrl.searchParams).pipe(Effect.result);
      if (Result.isFailure(urlParamsResult)) {
        return proxyErrorResponse(
          "upstream_failure",
          `Graphiti proxy failed to decode request query parameters: ${urlParamsResult.failure.message}`,
          { status: 400 }
        );
      }
      const urlParams = urlParamsResult.success;
      const headers = pipe(
        request.headers,
        Headers.remove("host"),
        Headers.remove("connection"),
        Headers.remove("content-length")
      );

      const method = HttpMethod.isHttpMethod(request.method) ? request.method : "GET";
      const hasBody = HttpMethod.hasBody(method);

      let upstreamRequest = HttpClientRequest.make(method)(destination.href, {
        headers,
        urlParams,
      });

      if (hasBody) {
        const requestBodyResult = O.isSome(bodyBytes)
          ? Result.succeed(bodyBytes.value)
          : yield* request.arrayBuffer.pipe(
              Effect.map((buffer) => new Uint8Array(buffer)),
              Effect.result
            );
        if (Result.isFailure(requestBodyResult)) {
          return proxyErrorResponse("upstream_failure", Inspectable.toStringUnknown(requestBodyResult.failure, 0), {
            status: 400,
          });
        }
        const requestBodyBytes = requestBodyResult.success;
        const contentTypeOption = Headers.get(headers, "content-type");
        const body = pipe(
          contentTypeOption,
          O.map((contentType) => HttpBody.uint8Array(requestBodyBytes, contentType)),
          O.getOrElse(() => HttpBody.uint8Array(requestBodyBytes))
        );
        upstreamRequest = HttpClientRequest.setBody(upstreamRequest, body);
      }

      const executeResult = yield* HttpClient.execute(upstreamRequest).pipe(
        Effect.timeoutOption(Duration.millis(config.requestTimeoutMs)),
        Effect.result
      );

      return yield* Result.match(executeResult, {
        onFailure: (error) =>
          Effect.succeed(
            HttpClientError.isHttpClientError(error)
              ? mapHttpClientErrorToResponse(error)
              : proxyErrorResponse("upstream_failure", Inspectable.toStringUnknown(error, 0), { status: 502 })
          ),
        onSuccess: flow(
          O.map(flow(HttpServerResponse.fromClientResponse, Effect.succeed)),
          O.getOrElse(() =>
            Effect.succeed(
              proxyErrorResponse("upstream_timeout", `Upstream request timed out after ${config.requestTimeoutMs}ms`, {
                status: 504,
              })
            )
          )
        ),
      });
    }
  );

  return GraphitiProxyForwarderService.of({
    forward,
    rejectDisallowedTarget,
  });
};
