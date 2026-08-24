/**
 * Workflow: Entity Resolution
 *
 * **Details**
 *
 * Post-extraction entity resolution to merge duplicate/coreference entities.
 * Handles cases like "Eze" and "Eberechi Eze" being the same person.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import type { IRI } from "@beep/rdf";
import { SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Effect, MutableHashMap, MutableHashSet, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Entity, KnowledgeGraph, Relation, RelationObject } from "../Domain/Model/Entity.ts";
import { EntityId } from "../Domain/Model/shared.ts";
import { dual2 } from "../Utils/Dual.ts";
import { combinedSimilarity, overlapRatio } from "../Utils/String.ts";

const $I = $ScratchpadId.create("effect-ontology/Workflow/EntityResolution");

/**
 * Configuration for entity resolution
 *
 *
 * **Example** (Use the EntityResolutionConfig contract)
 *
 * ```ts
 * import type { EntityResolutionConfig } from "@effect-ontology/Workflow/EntityResolution"
 *
 * const acceptsEntityResolutionConfig = (_value: EntityResolutionConfig): void => undefined
 *
 * console.log(acceptsEntityResolutionConfig)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class EntityResolutionConfig extends S.Class<EntityResolutionConfig>($I`EntityResolutionConfig`)(
  {
    mentionSimilarityThreshold: UnitInterval.pipe(SchemaUtils.withKeyDefaults(UnitInterval.make(0.7))),
    requireTypeOverlap: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    typeOverlapRatio: UnitInterval.pipe(SchemaUtils.withKeyDefaults(UnitInterval.make(0.5))),
  },
  $I.annote("EntityResolutionConfig", {
    description: "Mention similarity and type-overlap thresholds used by the legacy graph merge workflow.",
  })
) {}

/**
 * Constructor input accepted by {@link EntityResolutionConfig}.
 *
 * **Example** (Configure entity resolution)
 *
 * ```ts
 * import type { EntityResolutionConfigInput } from "@effect-ontology/Workflow/EntityResolution"
 *
 * const config: EntityResolutionConfigInput = { requireTypeOverlap: false }
 * console.log(config)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EntityResolutionConfigInput = (typeof EntityResolutionConfig)["~type.make.in"];

/**
 * Exposes default config for composition by callers of this module.
 *
 * **Example** (Inspect default config)
 *
 * ```ts
 * import { DEFAULT_CONFIG } from "@effect-ontology/Workflow/EntityResolution"
 *
 * console.log(DEFAULT_CONFIG)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_CONFIG = EntityResolutionConfig.make({});

/**
 * Check if two entities should be merged based on similarity criteria
 *
 * @internal
 */
const shouldMerge = (entityA: Entity, entityB: Entity, config: EntityResolutionConfig): boolean => {
  // Calculate mention similarity using combined approach
  const similarity = combinedSimilarity(entityA.mention, entityB.mention);

  if (similarity < config.mentionSimilarityThreshold) return false;

  // Check type overlap if required
  if (config.requireTypeOverlap) {
    const overlap = overlapRatio(entityA.types, entityB.types);
    if (overlap < config.typeOverlapRatio) return false;
  }

  return true;
};

/**
 * Find clusters of entities that should be merged using union-find
 *
 * @internal
 */
const findEntityClusters = (
  entities: ReadonlyArray<Entity>,
  config: EntityResolutionConfig
): MutableHashMap.MutableHashMap<string, Array<string>> => {
  const parent = MutableHashMap.empty<string, string>();

  const find = (id: string): string => {
    const current = O.getOrElse(MutableHashMap.get(parent, id), () => {
      MutableHashMap.set(parent, id, id);
      return id;
    });
    if (current === id) return id;
    const root = find(current);
    MutableHashMap.set(parent, id, root);
    return root;
  };

  const union = (idA: string, idB: string): void => {
    const rootA = find(idA);
    const rootB = find(idB);
    if (rootA !== rootB) {
      // Prefer shorter ID as root (usually more canonical)
      MutableHashMap.set(
        parent,
        rootA.length <= rootB.length ? rootB : rootA,
        rootA.length <= rootB.length ? rootA : rootB
      );
    }
  };

  // Compare all pairs of entities
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      if (shouldMerge(entities[i], entities[j], config)) {
        union(entities[i].id, entities[j].id);
      }
    }
  }

  // Build clusters
  const clusters = MutableHashMap.empty<string, Array<string>>();
  for (const entity of entities) {
    const root = find(entity.id);
    const cluster = O.getOrElse(MutableHashMap.get(clusters, root), () => {
      const created: Array<string> = [];
      MutableHashMap.set(clusters, root, created);
      return created;
    });
    cluster.push(entity.id);
  }

  return clusters;
};

/**
 * Merge a cluster of entities into a single canonical entity
 *
 * @internal
 */
