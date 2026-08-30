/**
 * Worker-side graph projection for the ontology visualizer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyUseCasesId } from "@beep/identity/packages";
import { ChangeOperation, SessionChangeDelta } from "@beep/ontology-domain/aggregates/Session";
import { makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_LABEL, RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { Float32Arr } from "@beep/schema/Float32Array";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { A, O, Str } from "@beep/utils";
import { Effect, MutableHashMap, MutableHashSet, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import {
  OntologyResourceClassification,
  OntologyResourceKind,
  OntologyResourceSummary,
  OntologySnapshot,
  OntologyViewMode,
  resourceVisibleInViewMode,
} from "./Session.projections.ts";
import type { Quad } from "@beep/rdf/Rdf";

const $I = $OntologyUseCasesId.create("aggregates/Session/Session.visualizer");

const RDFS_SUB_CLASS_OF = makeNamedNode(`${RDFS_NAMESPACE}subClassOf`);
const RDFS_SUB_PROPERTY_OF = makeNamedNode(`${RDFS_NAMESPACE}subPropertyOf`);

const Uint32Arr = S.instanceOf<globalThis.Uint32ArrayConstructor, globalThis.Uint32Array>(globalThis.Uint32Array)
  .annotate({
    toArbitrary: () => (fc) =>
      fc.array(fc.integer({ max: 1_000, min: 0 }), { maxLength: 8 }).map((values) => new Uint32Array(values)),
  })
  .pipe(
    $I.annoteSchema("Uint32Arr", {
      description: "Native Uint32Array instance used for graph node and edge identifiers.",
    })
  );

/**
 * Visualizer fold level.
 *
 * **Example** (Assign L2 fold level)
 *
 * ```ts
 * import { OntologyFoldLevel } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const level: OntologyFoldLevel = "L2"
 *
 * console.log(level)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const OntologyFoldLevel = LiteralKit(["L0", "L1", "L2", "L3"]).pipe(
  $I.annoteSchema("OntologyFoldLevel", {
    description: "Visualizer fold level from full detail through community clusters.",
  })
);

/**
 * Type for {@link OntologyFoldLevel}.
 *
 * **Example** (Type L1 fold level)
 *
 * ```ts
 * import { OntologyFoldLevel } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const fold: OntologyFoldLevel = "L1"
 *
 * console.log(fold)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export type OntologyFoldLevel = typeof OntologyFoldLevel.Type;

/**
 * Label level-of-detail selected for the projected viewport.
 *
 * **Example** (Assign key label detail)
 *
 * ```ts
 * import { OntologyLabelLevelOfDetail } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const labelDetail: OntologyLabelLevelOfDetail = "key"
 *
 * console.log(labelDetail)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const OntologyLabelLevelOfDetail = LiteralKit(["full", "key", "hidden"]).pipe(
  $I.annoteSchema("OntologyLabelLevelOfDetail", {
    description: "Viewport label density chosen by projected graph size.",
  })
);

/**
 * Type for {@link OntologyLabelLevelOfDetail}.
 *
 * **Example** (Type hidden label detail)
 *
 * ```ts
 * import { OntologyLabelLevelOfDetail } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const labelDetail: OntologyLabelLevelOfDetail = "hidden"
 *
 * console.log(labelDetail)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export type OntologyLabelLevelOfDetail = typeof OntologyLabelLevelOfDetail.Type;

/**
 * Pinned node position preserved across worker projections.
 *
 * **Example** (Create pinned node)
 *
 * ```ts
 * import { OntologyPinnedNode } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const pinned = OntologyPinnedNode.make({
 *   iri: "https://example.test/Pizza",
 *   x: 10,
 *   y: 20
 * })
 *
 * console.log(pinned.iri)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyPinnedNode extends S.Class<OntologyPinnedNode>($I`OntologyPinnedNode`)(
  {
    iri: S.String,
    x: S.Finite,
    y: S.Finite,
  },
  $I.annote("OntologyPinnedNode", {
    description: "Pinned node position preserved by worker-side graph projection.",
  })
) {}

/**
 * Worker graph projection options.
 *
 * **Example** (Default projection options)
 *
 * ```ts
 * import { defaultOntologyGraphProjectionOptions } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const options = defaultOntologyGraphProjectionOptions()
 *
 * console.log(options.foldLevel)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyGraphProjectionOptions extends S.Class<OntologyGraphProjectionOptions>(
  $I`OntologyGraphProjectionOptions`
)(
  {
    viewMode: OntologyViewMode,
    foldLevel: OntologyFoldLevel,
    focusIri: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    focusDepth: S.Int,
    pinnedNodes: S.Array(OntologyPinnedNode),
    structuralFoldThreshold: S.Int,
    autoClusterThreshold: S.Int,
    communityBucketSize: S.Int,
    fullLabelThreshold: S.Int,
    keyLabelThreshold: S.Int,
  },
  $I.annote("OntologyGraphProjectionOptions", {
    description: "Fold, focus, filter, label, and pinning options for worker graph projection.",
  })
) {}

/**
 * Default worker graph projection options.
 *
 * **Example** (Create default options)
 *
 * ```ts
 * import { defaultOntologyGraphProjectionOptions } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const options = defaultOntologyGraphProjectionOptions()
 *
 * console.log(options.autoClusterThreshold)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const defaultOntologyGraphProjectionOptions = (): OntologyGraphProjectionOptions =>
  OntologyGraphProjectionOptions.make({
    viewMode: "all",
    foldLevel: "L2",
    focusIri: O.none(),
    focusDepth: 1,
    pinnedNodes: [],
    structuralFoldThreshold: 24,
    autoClusterThreshold: 2_500,
    communityBucketSize: 250,
    fullLabelThreshold: 250,
    keyLabelThreshold: 2_500,
  });

/**
 * Graph node metadata paired with typed-array buffers.
 *
 * **Example** (Create graph node)
 *
 * ```ts
 * import { OntologyGraphNode } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const node = OntologyGraphNode.make({
 *   id: 1,
 *   iri: "https://example.test/Pizza",
 *   label: "Pizza",
 *   kind: "class",
 *   classification: "tbox",
 *   folded: false,
 *   memberCount: 1,
 *   x: 0,
 *   y: 0
 * })
 *
 * console.log(node.label)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyGraphNode extends S.Class<OntologyGraphNode>($I`OntologyGraphNode`)(
  {
    id: S.Int,
    iri: S.String,
    label: S.String,
    kind: OntologyResourceKind,
    classification: OntologyResourceClassification,
    folded: S.Boolean,
    memberCount: S.Int,
    x: S.Finite,
    y: S.Finite,
  },
  $I.annote("OntologyGraphNode", {
    description: "Graph node metadata paired with worker-produced typed arrays.",
  })
) {}

/**
 * Graph edge metadata paired with typed-array buffers.
 *
 * **Example** (Create graph edge)
 *
 * ```ts
 * import { OntologyGraphEdge } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const edge = OntologyGraphEdge.make({
 *   id: 1,
 *   sourceId: 1,
 *   targetId: 2,
 *   sourceIri: "https://example.test/A",
 *   targetIri: "https://example.test/B",
 *   predicateIri: "http://www.w3.org/2000/01/rdf-schema#subClassOf",
 *   label: "subClassOf",
 *   folded: false
 * })
 *
 * console.log(edge.label)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyGraphEdge extends S.Class<OntologyGraphEdge>($I`OntologyGraphEdge`)(
  {
    id: S.Int,
    sourceId: S.Int,
    targetId: S.Int,
    sourceIri: S.String,
    targetIri: S.String,
    predicateIri: S.String,
    label: S.String,
    folded: S.Boolean,
  },
  $I.annote("OntologyGraphEdge", {
    description: "Graph edge metadata paired with worker-produced link buffers.",
  })
) {}

/**
 * Fold cluster summary produced by the worker.
 *
 * **Example** (Create fold cluster)
 *
 * ```ts
 * import { OntologyGraphCluster } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const cluster = OntologyGraphCluster.make({
 *   id: 1,
 *   iri: "urn:beep:ontology:fold:annotations",
 *   label: "Annotations",
 *   foldLevel: "L1",
 *   memberCount: 10
 * })
 *
 * console.log(cluster.memberCount)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyGraphCluster extends S.Class<OntologyGraphCluster>($I`OntologyGraphCluster`)(
  {
    id: S.Int,
    iri: S.String,
    label: S.String,
    foldLevel: OntologyFoldLevel,
    memberCount: S.Int,
  },
  $I.annote("OntologyGraphCluster", {
    description: "Worker-computed folded cluster summary.",
  })
) {}

/**
 * Aggregate graph projection statistics.
 *
 * **Example** (Create projection stats)
 *
 * ```ts
 * import { OntologyGraphProjectionStats } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const stats = OntologyGraphProjectionStats.make({
 *   visibleResourceCount: 10,
 *   projectedNodeCount: 5,
 *   projectedEdgeCount: 4,
 *   foldedResourceCount: 5
 * })
 *
 * console.log(stats.projectedNodeCount)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyGraphProjectionStats extends S.Class<OntologyGraphProjectionStats>(
  $I`OntologyGraphProjectionStats`
)(
  {
    visibleResourceCount: S.Int,
    projectedNodeCount: S.Int,
    projectedEdgeCount: S.Int,
    foldedResourceCount: S.Int,
  },
  $I.annote("OntologyGraphProjectionStats", {
    description: "Worker-computed graph projection counts for benchmark and UI readouts.",
  })
) {}

/**
 * Typed-array graph projection consumed by the visualizer client.
 *
 * **Example** (Create graph projection)
 *
 * ```ts
 * import { OntologyGraphProjection, OntologyGraphProjectionStats } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const projection = OntologyGraphProjection.make({
 *   revision: 1,
 *   foldLevel: "L0",
 *   labelDetail: "full",
 *   nodeCount: 1,
 *   edgeCount: 0,
 *   nodeIds: new Uint32Array([1]),
 *   nodeKinds: new Uint8Array([1]),
 *   nodeFlags: new Uint8Array([0]),
 *   edgeIds: new Uint32Array([]),
 *   edgeKinds: new Uint8Array([]),
 *   pointPositions: new Float32Array([0, 0]),
 *   pointDepths: new Float32Array([0]),
 *   links: new Float32Array([]),
 *   nodes: [],
 *   edges: [],
 *   clusters: [],
 *   changedNodeIds: [],
 *   changedEdgeIds: [],
 *   stats: OntologyGraphProjectionStats.make({
 *     visibleResourceCount: 1,
 *     projectedNodeCount: 1,
 *     projectedEdgeCount: 0,
 *     foldedResourceCount: 0
 *   })
 * })
 *
 * console.log(projection.nodeCount)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyGraphProjection extends S.Class<OntologyGraphProjection>($I`OntologyGraphProjection`)(
  {
    revision: S.Int,
    foldLevel: OntologyFoldLevel,
    labelDetail: OntologyLabelLevelOfDetail,
    nodeCount: S.Int,
    edgeCount: S.Int,
    nodeIds: Uint32Arr,
    nodeKinds: S.Uint8Array,
    nodeFlags: S.Uint8Array,
    edgeIds: Uint32Arr,
    edgeKinds: S.Uint8Array,
    pointPositions: Float32Arr,
    pointDepths: Float32Arr.pipe(S.withConstructorDefault(Effect.sync(() => new Float32Array()))).annotateKey({
      description:
        "Worker-populated node depths; the empty constructor default supports legacy hand-built fixtures only.",
    }),
    links: Float32Arr,
    nodes: S.Array(OntologyGraphNode),
    edges: S.Array(OntologyGraphEdge),
    clusters: S.Array(OntologyGraphCluster),
    changedNodeIds: S.Array(S.Int),
    changedEdgeIds: S.Array(S.Int),
    stats: OntologyGraphProjectionStats,
  },
  $I.annote("OntologyGraphProjection", {
    description: "Worker-owned ontology graph projection with typed node and edge buffers.",
  })
) {}

/**
 * Graph editing gesture emitted by the viewport halo overlay.
 *
 * **Example** (Create instantiate gesture)
 *
 * ```ts
 * import { OntologyGraphGesture } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const gesture = OntologyGraphGesture.make({
 *   kind: "instantiate",
 *   classIri: "https://example.test/Pizza",
 *   instanceIri: "https://example.test/Margherita"
 * })
 *
 * console.log(gesture.kind)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const OntologyGraphGesture = LiteralKit(["connect", "delete", "expand", "instantiate"])
  .toTaggedUnion("kind")({
    connect: {
      sourceIri: S.String,
      predicateIri: S.String,
      targetIri: S.String,
    },
    delete: {
      sourceIri: S.String,
      predicateIri: S.String,
      targetIri: S.String,
    },
    expand: {
      sourceIri: S.String,
      predicateIri: S.String,
      targetIri: S.String,
    },
    instantiate: {
      classIri: S.String,
      instanceIri: S.String,
    },
  })
  .pipe(
    $I.annoteSchema("OntologyGraphGesture", {
      description: "Typed visualizer halo gesture converted into ontology change operations.",
    })
  );

/**
 * Type for {@link OntologyGraphGesture}.
 *
 * **Example** (Type connect gesture)
 *
 * ```ts
 * import { OntologyGraphGesture } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const gesture: OntologyGraphGesture = OntologyGraphGesture.make({
 *   kind: "connect",
 *   sourceIri: "https://example.test/A",
 *   predicateIri: "https://example.test/p",
 *   targetIri: "https://example.test/B"
 * })
 *
 * console.log(gesture.kind)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export type OntologyGraphGesture = typeof OntologyGraphGesture.Type;

/**
 * Predicate autocomplete suggestion for graph gestures.
 *
 * **Example** (Create predicate suggestion)
 *
 * ```ts
 * import { OntologyPredicateSuggestion } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const suggestion = OntologyPredicateSuggestion.make({
 *   iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
 *   label: "type",
 *   weight: 100
 * })
 *
 * console.log(suggestion.weight)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class OntologyPredicateSuggestion extends S.Class<OntologyPredicateSuggestion>($I`OntologyPredicateSuggestion`)(
  {
    iri: S.String,
    label: S.String,
    weight: S.Int,
  },
  $I.annote("OntologyPredicateSuggestion", {
    description: "Predicate autocomplete suggestion for graph halo gestures.",
  })
) {}

type Relationship = {
  readonly sourceIri: string;
  readonly predicateIri: string;
  readonly targetIri: string;
};

const emptyResources: () => ReadonlyArray<OntologyResourceSummary> = A.empty;

const hashText = (text: string): number => {
  let hash = 2_166_136_261;
  let index = 0;

  while (index < text.length) {
    hash = (hash ^ text.charCodeAt(index)) * 16_777_619;
    index += 1;
  }

  return hash >>> 0;
};

const labelFromIri = (iri: string): string =>
  pipe(
    iri,
    Str.split("#"),
    A.last,
    O.getOrElse(() => iri),
    Str.split("/"),
    A.last,
    O.getOrElse(() => iri)
  );

const positiveCount = (value: number): number => (value > 0 ? value : 1);

const levelAtLeast = (level: OntologyFoldLevel, candidate: OntologyFoldLevel): boolean => {
  const levels: ReadonlyArray<OntologyFoldLevel> = ["L0", "L1", "L2", "L3"];
  const current = pipe(
    levels,
    A.findFirstIndex((value) => value === level),
    O.getOrElse(() => 0)
  );
  const required = pipe(
    levels,
    A.findFirstIndex((value) => value === candidate),
    O.getOrElse(() => 0)
  );
  return current >= required;
};

const subjectIri = (quad: Quad): O.Option<string> =>
  quad.subject.termType === "NamedNode" ? O.some(quad.subject.value) : O.none();

const objectIri = (quad: Quad): O.Option<string> =>
  quad.object.termType === "NamedNode" ? O.some(quad.object.value) : O.none();

const relationshipFromQuad = (quad: Quad): O.Option<Relationship> =>
  pipe(
    subjectIri(quad),
    O.flatMap((sourceIri) =>
      pipe(
        objectIri(quad),
        O.map((targetIri) => ({
          sourceIri,
          predicateIri: quad.predicate.value,
          targetIri,
        }))
      )
    )
  );

const relationshipKey = (relationship: Relationship): string =>
  `${relationship.sourceIri}\n${relationship.predicateIri}\n${relationship.targetIri}`;

const sameRelationship = (left: Relationship, right: Relationship): boolean =>
  relationshipKey(left) === relationshipKey(right);

const relationshipExists = (relationships: ReadonlyArray<Relationship>, candidate: Relationship): boolean =>
  pipe(
    relationships,
    A.some((relationship) => sameRelationship(relationship, candidate))
  );

const addRelationship = (
  relationships: ReadonlyArray<Relationship>,
  candidate: Relationship
): ReadonlyArray<Relationship> =>
  relationshipExists(relationships, candidate) ? relationships : pipe(relationships, A.append(candidate));

const removeRelationship = (
  relationships: ReadonlyArray<Relationship>,
  candidate: Relationship
): ReadonlyArray<Relationship> =>
  pipe(
    relationships,
    A.filter((relationship) => !sameRelationship(relationship, candidate))
  );

const visibleResources = (
  snapshot: OntologySnapshot,
  options: OntologyGraphProjectionOptions
): ReadonlyArray<OntologyResourceSummary> =>
  pipe(
    snapshot.resources,
    A.filter((resource) => resourceVisibleInViewMode(resource, options.viewMode))
  );

const hierarchyNeighborhood = (
  snapshot: OntologySnapshot,
  focusIri: string,
  depth: number
): MutableHashSet.MutableHashSet<string> => {
  const neighbors = MutableHashMap.empty<string, ReadonlyArray<string>>();

  for (const entry of snapshot.hierarchy) {
    for (const childIri of entry.childIris) {
      const existingParent = pipe(MutableHashMap.get(neighbors, childIri), O.getOrElse(A.empty<string>));
      const existingChild = pipe(MutableHashMap.get(neighbors, entry.iri), O.getOrElse(A.empty<string>));
      MutableHashMap.set(neighbors, childIri, pipe(existingParent, A.append(entry.iri)));
      MutableHashMap.set(neighbors, entry.iri, pipe(existingChild, A.append(childIri)));
    }
  }

  const seen = MutableHashSet.fromIterable([focusIri]);
  let frontier: ReadonlyArray<string> = [focusIri];
  let remaining = depth;

  while (remaining > 0) {
    const next = pipe(
      frontier,
      A.flatMap((iri) => pipe(MutableHashMap.get(neighbors, iri), O.getOrElse(A.empty<string>))),
      A.dedupe
    );

    for (const iri of next) {
      MutableHashSet.add(seen, iri);
    }
    frontier = next;
    remaining -= 1;
  }

  return seen;
};

const focusedResources = (
  snapshot: OntologySnapshot,
  options: OntologyGraphProjectionOptions
): ReadonlyArray<OntologyResourceSummary> =>
  pipe(
    options.focusIri,
    O.match({
      onNone: () => visibleResources(snapshot, options),
      onSome: (focusIri) => {
        const neighborhood = hierarchyNeighborhood(snapshot, focusIri, options.focusDepth);
        return pipe(
          visibleResources(snapshot, options),
          A.filter((resource) => MutableHashSet.has(neighborhood, resource.iri))
        );
      },
    })
  );

const resourceByIri = (
  resources: ReadonlyArray<OntologyResourceSummary>
): MutableHashMap.MutableHashMap<string, OntologyResourceSummary> =>
  MutableHashMap.fromIterable(A.map(resources, (resource) => [resource.iri, resource]));

const relationshipVisible = (
  relationship: Relationship,
  resources: MutableHashMap.MutableHashMap<string, OntologyResourceSummary>
): boolean =>
  O.isSome(MutableHashMap.get(resources, relationship.sourceIri)) &&
  O.isSome(MutableHashMap.get(resources, relationship.targetIri));

const foldTarget = (
  resource: OntologyResourceSummary,
  childCounts: MutableHashMap.MutableHashMap<string, number>,
  options: OntologyGraphProjectionOptions,
  visibleCount: number
): O.Option<readonly [string, string, OntologyFoldLevel]> => {
  if (levelAtLeast(options.foldLevel, "L1") && resource.kind === "annotationProperty") {
    return O.some(["urn:beep:ontology:fold:annotations", "Annotations", "L1"]);
  }

  if (levelAtLeast(options.foldLevel, "L2")) {
    const parentIri = pipe(resource.parentIris, A.head);
    const structural = pipe(
      parentIri,
      O.filter(
        (iri) =>
          pipe(
            MutableHashMap.get(childCounts, iri),
            O.getOrElse(() => 0)
          ) >= options.structuralFoldThreshold
      ),
      O.map((iri) => [`urn:beep:ontology:fold:structural:${iri}`, `${labelFromIri(iri)} children`, "L2"] as const)
    );

    if (O.isSome(structural)) {
      return structural;
    }
  }

  if (levelAtLeast(options.foldLevel, "L3") && visibleCount > options.autoClusterThreshold) {
    const bucketCount = positiveCount(
      (visibleCount - (visibleCount % options.communityBucketSize)) / options.communityBucketSize
    );
    const bucket = hashText(resource.iri) % bucketCount;
    return O.some([`urn:beep:ontology:fold:community:${bucket}`, `Community ${bucket + 1}`, "L3"]);
  }

  return O.none();
};

const labelDetailFor = (nodeCount: number, options: OntologyGraphProjectionOptions): OntologyLabelLevelOfDetail =>
  nodeCount <= options.fullLabelThreshold ? "full" : nodeCount <= options.keyLabelThreshold ? "key" : "hidden";

const kindCode = (kind: OntologyResourceKind): number =>
  OntologyResourceKind.$match(kind, {
    class: () => 1,
    objectProperty: () => 2,
    dataProperty: () => 3,
    annotationProperty: () => 4,
    individual: () => 5,
    unknown: () => 0,
  });

const classificationForFolded = (members: ReadonlyArray<OntologyResourceSummary>): OntologyResourceClassification =>
  pipe(
    members,
    A.some((member) => member.classification === "tbox")
  )
    ? "tbox"
    : "abox";

const pinnedPositionMap = (
  previous: O.Option<OntologyGraphProjection>,
  options: OntologyGraphProjectionOptions,
  nodeIris: ReadonlyArray<string>
): MutableHashMap.MutableHashMap<string, readonly [number, number, number]> => {
  const positions = MutableHashMap.empty<string, readonly [number, number, number]>();
  const currentIndexByIri = MutableHashMap.fromIterable(A.map(nodeIris, (iri, index) => [iri, index]));

  pipe(
    previous,
    O.match({
      onNone: () => undefined,
      onSome: (projection) => {
        for (const [previousIndex, node] of projection.nodes.entries()) {
          const currentIndex = pipe(
            MutableHashMap.get(currentIndexByIri, node.iri),
            O.getOrElse(() => previousIndex)
          );
          const z =
            previousIndex < projection.pointDepths.length
              ? projection.pointDepths[previousIndex]
              : deterministicDepth(node.iri, currentIndex);
          MutableHashMap.set(positions, node.iri, [node.x, node.y, z]);
        }
      },
    })
  );

  for (const pinned of options.pinnedNodes) {
    const currentIndex = pipe(
      MutableHashMap.get(currentIndexByIri, pinned.iri),
      O.getOrElse(() => 0)
    );
    const z = pipe(
      MutableHashMap.get(positions, pinned.iri),
      O.map((position) => position[2]),
      O.getOrElse(() => deterministicDepth(pinned.iri, currentIndex))
    );
    MutableHashMap.set(positions, pinned.iri, [pinned.x, pinned.y, z]);
  }

  return positions;
};

/**
 * The angle that spreads points most evenly around a centre — the one sunflowers
 * use. Successive nodes land in the gaps left by the ones before them.
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Distance between successive rings of the spiral, in graph space. */
const RING_SPACING = 26;

