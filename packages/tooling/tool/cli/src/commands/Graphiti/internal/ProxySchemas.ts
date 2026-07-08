/**
 * Schema models for the Graphiti proxy data plane.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { SchemaTransformation } from "effect";
import * as S from "effect/Schema";
import { UrlParams } from "effect/unstable/http";

const $I = $RepoCliId.create("commands/Graphiti/internal/ProxySchemas");

/**
 * Container health literal union.
 *
 * @example
 * ```ts
 * console.log("ContainerHealthState")
 * ```
 * @category models
 * @since 0.0.0
 */
export const ContainerHealthState = LiteralKit(["unknown", "healthy", "unhealthy", "starting"]).pipe(
  $I.annoteSchema("ContainerHealthState", {
    description: "Container health status as reported by docker inspect.",
  })
);

/**
 * Dependency health literal union.
 *
 * @example
 * ```ts
 * console.log("DependencyHealthState")
 * ```
 * @category models
 * @since 0.0.0
 */
export const DependencyHealthState = LiteralKit(["unknown", "ok", "degraded"]).pipe(
  $I.annoteSchema("DependencyHealthState", {
    description: "Dependency health status used by graphiti proxy.",
  })
);

/**
 * Structured error kind values returned by proxy failures.
 *
 * @example
 * ```ts
 * import { ProxyErrorKind } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * console.log(ProxyErrorKind.is("queue_full"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const ProxyErrorKind = LiteralKit([
  "queue_full",
  "payload_too_large",
  "upstream_failure",
  "upstream_timeout",
  "shutting_down",
]).pipe(
  $I.annoteSchema("ProxyErrorKind", {
    description: "Structured graphiti proxy error identifiers.",
  })
);

/**
 * Health status values emitted by proxy health endpoints.
 *
 * @example
 * ```ts
 * import { ProxyHealthStatus } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * console.log(ProxyHealthStatus.is("ok"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const ProxyHealthStatus = LiteralKit(["ok", "degraded"]).pipe(
  $I.annoteSchema("ProxyHealthStatus", {
    description: "Health endpoint status values.",
  })
);

/**
 * Forwarding lane assigned to a proxied MCP request.
 *
 * @example
 * ```ts
 * import { ProxyLane } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * console.log(ProxyLane.is("fast"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const ProxyLane = LiteralKit(["queued", "fast"]).pipe(
  $I.annoteSchema("ProxyLane", {
    description: "Graphiti proxy forwarding lanes.",
  })
);
/**
 * Runtime type represented by {@link ProxyLane}.
 *
 * @example
 * ```ts
 * import type { ProxyLane } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * const lane: ProxyLane = "queued"
 * console.log(lane)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ProxyLane = typeof ProxyLane.Type;

/**
 * MCP methods allowed to bypass the serialized queue.
 *
 * @example
 * ```ts
 * import { GraphitiProxyFastMcpMethod } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * console.log(GraphitiProxyFastMcpMethod.is("tools/list"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const GraphitiProxyFastMcpMethod = LiteralKit([
  "initialize",
  "notifications/initialized",
  "ping",
  "prompts/list",
  "resources/list",
  "tools/list",
]).pipe(
  $I.annoteSchema("GraphitiProxyFastMcpMethod", {
    description: "Cheap MCP methods allowed to bypass serialized Graphiti memory work.",
  })
);
/**
 * Guard for fast-lane MCP method names.
 *
 * @example
 * ```ts
 * import { isGraphitiProxyFastMcpMethod } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * console.log(isGraphitiProxyFastMcpMethod("ping"))
 * ```
 * @category guards
 * @since 0.0.0
 */
export const isGraphitiProxyFastMcpMethod = S.is(GraphitiProxyFastMcpMethod);

