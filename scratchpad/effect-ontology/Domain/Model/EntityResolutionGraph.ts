/**
 * Indexed graph values produced by entity resolution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { DirectedGraph, NodeIndex, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Graph } from "effect";
import * as S from "effect/Schema";
import { Entity } from "./Entity.ts";
import { EREdge, ERNode, ResolutionMethod } from "./EntityResolution.ts";
import { EntityId } from "./shared.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/EntityResolutionGraph");

/**
 * Re-export of the canonical entity-resolution method domain.
 *
 * **Example** (Use SimilarityEdgeFields)
 * ```ts
 * import { ResolutionMethod } from "@effect-ontology/Model/EntityResolutionGraph"
 *
 * console.log(ResolutionMethod.is.similarity("similarity")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export { ResolutionMethod } from "./EntityResolution.ts";

const SimilarityEdgeFields = {
  similarity: UnitInterval.annotateKey({
    description: "Normalized similarity score between the two candidate entities.",
  }),
  method: ResolutionMethod.annotateKey({
    description: "Evidence strategy that produced the similarity edge.",
  }),
};

/**
 * Weighted candidate edge used while clustering extracted entities.
 *
 * **Example** (Use SimilarityEdge)
 * ```ts
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { SimilarityEdge } from "@effect-ontology/Model/EntityResolutionGraph"
 *
 * const edge = SimilarityEdge.make({
 *   similarity: UnitInterval.make(0.9),
 *   method: "similarity"
 * })
 * console.log(edge.method) // "similarity"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SimilarityEdge extends S.Class<SimilarityEdge>($I`SimilarityEdge`)(
  SimilarityEdgeFields,
  $I.annote("SimilarityEdge", {
    description: "Normalized similarity edge used by entity clustering.",
  })
) {}

const EntityResolutionInfoFields = {
  entityId: EntityId.annotateKey({
    description: "Identifier of the original extracted entity.",
  }),
  similarity: UnitInterval.annotateKey({
    description: "Similarity between the original and canonical entity.",
  }),
  method: ResolutionMethod.annotateKey({
    description: "Evidence strategy that selected the canonical entity.",
  }),
};

/**
 * Explanation of how one extracted entity resolved to its canonical form.
 *
 * **Example** (Use EntityResolutionInfo)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EntityResolutionInfo } from "@effect-ontology/Model/EntityResolutionGraph"
 *
 * const info = S.decodeUnknownOption(EntityResolutionInfo)({
 *   entityId: "arsenal_fc",
 *   similarity: 1,
 *   method: "exact"
 * })
 * console.log(O.map(info, (value) => value.similarity)) // Some(1)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntityResolutionInfo extends S.Class<EntityResolutionInfo>($I`EntityResolutionInfo`)(
  EntityResolutionInfoFields,
  $I.annote("EntityResolutionInfo", {
    description: "Resolution evidence linking one extracted entity to its canonical entity.",
  })
) {}

const EntityClusterFields = {
  entities: S.NonEmptyArray(Entity).annotateKey({
    description: "Non-empty set of extracted entities assigned to the cluster.",
  }),
  minSimilarity: UnitInterval.annotateKey({
    description: "Minimum accepted pairwise similarity in the cluster.",
  }),
  methods: S.NonEmptyArray(ResolutionMethod).annotateKey({
    description: "Resolution methods that contributed to the cluster.",
  }),
};

/**
 * Non-empty cluster of extracted entities representing one canonical entity.
 *
 * **Example** (Use EntityCluster)
 * ```ts
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Entity } from "@effect-ontology/Model/Entity"
 * import { EntityCluster } from "@effect-ontology/Model/EntityResolutionGraph"
 *
 * const entity = S.decodeUnknownOption(Entity)({
 *   id: "arsenal_fc",
 *   mention: "Arsenal",
 *   types: ["https://schema.org/SportsTeam"]
 * })
 * const cluster = O.map(entity, (value) =>
 *   EntityCluster.make({
 *     entities: [value],
 *     minSimilarity: UnitInterval.make(1),
 *     methods: ["exact"]
 *   })
 * )
 * console.log(O.map(cluster, (value) => value.entities.length)) // { _tag: "Some", value: 1 }
 * ```
 *
 * @invariant Every cluster contains at least one entity and one supporting
 * resolution method.
 * @category models
 * @since 0.0.0
 */
export class EntityCluster extends S.Class<EntityCluster>($I`EntityCluster`)(
  EntityClusterFields,
  $I.annote("EntityCluster", {
    description: "Non-empty cluster of extracted entities assigned to one canonical identity.",
  })
) {}

const ClusteringResultFields = {
  clusters: S.Array(EntityCluster).pipe(
    SchemaUtils.withEmptyArrayDefaults<EntityCluster>(),
    S.annotateKey({ description: "Entity clusters produced by the resolver." })
  ),
  embeddingMap: S.HashMap(EntityId, S.NonEmptyArray(S.Finite)).annotateKey({
    description: "Finite embedding vector indexed by extracted entity identifier.",
  }),
};