const mergeEntityCluster = (
  clusterIds: ReadonlyArray<string>,
  entityMap: MutableHashMap.MutableHashMap<string, Entity>
): O.Option<Entity> => {
  const entities = A.getSomes(A.map(clusterIds, (id) => MutableHashMap.get(entityMap, id)));

  if (entities.length === 0) return O.none();
  if (entities.length === 1) return O.some(entities[0]);

  // Select canonical entity (prefer longest mention - usually most complete)
  const sorted = A.sort(
    entities,
    Order.mapInput(Order.flip(Order.Number), (entity: Entity) => entity.mention.length)
  );
  const canonical = sorted[0];

  // Merge types using frequency voting
  const typeFreq = MutableHashMap.empty<IRI, number>();
  for (const entity of entities) {
    for (const type of entity.types) {
      MutableHashMap.set(typeFreq, type, O.getOrElse(MutableHashMap.get(typeFreq, type), () => 0) + 1);
    }
  }

  // Select types appearing in at least half the entities
  const threshold = Math.ceil(entities.length / 2);
  const mergedTypes = A.fromIterable(typeFreq)
    .filter(([_, count]) => count >= threshold)
    .map(([type]) => type);

  const finalTypes: Entity["types"] = mergedTypes.length > 0 ? [canonical.types[0], ...mergedTypes] : canonical.types;

  // Merge attributes (prefer values from longer mentions)
  const mergedAttrs: Record<string, string | number | boolean> = {};
  for (const entity of sorted) {
    for (const [key, value] of R.toEntries(entity.attributes)) {
      if (!(key in mergedAttrs)) mergedAttrs[key] = value;
    }
  }

  return O.some(
    Entity.make({
      id: canonical.id,
      mention: canonical.mention,
      types: finalTypes,
      attributes: mergedAttrs,
    })
  );
};

/**
 * Resolve entity coreferences in a knowledge graph
 *
 * **Details**
 *
 * Identifies and merges duplicate entities based on mention similarity
 * and type compatibility. Updates relations to point to canonical entities.
 *
 * **Example** (Use resolveEntities)
 *
 * ```ts
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
 * import { resolveEntities } from "@effect-ontology/Workflow/EntityResolution"
 * import * as Effect from "effect/Effect"
 *
 * const resolved = resolveEntities(KnowledgeGraph.make({}), {
 *   mentionSimilarityThreshold: UnitInterval.make(0.7),
 *   requireTypeOverlap: true
 * })
 * console.log(Effect.isEffect(resolved)) // true
 * ```
 *
 * @param graph - Input knowledge graph
 * @param config - Resolution configuration (optional)
 * @returns Effect yielding resolved knowledge graph
 * @category workflows
 * @since 0.0.0
 */
export const resolveEntities = dual2(
  Effect.fn("EntityResolution.resolve")(function* (
    graph: KnowledgeGraph,
    input: EntityResolutionConfigInput
  ): Effect.fn.Return<KnowledgeGraph, never, never> {
    const cfg = EntityResolutionConfig.make(input);

    yield* Effect.logInfo("Starting entity resolution", {
      stage: "entity-resolution",
      entityCount: graph.entities.length,
      relationCount: graph.relations.length,
    });

    // Build entity map
    const entityMap = MutableHashMap.empty<string, Entity>();
    for (const entity of graph.entities) MutableHashMap.set(entityMap, entity.id, entity);

    // Find entity clusters
    const clusters = findEntityClusters(graph.entities, cfg);

    yield* Effect.logDebug("Entity clusters found", {
      stage: "entity-resolution",
      clusterCount: MutableHashMap.size(clusters),
      clusters: A.fromIterable(clusters).map(([root, ids]) => ({
        canonical: root,
        members: ids,
      })),
    });

    // Merge clusters
    const mergedEntities: Array<Entity> = [];
    const idMapping = MutableHashMap.empty<string, string>();

    for (const [_canonicalId, clusterIds] of clusters) {
      const mergedOpt = mergeEntityCluster(clusterIds, entityMap);
      if (O.isSome(mergedOpt)) {
        mergedEntities.push(mergedOpt.value);
        for (const oldId of clusterIds) MutableHashMap.set(idMapping, oldId, mergedOpt.value.id);
      }
    }

    // Update relations to use canonical entity IDs
    const updatedRelations: Array<Relation> = [];
    for (const relation of graph.relations) {
      const newSubjectId = EntityId.make(
        O.getOrElse(MutableHashMap.get(idMapping, relation.subjectId), () => relation.subjectId)
      );
      const newObject = RelationObject.guards.EntityReference(relation.object)
        ? (() => {
            const objectId = relation.object.value;
            return RelationObject.cases.EntityReference.make({
              value: EntityId.make(O.getOrElse(MutableHashMap.get(idMapping, objectId), () => objectId)),
            });
          })()
        : relation.object;

      // Skip self-referential relations created by merging
      if (RelationObject.guards.EntityReference(newObject) && newSubjectId === newObject.value) continue;

      updatedRelations.push(
        Relation.make({
          subjectId: newSubjectId,
          predicate: relation.predicate,
          object: newObject,
        })
      );
    }

    // Deduplicate relations
    const relationSet = MutableHashSet.empty<string>();
    const deduped: Array<Relation> = [];
    for (const rel of updatedRelations) {
      const key = `${rel.subjectId}|${rel.predicate}|${rel.object._tag}:${rel.object.value}`;
      if (!MutableHashSet.has(relationSet, key)) {
        MutableHashSet.add(relationSet, key);
        deduped.push(rel);
      }
    }

    yield* Effect.logInfo("Entity resolution complete", {
      stage: "entity-resolution",
      originalEntities: graph.entities.length,
      mergedEntities: mergedEntities.length,
      originalRelations: graph.relations.length,
      updatedRelations: deduped.length,
    });

    return KnowledgeGraph.make({
      entities: mergedEntities,
      relations: deduped,
    });
  })
);
