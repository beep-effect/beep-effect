/**
 * Bounded breadth-first subgraph extraction for GraphRAG retrieval.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { Context, Effect, HashMap, HashSet, Layer } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import type { KnowledgeGraph } from "../Domain/Model/Entity.ts";
import { Entity, Relation, RelationObject } from "../Domain/Model/Entity.ts";
import { EntityId } from "../Domain/Model/shared.ts";
import type { FindSimilarOptions } from "./EntityIndex.ts";
import { EntityIndex } from "./EntityIndex.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/SubgraphExtractor");

/**
 * Shortest traversal distance from an accepted seed to one subgraph entity.
 *
 * **Example** (Create a measured node distance)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { EntityId } from "@effect-ontology/Domain/Model/shared"
 * import { NodeDistance } from "@effect-ontology/Service/SubgraphExtractor"
 *
 * const distance = NodeDistance.make({ entityId: EntityId.make("alice"), hops: NonNegativeInt.make(0) })
 * console.log(distance.hops)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NodeDistance extends S.Class<NodeDistance>($I`NodeDistance`)(
  {
    entityId: EntityId.annotateKey({ description: "Entity whose breadth-first distance was measured." }),
    hops: NonNegativeInt.annotateKey({ description: "Shortest number of traversed relations from any seed." }),
  },
  $I.annote("NodeDistance", {
    description: "Shortest breadth-first hop count from any accepted subgraph seed to one entity.",
  })
) {}

/**
 * Schema-backed bounded view of a knowledge graph.
 *
 * **Example** (Create an empty subgraph)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { Subgraph } from "@effect-ontology/Service/SubgraphExtractor"
 *
 * const subgraph = Subgraph.make({ nodes: [], edges: [], centerNodes: [], depth: NonNegativeInt.make(0), distances: [] })
 * console.log(subgraph.nodes.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Subgraph extends S.Class<Subgraph>($I`Subgraph`)(
  {
    nodes: S.Array(Entity).annotateKey({ description: "Entities admitted by the traversal bound." }),
    edges: S.Array(Relation).annotateKey({ description: "Relations whose entity endpoints are both admitted." }),
    centerNodes: S.Array(EntityId).annotateKey({ description: "Valid seed IDs admitted before traversal began." }),
    depth: NonNegativeInt.annotateKey({ description: "Deepest hop distance actually reached." }),
    distances: S.Array(NodeDistance).annotateKey({
      description: "Shortest measured hop distance for every admitted entity.",
    }),
  },
  $I.annote("Subgraph", {
    description: "Bounded knowledge-graph view with exact seed distances and actual traversal depth.",
  })
) {}

/**
 * Constructor input accepted by {@link Subgraph}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SubgraphInput = (typeof Subgraph)["~type.make.in"];

/**
 * Options controlling bounded breadth-first traversal.
 *
 * **Example** (Use default extraction options)
 *
 * ```ts
 * import { ExtractOptions } from "@effect-ontology/Service/SubgraphExtractor"
 *
 * const options = ExtractOptions.make({})
 * console.log(options.maxNodes) // 50
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractOptions extends S.Class<ExtractOptions>($I`ExtractOptions`)(
  {
    maxNodes: PosInt.pipe(
      SchemaUtils.withKeyDefaults(PosInt.make(50)),
      S.annotateKey({ description: "Maximum entities admitted, including seeds." })
    ),
    followOutgoing: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(true),
      S.annotateKey({ description: "Whether traversal follows entity-reference objects from each subject." })
    ),
    followIncoming: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(true),
      S.annotateKey({ description: "Whether traversal follows subjects of relations targeting each entity." })
    ),
  },
  $I.annote("ExtractOptions", {
    description: "Validated node bound and relation directions for breadth-first subgraph extraction.",
  })
) {}

/**
 * Constructor input accepted by {@link ExtractOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractOptionsInput = (typeof ExtractOptions)["~type.make.in"];

/**
 * Options controlling semantic seed selection before graph traversal.
 *
 * **Example** (Use default relevance options)
 *
 * ```ts
 * import { ExtractRelevantOptions } from "@effect-ontology/Service/SubgraphExtractor"
 *
 * const options = ExtractRelevantOptions.make({})
 * console.log(options.topK) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractRelevantOptions extends S.Class<ExtractRelevantOptions>($I`ExtractRelevantOptions`)(
  {
    topK: PosInt.pipe(
      SchemaUtils.withKeyDefaults(PosInt.make(5)),
      S.annotateKey({ description: "Maximum embedding matches used as traversal seeds." })
    ),
    hops: NonNegativeInt.pipe(
      SchemaUtils.withKeyDefaults(NonNegativeInt.make(1)),
      S.annotateKey({ description: "Maximum breadth-first distance from a seed." })
    ),
    minSimilarity: Confidence.pipe(
      SchemaUtils.withKeyDefaults(Confidence.make(0.3)),
      S.annotateKey({ description: "Minimum embedding similarity admitted as a seed." })
    ),
    filterTypes: S.Array(IRI).pipe(
      SchemaUtils.withEmptyArrayDefaults<IRI>(),
      S.annotateKey({ description: "Optional ontology classes restricting semantic seed candidates." })
    ),
  },
  $I.annote("ExtractRelevantOptions", {
    description: "Validated semantic seed count, score threshold, type filter, and traversal distance.",
  })
) {}

/**
 * Constructor input accepted by {@link ExtractRelevantOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractRelevantOptionsInput = (typeof ExtractRelevantOptions)["~type.make.in"];

/**
 * Subgraph extraction service contract.
 *
 * **Details**
 *
 * This remains an interface because both members are dual executable
 * operations over an in-memory knowledge graph, not serializable data.
 *
 * @category services
 * @since 0.0.0
 */
