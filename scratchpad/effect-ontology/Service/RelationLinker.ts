/**
 * Service: Relation Linker
 *
 * Canonicalizes relations using Entity Resolution Graph.
 * Maps subject/object IDs to their canonical representatives.
 *
 * @since 2.0.0
 * @module Service/RelationLinker
 */

import { Chunk, Effect, Option, Context, Layer } from "effect"
import { Relation } from "../Domain/Model/Entity.ts"
import type { EntityResolutionGraph } from "../Domain/Model/EntityResolutionGraph.ts"
import { getCanonicalId } from "./EntityLinker.ts"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/RelationLinker");

/**
 * Linked relation with canonical IDs
 *
 * @since 2.0.0
 * @category Types
 */
export interface LinkedRelation {
  /** Original relation */
  readonly original: Relation
  /** Canonical subject ID (resolved via ERG) */
  readonly canonicalSubjectId: string
  /** Canonical predicate (unchanged) */
  readonly canonicalPredicate: string
  /**
   * Canonical object (resolved via ERG if entity reference, unchanged if literal)
   */
  readonly canonicalObject: string | number | boolean
  /** Whether subject was remapped */
  readonly subjectRemapped: boolean
  /** Whether object was remapped (false for literals) */
  readonly objectRemapped: boolean
}

/**
 * Result of linking a batch of relations
 *
 * @since 2.0.0
 * @category Types
 */
export interface LinkingResult {
  readonly linkedRelations: Chunk.Chunk<LinkedRelation>
  readonly remappedCount: number
  readonly literalObjectCount: number
}

/**
 * RelationLinker - Service for canonicalizing relations
 *
 * Takes relations and an ERG, returns relations with canonical IDs.
 *
 * @since 2.0.0
 * @category Services
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
        let remappedCount = 0
        let literalObjectCount = 0

        const linkedRelations: Array<LinkedRelation> = []

        for (const relation of relations) {
          // Canonicalize subject - unwrap Option with fallback to original
          const canonicalSubjectId = Option.getOrElse(
            getCanonicalId(erg, relation.subjectId),
            () => relation.subjectId
          )
          const subjectRemapped = canonicalSubjectId !== relation.subjectId

          if (subjectRemapped) {
            remappedCount++
          }

          // Canonicalize object (only if it's an entity reference string)
          let canonicalObject: string | number | boolean
          let objectRemapped = false

          if (typeof relation.object === "string") {
            // Entity reference - canonicalize
            const resolved = Option.getOrElse(
              getCanonicalId(erg, relation.object),
              () => relation.object
            )
            canonicalObject = resolved
            objectRemapped = resolved !== relation.object
            if (objectRemapped) {
              remappedCount++
            }
          } else {
            // Literal value (number or boolean) - keep as-is
            canonicalObject = relation.object
            literalObjectCount++
          }

          linkedRelations.push({
            original: relation,
            canonicalSubjectId,
            canonicalPredicate: relation.predicate,
            canonicalObject,
            subjectRemapped,
            objectRemapped
          })
        }

        return {
          linkedRelations: Chunk.fromIterable(linkedRelations),
          remappedCount,
          literalObjectCount
        }
      }),

    /**
     * Create deduplicated canonical relations (remove duplicates after canonicalization)
     *
     * @param linkingResult - Result from linkRelations
     * @returns Deduplicated relations
     */
    deduplicateLinked: (
      linkingResult: LinkingResult
    ): Effect.Effect<Chunk.Chunk<Relation>, never> =>
      Effect.sync(() => {
        const seen = new Set<string>()
        const deduplicated: Array<Relation> = []

        for (const linked of linkingResult.linkedRelations) {
          // Create canonical key
          const objectStr = String(linked.canonicalObject)
          const key = `${linked.canonicalSubjectId}|${linked.canonicalPredicate}|${objectStr}`

          if (!seen.has(key)) {
            seen.add(key)
            // Create new relation with canonical IDs
            deduplicated.push(
              Relation.make({
                subjectId: linked.canonicalSubjectId,
                predicate: linked.canonicalPredicate,
                object: linked.canonicalObject
              })
            )
          }
        }

        return Chunk.fromIterable(deduplicated)
      })
  }),
}) {
    static readonly Default = Layer.effect(this, this.make);
}
