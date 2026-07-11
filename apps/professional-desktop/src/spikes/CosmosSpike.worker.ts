/**
 * Worker-side synthetic ontology projection for the cosmos spike.
 *
 * @packageDocumentation
 * @category projections
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity";
import {
  buildOntologyGraphProjection,
  defaultOntologyGraphProjectionOptions,
  OntologyGraphProjection,
  OntologyGraphProjectionOptions,
  OntologyMetrics,
  OntologyRelationshipSummary,
  OntologyResourceSummary,
  OntologySnapshot,
} from "@beep/ontology-use-cases/aggregates/Session/worker";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import * as S from "effect/Schema";

const $I = $ProfessionalDesktopId.create("spikes/CosmosSpike.worker");

type SyntheticProjectionRequest = {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly seed: number;
};

/**
 * Response posted from the synthetic cosmos projection worker.
 *
 * @example
 * ```ts
 * import { SyntheticProjectionResponse } from "@/spikes/CosmosSpike.worker"
 * import { OntologyGraphProjection, OntologyGraphProjectionStats } from "@beep/ontology-use-cases/aggregates/Session/worker"
 *
 * const projection = OntologyGraphProjection.make({
 *   revision: 0,
 *   foldLevel: "L3",
 *   labelDetail: "hidden",
 *   nodeCount: 0,
 *   edgeCount: 0,
 *   nodeIds: new Uint32Array([]),
 *   nodeKinds: new Uint8Array([]),
 *   nodeFlags: new Uint8Array([]),
 *   edgeIds: new Uint32Array([]),
 *   edgeKinds: new Uint8Array([]),
 *   pointPositions: new Float32Array([]),
 *   links: new Float32Array([]),
 *   nodes: [],
 *   edges: [],
 *   clusters: [],
 *   changedNodeIds: [],
 *   changedEdgeIds: [],
 *   stats: OntologyGraphProjectionStats.make({
 *     visibleResourceCount: 0,
 *     projectedNodeCount: 0,
 *     projectedEdgeCount: 0,
 *     foldedResourceCount: 0
 *   })
 * })
 *
 * const response = SyntheticProjectionResponse.make({
 *   elementCount: 0,
 *   projection
 * })
 *
 * console.log(response.elementCount)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export class SyntheticProjectionResponse extends S.Class<SyntheticProjectionResponse>($I`SyntheticProjectionResponse`)(
  {
    elementCount: S.Int,
    projection: OntologyGraphProjection,
  },
  $I.annote("SyntheticProjectionResponse", {
    description: "Response posted from the synthetic cosmos projection worker.",
  })
) {}

const RDFS_SUB_CLASS_OF = `${RDFS_NAMESPACE}subClassOf`;

const nextSeed = (value: number): number => (value * 1_664_525 + 1_013_904_223) % 4_294_967_296;

const labelFor = (index: number): string => (index % 5 === 0 ? `Class ${index}` : `Individual ${index}`);

const iriFor = (index: number): string => `https://example.test/synthetic/${index}`;

const resourceFor = (index: number): OntologyResourceSummary => {
  const isClass = index % 5 === 0;
  const parentIndex = isClass && index >= 500 ? index % 500 : 0;
  return OntologyResourceSummary.make({
    iri: iriFor(index),
    label: labelFor(index),
    kind: isClass ? "class" : "individual",
    classification: isClass ? "tbox" : "abox",
    types: [],
    parentIris: isClass && index >= 500 ? [iriFor(parentIndex)] : [],
    sourcePartitions: ["asserted"],
  });
};

const relationshipFor = (index: number, nodeCount: number, state: number): OntologyRelationshipSummary => {
  const source = index % nodeCount;
  const offset = nodeCount === 1 ? 0 : 1 + (state % (nodeCount - 1));
  const target = (source + offset) % nodeCount;
  const isClassLink = source % 5 === 0 && target % 5 === 0;
  const predicateIri = isClassLink ? RDFS_SUB_CLASS_OF : RDF_TYPE.value;

  return OntologyRelationshipSummary.make({
    sourceIri: iriFor(source),
    predicateIri,
    objectIri: iriFor(target),
    label: isClassLink ? "subClassOf" : "type",
    sourcePartitions: ["asserted"],
  });
};

const buildSyntheticProjection = (request: SyntheticProjectionRequest): SyntheticProjectionResponse => {
  const resources: Array<OntologyResourceSummary> = [];
  const relationships: Array<OntologyRelationshipSummary> = [];
  let index = 0;
  let state = request.seed;

  while (index < request.nodeCount) {
    resources.push(resourceFor(index));
    index += 1;
  }

  index = 0;
  while (index < request.edgeCount) {
    state = nextSeed(state);
    relationships.push(relationshipFor(index, request.nodeCount, state));
    index += 1;
  }

  const snapshot = OntologySnapshot.make({
    sessionId: "cosmos-spike",
    resources,
    hierarchy: [],
    relationships,
    metrics: OntologyMetrics.make({
      quadCount: request.edgeCount,
      resourceCount: request.nodeCount,
      classCount: resources.filter((resource) => resource.kind === "class").length,
      propertyCount: 0,
      individualCount: resources.filter((resource) => resource.kind === "individual").length,
      tboxCount: resources.filter((resource) => resource.classification === "tbox").length,
      aboxCount: resources.filter((resource) => resource.classification === "abox").length,
    }),
  });

  const projection = buildOntologyGraphProjection(
    snapshot,
    OntologyGraphProjectionOptions.make({
      ...defaultOntologyGraphProjectionOptions(),
      foldLevel: "L3",
      autoClusterThreshold: 2_500,
      structuralFoldThreshold: 24,
    })
  );

  return SyntheticProjectionResponse.make({
    elementCount: request.nodeCount + request.edgeCount,
    projection,
  });
};

globalThis.addEventListener("message", (event: MessageEvent<SyntheticProjectionRequest>) => {
  globalThis.postMessage(buildSyntheticProjection(event.data));
});