export interface SubgraphExtractorService {
  readonly extract: {
    (
      graph: KnowledgeGraph,
      seeds: ReadonlyArray<EntityId>,
      hops: NonNegativeInt,
      options: ExtractOptionsInput
    ): Effect.Effect<Subgraph>;
    (
      seeds: ReadonlyArray<EntityId>,
      hops: NonNegativeInt,
      options: ExtractOptionsInput
    ): (graph: KnowledgeGraph) => Effect.Effect<Subgraph>;
  };
  readonly extractRelevant: {
    (
      graph: KnowledgeGraph,
      query: string,
      maxNodes: PosInt,
      options: ExtractRelevantOptionsInput
    ): Effect.Effect<Subgraph, AnyEmbeddingError>;
    (
      query: string,
      maxNodes: PosInt,
      options: ExtractRelevantOptionsInput
    ): (graph: KnowledgeGraph) => Effect.Effect<Subgraph, AnyEmbeddingError>;
  };
}

const emptySubgraph = (centerNodes: ReadonlyArray<EntityId>): Subgraph =>
  Subgraph.make({
    nodes: [],
    edges: [],
    centerNodes,
    depth: NonNegativeInt.make(0),
    distances: [],
  });

interface TraversalState {
  readonly nodes: HashSet.HashSet<EntityId>;
  readonly edges: HashSet.HashSet<Relation>;
  readonly distances: HashMap.HashMap<EntityId, NonNegativeInt>;
  readonly depth: NonNegativeInt;
  readonly seeds: ReadonlyArray<EntityId>;
}

const traverseHops = (
  graph: KnowledgeGraph,
  seeds: ReadonlyArray<EntityId>,
  hops: NonNegativeInt,
  options: ExtractOptions
): TraversalState => {
  const validSeeds = A.filter(seeds, (id) => O.isSome(graph.getEntity(id)));
  const acceptedSeeds = A.take(A.fromIterable(HashSet.fromIterable(validSeeds)), options.maxNodes);
  let visited = HashSet.fromIterable(acceptedSeeds);
  let frontier = HashSet.fromIterable(acceptedSeeds);
  let edges = HashSet.empty<Relation>();
  let distances = HashMap.fromIterable(A.map(acceptedSeeds, (entityId) => [entityId, NonNegativeInt.make(0)]));
  let actualDepth = NonNegativeInt.make(0);

  for (let hop = 1; hop <= hops && HashSet.size(frontier) > 0; hop += 1) {
    let nextFrontier = HashSet.empty<EntityId>();

    const admit = (entityId: EntityId): void => {
      if (!HashSet.has(visited, entityId) && HashSet.size(visited) < options.maxNodes) {
        visited = HashSet.add(visited, entityId);
        nextFrontier = HashSet.add(nextFrontier, entityId);
        distances = HashMap.set(distances, entityId, NonNegativeInt.make(hop));
        actualDepth = NonNegativeInt.make(hop);
      }
    };

    for (const entityId of frontier) {
      if (options.followOutgoing) {
        for (const relation of graph.getRelationsFrom(entityId)) {
          edges = HashSet.add(edges, relation);
          if (RelationObject.guards.EntityReference(relation.object)) {
            admit(relation.object.value);
          }
        }
      }

      if (options.followIncoming) {
        for (const relation of graph.getRelationsTo(entityId)) {
          edges = HashSet.add(edges, relation);
          admit(relation.subjectId);
        }
      }
    }

    frontier = nextFrontier;
  }

  return { nodes: visited, edges, distances, depth: actualDepth, seeds: acceptedSeeds };
};

