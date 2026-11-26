/**
 * Authenticated ontology MCP HTTP transport for the desktop sidecar.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ExecutionAuthorityConfig } from "@beep/execution-authority-config/server";
import {
  ExecutionSink,
  GrantOperation,
  GrantPurpose,
  GrantResource,
  SinkDestination,
} from "@beep/execution-authority-domain/values/ExecutionGrant";
import { GovernedEgressLive, GovernedEgressOptions } from "@beep/execution-authority-server/GovernedEgress";
import { GovernedTierGateLive, GovernedTierGateOptions } from "@beep/execution-authority-server/GovernedTierGate";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { sanitizedToolkit } from "@beep/mcp-kit/SanitizedSpan";
import { OntologyMcpConfig } from "@beep/ontology-config/server";
import {
  OntologyMcpMutationToolsLive,
  OntologyMcpPublishToolsLive,
  OntologyMcpReadOnlyToolsLive,
} from "@beep/ontology-server/tools";
import {
  OntologyMutationToolkit,
  OntologyPublishToolkit,
  OntologyReadOnlyToolkit,
  PublishProvenanceTool,
} from "@beep/ontology-use-cases/tools";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpServer from "effect/ai/McpServer";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Headers from "effect/http/Headers";
import * as HttpMiddleware from "effect/http/HttpMiddleware";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as S from "effect/Schema";
import { requireRpcSessionToken } from "./RpcSessionAuth.ts";
import type * as Redacted from "effect/Redacted";

const $I = $ProfessionalDesktopId.create("server/OntologyMcpTransport");

const ontologyMcpOriginDecisions = Metric.counter("desktop_ontology_mcp_origin_decisions_total", {
  incremental: true,
});

const portlessDevOrigin = "http://professional-desktop.beep.localhost:1355";
const portlessBypassViteOrigins = ["http://localhost:1421", "http://127.0.0.1:1421"];

/**
 * Browser origins allowed to reach sidecar MCP routes.
 *
 * @category configuration
 * @since 0.0.0
 */
export const ontologyMcpAllowedOrigins: ReadonlyArray<string> = [
  portlessDevOrigin,
  ...portlessBypassViteOrigins,
  "tauri://localhost",
  "http://tauri.localhost",
];

class OntologyMcpOriginForbidden extends S.TaggedError<OntologyMcpOriginForbidden, { readonly brand: unique symbol }>(
  $I`OntologyMcpOriginForbidden`
)(
  "OntologyMcpOriginForbidden",
  {
    status: S.tag(403),
    message: S.String,
  },
  $I.annoteError<OntologyMcpOriginForbidden>("OntologyMcpOriginForbidden", {
    description: "A request to the ontology MCP endpoint came from an origin outside the allow-list.",
  })
) {}

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
                  OntologyMcpOriginForbidden.make({
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

/**
 * Origin allowlist, launch-token check and CORS for a sidecar MCP route.
 *
 * **Details**
 *
 * Shared by the ontology and vault-sync MCP routes so both authenticate the same way.
 *
 * **Example** (Build the security middleware)
 *
 * ```ts
 * import * as Redacted from "effect/Redacted";
 * import { desktopMcpSecurityMiddleware } from "./OntologyMcpTransport.ts"
 * const security = desktopMcpSecurityMiddleware(Redacted.make("test-token"))
 * console.log(typeof security.layer)
 * ```
 * @category layers
 * @since 0.0.0
 */
export const desktopMcpSecurityMiddleware = (token: Redacted.Redacted) =>
  HttpRouter.middleware(originMiddleware)
    .combine(token.pipe(requireRpcSessionToken, (middleware) => HttpRouter.middleware(middleware)))
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

// decision: ontology-mcp-publication-gated-apart
const ontologyWorkspaceSink = ExecutionSink.make({
  audience: "local-workspace",
  destination: SinkDestination.make("workspace://ontology"),
  sinkClass: "mcp-write",
});

const ontologyEgressSink = ExecutionSink.make({
  audience: "external-network",
  destination: SinkDestination.make("network://governed-egress"),
  sinkClass: "network-egress",
});

const ontologySessionGrantTtl = Duration.hours(12);

type OntologyMcpEgressFetch = typeof globalThis.fetch;

const OntologyMcpEgressFetch = S.declare((u: unknown): u is OntologyMcpEgressFetch => P.isFunction(u)).pipe(
  $I.annoteSchema("OntologyMcpEgressFetch", {
    description:
      "Transport function a test injects beneath the governed egress boundary; a capability held by reference, never encoded or decoded.",
  })
);

/**
 * Options for {@link makeOntologyMcpTransportLayer}.
 *
 * **Example** (Build transport options)
 *
 * ```ts
 * import * as Redacted from "effect/Redacted";
 * import { OntologyMcpTransportOptions } from "./OntologyMcpTransport.ts"
 * const options = OntologyMcpTransportOptions.make({ token: Redacted.make("test-token") })
 * console.log(options.approvedMutationTools)
 * // undefined
 * ```
 * @category models
 * @since 0.0.0
 */
export class OntologyMcpTransportOptions extends S.Opaque<
  OntologyMcpTransportOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    token: S.Redacted(S.String).annotateKey({
      description: "Launch token every MCP request must present as its bearer credential.",
    }),
    approvedMutationTools: S.String.pipe(S.Array, S.optionalKey).annotateKey({
      description: "Mutation tools granted to the session; test-only, production grants none.",
    }),
    egressFetch: OntologyMcpEgressFetch.pipe(S.optionalKey).annotateKey({
      description: "Fetch beneath the governed egress boundary; test-only, production uses the platform fetch.",
    }),
  }).pipe(
    $I.annoteSchema("OntologyMcpTransportOptions", {
      description: "Options for the authenticated ontology MCP transport layer.",
    })
  )
) {}

