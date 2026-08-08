/**
 * Storage-neutral polymorphic entity reference.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { Result } from "effect";
import { dual, pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as EntityId from "./EntityId.ts";

const $I = $SharedDomainId.create("entity/EntityRef");
const entityTypePattern = /^[A-Z][A-Za-z0-9]*$/u;

class EntityRefInvariantError extends TaggedErrorClass<EntityRefInvariantError>($I`EntityRefInvariantError`)(
  "EntityRefInvariantError",
  {
    actualEntityType: S.String,
    actualId: S.Unknown,
    entityType: S.String,
  },
  $I.annote("EntityRefInvariantError", {
    description: "EntityRef runtime invariant failure.",
  })
) {}

/**
 * Entity type grammar used by polymorphic references.
 *
 * **Example** (Decode EntityType schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { EntityType } from "@beep/shared-domain/entity/EntityRef"
 *
 * const program = Effect.gen(function* () {
 *   const entityType = yield* S.decodeUnknownEffect(EntityType)("SharedOrganization")
 *   return entityType
 * })
 * console.log(program)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EntityType = S.NonEmptyString.check(
  S.isPattern(entityTypePattern, {
    identifier: $I`EntityRefEntityTypePattern`,
    title: "EntityRef entity type pattern",
    description: "PascalCase entity type token used by polymorphic entity references.",
    message: "Expected a PascalCase entity type token",
  })
).pipe(
  S.brand("EntityType"),
  $I.annoteSchema("EntityType", {
    description: "PascalCase entity type token used by polymorphic entity references.",
  })
);

/**
 * Runtime type for {@link EntityType}.
 *
 * **Example** (Annotate EntityType parameter)
 *
 * ```ts
 * import type { EntityType } from "@beep/shared-domain/entity/EntityRef"
 *
 * const printEntityType = (entityType: EntityType) => console.log(entityType)
 * console.log(printEntityType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EntityType = typeof EntityType.Type;

/**
 * Persisted polymorphic reference encoded as entity type plus numeric id.
 *
 * **Example** (Make EntityRef value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { EntityIdValue } from "@beep/shared-domain/entity/EntityId"
 * import { EntityRef, EntityType } from "@beep/shared-domain/entity/EntityRef"
 *
 * const program = Effect.gen(function* () {
 *   const ref = EntityRef.make({
 *     entityType: yield* S.decodeUnknownEffect(EntityType)("SharedOrganization"),
 *     id: yield* S.decodeUnknownEffect(EntityIdValue)(1),
 *   })
 *   return ref.entityType
 * })
 * console.log(program)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntityRef extends S.Class<EntityRef>($I`EntityRef`)(
  {
    entityType: EntityType.annotateKey({ description: "PascalCase entity type token for the referenced entity." }),
    id: EntityId.EntityIdValue.annotateKey({ description: "Storage-neutral numeric id for the referenced entity." }),
  },
  $I.annote("EntityRef", {
    description: "Storage-neutral polymorphic entity reference.",
  })
) {}

/**
 * Entity reference narrowed to a known entity-id schema.
 *
 * **Example** (Narrow to OrganizationId)
 *
 * ```ts
 * import type { EntityRefFor } from "@beep/shared-domain/entity/EntityRef"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * type OrganizationRef = EntityRefFor<typeof OrganizationId>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EntityRefFor<Entity extends EntityId.Any> = Omit<EntityRef, "entityType" | "id"> & {
  readonly entityType: Entity["entityType"] & EntityType;
  readonly id: Entity["Type"];
};

const decodeEntityTypeResult = S.decodeUnknownResult(EntityType);

function isEntityRefFor<const Entity extends EntityId.Any>(
  entityId: Entity,
  ref: EntityRef
): ref is EntityRefFor<Entity> {
  return ref.entityType === entityId.entityType && S.is(entityId)(ref.id);
}

function assertEntityRefFor<const Entity extends EntityId.Any>(
  entityId: Entity,
  ref: EntityRef
): asserts ref is EntityRefFor<Entity> {
  /* istanbul ignore next -- makeResult builds the ref from entityId's own entityType and typed id, so the mismatch guard is unreachable via the public constructors */
  if (!isEntityRefFor(entityId, ref)) {
    throw EntityRefInvariantError.make({
      actualEntityType: ref.entityType,
      actualId: ref.id,
      entityType: entityId.entityType,
    });
  }
}

/**
 * Build a polymorphic reference result for a known entity id schema.
 *
 * **Example** (Build Result reference)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { makeResult } from "@beep/shared-domain/entity/EntityRef"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(OrganizationId)(1)
 *   const ref = makeResult(OrganizationId, id)
 *   return Result.isSuccess(ref)
 * })
 * console.log(program)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeResult: {
  <const Entity extends EntityId.Any>(
    entityId: Entity,
    id: Entity["Type"]
  ): Result.Result<EntityRefFor<Entity>, S.SchemaError>;
  <const Entity extends EntityId.Any>(
    id: Entity["Type"]
  ): (entityId: Entity) => Result.Result<EntityRefFor<Entity>, S.SchemaError>;
} = dual(
  2,
  <const Entity extends EntityId.Any>(
    entityId: Entity,
    id: Entity["Type"]
  ): Result.Result<EntityRefFor<Entity>, S.SchemaError> =>
    pipe(
      decodeEntityTypeResult(entityId.entityType),
      Result.map((entityType) => {
        const ref = EntityRef.make({
          entityType,
          id,
        });
        assertEntityRefFor(entityId, ref);
        return ref;
      })
    )
);

/**
 * Build a polymorphic reference for a known entity id schema.
 *
 * **Example** (Build typed reference)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { make } from "@beep/shared-domain/entity/EntityRef"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(OrganizationId)(1)
 *   const ref = make(OrganizationId, id)
 *   return ref.entityType
 * })
 * console.log(program)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make: {
  <const Entity extends EntityId.Any>(entityId: Entity, id: Entity["Type"]): EntityRefFor<Entity>;
  <const Entity extends EntityId.Any>(id: Entity["Type"]): (entityId: Entity) => EntityRefFor<Entity>;
} = dual(
  2,
  <const Entity extends EntityId.Any>(entityId: Entity, id: Entity["Type"]): EntityRefFor<Entity> =>
    Result.getOrThrow(makeResult(entityId, id))
);
