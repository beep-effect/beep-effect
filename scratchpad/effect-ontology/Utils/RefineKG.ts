/**
 * Refine Knowledge Graph using Entity Resolution results
 *
 * **Details**
 *
 * Merges entities and rewrites relations based on canonical mappings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { Entity, KnowledgeGraph, Relation, RelationObject } from "../Domain/Model/Entity.ts";
import type { EntityResolutionGraph } from "../Domain/Model/EntityResolutionGraph.ts";
import { EntityId } from "../Domain/Model/shared.ts";
import { mergeGraphs } from "../Workflow/Merge.ts";
import { dual2 } from "./Dual.ts";

/**
 * Refine a KnowledgeGraph using the canonical mappings from an EntityResolutionGraph.
 *
 * **Details**
 *
 * - Merges entities that map to the same canonical ID.
 * - Rewrites relations to use canonical IDs.
 * - Deduplicates relations after rewriting.
 *
 * **Example** (Refine an empty graph)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { DateTime, Graph } from "effect"
 * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
 * import { EntityResolutionGraph, EntityResolutionStats } from "@effect-ontology/Model/EntityResolutionGraph"
 * import { refineKnowledgeGraph } from "@effect-ontology/Utils/RefineKG"
 *
 * const stats = EntityResolutionStats.make({
 *   mentionCount: NonNegativeInt.make(0),
 *   resolvedCount: NonNegativeInt.make(0),
 *   relationCount: NonNegativeInt.make(0),
 *   clusterCount: NonNegativeInt.make(0)
 * })
 * const resolution = EntityResolutionGraph.make({
 *   graph: Graph.directed(),
 *   entityIndex: {},
 *   canonicalMap: {},
 *   createdAt: DateTime.nowUnsafe(),
 *   stats
 * })
 * const refined = refineKnowledgeGraph(KnowledgeGraph.make({}), resolution)
 * console.log(refined.entities.length) // 0
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const refineKnowledgeGraph = dual2((kg: KnowledgeGraph, erg: EntityResolutionGraph): KnowledgeGraph => {
  const { canonicalMap } = erg;
  const canonicalIdFor = (id: EntityId): EntityId => EntityId.make(O.getOrElse(R.get(canonicalMap, id), () => id));
  const base = KnowledgeGraph.make({
    sourceText: kg.sourceText,
    provenance: kg.provenance,
    entityObservations: kg.entityObservations,
    relationObservations: kg.relationObservations,
  });
  const withEntities = A.reduce(kg.entities, base, (graph, entity) =>
    mergeGraphs(
      graph,
      KnowledgeGraph.make({
        entities: [Entity.make({ ...entity, id: canonicalIdFor(entity.id) })],
      })
    )
  );
  return A.reduce(kg.relations, withEntities, (graph, relation) =>
    mergeGraphs(
      graph,
      KnowledgeGraph.make({
        relations: [
          Relation.make({
            ...relation,
            subjectId: canonicalIdFor(relation.subjectId),
            object: RelationObject.match(relation.object, {
              EntityReference: ({ value }): RelationObject =>
                RelationObject.cases.EntityReference.make({ value: canonicalIdFor(value) }),
              Text: (value): RelationObject => RelationObject.cases.Text.make(value),
              Number: (value): RelationObject => RelationObject.cases.Number.make(value),
              Boolean: (value): RelationObject => RelationObject.cases.Boolean.make(value),
            }),
          }),
        ],
      })
    )
  );
});
