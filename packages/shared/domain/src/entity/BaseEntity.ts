/**
 * Product-facing persisted entity base constructor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { PosInt } from "@beep/schema/Int";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Shared from "../identity/Shared.ts";
import { Principal } from "./Principal.ts";
import * as PublicEntityId from "./PublicEntityId.ts";
import { SourceKind } from "./SourceKind.ts";
import type * as EntityId from "./EntityId.ts";

const $I = $SharedDomainId.create("entity/BaseEntity");

class BaseEntityAttachmentError extends S.TaggedError<BaseEntityAttachmentError>($I`BaseEntityAttachmentError`)(
  "BaseEntityAttachmentError",
  {
    message: S.String,
  },
  $I.annote("BaseEntityAttachmentError", {
    description: "BaseEntity factory metadata attachment invariant failure.",
  })
) {}

type EntityInput<
  FieldMap extends EntitySchema.EntityFieldInputs,
  Persisted extends EntitySchema.PersistedFor<FieldMap>,
> = Omit<EntitySchema.ClassInput<FieldMap, Persisted>, "entityId" | "tableName">;

type EntityIdentityFields<Entity extends EntityId.Any> = {
  readonly entityType: S.Literal<Entity["entityType"]>;
  readonly id: Entity;
  readonly publicId: PublicEntityId.PublicEntityId<Entity>;
};

type EntityIdentityPersisted = {
  readonly entityType: EntitySchema.PersistDescriptor<"literal", "derived", "entity_type", undefined>;
  readonly id: EntitySchema.PersistDescriptor<"entityId", "generatedOnInsert", undefined, undefined>;
  readonly publicId: EntitySchema.PersistDescriptor<
    "text",
    "computedByServiceOnInsert",
    "public_id",
    readonly [typeof EntitySchema.IndexHint.unique]
  >;
};

type EntityFieldsFor<
  Entity extends EntityId.Any,
  ChildFields extends EntitySchema.EntityFieldInputs,
> = EntitySchema.Assign<ChildFields, EntityIdentityFields<Entity>>;

type EntityPersistedFor<
  Entity extends EntityId.Any,
  ChildFields extends EntitySchema.EntityFieldInputs,
  ChildPersisted extends EntitySchema.PersistedFor<ChildFields>,
> = EntitySchema.AssignedPersisted<ChildFields, ChildPersisted, EntityIdentityFields<Entity>, EntityIdentityPersisted>;

/**
 * BaseEntity fields shared by every persisted product entity except the
 * entity-specific `id` and `entityType` fields.
 *
 * **Example** (Log fields.createdAt property)
 *
 * ```ts
 * import { fields } from "@beep/shared-domain/entity/BaseEntity"
 *
 * console.log(fields.createdAt)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const fields = {
  createdAt: EntitySchema.DateTimeFromMillis,
  createdByPrincipal: Principal,
  orgId: Shared.OrganizationId,
  rowVersion: PosInt,
  schemaVersion: SemanticVersion,
  source: SourceKind,
  updatedAt: EntitySchema.DateTimeFromMillis,
  updatedByPrincipal: Principal,
} as const;

/**
 * Physical persistence metadata for BaseEntity invariant fields.
 *
 * **Example** (Log orgId storageKind)
 *
 * ```ts
 * import { persisted } from "@beep/shared-domain/entity/BaseEntity"
 *
 * console.log(persisted.orgId.storageKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const persisted = {
  createdAt: EntitySchema.persist.timestampMillis({
    valueStrategy: "defaultedOnInsert",
  }),
  createdByPrincipal: EntitySchema.persist.jsonb({
    valueStrategy: "providedByContext",
  }),
  orgId: EntitySchema.persist.entityId({
    indexHints: [EntitySchema.IndexHint.btree, EntitySchema.IndexHint.lookup],
    valueStrategy: "providedByContext",
  }),
  rowVersion: EntitySchema.persist.int({
    valueStrategy: "incrementedOnWrite",
  }),
  schemaVersion: EntitySchema.persist.text({
    valueStrategy: "providedByContext",
  }),
  source: EntitySchema.persist.literal({
    indexHints: [EntitySchema.IndexHint.btree, EntitySchema.IndexHint.lookup],
    valueStrategy: "derived",
  }),
  updatedAt: EntitySchema.persist.timestampMillis({
    valueStrategy: "updatedOnWrite",
  }),
  updatedByPrincipal: EntitySchema.persist.jsonb({
    valueStrategy: "providedByContext",
  }),
} as const satisfies EntitySchema.PersistedFor<typeof fields>;

const BaseEntityCore = EntitySchema.ClassFactory($I`BaseEntity`)(
  {
    fields,
    persisted,
  },
  $I.annote("BaseEntity", {
    description: "Base persisted entity shape shared by every product entity.",
  })
);

const BaseEntityCoreClass = BaseEntityCore.Class;

const identityFields = <const Entity extends EntityId.Any>(entityId: Entity): EntityIdentityFields<Entity> => ({
  entityType: EntitySchema.literal(entityId.entityType),
  id: entityId,
  publicId: PublicEntityId.factory(entityId),
});

const identityPersisted = {
  entityType: EntitySchema.persist.literal({
    columnName: "entity_type",
    valueStrategy: "derived",
  }),
  id: EntitySchema.persist.entityId({
    valueStrategy: "generatedOnInsert",
  }),
  publicId: EntitySchema.persist.text({
    columnName: "public_id",
    indexHints: [EntitySchema.IndexHint.unique],
    valueStrategy: "computedByServiceOnInsert",
  }),
} as const satisfies EntityIdentityPersisted;

const entityPartsFor = <
  const Entity extends EntityId.Any,
  const ChildFields extends EntitySchema.EntityFieldInputs,
  const ChildPersisted extends EntitySchema.PersistedFor<ChildFields>,
>(
  entityId: Entity,
  input: EntityInput<ChildFields, ChildPersisted>
): {
  readonly fields: EntityFieldsFor<Entity, ChildFields>;
  readonly persisted: EntityPersistedFor<Entity, ChildFields, ChildPersisted>;
} =>
  EntitySchema.assignEntityParts({
    baseFields: input.fields,
    basePersisted: input.persisted,
    extensionFields: identityFields(entityId),
    extensionPersisted: identityPersisted,
  });

const Class =
  <Child = never>(identifier: string) =>
  <
    const Entity extends EntityId.Any,
    const ChildFields extends EntitySchema.EntityFieldInputs,
    const ChildPersisted extends EntitySchema.PersistedFor<ChildFields>,
  >(
    entityId: Entity,
    input: EntityInput<ChildFields, ChildPersisted>,
    annotations?: EntitySchema.SchemaAnnotations
  ) => {
    const entityParts = entityPartsFor(entityId, input);
    const classInput = EntitySchema.defineClassInput<
      EntityFieldsFor<Entity, ChildFields>,
      EntityPersistedFor<Entity, ChildFields, ChildPersisted>,
      Entity["tableName"],
      Entity
    >({
      entityId,
      fields: entityParts.fields,
      persisted: entityParts.persisted,
      tableName: entityId.tableName,
    });

    return BaseEntityCoreClass<Child>(identifier)<
      EntityFieldsFor<Entity, ChildFields>,
      EntityPersistedFor<Entity, ChildFields, ChildPersisted>,
      Entity["tableName"],
      Entity
    >(classInput, annotations);
  };

const replaceClass = <Base extends object>(base: Base): Omit<Base, "Class"> & { readonly Class: typeof Class } => {
  Reflect.defineProperty(base, "Class", {
    configurable: true,
    value: Class,
  });
  if (hasReplacementClass(base)) {
    return base;
  }
  /* istanbul ignore next -- Reflect.defineProperty on the module-local base cannot fail; defensive attachment guard */
  throw BaseEntityAttachmentError.make({ message: "Failed to attach BaseEntity Class factory." });
};