/**
 * Clustering output together with the embeddings used to derive it.
 *
 * **Example** (Use ClusteringResult)
 * ```ts
 * import * as HashMap from "effect/HashMap"
 * import { ClusteringResult } from "@effect-ontology/Model/EntityResolutionGraph"
 *
 * const result = ClusteringResult.make({ embeddingMap: HashMap.empty() })
 * console.log(result.clusters.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClusteringResult extends S.Class<ClusteringResult>($I`ClusteringResult`)(
  ClusteringResultFields,
  $I.annote("ClusteringResult", {
    description: "Entity clusters and the finite vectors used by the clustering pass.",
  })
) {}

const EntityResolutionStatsFields = {
  mentionCount: NonNegativeInt.annotateKey({
    description: "Number of immutable mention nodes.",
  }),
  resolvedCount: NonNegativeInt.annotateKey({
    description: "Number of canonical resolved-entity nodes.",
  }),
  relationCount: NonNegativeInt.annotateKey({
    description: "Number of canonical relation edges.",
  }),
  clusterCount: NonNegativeInt.annotateKey({
    description: "Number of clusters produced by resolution.",
  }),
};

/**
 * Cardinality summary for an entity-resolution graph.
 *
 * **Example** (Use EntityResolutionStats)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EntityResolutionStats } from "@effect-ontology/Model/EntityResolutionGraph"
 *
 * const stats = S.decodeUnknownOption(EntityResolutionStats)({
 *   mentionCount: 2,
 *   resolvedCount: 1,
 *   relationCount: 0,
 *   clusterCount: 1
 * })
 * console.log(O.map(stats, (value) => value.resolvedCount)) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntityResolutionStats extends S.Class<EntityResolutionStats>($I`EntityResolutionStats`)(
  EntityResolutionStatsFields,
  $I.annote("EntityResolutionStats", {
    description: "Non-negative cardinality summary for an entity-resolution graph.",
  })
) {}

const ResolutionGraph = DirectedGraph({ node: ERNode, edge: EREdge }).pipe(
  $I.annoteSchema("ResolutionGraph", {
    description: "Immutable directed graph of entity-resolution nodes and edges.",
    toArbitrary: () => (fc) => {
      const node = S.toArbitrary(ERNode)(fc);
      const edge = S.toArbitrary(EREdge)(fc);

      return fc.oneof(
        fc.constant(Graph.directed<ERNode, EREdge>()),
        node.map((value) =>
          Graph.directed<ERNode, EREdge>((graph) => {
            Graph.addNode(graph, value);
            return undefined;
          })
        ),
        fc.tuple(node, node, edge).map(([source, target, value]) =>
          Graph.directed<ERNode, EREdge>((graph) => {
            const sourceIndex = Graph.addNode(graph, source);
            const targetIndex = Graph.addNode(graph, target);
            Graph.addEdge(graph, sourceIndex, targetIndex, value);
            return undefined;
          })
        )
      );
    },
  })
);

const EntityResolutionGraphFields = {
  graph: ResolutionGraph.annotateKey({
    description: "Immutable two-tier mention-to-canonical graph.",
  }),
  entityIndex: S.Record(EntityId, NodeIndex).annotateKey({
    description: "Lookup from entity identifier to graph node index.",
  }),
  canonicalMap: S.Record(EntityId, EntityId).annotateKey({
    description: "Lookup from extracted entity identifier to canonical identifier.",
  }),
  createdAt: S.DateTimeUtcFromString.annotateKey({
    description: "UTC instant at which the graph snapshot was created.",
  }),
  stats: EntityResolutionStats.annotateKey({
    description: "Cardinality summary for the graph snapshot.",
  }),
};

/**
 * Immutable entity-resolution graph with lookup indexes and statistics.
 *
 * **Details**
 *
 * * The graph uses the repository's schema-backed Effect `DirectedGraph`
 * codec. Indexes are serialized records rather than mutable JavaScript maps,
 * preserving deterministic transport behavior.
 *
 * **Example** (Use EntityResolutionGraph)
 * ```ts
 * import { Graph } from "effect"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EntityResolutionGraph, EntityResolutionStats } from "@effect-ontology/Model/EntityResolutionGraph"
 *
 * const stats = S.decodeUnknownOption(EntityResolutionStats)({
 *   mentionCount: 0,
 *   resolvedCount: 0,
 *   relationCount: 0,
 *   clusterCount: 0
 * })
 * const snapshot = O.map(stats, (value) =>
 *   EntityResolutionGraph.make({
 *     graph: Graph.directed(),
 *     entityIndex: {},
 *     canonicalMap: {},
 *     createdAt: DateTime.nowUnsafe(),
 *     stats: value
 *   })
 * )
 * console.log(O.map(snapshot, (value) => value.stats.mentionCount)) // { _tag: "Some", value: 0 }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntityResolutionGraph extends S.Class<EntityResolutionGraph>($I`EntityResolutionGraph`)(
  EntityResolutionGraphFields,
  $I.annote("EntityResolutionGraph", {
    description: "Indexed immutable graph snapshot produced by entity resolution.",
  })
) {
  /** Schema-derived graph-snapshot guard. */
  static readonly is = S.is(EntityResolutionGraph);
}
