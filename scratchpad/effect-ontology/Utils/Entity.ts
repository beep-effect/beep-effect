/**
 * Entity Utilities
 *
 * **Details**
 *
 * Pure functions for entity ID validation and reference detection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { IRI } from "@beep/rdf";
import { MutableHashMap, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import type { Entity } from "../Domain/Model/Entity.ts";
import { ENTITY_ID_PATTERN } from "../Domain/Model/shared.ts";

/**
 * Check if a string value is an entity reference (vs a literal)
 *
 * **Details**
 *
 * Entity references are snake_case identifiers starting with lowercase letter.
 * This distinguishes entity ID references from literal string values.
 *
 * **Example** (Inspect is entity reference)
 *
 * ```ts
 * import { isEntityReference } from "@effect-ontology/Utils/Entity"
 *
 * isEntityReference("cristiano_ronaldo")  // => true
 * isEntityReference("al_nassr_fc")        // => true
 * isEntityReference("1985-02-05")         // => false (starts with digit)
 * isEntityReference("Portuguese")         // => false (starts with uppercase)
 * isEntityReference("hello world")        // => false (contains space)
 * ```
 *
 * @param value - String to check
 * @returns True if value matches entity reference pattern
 * @category predicates
 * @since 0.0.0
 */
export const isEntityReference = (value: string): boolean => ENTITY_ID_PATTERN.test(value);

/**
 * Merges the canonical mention, majority-voted types, and preferred attributes
 * shared by the entity-resolution workflows.
 *
 * **Example** (Merge one entity)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { Entity } from "@effect-ontology/Domain/Model/Entity"
 * import { EntityId } from "@effect-ontology/Domain/Model/shared"
 * import { mergeEntityFields } from "@effect-ontology/Utils/Entity"
 *
 * const entity = Entity.make({
 *   id: EntityId.make("ada"),
 *   mention: "Ada",
 *   types: [IRI.make("https://schema.org/Person")]
 * })
 * console.log(mergeEntityFields([entity]).canonical.id) // "ada"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const mergeEntityFields = (entities: A.NonEmptyReadonlyArray<Entity>) => {
  const sorted = A.sort(
    entities,
    Order.mapInput(Order.flip(Order.Number), (entity: Entity) => entity.mention.length)
  );
  const canonical = A.headNonEmpty(sorted);
  const typeFrequency = MutableHashMap.empty<IRI, number>();

  for (const entity of entities) {
    for (const type of entity.types) {
      MutableHashMap.set(typeFrequency, type, O.getOrElse(MutableHashMap.get(typeFrequency, type), () => 0) + 1);
    }
  }

  const threshold = Math.ceil(entities.length / 2);
  const mergedTypes = A.fromIterable(typeFrequency)
    .filter(([_, count]) => count >= threshold)
    .map(([type]) => type);
  const types = A.match(mergedTypes, {
    onEmpty: () => canonical.types,
    onNonEmpty: (values) => A.prepend(values, canonical.types[0]),
  });

  const attributes: Record<string, string | number | boolean> = {};
  for (const entity of sorted) {
    for (const [key, value] of R.toEntries(entity.attributes)) {
      if (!(key in attributes)) attributes[key] = value;
    }
  }

  return { canonical, types, attributes };
};