/**
 * Graphiti MCP tool names allowed onto the fast lane.
 *
 * @example
 * ```ts
 * import { GraphitiProxyFastMcpToolName } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * console.log(GraphitiProxyFastMcpToolName.is("get_status"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const GraphitiProxyFastMcpToolName = LiteralKit(["get_status"]).pipe(
  $I.annoteSchema("GraphitiProxyFastMcpToolName", {
    description: "Cheap Graphiti MCP tools allowed to bypass serialized Graphiti memory work.",
  })
);
/**
 * Guard for fast-lane Graphiti MCP tool names.
 *
 * @example
 * ```ts
 * import { isGraphitiProxyFastMcpToolName } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * console.log(isGraphitiProxyFastMcpToolName("get_status"))
 * ```
 * @category guards
 * @since 0.0.0
 */
export const isGraphitiProxyFastMcpToolName = S.is(GraphitiProxyFastMcpToolName);

/**
 * Per-container dependency health detail payload.
 *
 * @example
 * ```ts
 * import { DependencyHealthDetails } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * const details = DependencyHealthDetails.make({ falkor: "healthy", graphiti: "healthy" })
 * console.log(details.falkor)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DependencyHealthDetails extends S.Class<DependencyHealthDetails>($I`DependencyHealthDetails`)(
  {
    falkor: ContainerHealthState,
    graphiti: ContainerHealthState,
  },
  $I.annote("DependencyHealthDetails", {
    description: "Dependency-level container health details.",
  })
) {}

/**
 * Cached dependency health snapshot payload.
 *
 * @example
 * ```ts
 * console.log("DependencyHealthSnapshot")
 * ```
 * @category models
 * @since 0.0.0
 */
export class DependencyHealthSnapshot extends S.Class<DependencyHealthSnapshot>($I`DependencyHealthSnapshot`)(
  {
    status: DependencyHealthState,
    details: DependencyHealthDetails,
  },
  $I.annote("DependencyHealthSnapshot", {
    description: "Cached dependency health snapshot.",
  })
) {}

/**
 * Queue and processing counters for proxy introspection.
 *
 * @example
 * ```ts
 * console.log("ProxyQueueStats")
 * ```
 * @category models
 * @since 0.0.0
 */
export class ProxyQueueStats extends S.Class<ProxyQueueStats>($I`ProxyQueueStats`)(
  {
    active: S.Finite,
    queued: S.Finite,
    peakQueueDepth: S.Finite,
    processed: S.Finite,
    failed: S.Finite,
    rejected: S.Finite,
    concurrency: S.Finite,
    maxQueue: S.Finite,
    upstream: S.String,
  },
  $I.annote("ProxyQueueStats", {
    description: "Queue and throughput counters for graphiti proxy.",
  })
) {}

/**
 * Structured JSON payload for health endpoints.
 *
 * @example
 * ```ts
 * console.log("ProxyHealthPayload")
 * ```
 * @category models
 * @since 0.0.0
 */
export class ProxyHealthPayload extends S.Class<ProxyHealthPayload>($I`ProxyHealthPayload`)(
  {
    status: ProxyHealthStatus,
    active: S.Finite,
    queued: S.Finite,
    peakQueueDepth: S.Finite,
    processed: S.Finite,
    failed: S.Finite,
    rejected: S.Finite,
    concurrency: S.Finite,
    maxQueue: S.Finite,
    upstream: S.String,
    dependencies: DependencyHealthDetails,
  },
  $I.annote("ProxyHealthPayload", {
    description: "JSON payload returned by /healthz and /metrics routes.",
  })
) {}

