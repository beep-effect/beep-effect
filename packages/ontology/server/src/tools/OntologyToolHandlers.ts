/**
 * Thin handlers for the ontology agent toolkit.
 *
 * @packageDocumentation
 * @category handlers
 * @since 0.0.0
 */

import { OntologyToolkit, OntologyToolService, OntologyToolServiceLive } from "@beep/ontology-use-cases/tools";
import { CanonicalizationServiceLive } from "@beep/rdf-canonize/adapters/canonicalization";
import { Effect, Layer } from "effect";
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
    return OntologyToolkit.of({
      ontology_capability_metadata: service.capabilityMetadata,
      ontology_export_provenance: service.exportProvenance,
      ontology_open_inspect: service.openInspect,
      ontology_propose_change_batch: service.proposeChangeBatch,
      ontology_repair: service.repair,
      ontology_search: service.search,
      ontology_snapshot_describe: service.snapshotDescribe,
      ontology_sparql_query: service.sparqlQuery,
      ontology_validate: service.validate,
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
