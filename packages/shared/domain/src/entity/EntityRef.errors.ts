/**
 * Typed invariant failures for storage-neutral entity references.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SharedDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $SharedDomainId.create("entity/EntityRef.errors");

/**
 * Reports a reference whose runtime entity type or id violates its expected identity.
 *
 * **Details**
 *
 * The opaque actualId remains diagnostic payload and does not participate in equivalence.
 *
 * **Example** (Describe a mismatched reference)
 *
 * ```ts
 * import { EntityRefInvariantError } from "@beep/shared-domain/entity/EntityRef"
 *
 * const error = EntityRefInvariantError.mismatch("SharedOrganization", "OtherEntity", 1)
 * console.log(error.entityType)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EntityRefInvariantError extends S.TaggedError<EntityRefInvariantError>($I`EntityRefInvariantError`)(
  "EntityRefInvariantError",
  {
    actualEntityType: S.String,
    actualId: S.Unknown.pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent)),
    entityType: S.String,
  },
  $I.annoteError<EntityRefInvariantError>("EntityRefInvariantError", {
    description: "EntityRef runtime invariant failure.",
  })
) {
  /**
   * Captures the expected entity type and the observed reference identity.
   *
   * **Example** (Capture observed identity)
   *
   * ```ts
   * import { EntityRefInvariantError } from "@beep/shared-domain/entity/EntityRef"
   *
   * const error = EntityRefInvariantError.mismatch("SharedOrganization", "OtherEntity", 2)
   * console.log(error.actualId)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static mismatch(entityType: string, actualEntityType: string, actualId: unknown): EntityRefInvariantError {
    return EntityRefInvariantError.make({ entityType, actualEntityType, actualId });
  }
}

/**
 * Closed union of entity-reference invariant failures.
 *
 * **Example** (Recognize an entity-reference failure)
 *
 * ```ts
 * import { EntityRefError, EntityRefInvariantError } from "@beep/shared-domain/entity/EntityRef"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EntityRefError)(EntityRefInvariantError.mismatch("SharedOrganization", "OtherEntity", 1)))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const EntityRefError = S.Union([EntityRefInvariantError]).pipe(
  $I.annoteSchema("EntityRefError", { description: "Union of entity-reference invariant failures." })
);

/**
 * Runtime failure type derived from the entity-reference error union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EntityRefError = typeof EntityRefError.Type;
