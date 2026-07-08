/**
 * Graphiti proxy service contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Effect } from "effect";
import type * as O from "effect/Option";
import type { HttpClient, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import type { DependencyHealthSnapshot, ProxyQueueStats } from "./ProxySchemas.js";

const $I = $RepoCliId.create("commands/Graphiti/internal/ProxyServices");

type GraphitiDependencyHealthServiceShape = {
  readonly snapshot: Effect.Effect<DependencyHealthSnapshot>;
};

/**
 * Rejection response returned before buffering disallowed proxy targets.
 *
 * @example
 * ```ts
 * import type { RequestTargetRejection } from "@beep/repo-cli/commands/Graphiti/internal/ProxyServices"
 *
 * const rejection: RequestTargetRejection = { response: new Response("blocked") as never }
 * console.log(rejection)
 * ```
 * @category models
 * @since 0.0.0
 */
type RequestTargetRejection = {
  readonly response: HttpServerResponse.HttpServerResponse;
};

type GraphitiProxyForwarderServiceShape = {
  readonly forward: (
    request: HttpServerRequest.HttpServerRequest,
    bodyBytes?: O.Option<Uint8Array>
  ) => Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpClient.HttpClient>;
  /**
   * Validate that a request targets the configured upstream subtree before its
   * body is consumed. Returns the rejection response when the target is
   * disallowed so callers can fail closed without buffering the body.
   */
  readonly rejectDisallowedTarget: (request: HttpServerRequest.HttpServerRequest) => O.Option<RequestTargetRejection>;
};

type GraphitiProxyQueueServiceShape = {
  readonly enqueue: (
    request: HttpServerRequest.HttpServerRequest
  ) => Effect.Effect<HttpServerResponse.HttpServerResponse>;
  readonly snapshot: Effect.Effect<ProxyQueueStats>;
  readonly beginShutdown: Effect.Effect<void>;
  readonly awaitDrain: (timeoutMs: number) => Effect.Effect<boolean>;
};

/**
 * Service tag for dependency health snapshots.
 *
 * @example
 * ```ts
 * console.log("GraphitiDependencyHealthService")
 * ```
 * @category models
 * @since 0.0.0
 */
export class GraphitiDependencyHealthService extends Context.Service<
  GraphitiDependencyHealthService,
  GraphitiDependencyHealthServiceShape
>()($I`GraphitiDependencyHealthService`) {}

/**
 * Service tag for forwarding requests to upstream graphiti.
 *
 * @example
 * ```ts
 * console.log("GraphitiProxyForwarderService")
 * ```
 * @category models
 * @since 0.0.0
 */
export class GraphitiProxyForwarderService extends Context.Service<
  GraphitiProxyForwarderService,
  GraphitiProxyForwarderServiceShape
>()($I`GraphitiProxyForwarderService`) {}

/**
 * Service tag for queueing and draining proxy traffic.
 *
 * @example
 * ```ts
 * console.log("GraphitiProxyQueueService")
 * ```
 * @category models
 * @since 0.0.0
 */
export class GraphitiProxyQueueService extends Context.Service<
  GraphitiProxyQueueService,
  GraphitiProxyQueueServiceShape
>()($I`GraphitiProxyQueueService`) {}
