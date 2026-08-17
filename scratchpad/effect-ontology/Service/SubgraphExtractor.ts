/**
 * Service: Subgraph Extractor
 *
 * Extracts relevant subgraphs from knowledge graphs for GraphRAG context.
 * Supports N-hop traversal from seed entities and relevance-based extraction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Effect, HashSet, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import type { Entity, KnowledgeGraph, Relation } from "../Domain/Model/Entity.ts";
import { RelationObject } from "../Domain/Model/Entity.ts";
import type { EntityId } from "../Domain/Model/shared.ts";
import type { FindSimilarOptions } from "./EntityIndex.ts";
import { EntityIndex } from "./EntityIndex.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/SubgraphExtractor");

/**
 * Extracted subgraph containing nodes and edges
 *
 * @since 0.0.0
 * @category type-level
 */
export interface Subgraph {
  /** Entities in the subgraph */
  readonly nodes: ReadonlyArray<Entity>;
  /** Relations in the subgraph */
  readonly edges: ReadonlyArray<Relation>;
  /** Original seed entity IDs */
  readonly centerNodes: ReadonlyArray<EntityId>;
  /** Actual traversal depth used */
  readonly depth: number;
}

/**
 * Options for N-hop extraction
 *
 * @since 0.0.0
 * @category type-level
 */
export interface ExtractOptions {
  /** Maximum number of nodes to include (default: unlimited) */
  readonly maxNodes?: number;
  /** Whether to follow outgoing relations (default: true) */
  readonly followOutgoing?: boolean;
  /** Whether to follow incoming relations (default: true) */
  readonly followIncoming?: boolean;
}

/**
 * Options for relevance-based extraction
 *
 * @since 0.0.0
 * @category type-level
 */
export interface ExtractRelevantOptions {
  /** Number of seed entities to find (default: 5) */
  readonly topK?: number;
  /** Number of hops to traverse from seeds (default: 1) */
  readonly hops?: number;
  /** Minimum similarity score for seed selection (default: 0.3) */
  readonly minSimilarity?: number;
  /** Type filter for seed entities */
  readonly filterTypes?: ReadonlyArray<string>;
}

/**
 * SubgraphExtractor service interface
 *
 * @since 0.0.0
 * @category services
 */
export interface SubgraphExtractorService {
  /**
   * Extract subgraph around seed entities using N-hop traversal
   *
   * @param graph - Source knowledge graph
   * @param seeds - Entity IDs to start traversal from
   * @param hops - Number of hops to traverse (0 = seeds only)
   * @param options - Optional extraction settings
   */
  readonly extract: (
    graph: KnowledgeGraph,
    seeds: ReadonlyArray<EntityId>,
    hops: number,
    options?: ExtractOptions
  ) => Effect.Effect<Subgraph>;

  /**
   * Extract subgraph based on query relevance
   *
   * Uses EntityIndex to find similar entities, then extracts N-hop subgraph
   *
   * @param graph - Source knowledge graph (must be indexed first)
   * @param query - Query string for relevance matching
   * @param maxNodes - Maximum nodes to include in result
   * @param options - Optional relevance extraction settings
   */
  readonly extractRelevant: (
    graph: KnowledgeGraph,
    query: string,
    maxNodes: number,
    options?: ExtractRelevantOptions
  ) => Effect.Effect<Subgraph, AnyEmbeddingError>;
}

/**
 * Empty subgraph constant
 */
const emptySubgraph = (centerNodes: ReadonlyArray<EntityId>, depth: number): Subgraph => ({
  nodes: [],
  edges: [],
  centerNodes,
  depth,
});

/**
 * SubgraphExtractor - Extracts relevant subgraphs for GraphRAG context
 *
 * @since 0.0.0
 * @category services
 */