const hasReplacementClass = <Base extends object>(base: Base): base is Base & { readonly Class: typeof Class } =>
  P.hasProperty(base, "Class") && Reflect.get(base, "Class") === Class;

/**
 * Product-facing persisted entity base.
 *
 * **Example** (Log definition tableName)
 *
 * ```ts
 * import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity"
 *
 * console.log(BaseEntity.definition.tableName)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const BaseEntity = replaceClass(BaseEntityCore);

/**
 * Runtime type for {@link BaseEntity}.
 *
 * **Example** (Decode BaseEntity with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity"
 * import type { BaseEntity as BaseEntityValue } from "@beep/shared-domain/entity/BaseEntity"
 *
 * const systemPrincipal = {
 *   component: "Runtime",
 *   kind: "System"
 * }
 *
 * const program = Effect.gen(function* () {
 *   const entity: BaseEntityValue = yield* S.decodeUnknownEffect(BaseEntity)({
 *     createdAt: 1,
 *     createdByPrincipal: systemPrincipal,
 *     orgId: 1,
 *     rowVersion: 1,
 *     schemaVersion: "0.0.0",
 *     source: "System",
 *     updatedAt: 2,
 *     updatedByPrincipal: systemPrincipal
 *   })
 *   return entity.rowVersion
 * })
 *
 * Effect.runPromise(program)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BaseEntity = typeof BaseEntity.Type;
