/**
 * EntityLinker Service
 *
 * Query helpers for EntityResolutionGraph:
 * - getCanonicalId: Look up canonical entity ID for any mention
 * - getMentionsForEntity: Get all MentionRecords for a canonical entity
 * - toMermaid: Visualization of the resolution graph
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Graph, Option } from "effect";
import { flow } from "effect/Function";
import * as Str from "effect/String";
import type { ERNode, MentionRecord } from "../Domain/Model/EntityResolution.ts";
import type { EntityResolutionGraph } from "../Domain/Model/EntityResolutionGraph.ts";
import { EntityId } from "../Domain/Model/shared.ts";
import { dual2 } from "../Utils/Dual.ts";

/**
 * Get canonical ID for an entity
 *
 * Looks up the canonical (resolved) entity ID for any original entity ID.
 * This enables entity linking: multiple mentions can resolve to one canonical.
 *
 * @param erg - Entity Resolution Graph
 * @param entityId - Original entity ID from extraction
 * @returns Option containing canonical ID, or None if not found
 *
 * **Example** (Use getCanonicalId)
 * ```ts
 * const canonical = getCanonicalId(erg, "arsenal")
 * // => Option.some("arsenal_fc")
 *
 * const unknown = getCanonicalId(erg, "not_found")
 * // => Option.none()
 * ```
 *
 * @since 0.0.0
 * @category queries
 */
export const getCanonicalId = dual2((erg: EntityResolutionGraph, entityId: EntityId): Option.Option<EntityId> => {
  const canonical = erg.canonicalMap[entityId];
  return canonical !== undefined ? Option.some(canonical) : Option.none();
});

/**
 * Get all MentionRecords for a canonical entity
 *
 * Returns all original extraction records that resolved to this canonical ID.
 * Useful for provenance tracking and understanding entity clustering.
 *
 * @param erg - Entity Resolution Graph
 * @param canonicalId - Canonical entity ID (from ResolvedEntity)
 * @returns Array of MentionRecords that resolved to this entity
 *
 * **Example** (Use getMentionsForEntity)
 * ```ts
 * const mentions = getMentionsForEntity(erg, "arsenal_fc")
 * // => [
 * //   MentionRecord { id: "arsenal", mention: "Arsenal", chunkIndex: 0 },
 * //   MentionRecord { id: "arsenal_fc", mention: "Arsenal FC", chunkIndex: 2 }
 * // ]
 * ```
 *
 * @since 0.0.0
 * @category queries
 */
export const getMentionsForEntity = dual2(
  (erg: EntityResolutionGraph, canonicalId: EntityId): ReadonlyArray<MentionRecord> => {
    // Find all entity IDs that map to this canonical ID
    const matchingIds = Object.entries(erg.canonicalMap)
      .filter(([_, canonical]) => canonical === canonicalId)
      .map(([entityId]) => EntityId.fromUnknown(entityId));

    // Look up MentionRecord nodes in the graph
    const mentions: Array<MentionRecord> = [];

    for (const entityId of matchingIds) {
      const nodeIdx = erg.entityIndex[entityId];
      if (nodeIdx !== undefined) {
        const nodeOpt = Graph.getNode(erg.graph, nodeIdx);
        if (Option.isSome(nodeOpt)) {
          const node = nodeOpt.value;
          if (isMentionRecord(node)) {
            mentions.push(node);
          }
        }
      }
    }

    return mentions;
  }
);

/**
 * Type guard for MentionRecord
 *
 * @internal
 */
const isMentionRecord = (node: ERNode): node is MentionRecord => node._tag === "MentionRecord";

/**
 * Generate Mermaid diagram from EntityResolutionGraph
 *
 * Creates a visual representation of the two-tier graph:
 * - MentionRecord nodes (evidence)
 * - ResolvedEntity nodes (canonical)
 * - Resolution edges (mention → canonical)
 * - Relation edges (canonical → canonical)
 *
 * @param erg - Entity Resolution Graph
 * @returns Mermaid diagram string
 *
 * **Example** (Use toMermaid)
 * ```ts
 * const mermaid = toMermaid(erg)
 * // graph TD
 * //   m0["Arsenal (chunk 0)"]
 * //   m1["Arsenal FC (chunk 2)"]
 * //   r0[["arsenal_fc"]]
 * //   m0 --> r0
 * //   m1 --> r0
 * ```
 *
 * @since 0.0.0
 * @category formatting
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
    if (node._tag === "MentionRecord") {
      mentionNodes.push({ idx, node });
    } else if (node._tag === "ResolvedEntity") {
      resolvedNodes.push({
        idx,
        canonicalId: node.canonicalId,
        mention: node.mention,
      });
    }
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

    if (data._tag === "ResolutionEdge") {
      // MentionRecord → ResolvedEntity (dashed)
      lines.push(`  m${source} -.-> r${target}`);
    } else if (data._tag === "RelationEdge") {
      // ResolvedEntity → ResolvedEntity (solid with label)
      const predLabel = extractLocalName(data.predicate);
      lines.push(`  r${source} -->|${predLabel}| r${target}`);
    }
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
