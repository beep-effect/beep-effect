/**
 * Authenticated ontology MCP HTTP transport for the desktop sidecar.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ExecutionSink,
  GrantOperation,
  GrantPurpose,
  GrantResource,
  SinkDestination,
} from "@beep/epistemic-domain/values/ExecutionGrant";
import { GovernedTierGateLive } from "@beep/epistemic-server/GovernedTierGate";
import { sanitizedToolkit } from "@beep/mcp-kit";
import { OntologyMcpConfig } from "@beep/ontology-config/server";
import { OntologyMcpMutationToolsLive, OntologyMcpReadOnlyToolsLive } from "@beep/ontology-server/tools";
import {
  ExportProvenanceTool,
  OntologyMutationToolkit,
  OntologyReadOnlyToolkit,
  ProposeChangeBatchTool,
  RepairOntologyTool,
} from "@beep/ontology-use-cases/tools";
import { A, O } from "@beep/utils";
import { Context, Data, Duration, Effect, Layer, Metric } from "effect";
import * as McpServer from "effect/unstable/ai/McpServer";
import { Headers, HttpMiddleware, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { requireRpcSessionToken } from "./RpcSessionAuth.ts";
import type { Redacted } from "effect";

const ontologyMcpOriginDecisions = Metric.counter("desktop_ontology_mcp_origin_decisions_total", {
  incremental: true,
});

const ontologyMcpAllowedOrigins: ReadonlyArray<string> = [
  // Canonical portless dev origin; the 1421 entries cover the PORTLESS=0
  // diagnostic bypass (vite falls back to --port 1421).
  "http://professional-desktop.beep.localhost:1355",
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

const ontologyMcpSecurityMiddleware = (token: Redacted.Redacted) =>
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

/** Ontology mutation tools eligible to dispatch once registration is enabled.
 * @remarks Registration and approval are separate gates; this list is the approval half and is inert while mutations stay unregistered. It becomes the granted operations of each MCP session's frozen grant set.
 * @category constants
 * @since 0.0.0
 */
const approvedOntologyMutationTools: ReadonlyArray<string> = [
  ProposeChangeBatchTool.name,
  RepairOntologyTool.name,
  ExportProvenanceTool.name,
];

// Every governed ontology mutation writes the local workspace; the sink triple
// is a composition-root fact, so the boundary classifies its audience by
// construction (the URL-parsing resolver is for network-egress destinations).
// The raw destination never reaches the ledger — records carry its digest.
const ontologyWorkspaceSink = ExecutionSink.make({
  audience: "local-workspace",
  destination: SinkDestination.make("workspace://ontology"),
  sinkClass: "mcp-write",
});

// Generous against any interactive session length; a session's frozen grants
// expire together and an expired run can only deny.
const ontologySessionGrantTtl = Duration.hours(12);

/** Build the `/mcp` route layer with read-only registration independent of mutation enablement.
 * @remarks Mutation registration is decided by `OntologyMcpConfig` inside `Layer.unwrap`, so the layer-shape branch stays where the layer is built; every mutation dispatches through the governed TierGate, which freezes a per-session grant set and writes a write-ahead ledger decision before any effect runs. The returned layer therefore requires `ExecutionLedger` and `EpistemicConfig`; the entrypoint provides the Drizzle ledger over the shared PGlite, and a test may inject a failing ledger to prove the fail-closed refusal.
 * @remarks `approvedMutationTools` exists so a test can register the mutation tools while granting none of them, which is the only way to prove that registration is not authorization. Production never passes it.
 * @example
 * ```ts
 * import { Layer, Redacted } from "effect"
 * import { makeOntologyMcpTransportLayer } from "./OntologyMcpTransport.ts"
 * const layer = makeOntologyMcpTransportLayer({ token: Redacted.make("test-token") })
 * console.log(Layer.isLayer(layer))
 * ```
 * @category layers
 * @since 0.0.0
 */
export const makeOntologyMcpTransportLayer = (options: {
  readonly token: Redacted.Redacted;
  readonly approvedMutationTools?: ReadonlyArray<string> | undefined;
}) => {
  const approvedTools = options.approvedMutationTools ?? approvedOntologyMutationTools;
  const security = ontologyMcpSecurityMiddleware(options.token);
  const server = McpServer.layerHttp({ name: "beep-ontology", version: "0.0.0", path: "/mcp" }).pipe(
    Layer.provide(security.layer)
  );
  const readOnly = sanitizedToolkit(OntologyReadOnlyToolkit).pipe(Layer.provide(OntologyMcpReadOnlyToolsLive));
  const mutations = sanitizedToolkit(OntologyMutationToolkit).pipe(
    Layer.provide(OntologyMcpMutationToolsLive),
    Layer.provide(
      GovernedTierGateLive({
        grantTtl: ontologySessionGrantTtl,
        operations: A.map(approvedTools, (tool) => GrantOperation.make(tool)),
        purpose: GrantPurpose.make("ontology-workspace-mutation"),
        resource: GrantResource.make("ontology-workspace"),
        sink: ontologyWorkspaceSink,
      })
    )
  );
  const preflight = HttpRouter.add("OPTIONS", "/mcp", HttpServerResponse.empty({ status: 204 })).pipe(
    Layer.provide(security.layer)
  );
  const registration = Layer.unwrap(
    Effect.map(OntologyMcpConfig, (config) => (config.mutationsEnabled ? Layer.merge(readOnly, mutations) : readOnly))
  );
  const mcp = registration.pipe(Layer.provide(server));

  return Layer.merge(mcp, preflight);
};
