/**
 * Service: Relation Linker
 *
 * **Details**
 *
 * Canonicalizes relations using Entity Resolution Graph.
 * Maps subject/object IDs to their canonical representatives.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { Chunk, Context, Effect, HashSet, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Relation, RelationObject } from "../Domain/Model/Entity.ts";
import type { EntityResolutionGraph } from "../Domain/Model/EntityResolutionGraph.ts";
import { EntityId } from "../Domain/Model/shared.ts";
import { getCanonicalId } from "./EntityLinker.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/RelationLinker");

/**
 * Linked relation with canonical IDs
 *
 *
 * **Example** (Reject incomplete linked-relation data)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { LinkedRelation } from "@effect-ontology/Service/RelationLinker"
 *
 * console.log(S.is(LinkedRelation)({})) // false
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class LinkedRelation extends S.Class<LinkedRelation>($I`LinkedRelation`)(
  {
    original: Relation,
    canonicalSubjectId: EntityId,
    canonicalPredicate: IRI,
    canonicalObject: RelationObject,
    subjectRemapped: S.Boolean,
    objectRemapped: S.Boolean,
  },
  $I.annote("LinkedRelation", {
    description: "Original relation paired with its canonicalized subject, predicate, object, and remapping flags.",
  })
) {}

/**
 * Result of linking a batch of relations
 *
 *
 * **Example** (Create an empty linking result)
 *
 * ```ts
 * import { Chunk } from "effect"
 * import { LinkingResult } from "@effect-ontology/Service/RelationLinker"
 *
 * console.log(LinkingResult.make({ linkedRelations: Chunk.empty(), remappedCount: 0, literalObjectCount: 0 }))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class LinkingResult extends S.Class<LinkingResult>($I`LinkingResult`)(
  {
    linkedRelations: S.Chunk(LinkedRelation),
    remappedCount: S.Int.check(S.isGreaterThanOrEqualTo(0, { message: "Remapped count must be non-negative." })),
    literalObjectCount: S.Int.check(
      S.isGreaterThanOrEqualTo(0, { message: "Literal-object count must be non-negative." })
    ),
  },
  $I.annote("LinkingResult", {
    description: "Canonicalized relations and non-negative remapping and literal-object counts.",
  })
) {}

/**
 * RelationLinker - Service for canonicalizing relations
 *
 * **Details**
 *
 * Takes relations and an ERG, returns relations with canonical IDs.
 *
 * **Example** (Inspect relation linker)
 *
 * ```ts
 * import { RelationLinker } from "@effect-ontology/Service/RelationLinker"
 *
 * console.log(RelationLinker)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class RelationLinker extends Context.Service<RelationLinker>()($I`RelationLinker`, {
  make: Effect.succeed({
    /**
     * Link relations to canonical entities
     *
     * @param relations - Relations to canonicalize
     * @param erg - Entity Resolution Graph for lookups
     * @returns Linking result with canonical relations
     */
    linkRelations: (
      relations: ReadonlyArray<Relation>,
      erg: EntityResolutionGraph
    ): Effect.Effect<LinkingResult, never> =>
      Effect.sync(() => {
        let remappedCount = 0;
        let literalObjectCount = 0;

        const linkedRelations = A.empty<LinkedRelation>();

        for (const relation of relations) {
          // Canonicalize subject - unwrap Option with fallback to original
          const canonicalSubjectId = EntityId.fromUnknown(
            O.getOrElse(getCanonicalId(erg, relation.subjectId), () => relation.subjectId)
          );
          const subjectRemapped = canonicalSubjectId !== relation.subjectId;

          if (subjectRemapped) {
            remappedCount++;
          }

          // Canonicalize object (only if it's an entity reference string)
          let canonicalObject: RelationObject;
          let objectRemapped = false;

          if (RelationObject.guards.EntityReference(relation.object)) {
            // Entity reference - canonicalize
            const resolved = O.getOrElse(getCanonicalId(erg, relation.object.value), () => relation.object.value);
            canonicalObject = RelationObject.cases.EntityReference.make({ value: EntityId.fromUnknown(resolved) });
            objectRemapped = resolved !== relation.object.value;
            if (objectRemapped) {
              remappedCount++;
            }
          } else {
            // Literal value (number or boolean) - keep as-is
            canonicalObject = relation.object;
            literalObjectCount++;
          }

          linkedRelations.push({
            original: relation,
            canonicalSubjectId,
            canonicalPredicate: relation.predicate,
            canonicalObject,
            subjectRemapped,
            objectRemapped,
          });
        }

        return {
          linkedRelations: Chunk.fromIterable(linkedRelations),
          remappedCount,
          literalObjectCount,
        };
      }),

    /**
     * Create deduplicated canonical relations (remove duplicates after canonicalization)
     *
     * @param linkingResult - Result from linkRelations
     * @returns Deduplicated relations
     */
    deduplicateLinked: (linkingResult: LinkingResult): Effect.Effect<Chunk.Chunk<Relation>, never> =>
      Effect.sync(() => {
        let seen = HashSet.empty<string>();
        const deduplicated = A.empty<Relation>();

        for (const linked of linkingResult.linkedRelations) {
          // Create canonical key
          const objectStr = String(linked.canonicalObject.value);
          const key = `${linked.canonicalSubjectId}|${linked.canonicalPredicate}|${objectStr}`;

          if (!HashSet.has(seen, key)) {
            seen = HashSet.add(seen, key);
            // Create new relation with canonical IDs
            deduplicated.push(
              Relation.make({
                subjectId: linked.canonicalSubjectId,
                predicate: linked.canonicalPredicate,
                object: linked.canonicalObject,
              })
            );
          }
        }

        return Chunk.fromIterable(deduplicated);
      }),
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