/**
 * The seed position for a node the simulation has not placed yet.
 *
 * This used to be a 512-column grid: `row = floor(index / 512)`, which is zero for
 * every node in any ontology with fewer than 512 of them — so a real ontology got a
 * single row, every `y` within a few units of the others, and `x` smeared across
 * ±768. It rendered as a horizontal line of overlapping dots. And a collinear start
 * is the one arrangement a force simulation cannot escape: repulsion between points
 * on a line only pushes them further along it, so the layout never opened up.
 *
 * A phyllotaxis spiral spreads evenly in two dimensions at any node count, stays
 * deterministic (same ontology, same picture), and gives the simulation something it
 * can actually relax from. The hash still perturbs the angle so that two nodes added
 * in the same order do not sit on top of each other.
 */
const deterministicPosition = (iri: string, index: number): readonly [number, number] => {
  const hash = hashText(iri);
  const radius = RING_SPACING * Math.sqrt(index + 0.5);
  const angle = index * GOLDEN_ANGLE + ((hash % 64) - 32) / 512;

  return [radius * Math.cos(angle), radius * Math.sin(angle)];
};

/** Deterministic depth seed from a second hash-perturbed golden-angle series. */
const deterministicDepth = (iri: string, index: number): number => {
  const hash = hashText(iri);
  const phase = ((hash % 1_024) / 1_024) * Math.PI * 2;

  return 260 * Math.sin(index * GOLDEN_ANGLE * 1.618_033_988_75 + phase);
};

