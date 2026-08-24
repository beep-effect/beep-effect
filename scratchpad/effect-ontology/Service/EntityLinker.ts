/**
 * EntityLinker Service
 *
 * **Details**
 *
 * Query helpers for EntityResolutionGraph:
 * - getCanonicalId: Look up canonical entity ID for any mention
 * - getMentionsForEntity: Get all MentionRecords for a canonical entity
 * - toMermaid: Visualization of the resolution graph
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Graph } from "effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type { MentionRecord } from "../Domain/Model/EntityResolution.ts";
import { EREdge, ERNode } from "../Domain/Model/EntityResolution.ts";
import type { EntityResolutionGraph } from "../Domain/Model/EntityResolutionGraph.ts";
import { EntityId } from "../Domain/Model/shared.ts";
import { dual2 } from "../Utils/Dual.ts";

/**
 * Get canonical ID for an entity
 *
 * **Details**
 *
 * Looks up the canonical (resolved) entity ID for any original entity ID.
 * This enables entity linking: multiple mentions can resolve to one canonical.
 *
 * **Example** (Use getCanonicalId)
 *
 * ```ts
 * import { Graph } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EntityResolutionGraph } from "@effect-ontology/Model/EntityResolutionGraph"
 * import { EntityId } from "@effect-ontology/Model/shared"
 * import { getCanonicalId } from "@effect-ontology/Service/EntityLinker"
 *
 * const graph = S.decodeUnknownOption(EntityResolutionGraph)({
 *   graph: Graph.directed(),
 *   entityIndex: {},
 *   canonicalMap: {},
 *   createdAt: "2026-01-01T00:00:00.000Z",
 *   stats: { mentionCount: 0, resolvedCount: 0, relationCount: 0, clusterCount: 0 }
 * })
 * const canonical = O.flatMap(graph, (value) =>
 *   getCanonicalId(value, EntityId.make("not_found")))
 * console.log(O.isNone(canonical)) // true
 * ```
 *
 * @param erg - Entity Resolution Graph
 * @param entityId - Original entity ID from extraction
 * @returns Option containing canonical ID, or None if not found
 * @category services
 * @since 0.0.0
 */
export const getCanonicalId = dual2((erg: EntityResolutionGraph, entityId: EntityId): O.Option<EntityId> => {
  const canonical = erg.canonicalMap[entityId];
  return canonical !== undefined ? O.some(canonical) : O.none();
});

/**
 * Get all MentionRecords for a canonical entity
 *
 * **Details**
 *
 * Returns all original extraction records that resolved to this canonical ID.
 * Useful for provenance tracking and understanding entity clustering.
 *
 * **Example** (Use getMentionsForEntity)
 *
 * ```ts
 * import { Graph } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EntityResolutionGraph } from "@effect-ontology/Model/EntityResolutionGraph"
 * import { EntityId } from "@effect-ontology/Model/shared"
 * import { getMentionsForEntity } from "@effect-ontology/Service/EntityLinker"
 *
 * const graph = S.decodeUnknownOption(EntityResolutionGraph)({
 *   graph: Graph.directed(),
 *   entityIndex: {},
 *   canonicalMap: {},
 *   createdAt: "2026-01-01T00:00:00.000Z",
 *   stats: { mentionCount: 0, resolvedCount: 0, relationCount: 0, clusterCount: 0 }
 * })
 * const mentions = O.map(graph, (value) =>
 *   getMentionsForEntity(value, EntityId.make("arsenal_fc")))
 * console.log(mentions)
 * ```
 *
 * @param erg - Entity Resolution Graph
 * @param canonicalId - Canonical entity ID (from ResolvedEntity)
 * @returns Array of MentionRecords that resolved to this entity
 * @category services
 * @since 0.0.0
 */