const buildSubgraph = (graph: KnowledgeGraph, traversal: TraversalState): Subgraph => {
  const nodes = traversal.nodes.pipe(
    A.fromIterable,
    A.map((entityId) => graph.getEntity(entityId)),
    A.getSomes
  );
  const edges = A.filter(A.fromIterable(traversal.edges), (relation) => {
    const hasSubject = HashSet.has(traversal.nodes, relation.subjectId);
    const hasObject = RelationObject.match(relation.object, {
      EntityReference: ({ value }) => HashSet.has(traversal.nodes, value),
      Text: () => true,
      Number: () => true,
      Boolean: () => true,
    });
    return hasSubject && hasObject;
  });
  const distances = A.getSomes(
    A.map(nodes, (entity) =>
      O.map(HashMap.get(traversal.distances, entity.id), (hops) => NodeDistance.make({ entityId: entity.id, hops }))
    )
  );

  return Subgraph.make({
    nodes,
    edges,
    centerNodes: traversal.seeds,
    depth: traversal.depth,
    distances,
  });
};

/**
 * Extracts bounded subgraphs around explicit or semantically selected seeds.
 *
 * **Example** (Access the extraction service tag)
 *
 * ```ts
 * import { SubgraphExtractor } from "@effect-ontology/Service/SubgraphExtractor"
 *
 * console.log(SubgraphExtractor.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SubgraphExtractor extends Context.Service<SubgraphExtractor>()($I`SubgraphExtractor`, {
  make: Effect.gen(function* () {
    const entityIndex = yield* EntityIndex;

    const extractImpl = Effect.fn("SubgraphExtractor.extract")(
      (
        graph: KnowledgeGraph,
        seeds: ReadonlyArray<EntityId>,
        hops: NonNegativeInt,
        optionsInput: ExtractOptionsInput
      ) =>
        Effect.suspend(() => {
          const options = ExtractOptions.make(optionsInput);
          const traversal = traverseHops(graph, seeds, hops, options);
          return Effect.succeed(A.length(traversal.seeds) === 0 ? emptySubgraph([]) : buildSubgraph(graph, traversal));
        })
    );

    const extract: SubgraphExtractorService["extract"] = dual(4, extractImpl);

    const extractRelevantImpl = Effect.fn("SubgraphExtractor.extractRelevant")(function* (
      graph: KnowledgeGraph,
      query: string,
      maxNodes: PosInt,
      optionsInput: ExtractRelevantOptionsInput
    ) {
      const options = ExtractRelevantOptions.make(optionsInput);
      yield* entityIndex.index(graph);
      const findOptions: FindSimilarOptions =
        A.length(options.filterTypes) === 0
          ? { minScore: options.minSimilarity }
          : { minScore: options.minSimilarity, filterTypes: options.filterTypes };
      const similar = yield* entityIndex.findSimilar(query, options.topK, findOptions);
      if (A.length(similar) === 0) {
        return emptySubgraph([]);
      }
      const seeds = A.map(similar, (result) => result.entity.id);
      const traversal = traverseHops(
        graph,
        seeds,
        options.hops,
        ExtractOptions.make({ maxNodes, followIncoming: true, followOutgoing: true })
      );
      return buildSubgraph(graph, traversal);
    });

    const extractRelevant: SubgraphExtractorService["extractRelevant"] = dual(4, extractRelevantImpl);

    return { extract, extractRelevant } satisfies SubgraphExtractorService;
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide(EntityIndex.Default));
}

/**
 * Live subgraph-extraction layer backed by the default entity index.
 *
 * **Example** (Compose the live extraction layer)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { SubgraphExtractor, SubgraphExtractorDefault } from "@effect-ontology/Service/SubgraphExtractor"
 *
 * const program = Effect.gen(function* () {
 *   const extractor = yield* SubgraphExtractor
 *   return extractor
 * }).pipe(Effect.provide(SubgraphExtractorDefault))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SubgraphExtractorDefault = SubgraphExtractor.Default;