const deterministicPosition3d = (iri: string, index: number): readonly [number, number, number] => {
  const [x, y] = deterministicPosition(iri, index);

  return [x, y, deterministicDepth(iri, index)];
};

const FORCE_RANGE = 150;
const MANY_BODY_STRENGTH = -60;
const LINK_REST_LENGTH = 50;
const LINK_STRENGTH = 0.1;
const VELOCITY_DAMPING = 0.6;
const CONTAINMENT_RADIUS = 420;

const spatialCellKey = (x: number, y: number, z: number): string =>
  `${Math.floor(x / FORCE_RANGE)}:${Math.floor(y / FORCE_RANGE)}:${Math.floor(z / FORCE_RANGE)}`;

const graphDegrees = (nodeCount: number, links: Float32Array): Float64Array<ArrayBuffer> => {
  const degrees = new Float64Array(nodeCount);

  for (let linkIndex = 0; linkIndex < links.length; linkIndex += 2) {
    degrees[links[linkIndex]] += 1;
    degrees[links[linkIndex + 1]] += 1;
  }

  return degrees;
};

const buildSpatialGrid = (
  positions: Float64Array,
  nodeCount: number
): MutableHashMap.MutableHashMap<string, ReadonlyArray<number>> => {
  const cells = MutableHashMap.empty<string, ReadonlyArray<number>>();

  for (let index = 0; index < nodeCount; index += 1) {
    const offset = index * 3;
    const key = spatialCellKey(positions[offset], positions[offset + 1], positions[offset + 2]);
    const occupants = pipe(MutableHashMap.get(cells, key), O.getOrElse(A.empty<number>));
    MutableHashMap.set(cells, key, pipe(occupants, A.append(index)));
  }

  return cells;
};