/**
 * JSON error body returned by proxy failure responses.
 *
 * @example
 * ```ts
 * import { ProxyErrorPayload } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * const payload = ProxyErrorPayload.make({ error: "queue_full", message: "try later" })
 * console.log(payload.error)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ProxyErrorPayload extends S.Class<ProxyErrorPayload>($I`ProxyErrorPayload`)(
  {
    error: ProxyErrorKind,
    message: S.String,
  },
  $I.annote("ProxyErrorPayload", {
    description: "Structured proxy error payload.",
  })
) {}

/**
 * MCP tools/call params used for lane selection.
 *
 * @example
 * ```ts
 * import { GraphitiMcpToolCallParams } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * const params = GraphitiMcpToolCallParams.make({ name: "get_status" })
 * console.log(params.name)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GraphitiMcpToolCallParams extends S.Class<GraphitiMcpToolCallParams>($I`GraphitiMcpToolCallParams`)(
  {
    name: S.optionalKey(S.String),
  },
  $I.annote("GraphitiMcpToolCallParams", {
    description: "Subset of MCP tools/call params needed for proxy lane selection.",
  })
) {}

/**
 * JSON-RPC request subset inspected by the proxy lane classifier.
 *
 * @example
 * ```ts
 * import { GraphitiMcpJsonRpcRequest } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * const request = GraphitiMcpJsonRpcRequest.make({ method: "ping" })
 * console.log(request.method)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GraphitiMcpJsonRpcRequest extends S.Class<GraphitiMcpJsonRpcRequest>($I`GraphitiMcpJsonRpcRequest`)(
  {
    method: S.String,
    params: S.optionalKey(GraphitiMcpToolCallParams),
  },
  $I.annote("GraphitiMcpJsonRpcRequest", {
    description: "Subset of a JSON-RPC MCP request needed for Graphiti proxy lane selection.",
  })
) {}

/**
 * Schema bridge from URLSearchParams to Effect UrlParams.
 *
 * @example
 * ```ts
 * import { decodeUrlSearchParams } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 * import { Effect } from "effect"
 *
 * const decoded = Effect.runSync(decodeUrlSearchParams(new URLSearchParams("q=graphiti")))
 * console.log(decoded.params.length)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const urlSearchParamsSchema = S.instanceOf(URLSearchParams).pipe(
  S.decodeTo(
    UrlParams.UrlParamsSchema,
    SchemaTransformation.transform({
      decode: UrlParams.fromInput,
      encode: (params) => {
        const next = new URLSearchParams();
        for (const [key, value] of params.params) {
          next.append(key, value);
        }
        return next;
      },
    })
  ),
  $I.annoteSchema("UrlSearchParamsToUrlParams", {
    description: "Schema transformation from URLSearchParams into Effect UrlParams.",
  })
);

/**
 * Decode URLSearchParams into Effect UrlParams.
 *
 * @example
 * ```ts
 * import { decodeUrlSearchParams } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 * import { Effect } from "effect"
 *
 * console.log(Effect.runSync(decodeUrlSearchParams(new URLSearchParams("a=b"))).params[0])
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeUrlSearchParams = S.decodeUnknownEffect(urlSearchParamsSchema);
/**
 * Decode raw Docker health text into a known container health state.
 *
 * @example
 * ```ts
 * import { decodeContainerHealthState } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrUndefined(decodeContainerHealthState("healthy")))
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeContainerHealthState = S.decodeUnknownOption(ContainerHealthState);
/**
 * Decode a JSON string into the MCP request subset used by lane selection.
 *
 * @example
 * ```ts
 * import { decodeGraphitiMcpJsonRpcRequest } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 * import * as O from "effect/Option"
 *
 * const decoded = decodeGraphitiMcpJsonRpcRequest('{"method":"ping"}')
 * console.log(O.isSome(decoded))
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeGraphitiMcpJsonRpcRequest = S.decodeUnknownOption(S.fromJsonString(GraphitiMcpJsonRpcRequest));
/**
 * Fallback container health state used when Docker output is missing or unknown.
 *
 * @example
 * ```ts
 * import { unknownContainerHealthState } from "@beep/repo-cli/commands/Graphiti/internal/ProxySchemas"
 *
 * console.log(unknownContainerHealthState === "unknown")
 * ```
 * @category constants
 * @since 0.0.0
 */
export const unknownContainerHealthState: S.Schema.Type<typeof ContainerHealthState> = "unknown";