/**
 * Builds the `/mcp` route layer with read-only registration independent of mutation enablement.
 *
 * **Details**
 *
 * Mutation registration is decided by `OntologyMcpConfig` inside
 * `Layer.unwrap`, so the layer-shape branch stays where the layer is built.
 * Every mutation dispatches through the governed TierGate, which freezes a
 * per-session grant set and writes a write-ahead ledger decision before any
 * effect runs. The returned layer therefore requires `ExecutionLedger` and
 * `ExecutionAuthorityConfig`; the entrypoint provides the Drizzle ledger over the shared
 * PGlite, and a test may inject a failing ledger to prove the fail-closed
 * refusal.
 *
 * `approvedMutationTools` lets a test register mutation tools while granting
 * none of them, proving that registration is not authorization. Production
 * never passes it, nor `egressFetch`, which only tests supply to observe the
 * governed egress boundary without reaching the network.
 *
 * **Example** (Build the ontology transport layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer";
 * import * as Redacted from "effect/Redacted";
 * import { makeOntologyMcpTransportLayer, OntologyMcpTransportOptions } from "./OntologyMcpTransport.ts"
 * const layer = makeOntologyMcpTransportLayer(OntologyMcpTransportOptions.make({ token: Redacted.make("test-token") }))
 * console.log(Layer.isLayer(layer))
 * ```
 * @category layers
 * @since 0.0.0
 */
export const makeOntologyMcpTransportLayer = (options: OntologyMcpTransportOptions) => {
  const approvedTools = options.approvedMutationTools ?? [];
  const security = desktopMcpSecurityMiddleware(options.token);
  // decision: mcp-layer-http-owns-origin-and-preflight
  const server = McpServer.layerHttp({
    name: "beep-ontology",
    version: "0.0.0",
    path: "/mcp",
    protocols: [McpProtocol.v2025_06_18],
    allowedOrigins: ontologyMcpAllowedOrigins,
  }).pipe(Layer.provide(security.layer), Layer.orDie);
  const readOnly = sanitizedToolkit(OntologyReadOnlyToolkit).pipe(Layer.provide(OntologyMcpReadOnlyToolsLive));
  const mutations = sanitizedToolkit(OntologyMutationToolkit).pipe(
    Layer.provide(OntologyMcpMutationToolsLive),
    Layer.provide(
      GovernedTierGateLive(
        GovernedTierGateOptions.make({
          grantTtl: ontologySessionGrantTtl,
          operations: A.map(
            A.filter(approvedTools, (tool) => tool !== PublishProvenanceTool.name),
            (tool) => GrantOperation.make(tool)
          ),
          purpose: GrantPurpose.make("ontology-workspace-mutation"),
          resource: GrantResource.make("ontology-workspace"),
          sink: ontologyWorkspaceSink,
        })
      )
    )
  );
  // decision: governed-egress-client-is-layer-fresh
  const governedHttpClient = Layer.fresh(FetchHttpClient.layer).pipe(
    Layer.provide(
      GovernedEgressLive({
        grant: GovernedEgressOptions.make({
          grantTtl: ontologySessionGrantTtl,
          operation: GrantOperation.make("http-egress"),
          purpose: GrantPurpose.make("ontology-provenance-publication"),
          resource: GrantResource.make("ontology-workspace"),
        }),
        baseFetch: options.egressFetch,
      })
    )
  );
  const publish = sanitizedToolkit(OntologyPublishToolkit).pipe(
    Layer.provide(OntologyMcpPublishToolsLive),
    Layer.provide(governedHttpClient),
    Layer.provide(
      GovernedTierGateLive(
        GovernedTierGateOptions.make({
          grantTtl: ontologySessionGrantTtl,
          operations: A.map(
            A.filter(approvedTools, (tool) => tool === PublishProvenanceTool.name),
            (tool) => GrantOperation.make(tool)
          ),
          purpose: GrantPurpose.make("ontology-provenance-publication"),
          resource: GrantResource.make("ontology-workspace"),
          sink: ontologyEgressSink,
        })
      )
    )
  );
  const registration = Layer.unwrap(
    Effect.gen(function* () {
      const mcpConfig = yield* OntologyMcpConfig;
      const epistemic = yield* ExecutionAuthorityConfig;
      if (!mcpConfig.mutationsEnabled) {
        return readOnly;
      }
      const governed = Layer.merge(readOnly, mutations);
      return epistemic.destinationAllowlist.length === 0 ? governed : Layer.merge(governed, publish);
    })
  );
  const mcp = registration.pipe(Layer.provide(server));

  return mcp;
};
