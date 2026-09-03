/**
 * Effect RPC worker for synthetic ontology graph projections.
 *
 * @packageDocumentation
 * @category projections
 * @since 0.0.0
 */

import { Session } from "@beep/ontology-use-cases/worker";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import * as BrowserRuntime from "@effect/platform-browser/BrowserRuntime";
import * as BrowserWorkerRunner from "@effect/platform-browser/BrowserWorkerRunner";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as RpcServer from "effect/unstable/rpc/RpcServer";
import { CosmosSpikeRpcs, SyntheticProjectionResponse } from "./CosmosSpike.rpc.ts";
import type { ProjectSyntheticGraphRequest } from "./CosmosSpike.rpc.ts";

const RDFS_SUB_CLASS_OF = `${RDFS_NAMESPACE}subClassOf`;

const nextSeed = (value: number): number => (value * 1_664_525 + 1_013_904_223) % 4_294_967_296;

const labelFor = (index: number): string => (index % 5 === 0 ? `Class ${index}` : `Individual ${index}`);

const iriFor = (index: number): string => `https://example.test/synthetic/${index}`;

const resourceFor = (index: number): Session.OntologyResourceSummary => {
  const isClass = index % 5 === 0;
  const parentIndex = isClass && index >= 500 ? index % 500 : 0;

  return Session.OntologyResourceSummary.make({
    iri: iriFor(index),
    label: labelFor(index),
    kind: isClass ? "class" : "individual",
    classification: isClass ? "tbox" : "abox",
    types: [],
    parentIris: isClass && index >= 500 ? [iriFor(parentIndex)] : [],
    sourcePartitions: ["asserted"],
  });
};

const relationshipFor = (index: number, nodeCount: number, state: number): Session.OntologyRelationshipSummary => {
  const source = index % nodeCount;
  const offset = nodeCount === 1 ? 0 : 1 + (state % (nodeCount - 1));
  const target = (source + offset) % nodeCount;
  const isClassLink = source % 5 === 0 && target % 5 === 0;

  return Session.OntologyRelationshipSummary.make({
    sourceIri: iriFor(source),
    predicateIri: isClassLink ? RDFS_SUB_CLASS_OF : RDF_TYPE.value,
    objectIri: iriFor(target),
    label: isClassLink ? "subClassOf" : "type",
    sourcePartitions: ["asserted"],
  });
};

const buildSyntheticProjection = Effect.fn("professional_desktop.cosmos_spike.build_projection")(
  (request: ProjectSyntheticGraphRequest) =>
    Effect.sync(() => {
      const resources = A.makeBy(request.nodeCount, resourceFor);
      const [, relationships] = A.mapAccum(
        A.makeBy(request.edgeCount, (index) => index),
        request.seed,
        (state, index) => {
          const nextState = nextSeed(state);
          return [nextState, relationshipFor(index, request.nodeCount, nextState)];
        }
      );
      const snapshot = Session.OntologySnapshot.make({
        sessionId: "cosmos-spike",
        resources,
        hierarchy: [],
        relationships,
        metrics: Session.OntologyMetrics.make({
          quadCount: request.edgeCount,
          resourceCount: request.nodeCount,
          classCount: A.countBy(resources, (resource) => resource.kind === "class"),
          propertyCount: 0,
          individualCount: A.countBy(resources, (resource) => resource.kind === "individual"),
          tboxCount: A.countBy(resources, (resource) => resource.classification === "tbox"),
          aboxCount: A.countBy(resources, (resource) => resource.classification === "abox"),
        }),
      });
      const projection = Session.buildOntologyGraphProjection(
        snapshot,
        Session.OntologyGraphProjectionOptions.make({
          ...Session.defaultOntologyGraphProjectionOptions(),
          foldLevel: "L3",
          autoClusterThreshold: 2_500,
          structuralFoldThreshold: 24,
        })
      );

      return SyntheticProjectionResponse.make({
        elementCount: request.nodeCount + request.edgeCount,
        projection,
      });
    })
);

const CosmosSpikeHandlersLive = CosmosSpikeRpcs.toLayer({
  ProjectSyntheticGraph: buildSyntheticProjection,
});

const CosmosSpikeWorkerLive = RpcServer.layer(CosmosSpikeRpcs).pipe(
  Layer.provide(CosmosSpikeHandlersLive),
  Layer.provide(RpcServer.layerProtocolWorkerRunner),
  Layer.provide(BrowserWorkerRunner.layer)
);

CosmosSpikeWorkerLive.pipe(Layer.launch, BrowserRuntime.runMain);
