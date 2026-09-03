/**
 * Authenticated ontology MCP HTTP transport for the desktop sidecar.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EpistemicConfig } from "@beep/epistemic-config/server";
import {
  ExecutionSink,
  GrantOperation,
  GrantPurpose,
  GrantResource,
  SinkDestination,
} from "@beep/epistemic-domain/values/ExecutionGrant";
import { GovernedEgressLive, GovernedEgressOptions } from "@beep/epistemic-server/GovernedEgress";
import { GovernedTierGateLive, GovernedTierGateOptions } from "@beep/epistemic-server/GovernedTierGate";
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
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as McpProtocol from "effect/unstable/ai/McpProtocol";
import * as McpServer from "effect/unstable/ai/McpServer";
import { Headers, HttpMiddleware, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { requireRpcSessionToken } from "./RpcSessionAuth.ts";
import type * as Redacted from "effect/Redacted";

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

// Every governed ontology mutation writes the local workspace; the sink triple
// is a composition-root fact, so the boundary classifies its audience by
// construction (the URL-parsing resolver is for network-egress destinations).
// The raw destination never reaches the ledger — records carry its digest.
const ontologyWorkspaceSink = ExecutionSink.make({
  audience: "local-workspace",
  destination: SinkDestination.make("workspace://ontology"),
  sinkClass: "mcp-write",
});

// The publication branch's sink names the *class* of egress, not a URL, and
// that is deliberate: `ToolCallRequest` carries no parameters, so the gate
// cannot see which destination a dispatch intends. The split is therefore
// explicit — the gate decides whether this session may publish at all, the
// governed egress `Fetch` decides which destination a request may reach, and
// each writes its own decision row. Reading one row without the other tells
// half the story.
const ontologyEgressSink = ExecutionSink.make({
  audience: "external-network",
  destination: SinkDestination.make("network://governed-egress"),
  sinkClass: "network-egress",
});

// Generous against any interactive session length; a session's frozen grants
// expire together and an expired run can only deny.
const ontologySessionGrantTtl = Duration.hours(12);

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
 * `EpistemicConfig`; the entrypoint provides the Drizzle ledger over the shared
 * PGlite, and a test may inject a failing ledger to prove the fail-closed
 * refusal.
 *
 * `approvedMutationTools` lets a test register mutation tools while granting
 * none of them, proving that registration is not authorization. Production
 * never passes it.
 *
 * **Example** (Build the ontology transport layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer";
 * import * as Redacted from "effect/Redacted";
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
  readonly egressFetch?: typeof globalThis.fetch | undefined;
}) => {
  const approvedTools = options.approvedMutationTools ?? [];
  const security = ontologyMcpSecurityMiddleware(options.token);
  // `layerHttp` fails with `IllegalArgumentError` only on a malformed path or an
  // empty protocol list, both of which are literals here — so a failure is a
  // defect, not a startup condition the desktop shell can report.
  const server = McpServer.layerHttp({
    name: "beep-ontology",
    version: "0.0.0",
    path: "/mcp",
    protocols: [McpProtocol.v2025_06_18],
    // `layerHttp` now runs its own DNS-rebinding Origin check and answers 403 to
    // any request carrying an Origin outside this list. Left unset it rejects
    // every browser-origin request, so it must mirror the same allowlist the
    // surrounding origin middleware and CORS layer enforce.
    allowedOrigins: ontologyMcpAllowedOrigins,
  }).pipe(Layer.provide(security.layer), Layer.orDie);
  const readOnly = sanitizedToolkit(OntologyReadOnlyToolkit).pipe(Layer.provide(OntologyMcpReadOnlyToolsLive));
  const mutations = sanitizedToolkit(OntologyMutationToolkit).pipe(
    Layer.provide(OntologyMcpMutationToolsLive),
    Layer.provide(
      GovernedTierGateLive(
        GovernedTierGateOptions.make({
          grantTtl: ontologySessionGrantTtl,
          // Publication is governed by its own branch against a network sink;
          // granting it here as well would be a second, unintended authority
          // for it against the workspace sink.
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
  // Placement is load-bearing and is not type-checked: `Fetch` is a Reference,
  // so a missing override silently resolves to the platform fetch instead of
  // failing to compile. It goes into the graph that builds THIS client, which
  // is the client the publication handler receives.
  // `Layer.fresh` is load-bearing, not tidiness. `FetchHttpClient.layer` is a
  // module-level object and layer builds are memoized by object identity across
  // one graph, so without a fresh copy this governed client is the *same*
  // instance the sidecar's other consumers resolve — `AnthropicLive`
  // (`Anthropic.service.ts`) and `ObservabilityLive`'s OTLP exporter
  // (`runtime/Observability.ts`) both provide into this very layer. Whichever
  // builds first wins for all of them: the governed default-deny fetch would be
  // applied to every Anthropic and OTLP request, failing them with
  // `EgressDenied` and writing spurious denied rows into this boundary's
  // hash chain. Nothing type-checks this — `Fetch` is a Reference, so the
  // layer's output is `never`.
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
          // Drawn from the same approval list as the workspace branch, so
          // "registration is not authorization" holds here too: a test can
          // register the publication tool while granting nothing, and every
          // dispatch is refused before any destination is even considered.
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
  // No explicit OPTIONS route: `McpServer.layerHttp` now declares one itself, and
  // a second declaration on the same path is a hard router error. Nothing is lost
  // — `HttpMiddleware.cors` in `security` short-circuits every OPTIONS request
  // with a 204 plus CORS headers before any route handler is reached, so this
  // route was already unreachable.
  // The publication tool is registered only when an operator has named at least
  // one destination. An empty allowlist is the default, so the tool does not
  // exist on a stock install — the sink and its control ship together.
  const registration = Layer.unwrap(
    Effect.gen(function* () {
      const mcpConfig = yield* OntologyMcpConfig;
      const epistemic = yield* EpistemicConfig;
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