const applyPairRepulsion = (
  index: number,
  neighbor: number,
  alpha: number,
  positions: Float64Array,
  forces: Float64Array
): void => {
  if (neighbor <= index) {
    return;
  }

  const offset = index * 3;
  const neighborOffset = neighbor * 3;
  let x = positions[offset] - positions[neighborOffset];
  let y = positions[offset + 1] - positions[neighborOffset + 1];
  let z = positions[offset + 2] - positions[neighborOffset + 2];
  let distanceSquared = x * x + y * y + z * z;

  if (distanceSquared < 0.000_001) {
    const angle = (index + 1) * (neighbor + 1) * GOLDEN_ANGLE;
    x = Math.cos(angle);
    y = Math.sin(angle);
    z = Math.sin(angle * 1.618_033_988_75);
    distanceSquared = x * x + y * y + z * z;
  }

  if (distanceSquared > FORCE_RANGE * FORCE_RANGE) {
    return;
  }

  const force = (-MANY_BODY_STRENGTH * alpha) / distanceSquared;
  forces[offset] += x * force;
  forces[offset + 1] += y * force;
  forces[offset + 2] += z * force;
  forces[neighborOffset] -= x * force;
  forces[neighborOffset + 1] -= y * force;
  forces[neighborOffset + 2] -= z * force;
};