export const getMentionsForEntity = dual2(
  (erg: EntityResolutionGraph, canonicalId: EntityId): ReadonlyArray<MentionRecord> => {
    // Find all entity IDs that map to this canonical ID
    const matchingIds = R.toEntries(erg.canonicalMap)
      .filter(([_, canonical]) => canonical === canonicalId)
      .map(([entityId]) => EntityId.fromUnknown(entityId));

    // Look up MentionRecord nodes in the graph
    const mentions: Array<MentionRecord> = [];

    for (const entityId of matchingIds) {
      const nodeIdx = erg.entityIndex[entityId];
      if (nodeIdx !== undefined) {
        const nodeOpt = Graph.getNode(erg.graph, nodeIdx);
        if (O.isSome(nodeOpt)) {
          const node = nodeOpt.value;
          if (ERNode.guards.MentionRecord(node)) {
            mentions.push(node);
          }
        }
      }
    }

    return mentions;
  }
);

/**
 * Generate Mermaid diagram from EntityResolutionGraph
 *
 * **Details**
 *
 * Creates a visual representation of the two-tier graph:
 * - MentionRecord nodes (evidence)
 * - ResolvedEntity nodes (canonical)
 * - Resolution edges (mention → canonical)
 * - Relation edges (canonical → canonical)
 *
 * **Example** (Use toMermaid)
 *
 * ```ts
 * import { Graph } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EntityResolutionGraph } from "@effect-ontology/Model/EntityResolutionGraph"
 * import { toMermaid } from "@effect-ontology/Service/EntityLinker"
 *
 * const graph = S.decodeUnknownOption(EntityResolutionGraph)({
 *   graph: Graph.directed(),
 *   entityIndex: {},
 *   canonicalMap: {},
 *   createdAt: "2026-01-01T00:00:00.000Z",
 *   stats: { mentionCount: 0, resolvedCount: 0, relationCount: 0, clusterCount: 0 }
 * })
 * const mermaid = O.map(graph, toMermaid)
 * console.log(mermaid)
 * ```
 *
 * @param erg - Entity Resolution Graph
 * @returns Mermaid diagram string
 * @category services
 * @since 0.0.0
 */
export const toMermaid = (erg: EntityResolutionGraph): string => {
  const lines: Array<string> = ["graph TD"];

  // Collect nodes by type
  const mentionNodes: Array<{ idx: Graph.NodeIndex; node: MentionRecord }> = [];
  const resolvedNodes: Array<{
    idx: Graph.NodeIndex;
    canonicalId: string;
    mention: string;
  }> = [];

  for (const [idx, node] of Graph.entries(Graph.nodes(erg.graph))) {
    ERNode.match(node, {
      MentionRecord: (mention) => mentionNodes.push({ idx, node: mention }),
      ResolvedEntity: (resolved) =>
        resolvedNodes.push({
          idx,
          canonicalId: resolved.canonicalId,
          mention: resolved.mention,
        }),
    });
  }

  // Add MentionRecord nodes (rectangles)
  for (const { idx, node } of mentionNodes) {
    const label = sanitizeLabel(`${node.mention} (chunk ${node.chunkIndex})`);
    lines.push(`  m${idx}["${label}"]`);
  }

  // Add ResolvedEntity nodes (stadium/pill shape)
  for (const { canonicalId, idx, mention } of resolvedNodes) {
    const label = sanitizeLabel(`${mention} [${canonicalId}]`);
    lines.push(`  r${idx}(["${label}"])`);
  }

  // Add edges
  for (const [_edgeIdx, edgeInfo] of Graph.entries(Graph.edges(erg.graph))) {
    const { data, source, target } = edgeInfo;

    EREdge.match(data, {
      ResolutionEdge: () => lines.push(`  m${source} -.-> r${target}`),
      RelationEdge: (relation) => {
        const predLabel = extractLocalName(relation.predicate);
        lines.push(`  r${source} -->|${predLabel}| r${target}`);
      },
    });
  }

  return lines.join("\n");
};

/**
 * Extract local name from IRI
 *
 * @internal
 */
const extractLocalName = (iri: string): string => {
  const hashIdx = iri.lastIndexOf("#");
  if (hashIdx !== -1) return iri.slice(hashIdx + 1);

  const slashIdx = iri.lastIndexOf("/");
  if (slashIdx !== -1) return iri.slice(slashIdx + 1);

  return iri;
};

/**
 * Sanitize label for Mermaid (escape special characters)
 *
 * @internal
 */
const sanitizeLabel = flow(Str.replace(/"/g, "'"), Str.replace(/\[/g, "("), Str.replace(/\]/g, ")"));