export class SubgraphExtractor extends Context.Service<SubgraphExtractor>()($I`SubgraphExtractor`, {
  make: Effect.gen(function* () {
    const entityIndex = yield* EntityIndex;

    /**
     * Perform N-hop BFS traversal from seed entities
     */
    const traverseHops = (
      graph: KnowledgeGraph,
      seeds: ReadonlyArray<EntityId>,
      hops: number,
      options: ExtractOptions
    ): { nodes: HashSet.HashSet<EntityId>; edges: HashSet.HashSet<Relation> } => {
      const followOutgoing = options.followOutgoing ?? true;
      const followIncoming = options.followIncoming ?? true;
      const maxNodes = options.maxNodes ?? Infinity;

      // Track visited nodes and collected edges
      let visitedNodes = HashSet.fromIterable(seeds);
      let collectedEdges = HashSet.empty<Relation>();

      // Current frontier for BFS
      let frontier = HashSet.fromIterable(seeds);

      // Perform N hops
      for (let hop = 0; hop < hops && HashSet.size(visitedNodes) < maxNodes; hop++) {
        let nextFrontier = HashSet.empty<EntityId>();

        for (const entityId of frontier) {
          // Check node limit
          if (HashSet.size(visitedNodes) >= maxNodes) break;

          // Get outgoing relations
          if (followOutgoing) {
            const outgoing = graph.getRelationsFrom(entityId);
            for (const rel of outgoing) {
              collectedEdges = HashSet.add(collectedEdges, rel);

              // If object is an entity reference, add to next frontier
              if (RelationObject.guards.EntityReference(rel.object)) {
                if (!HashSet.has(visitedNodes, rel.object.value)) {
                  nextFrontier = HashSet.add(nextFrontier, rel.object.value);
                }
              }
            }
          }

          // Get incoming relations
          if (followIncoming) {
            const incoming = graph.getRelationsTo(entityId);
            for (const rel of incoming) {
              collectedEdges = HashSet.add(collectedEdges, rel);

              // Add subject to next frontier if not visited
              if (!HashSet.has(visitedNodes, rel.subjectId)) {
                nextFrontier = HashSet.add(nextFrontier, rel.subjectId);
              }
            }
          }
        }

        // Add next frontier to visited (respecting max nodes)
        for (const nodeId of nextFrontier) {
          if (HashSet.size(visitedNodes) >= maxNodes) break;
          visitedNodes = HashSet.add(visitedNodes, nodeId);
        }

        frontier = nextFrontier;
      }

      return { nodes: visitedNodes, edges: collectedEdges };
    };

    /**
     * Build subgraph from node and edge sets
     */
    const buildSubgraph = (
      graph: KnowledgeGraph,
      nodeIds: HashSet.HashSet<EntityId>,
      edges: HashSet.HashSet<Relation>,
      centerNodes: ReadonlyArray<EntityId>,
      depth: number
    ): Subgraph => {
      // Collect entities
      const nodes: Array<Entity> = [];
      for (const nodeId of nodeIds) {
        const entity = graph.getEntity(nodeId);
        if (O.isSome(entity)) {
          nodes.push(entity.value);
        }
      }

      // Filter edges to only those with both endpoints in subgraph
      const filteredEdges: Array<Relation> = [];
      for (const edge of edges) {
        const hasSubject = HashSet.has(nodeIds, edge.subjectId);
        const hasObject =
          !RelationObject.guards.EntityReference(edge.object) || HashSet.has(nodeIds, edge.object.value);

        if (hasSubject && hasObject) {
          filteredEdges.push(edge);
        }
      }

      return {
        nodes,
        edges: filteredEdges,
        centerNodes,
        depth,
      };
    };

    const service: SubgraphExtractorService = {
      extract: Effect.fn("SubgraphExtractor.extract")(function* (graph, seeds, hops, options = {}) {
        const validSeeds = A.filter(seeds, (id) => O.isSome(graph.getEntity(id)));
        if (A.length(validSeeds) === 0) {
          return emptySubgraph(seeds, 0);
        }
        const { edges, nodes } = traverseHops(graph, validSeeds, hops, options);
        return buildSubgraph(graph, nodes, edges, validSeeds, hops);
      }),
      extractRelevant: Effect.fn("SubgraphExtractor.extractRelevant")(function* (graph, query, maxNodes, options = {}) {
        const topK = options.topK ?? 5;
        const hops = options.hops ?? 1;
        const minSimilarity = options.minSimilarity ?? 0.3;
        yield* entityIndex.index(graph);
        const findOptions: FindSimilarOptions = {
          minScore: minSimilarity,
          ...(options.filterTypes === undefined ? {} : { filterTypes: options.filterTypes }),
        };
        const similar = yield* entityIndex.findSimilar(query, topK, findOptions);
        if (A.length(similar) === 0) {
          return emptySubgraph([], 0);
        }
        const seeds = A.map(similar, (result) => result.entity.id);
        const { edges, nodes } = traverseHops(graph, seeds, hops, { maxNodes });
        return buildSubgraph(graph, nodes, edges, seeds, hops);
      }),
    };

    return service;
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([EntityIndex.Default]));
}

/**
 * Default SubgraphExtractor layer
 *
 * Requires EmbeddingService dependencies to be provided.
 *
 * @since 0.0.0
 * @category layers
 */
export const SubgraphExtractorDefault = SubgraphExtractor.Default;