const applyNeighborCellRepulsion = (
  index: number,
  alpha: number,
  positions: Float64Array,
  forces: Float64Array,
  cells: MutableHashMap.MutableHashMap<string, ReadonlyArray<number>>
): void => {
  const offset = index * 3;
  const cellX = Math.floor(positions[offset] / FORCE_RANGE);
  const cellY = Math.floor(positions[offset + 1] / FORCE_RANGE);
  const cellZ = Math.floor(positions[offset + 2] / FORCE_RANGE);

  for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
    for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
      for (let deltaZ = -1; deltaZ <= 1; deltaZ += 1) {
        const neighbors = pipe(
          MutableHashMap.get(cells, `${cellX + deltaX}:${cellY + deltaY}:${cellZ + deltaZ}`),
          O.getOrElse(A.empty<number>)
        );

        for (const neighbor of neighbors) {
          applyPairRepulsion(index, neighbor, alpha, positions, forces);
        }
      }
    }
  }
};

const applyRepulsionForces = (
  nodeCount: number,
  alpha: number,
  positions: Float64Array,
  forces: Float64Array,
  cells: MutableHashMap.MutableHashMap<string, ReadonlyArray<number>>
): void => {
  for (let index = 0; index < nodeCount; index += 1) {
    applyNeighborCellRepulsion(index, alpha, positions, forces, cells);
  }
};

const applySpringForces = (
  alpha: number,
  positions: Float64Array,
  forces: Float64Array,
  degrees: Float64Array,
  links: Float32Array
): void => {
  for (let linkIndex = 0; linkIndex < links.length; linkIndex += 2) {
    const source = links[linkIndex];
    const target = links[linkIndex + 1];
    const sourceOffset = source * 3;
    const targetOffset = target * 3;
    const x = positions[targetOffset] - positions[sourceOffset];
    const y = positions[targetOffset + 1] - positions[sourceOffset + 1];
    const z = positions[targetOffset + 2] - positions[sourceOffset + 2];
    const distance = Math.sqrt(x * x + y * y + z * z) || 1;
    const force = ((distance - LINK_REST_LENGTH) / distance) * LINK_STRENGTH * alpha;
    const bias = degrees[source] / (degrees[source] + degrees[target]);

    forces[sourceOffset] += x * force * (1 - bias);
    forces[sourceOffset + 1] += y * force * (1 - bias);
    forces[sourceOffset + 2] += z * force * (1 - bias);
    forces[targetOffset] -= x * force * bias;
    forces[targetOffset + 1] -= y * force * bias;
    forces[targetOffset + 2] -= z * force * bias;
  }
};

const integratePositions = (
  nodeCount: number,
  positions: Float64Array,
  velocities: Float64Array,
  forces: Float64Array
): readonly [number, number, number] => {
  let meanX = 0;
  let meanY = 0;
  let meanZ = 0;

  for (let index = 0; index < nodeCount; index += 1) {
    const offset = index * 3;
    velocities[offset] = (velocities[offset] + forces[offset]) * VELOCITY_DAMPING;
    velocities[offset + 1] = (velocities[offset + 1] + forces[offset + 1]) * VELOCITY_DAMPING;
    velocities[offset + 2] = (velocities[offset + 2] + forces[offset + 2]) * VELOCITY_DAMPING;
    positions[offset] += velocities[offset];
    positions[offset + 1] += velocities[offset + 1];
    positions[offset + 2] += velocities[offset + 2];
    meanX += positions[offset];
    meanY += positions[offset + 1];
    meanZ += positions[offset + 2];
  }

  meanX /= nodeCount;
  meanY /= nodeCount;
  meanZ /= nodeCount;
  return [meanX, meanY, meanZ];
};

const centerAndContainPositions = (
  nodeCount: number,
  positions: Float64Array,
  meanX: number,
  meanY: number,
  meanZ: number
): void => {
  for (let index = 0; index < nodeCount; index += 1) {
    const offset = index * 3;
    positions[offset] -= meanX;
    positions[offset + 1] -= meanY;
    positions[offset + 2] -= meanZ;
    const radius = Math.sqrt(
      positions[offset] * positions[offset] +
        positions[offset + 1] * positions[offset + 1] +
        positions[offset + 2] * positions[offset + 2]
    );

    if (radius > CONTAINMENT_RADIUS) {
      const factor = 1 - (0.05 * (radius - CONTAINMENT_RADIUS)) / radius;
      positions[offset] *= factor;
      positions[offset + 1] *= factor;
      positions[offset + 2] *= factor;
    }
  }
};

/**
 * Relaxes copied xyz seeds with a deterministic, bounded 3D force simulation.
 *
 * All links use the 50-unit intra-community rest length because this projection
 * does not carry the community signal required for the reference's 50/150 split.
 */
const relaxPositions = (seeds: Float64Array, links: Float32Array): Float64Array => {
  const positions = new Float64Array(seeds);
  const nodeCount = positions.length / 3;

  if (nodeCount === 0) {
    return positions;
  }

  const velocities = new Float64Array(positions.length);
  const forces = new Float64Array(positions.length);
  const degrees = graphDegrees(nodeCount, links);

  let alpha = 1;
  let tick = 0;

  while (alpha >= 0.02 && tick < 60) {
    forces.fill(0);
    const cells = buildSpatialGrid(positions, nodeCount);
    applyRepulsionForces(nodeCount, alpha, positions, forces, cells);
    applySpringForces(alpha, positions, forces, degrees, links);
    const [meanX, meanY, meanZ] = integratePositions(nodeCount, positions, velocities, forces);
    centerAndContainPositions(nodeCount, positions, meanX, meanY, meanZ);

    alpha *= 0.9;
    tick += 1;
  }

  return positions;
};

