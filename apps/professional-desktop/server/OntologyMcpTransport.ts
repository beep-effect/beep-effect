/**
 * Authenticated ontology MCP HTTP transport for the desktop sidecar.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { fromApprovedToolsPolicy, sanitizedToolkit, TierGate } from "@beep/mcp-kit";
import { OntologyMcpMutationToolsLive, OntologyMcpReadOnlyToolsLive } from "@beep/ontology-server/tools";
import { OntologyMutationToolkit, OntologyReadOnlyToolkit } from "@beep/ontology-use-cases/tools";
import { Context, Data, Effect, Layer, Metric } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as McpServer from "effect/unstable/ai/McpServer";
import { Headers, HttpMiddleware, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { requireRpcSessionToken } from "./RpcSessionAuth.ts";
import type { Redacted } from "effect";

const ontologyMcpOriginDecisions = Metric.counter("desktop_ontology_mcp_origin_decisions_total", {
  incremental: true,
});

const ontologyMcpAllowedOrigins: ReadonlyArray<string> = [
  "http://localhost:1421",
  "http://127.0.0.1:1421",
  "tauri://localhost",
  "http://tauri.localhost",
];

class OntologyMcpOriginForbidden extends Data.TaggedError("OntologyMcpOriginForbidden")<{
  readonly status: 403;
  readonly message: string;
}> {}

const isAllowedOntologyMcpOrigin = (headers: Headers.Headers): boolean =>
  O.exists(Headers.get(headers, "origin"), (origin) => A.contains(ontologyMcpAllowedOrigins, origin));

const originMiddleware = HttpMiddleware.make((effect) =>
  Effect.withFiber((fiber) => {
    const request = Context.getUnsafe(fiber.context, HttpServerRequest.HttpServerRequest);
    const allowed = isAllowedOntologyMcpOrigin(request.headers);
    const attributes = { decision: allowed ? "allowed" : "denied", method: request.method };
    return Metric.update(Metric.withAttributes(ontologyMcpOriginDecisions, attributes), 1).pipe(
      Effect.andThen(
        allowed
          ? effect
          : Effect.logWarning("ontology MCP origin denied").pipe(
              Effect.annotateLogs({ method: request.method, subsystem: "ontology_mcp" }),
              Effect.as(
                HttpServerResponse.jsonUnsafe(
                  new OntologyMcpOriginForbidden({
                    status: 403,
                    message: "Origin is not allowed for the ontology MCP endpoint.",
                  }),
                  { status: 403 }
                )
              )
            )
      ),
      Effect.withSpan("ontology.mcp.origin", { attributes })
    );
  })
);

const ontologyMcpSecurityMiddleware = (token: Redacted.Redacted<string>) =>
  HttpRouter.middleware(originMiddleware)
    .combine(HttpRouter.middleware(requireRpcSessionToken(token)))
    .combine(
      HttpRouter.middleware(
        HttpMiddleware.cors({
          allowedOrigins: ontologyMcpAllowedOrigins,
          allowedMethods: ["POST", "OPTIONS"],
          allowedHeaders: ["authorization", "content-type", "mcp-protocol-version", "mcp-session-id"],
          exposedHeaders: ["mcp-protocol-version", "mcp-session-id"],
        })
      )
    );

/** Build the `/mcp` route layer with read-only registration independent of mutation enablement.
 * @remarks Mutation registration is a separate feature-gated Layer and every mutation still dispatches through TierGate.
 * @example
 * ```ts
 * import { Redacted } from "effect"
 * import { makeOntologyMcpTransportLayer } from "./OntologyMcpTransport.ts"
 * const layer = makeOntologyMcpTransportLayer({
 *   token: Redacted.make("test-token"),
 *   mutationsEnabled: false,
 *   approvedMutationTools: []
 * })
 * console.log(layer)
 * ```
 * @category layers
 * @since 0.0.0
 */
export const makeOntologyMcpTransportLayer = (options: {
  readonly token: Redacted.Redacted<string>;
  readonly mutationsEnabled: boolean;
  readonly approvedMutationTools: ReadonlyArray<string>;
}) => {
  const security = ontologyMcpSecurityMiddleware(options.token);
  const server = McpServer.layerHttp({ name: "beep-ontology", version: "0.0.0", path: "/mcp" }).pipe(
    Layer.provide(security.layer)
  );
  const readOnly = sanitizedToolkit(OntologyReadOnlyToolkit).pipe(Layer.provide(OntologyMcpReadOnlyToolsLive));
  const mutations = sanitizedToolkit(OntologyMutationToolkit).pipe(
    Layer.provide(OntologyMcpMutationToolsLive),
    Layer.provide(
      Layer.succeed(TierGate)(TierGate.of(fromApprovedToolsPolicy({ approvedTools: options.approvedMutationTools })))
    )
  );
  const preflight = HttpRouter.add("OPTIONS", "/mcp", HttpServerResponse.empty({ status: 204 })).pipe(
    Layer.provide(security.layer)
  );
  const registration = options.mutationsEnabled ? Layer.merge(readOnly, mutations) : readOnly;
  const mcp = registration.pipe(Layer.provide(server));

  return Layer.merge(mcp, preflight);
};
