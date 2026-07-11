/**
 * Thin handlers for the ontology agent toolkit.
 *
 * @packageDocumentation
 * @category handlers
 * @since 0.0.0
 */

import { CurrentMcpCaller, dispatchWithTierGate, TierGate, TierGateDispatchResult } from "@beep/mcp-kit";
import { OntologyChangeActor } from "@beep/ontology-domain/aggregates/Session";
import {
  ExportProvenanceTool,
  OntologyActorIdentityRefusal,
  OntologyMutationToolkit,
  OntologyReadOnlyToolkit,
  OntologyTierGateRefusal,
  OntologyToolkit,
  OntologyToolService,
  OntologyToolServiceLive,
  ProposeChangeBatchTool,
  RepairOntologyTool,
} from "@beep/ontology-use-cases/tools";
import { CanonicalizationServiceLive } from "@beep/rdf-canonize/adapters/canonicalization";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import { SessionServerLayer } from "../aggregates/Session/Session.layer.js";
import type * as Tool from "effect/unstable/ai/Tool";

/** Thin service-delegating handler layer for the ontology toolkit.
 * @example
 * ```ts
 * import { OntologyToolkitHandlersLive } from "@beep/ontology-server/tools"
 * console.log(OntologyToolkitHandlersLive)
 * ```
 * @category handlers
 * @since 0.0.0
 */
export const OntologyToolkitHandlersLive: Layer.Layer<
  Tool.HandlersFor<typeof OntologyToolkit.tools>,
  never,
  OntologyToolService
> = OntologyToolkit.toLayer(
  Effect.gen(function* () {
    const service = yield* OntologyToolService;
    const missingActor = () =>
      Effect.fail(
        OntologyActorIdentityRefusal.make({
          guidance: "Invoke mutation through the authenticated MCP transport so caller identity can be resolved.",
          recoverable: true,
        })
      );
    return OntologyToolkit.of({
      ontology_capability_metadata: service.capabilityMetadata,
      ontology_export_provenance: service.exportProvenance,
      ontology_open_inspect: service.openInspect,
      ontology_propose_change_batch: missingActor,
      ontology_repair: missingActor,
      ontology_search: service.search,
      ontology_snapshot_describe: service.snapshotDescribe,
      ontology_sparql_query: service.sparqlQuery,
      ontology_validate: service.validate,
    });
  })
);

const authenticatedMcpActor = Effect.fn("Ontology.Tools.authenticatedMcpActor")(function* () {
  const caller = yield* CurrentMcpCaller;
  return yield* O.match(caller, {
    onNone: () =>
      Effect.fail(
        OntologyActorIdentityRefusal.make({
          guidance: "Initialize through the authenticated MCP transport and retry the mutation.",
          recoverable: true,
        })
      ),
    onSome: (identity) =>
      Effect.succeed(OntologyChangeActor.make(`urn:beep:desktop-rpc-session:mcp-client:${identity.clientId}`)),
  });
});

const gatedMutation = Effect.fn("Ontology.Tools.gatedMutation")(function* <A, E, R>(
  tool: typeof ProposeChangeBatchTool | typeof RepairOntologyTool | typeof ExportProvenanceTool,
  effect: Effect.Effect<A, E, R>
) {
  const dispatch = yield* dispatchWithTierGate({ tool, toolCallId: O.none() }, effect);
  return yield* TierGateDispatchResult.$match(dispatch, {
    Dispatched: ({ value }) => Effect.succeed(value),
    Refused: ({ audit }) =>
      Effect.fail(
        OntologyTierGateRefusal.make({
          guidance: `${audit.reason} Resolve the mutation tier and retry.`,
          recoverable: true,
        })
      ),
  });
});

/** Read-only MCP handlers that remain available while mutation registration is disabled.
 * @example
 * ```ts
 * import { OntologyMcpReadOnlyHandlersLive } from "@beep/ontology-server/tools"
 * console.log(OntologyMcpReadOnlyHandlersLive)
 * ```
 * @category handlers
 * @since 0.0.0
 */
export const OntologyMcpReadOnlyHandlersLive = OntologyReadOnlyToolkit.toLayer(
  Effect.gen(function* () {
    const service = yield* OntologyToolService;
    return OntologyReadOnlyToolkit.of({
      ontology_capability_metadata: service.capabilityMetadata,
      ontology_open_inspect: service.openInspect,
      ontology_search: service.search,
      ontology_snapshot_describe: service.snapshotDescribe,
      ontology_sparql_query: service.sparqlQuery,
      ontology_validate: service.validate,
    });
  })
);

/** Authenticated, TierGate-wrapped mutation handlers for the MCP transport.
 * @example
 * ```ts
 * import { OntologyMcpMutationHandlersLive } from "@beep/ontology-server/tools"
 * console.log(OntologyMcpMutationHandlersLive)
 * ```
 * @category handlers
 * @since 0.0.0
 */
export const OntologyMcpMutationHandlersLive = OntologyMutationToolkit.toLayer(
  Effect.gen(function* () {
    const service = yield* OntologyToolService;
    const gate = yield* TierGate;
    const gateMutation = <A, E, R>(
      tool: typeof ProposeChangeBatchTool | typeof RepairOntologyTool | typeof ExportProvenanceTool,
      effect: Effect.Effect<A, E, R>
    ) => gatedMutation(tool, effect).pipe(Effect.provideService(TierGate, gate));
    return OntologyMutationToolkit.of({
      ontology_export_provenance: (request) => gateMutation(ExportProvenanceTool, service.exportProvenance(request)),
      ontology_propose_change_batch: Effect.fn("ontology_propose_change_batch")(function* (request) {
        const actor = yield* authenticatedMcpActor();
        return yield* gateMutation(ProposeChangeBatchTool, service.proposeChangeBatch(request, actor));
      }),
      ontology_repair: Effect.fn("ontology_repair")(function* (request) {
        const actor = yield* authenticatedMcpActor();
        return yield* gateMutation(RepairOntologyTool, service.repair(request, actor));
      }),
    });
  })
);

const OntologyToolServiceServerLive = OntologyToolServiceLive.pipe(
  Layer.provideMerge(SessionServerLayer),
  Layer.provide(CanonicalizationServiceLive)
);

/** Fully wired real-engine ontology toolkit handler layer without transport.
 * @example
 * ```ts
 * import { OntologyToolsLive } from "@beep/ontology-server/tools"
 * console.log(OntologyToolsLive)
 * ```
 * @category layers
 * @since 0.0.0
 */
export const OntologyToolsLive = OntologyToolkitHandlersLive.pipe(Layer.provideMerge(OntologyToolServiceServerLive));

/** Fully wired read-only MCP ontology handlers over the real engine stack.
 * @example
 * ```ts
 * import { OntologyMcpReadOnlyToolsLive } from "@beep/ontology-server/tools"
 * console.log(OntologyMcpReadOnlyToolsLive)
 * ```
 * @category layers
 * @since 0.0.0
 */
export const OntologyMcpReadOnlyToolsLive = OntologyMcpReadOnlyHandlersLive.pipe(
  Layer.provideMerge(OntologyToolServiceServerLive)
);

/** Fully wired TierGate-protected mutation handlers over the real engine stack.
 * @example
 * ```ts
 * import { OntologyMcpMutationToolsLive } from "@beep/ontology-server/tools"
 * console.log(OntologyMcpMutationToolsLive)
 * ```
 * @category layers
 * @since 0.0.0
 */
export const OntologyMcpMutationToolsLive = OntologyMcpMutationHandlersLive.pipe(
  Layer.provideMerge(OntologyToolServiceServerLive)
);