const relaxProjectedNodes = (
  nodes: ReadonlyArray<OntologyGraphNode>,
  edges: ReadonlyArray<OntologyGraphEdge>,
  seedPositions3d: Float64Array,
  links: Float32Array,
  pointPositions: Float32Array,
  pointDepths: Float32Array
): Array<OntologyGraphNode> => {
  const relaxedPositions =
    nodes.length <= 10_000 && edges.length <= 30_000 ? relaxPositions(seedPositions3d, links) : seedPositions3d;

  return A.map(nodes, (node, index) => {
    const x = relaxedPositions[index * 3];
    const y = relaxedPositions[index * 3 + 1];
    pointPositions[index * 2] = x;
    pointPositions[index * 2 + 1] = y;
    pointDepths[index] = relaxedPositions[index * 3 + 2];

    return OntologyGraphNode.make({
      ...node,
      x,
      y,
    });
  });
};

const countResourceChildren = (
  resources: ReadonlyArray<OntologyResourceSummary>
): MutableHashMap.MutableHashMap<string, number> => {
  const childCounts = MutableHashMap.empty<string, number>();

  for (const resource of resources) {
    for (const parentIri of resource.parentIris) {
      MutableHashMap.set(
        childCounts,
        parentIri,
        pipe(
          MutableHashMap.get(childCounts, parentIri),
          O.getOrElse(() => 0)
        ) + 1
      );
    }
  }

  return childCounts;
};

const projectionFromRelationships = (
  snapshot: OntologySnapshot,
  relationships: ReadonlyArray<Relationship>,
  options: OntologyGraphProjectionOptions,
  previous: O.Option<OntologyGraphProjection>,
  changedIris: ReadonlyArray<string>
): OntologyGraphProjection => {
  const resources = focusedResources(snapshot, options);
  const visibleCount = resources.length;
  const resourcesByIri = resourceByIri(resources);
  const childCounts = countResourceChildren(resources);

  const membersByNodeIri = MutableHashMap.empty<string, ReadonlyArray<OntologyResourceSummary>>();
  const nodeLabelByIri = MutableHashMap.empty<string, string>();
  const clusterByIri = MutableHashMap.empty<string, OntologyGraphCluster>();
  const foldedResourceCount = { value: 0 };

  for (const resource of resources) {
    const target = foldTarget(resource, childCounts, options, visibleCount);
    const nodeIri = pipe(
      target,
      O.match({
        onNone: () => resource.iri,
        onSome: ([iri, label, level]) => {
          foldedResourceCount.value += 1;
          MutableHashMap.set(nodeLabelByIri, iri, label);
          MutableHashMap.set(
            clusterByIri,
            iri,
            OntologyGraphCluster.make({
              id: hashText(iri),
              iri,
              label,
              foldLevel: level,
              memberCount: pipe(MutableHashMap.get(membersByNodeIri, iri), O.getOrElse(emptyResources)).length + 1,
            })
          );
          return iri;
        },
      })
    );
    MutableHashMap.set(
      membersByNodeIri,
      nodeIri,
      pipe(MutableHashMap.get(membersByNodeIri, nodeIri), O.getOrElse(emptyResources), A.append(resource))
    );
    if (O.isNone(target)) {
      MutableHashMap.set(nodeLabelByIri, nodeIri, resource.label);
    }
  }

  const nodeIris = pipe(MutableHashMap.keys(membersByNodeIri), A.fromIterable, A.sort(Order.String));
  const positions = pinnedPositionMap(previous, options, nodeIris);
  const seedDepths = new Float64Array(nodeIris.length);
  let nodes = A.map(nodeIris, (iri, index) => {
    const members = pipe(MutableHashMap.get(membersByNodeIri, iri), O.getOrElse(emptyResources));
    const first = pipe(
      A.head(members),
      O.getOrElse(() =>
        OntologyResourceSummary.make({
          iri,
          label: labelFromIri(iri),
          kind: "unknown",
          classification: "abox",
          types: [],
          parentIris: [],
          sourcePartitions: [],
        })
      )
    );
    const [x, y, z] = pipe(
      MutableHashMap.get(positions, iri),
      O.getOrElse(() => deterministicPosition3d(iri, index))
    );
    seedDepths[index] = z;

    return OntologyGraphNode.make({
      id: hashText(iri),
      iri,
      label: pipe(
        MutableHashMap.get(nodeLabelByIri, iri),
        O.getOrElse(() => first.label)
      ),
      kind: first.kind,
      classification: members.length > 1 ? classificationForFolded(members) : first.classification,
      folded: members.length > 1,
      memberCount: members.length,
      x,
      y,
    });
  });
  const nodeIndexByIri = MutableHashMap.fromIterable(A.map(nodes, (node, index) => [node.iri, index]));
  const nodeIriByResourceIri = MutableHashMap.empty<string, string>();

  for (const node of nodes) {
    const members = pipe(MutableHashMap.get(membersByNodeIri, node.iri), O.getOrElse(emptyResources));
    for (const member of members) {
      MutableHashMap.set(nodeIriByResourceIri, member.iri, node.iri);
    }
  }

  const edges = pipe(
    relationships,
    A.filter((relationship) => relationshipVisible(relationship, resourcesByIri)),
    A.flatMap((relationship) => {
      const sourceNodeIri = MutableHashMap.get(nodeIriByResourceIri, relationship.sourceIri);
      const targetNodeIri = MutableHashMap.get(nodeIriByResourceIri, relationship.targetIri);

      if (O.isNone(sourceNodeIri) || O.isNone(targetNodeIri) || sourceNodeIri.value === targetNodeIri.value) {
        return [];
      }

      const sourceIndex = MutableHashMap.get(nodeIndexByIri, sourceNodeIri.value);
      const targetIndex = MutableHashMap.get(nodeIndexByIri, targetNodeIri.value);

      if (O.isNone(sourceIndex) || O.isNone(targetIndex)) {
        return [];
      }

      const source = nodes[sourceIndex.value];
      const target = nodes[targetIndex.value];

      return [
        OntologyGraphEdge.make({
          id: hashText(relationshipKey(relationship)),
          sourceId: source.id,
          targetId: target.id,
          sourceIri: relationship.sourceIri,
          targetIri: relationship.targetIri,
          predicateIri: relationship.predicateIri,
          label: labelFromIri(relationship.predicateIri),
          folded: source.folded || target.folded,
        }),
      ];
    }),
    A.dedupeWith((left, right) => left.id === right.id),
    A.sortWith((edge) => edge.id, Order.Number)
  );

  const nodeIds = new Uint32Array(nodes.length);
  const nodeKinds = new Uint8Array(nodes.length);
  const nodeFlags = new Uint8Array(nodes.length);
  const edgeIds = new Uint32Array(edges.length);
  const edgeKinds = new Uint8Array(edges.length);
  const pointPositions = new Float32Array(nodes.length * 2);
  const pointDepths = new Float32Array(nodes.length);
  const seedPositions3d = new Float64Array(nodes.length * 3);
  const links = new Float32Array(edges.length * 2);

  for (const [index, node] of nodes.entries()) {
    nodeIds[index] = node.id;
    nodeKinds[index] = kindCode(node.kind);
    nodeFlags[index] = node.folded ? 1 : 0;
    pointPositions[index * 2] = node.x;
    pointPositions[index * 2 + 1] = node.y;
    pointDepths[index] = seedDepths[index];
    seedPositions3d[index * 3] = node.x;
    seedPositions3d[index * 3 + 1] = node.y;
    seedPositions3d[index * 3 + 2] = seedDepths[index];
  }

  for (const [index, edge] of edges.entries()) {
    const sourceIndex = pipe(
      nodes,
      A.findFirstIndex((node) => node.id === edge.sourceId),
      O.getOrElse(() => 0)
    );
    const targetIndex = pipe(
      nodes,
      A.findFirstIndex((node) => node.id === edge.targetId),
      O.getOrElse(() => 0)
    );

    edgeIds[index] = edge.id;
    edgeKinds[index] = edge.folded ? 1 : 0;
    links[index * 2] = sourceIndex;
    links[index * 2 + 1] = targetIndex;
  }

  nodes = relaxProjectedNodes(nodes, edges, seedPositions3d, links, pointPositions, pointDepths);

  const changedNodeIds = pipe(
    changedIris,
    A.flatMap((iri) =>
      pipe(
        MutableHashMap.get(nodeIriByResourceIri, iri),
        O.flatMap((nodeIri) => MutableHashMap.get(nodeIndexByIri, nodeIri)),
        O.map((index) => nodes[index].id),
        O.toArray
      )
    ),
    A.dedupe
  );

  return OntologyGraphProjection.make({
    revision: pipe(
      previous,
      O.map((projection) => projection.revision + 1),
      O.getOrElse(() => 1)
    ),
    foldLevel: options.foldLevel,
    labelDetail: labelDetailFor(nodes.length, options),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeIds,
    nodeKinds,
    nodeFlags,
    edgeIds,
    edgeKinds,
    pointPositions,
    pointDepths,
    links,
    nodes,
    edges,
    clusters: pipe(
      MutableHashMap.values(clusterByIri),
      A.fromIterable,
      A.sortWith((cluster) => cluster.id, Order.Number)
    ),
    changedNodeIds,
    changedEdgeIds: [],
    stats: OntologyGraphProjectionStats.make({
      visibleResourceCount: visibleCount,
      projectedNodeCount: nodes.length,
      projectedEdgeCount: edges.length,
      foldedResourceCount: foldedResourceCount.value,
    }),
  });
};

const relationshipsFromSnapshot = (snapshot: OntologySnapshot): ReadonlyArray<Relationship> =>
  pipe(
    snapshot.relationships,
    A.map((relationship) => ({
      sourceIri: relationship.sourceIri,
      predicateIri: relationship.predicateIri,
      targetIri: relationship.objectIri,
    }))
  );

/**
 * Build a full graph projection from the shared ontology snapshot.
 *
 * **Example** (Build full projection)
 *
 * ```ts
 * import { buildOntologyGraphProjection, defaultOntologyGraphProjectionOptions, OntologyMetrics, OntologySnapshot } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const projection = buildOntologyGraphProjection(
 *   OntologySnapshot.make({
 *     sessionId: "session-1",
 *     resources: [],
 *     hierarchy: [],
 *     metrics: OntologyMetrics.make({
 *       quadCount: 0,
 *       resourceCount: 0,
 *       classCount: 0,
 *       propertyCount: 0,
 *       individualCount: 0,
 *       tboxCount: 0,
 *       aboxCount: 0
 *     })
 *   }),
 *   defaultOntologyGraphProjectionOptions()
 * )
 *
 * console.log(projection.nodeCount)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const buildOntologyGraphProjection: {
  (options: OntologyGraphProjectionOptions): (snapshot: OntologySnapshot) => OntologyGraphProjection;
  (snapshot: OntologySnapshot, options: OntologyGraphProjectionOptions): OntologyGraphProjection;
} = dual(
  2,
  (snapshot: OntologySnapshot, options: OntologyGraphProjectionOptions): OntologyGraphProjection =>
    projectionFromRelationships(snapshot, relationshipsFromSnapshot(snapshot), options, O.none(), [])
);

/**
 * Input for applying a graph projection delta.
 *
 * **Example** (Create delta input)
 *
 * ```ts
 * import { emptySessionChangeDelta } from "@beep/ontology-domain/aggregates/Session"
 * import { ApplyOntologyGraphProjectionDeltaInput, defaultOntologyGraphProjectionOptions, OntologyGraphProjection, OntologyGraphProjectionStats, OntologyMetrics, OntologySnapshot } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const input = ApplyOntologyGraphProjectionDeltaInput.make({
 *   previous: OntologyGraphProjection.make({
 *     revision: 1,
 *     foldLevel: "L0",
 *     labelDetail: "hidden",
 *     nodeCount: 0,
 *     edgeCount: 0,
 *     nodeIds: new Uint32Array([]),
 *     nodeKinds: new Uint8Array([]),
 *     nodeFlags: new Uint8Array([]),
 *     edgeIds: new Uint32Array([]),
 *     edgeKinds: new Uint8Array([]),
 *     pointPositions: new Float32Array([]),
 *     pointDepths: new Float32Array([]),
 *     links: new Float32Array([]),
 *     nodes: [],
 *     edges: [],
 *     clusters: [],
 *     changedNodeIds: [],
 *     changedEdgeIds: [],
 *     stats: OntologyGraphProjectionStats.make({
 *       visibleResourceCount: 0,
 *       projectedNodeCount: 0,
 *       projectedEdgeCount: 0,
 *       foldedResourceCount: 0
 *     })
 *   }),
 *   snapshot: OntologySnapshot.make({
 *     sessionId: "session-1",
 *     resources: [],
 *     hierarchy: [],
 *     metrics: OntologyMetrics.make({
 *       quadCount: 0,
 *       resourceCount: 0,
 *       classCount: 0,
 *       propertyCount: 0,
 *       individualCount: 0,
 *       tboxCount: 0,
 *       aboxCount: 0
 *     })
 *   }),
 *   delta: emptySessionChangeDelta(),
 *   options: defaultOntologyGraphProjectionOptions()
 * })
 *
 * console.log(input.previous.revision)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ApplyOntologyGraphProjectionDeltaInput extends S.Class<ApplyOntologyGraphProjectionDeltaInput>(
  $I`ApplyOntologyGraphProjectionDeltaInput`
)(
  {
    previous: OntologyGraphProjection,
    snapshot: OntologySnapshot,
    delta: SessionChangeDelta,
    options: OntologyGraphProjectionOptions,
  },
  $I.annote("ApplyOntologyGraphProjectionDeltaInput", {
    description: "Worker-safe input for applying a session delta to a graph projection.",
  })
) {}

/**
 * Apply a session delta to an existing graph projection without full graph diffing.
 *
 * **Example** (Apply projection delta)
 *
 * ```ts
 * import { ApplyOntologyGraphProjectionDeltaInput, applyOntologyGraphProjectionDelta, buildOntologyGraphProjection, defaultOntologyGraphProjectionOptions, OntologyMetrics, OntologySnapshot } from "@beep/ontology-use-cases/aggregates/Session"
 * import { emptySessionChangeDelta } from "@beep/ontology-domain/aggregates/Session"
 *
 * const snapshot = OntologySnapshot.make({
 *   sessionId: "session-1",
 *   resources: [],
 *   hierarchy: [],
 *   metrics: OntologyMetrics.make({
 *     quadCount: 0,
 *     resourceCount: 0,
 *     classCount: 0,
 *     propertyCount: 0,
 *     individualCount: 0,
 *     tboxCount: 0,
 *     aboxCount: 0
 *   })
 * })
 * const options = defaultOntologyGraphProjectionOptions()
 * const initial = buildOntologyGraphProjection(snapshot, options)
 * const next = applyOntologyGraphProjectionDelta(
 *   ApplyOntologyGraphProjectionDeltaInput.make({
 *     previous: initial,
 *     snapshot,
 *     delta: emptySessionChangeDelta(),
 *     options
 *   })
 * )
 *
 * console.log(next.revision)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const applyOntologyGraphProjectionDelta = (
  input: ApplyOntologyGraphProjectionDeltaInput
): OntologyGraphProjection => {
  const { delta, options, previous, snapshot } = input;
  let relationships: ReadonlyArray<Relationship> = pipe(
    previous.edges,
    A.map((edge) => ({
      sourceIri: edge.sourceIri,
      predicateIri: edge.predicateIri,
      targetIri: edge.targetIri,
    }))
  );
  const changedIris = MutableHashSet.empty<string>();
  const addChangedSubject = (quad: Quad): void => {
    pipe(
      subjectIri(quad),
      O.map((iri) => MutableHashSet.add(changedIris, iri))
    );
  };

  for (const quad of delta.removed) {
    pipe(
      relationshipFromQuad(quad),
      O.match({
        onNone: () => undefined,
        onSome: (relationship) => {
          relationships = removeRelationship(relationships, relationship);
          MutableHashSet.add(changedIris, relationship.sourceIri);
          MutableHashSet.add(changedIris, relationship.targetIri);
        },
      })
    );
  }

  for (const quad of delta.added) {
    pipe(
      relationshipFromQuad(quad),
      O.match({
        onNone: () => addChangedSubject(quad),
        onSome: (relationship) => {
          relationships = addRelationship(relationships, relationship);
          MutableHashSet.add(changedIris, relationship.sourceIri);
          MutableHashSet.add(changedIris, relationship.targetIri);
        },
      })
    );
  }

  return projectionFromRelationships(snapshot, relationships, options, O.some(previous), A.fromIterable(changedIris));
};

const quadChange = (
  kind: "addQuad" | "removeQuad",
  sourceIri: string,
  predicateIri: string,
  targetIri: string
): ChangeOperation =>
  ChangeOperation.make({
    kind,
    partition: "asserted",
    quad: makeQuad(makeNamedNode(sourceIri), makeNamedNode(predicateIri), makeNamedNode(targetIri)),
  });

/**
 * Convert a halo graph gesture into undoable ontology change operations.
 *
 * **Example** (Convert gesture to operations)
 *
 * ```ts
 * import { graphGestureChangeOperations, OntologyGraphGesture } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const operations = graphGestureChangeOperations(
 *   OntologyGraphGesture.make({
 *     kind: "instantiate",
 *     classIri: "https://example.test/Pizza",
 *     instanceIri: "https://example.test/Margherita"
 *   })
 * )
 *
 * console.log(operations.length)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const graphGestureChangeOperations = (gesture: OntologyGraphGesture): ReadonlyArray<ChangeOperation> =>
  OntologyGraphGesture.match(gesture, {
    connect: ({ sourceIri, predicateIri, targetIri }) => [quadChange("addQuad", sourceIri, predicateIri, targetIri)],
    delete: ({ sourceIri, predicateIri, targetIri }) => [quadChange("removeQuad", sourceIri, predicateIri, targetIri)],
    expand: ({ sourceIri, predicateIri, targetIri }) => [quadChange("addQuad", sourceIri, predicateIri, targetIri)],
    instantiate: ({ classIri, instanceIri }) => [quadChange("addQuad", instanceIri, RDF_TYPE.value, classIri)],
  });

/**
 * Build predicate autocomplete suggestions from the current snapshot.
 *
 * **Example** (Build autocomplete suggestions)
 *
 * ```ts
 * import { predicateAutocompleteSuggestions, OntologyMetrics, OntologySnapshot } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const suggestions = predicateAutocompleteSuggestions(
 *   OntologySnapshot.make({
 *     sessionId: "session-1",
 *     resources: [],
 *     hierarchy: [],
 *     metrics: OntologyMetrics.make({
 *       quadCount: 0,
 *       resourceCount: 0,
 *       classCount: 0,
 *       propertyCount: 0,
 *       individualCount: 0,
 *       tboxCount: 0,
 *       aboxCount: 0
 *     })
 *   }),
 *   "type"
 * )
 *
 * console.log(suggestions.length)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const predicateAutocompleteSuggestions: {
  (query: string): (snapshot: OntologySnapshot) => ReadonlyArray<OntologyPredicateSuggestion>;
  (snapshot: OntologySnapshot, query: string): ReadonlyArray<OntologyPredicateSuggestion>;
} = dual(2, (snapshot: OntologySnapshot, query: string): ReadonlyArray<OntologyPredicateSuggestion> => {
  const normalized = Str.toLowerCase(Str.trim(query));
  const seeded = [
    OntologyPredicateSuggestion.make({ iri: RDF_TYPE.value, label: "type", weight: 100 }),
    OntologyPredicateSuggestion.make({ iri: RDFS_SUB_CLASS_OF.value, label: "subClassOf", weight: 95 }),
    OntologyPredicateSuggestion.make({ iri: RDFS_SUB_PROPERTY_OF.value, label: "subPropertyOf", weight: 90 }),
    OntologyPredicateSuggestion.make({ iri: RDFS_LABEL.value, label: "label", weight: 50 }),
  ];
  const resourcePredicates = pipe(
    snapshot.resources,
    A.filter(
      (resource) =>
        resource.kind === "objectProperty" || resource.kind === "dataProperty" || resource.kind === "annotationProperty"
    ),
    A.map((resource) =>
      OntologyPredicateSuggestion.make({
        iri: resource.iri,
        label: resource.label,
        weight: 75,
      })
    )
  );

  return pipe(
    seeded,
    A.appendAll(resourcePredicates),
    A.filter((suggestion) =>
      Str.isEmpty(normalized)
        ? true
        : Str.contains(Str.toLowerCase(suggestion.label), normalized) ||
          Str.contains(Str.toLowerCase(suggestion.iri), normalized)
    ),
    A.dedupeWith((left, right) => left.iri === right.iri),
    A.sortWith((suggestion) => -suggestion.weight, Order.Number)
  );
});
