/**
 * URL-safe public entity identifier constructor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Cuid, cuid } from "@beep/schema/Cuid";
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { SegmentValue } from "@beep/identity";
import type * as BrandNS from "effect/Brand";
import type * as EntityId from "./EntityId.ts";

const $I = $SharedDomainId.create("entity/PublicEntityId");

/**
 * Public id brand derived from an entity type token.
 *
 * **Example** (Brand from entity type)
 *
 * ```ts
 * import type { Brand } from "@beep/shared-domain/entity/PublicEntityId"
 *
 * const brand: Brand<"SharedOrganization"> = "SharedOrganizationPublicId"
 * console.log(brand)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Brand<EntityType extends string> = `${EntityType}PublicId`;

/**
 * Public id brand derived from an entity-id schema.
 *
 * **Example** (Brand from entity-id schema)
 *
 * ```ts
 * import type { BrandFor } from "@beep/shared-domain/entity/PublicEntityId"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * const brand: BrandFor<typeof OrganizationId> = "SharedOrganizationPublicId"
 * console.log(brand)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BrandFor<Entity extends EntityId.Any> = Brand<Entity["entityType"]>;

/**
 * Public id prefix derived from an entity-id schema.
 *
 * **Example** (Prefix from entity-id schema)
 *
 * ```ts
 * import type { PrefixFor } from "@beep/shared-domain/entity/PublicEntityId"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * const prefix: PrefixFor<typeof OrganizationId> = "shared_organization"
 * console.log(prefix)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PrefixFor<Entity extends EntityId.Any> = Entity["tableName"];

/**
 * Branded public id value for one entity prefix and schema brand.
 *
 * **Example** (Value via fromCuid)
 *
 * ```ts
 * import { Cuid } from "@beep/schema/Cuid"
 * import type { PublicEntityIdValueFor } from "@beep/shared-domain/entity/PublicEntityId"
 * import { fromCuid } from "@beep/shared-domain/entity/PublicEntityId"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * const id: PublicEntityIdValueFor<"shared_organization", "SharedOrganizationPublicId"> = fromCuid(
 *   OrganizationId,
 *   Cuid.fromUnknown("a123")
 * )
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PublicEntityIdValueFor<Prefix extends string, TBrand extends string> = BrandNS.Branded<
  `${Prefix}_${string}`,
  TBrand
>;

/**
 * Public id value narrowed to a concrete entity-id schema.
 *
 * **Example** (Id for entity schema)
 *
 * ```ts
 * import { Cuid } from "@beep/schema/Cuid"
 * import type { PublicEntityIdFor } from "@beep/shared-domain/entity/PublicEntityId"
 * import { fromCuid } from "@beep/shared-domain/entity/PublicEntityId"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * const id: PublicEntityIdFor<typeof OrganizationId> = fromCuid(OrganizationId, Cuid.fromUnknown("a123"))
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PublicEntityIdFor<Entity extends EntityId.Any> = PublicEntityIdValueFor<
  PrefixFor<Entity>,
  BrandFor<Entity>
>;

type PublicEntityIdSchema<Prefix extends string, TBrand extends string> = S.Codec<
  PublicEntityIdValueFor<Prefix, TBrand>,
  string
>;

type PublicEntityIdStatics<
  Entity extends EntityId.Any,
  Prefix extends string,
  TBrand extends string,
> = SchemaUtils.CodecStatics<PublicEntityIdSchema<Prefix, TBrand>> & {
  readonly brand: TBrand;
  readonly entityType: Entity["entityType"];
  readonly equivalence: PublicEntityIdEquivalence<Prefix, TBrand>;
  readonly prefix: Prefix;
  readonly resource: Entity["resource"];
  readonly sourceEntityId: Entity;
  readonly tableName: Entity["tableName"];
};

/**
 * Branded schema for a concrete entity's public id.
 *
 * **Example** (Schema from factory)
 *
 * ```ts
 * import type { PublicEntityId } from "@beep/shared-domain/entity/PublicEntityId"
 * import { factory } from "@beep/shared-domain/entity/PublicEntityId"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * const schema: PublicEntityId<typeof OrganizationId> = factory(OrganizationId)
 * console.log(schema.prefix)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PublicEntityId<
  Entity extends EntityId.Any = EntityId.Any,
  Prefix extends string = PrefixFor<Entity>,
  TBrand extends string = BrandFor<Entity>,
> = PublicEntityIdSchema<Prefix, TBrand> & PublicEntityIdStatics<Entity, Prefix, TBrand>;

type PublicEntityIdEquivalence<Prefix extends string, TBrand extends string> = {
  bivarianceHack(self: PublicEntityIdValueFor<Prefix, TBrand>, that: PublicEntityIdValueFor<Prefix, TBrand>): boolean;
}["bivarianceHack"];

/**
 * Any public entity id schema produced by {@link factory}.
 *
 * **Example** (Any factory-produced schema)
 *
 * ```ts
 * import type { Any } from "@beep/shared-domain/entity/PublicEntityId"
 * import { factory } from "@beep/shared-domain/entity/PublicEntityId"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * const schema: Any = factory(OrganizationId)
 * console.log(schema.entityType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Any = PublicEntityId<EntityId.Any, string, string>;

const attachPublicEntityIdStatics = <
  const Entity extends EntityId.Any,
  const Prefix extends string,
  const TBrand extends string,
>(
  schema: PublicEntityIdSchema<Prefix, TBrand>,
  statics: Omit<PublicEntityIdStatics<Entity, Prefix, TBrand>, keyof SchemaUtils.CodecStatics<typeof schema>>
): PublicEntityId<Entity, Prefix, TBrand> =>
  SchemaUtils.withStatics(schema, (self) => ({
    decodeOption: S.decodeUnknownOption(self),
    fromUnknown: S.decodeUnknownSync(self),
    is: S.is(self),
    ...statics,
  })) as PublicEntityId<Entity, Prefix, TBrand>;

/**
 * Build a public id schema from an existing numeric entity-id schema.
 *
 * **Example** (Build public id schema)
 *
 * ```ts
 * import { factory } from "@beep/shared-domain/entity/PublicEntityId"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * const OrganizationPublicId = factory(OrganizationId)
 * console.log(OrganizationPublicId.prefix)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const factory = <const Entity extends EntityId.Any>(
  entityId: Entity
): PublicEntityId<Entity, PrefixFor<Entity>, BrandFor<Entity>> => {
  const brand = `${entityId.entityType}PublicId` as BrandFor<Entity>;
  const annotationName = brand as SegmentValue<BrandFor<Entity>>;
  const schema = S.TemplateLiteral([entityId.tableName, "_", Cuid] as const).pipe(
    S.brand(brand),
    $I.annoteSchema(annotationName, {
      description: `${entityId.entityType} public entity identifier.`,
    })
  ) as unknown as PublicEntityIdSchema<PrefixFor<Entity>, BrandFor<Entity>>;

  return attachPublicEntityIdStatics(schema, {
    brand,
    entityType: entityId.entityType,
    equivalence: S.toEquivalence(schema),
    prefix: entityId.tableName,
    resource: entityId.resource,
    sourceEntityId: entityId,
    tableName: entityId.tableName,
  });
};

/**
 * Build a public entity id from an entity schema and CUID value.
 *
 * **Example** (Build id from CUID)
 *
 * ```ts
 * import { Cuid } from "@beep/schema/Cuid"
 * import { fromCuid } from "@beep/shared-domain/entity/PublicEntityId"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * const id = fromCuid(OrganizationId, Cuid.fromUnknown("a123"))
 * console.log(id)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fromCuid: {
  (id: Cuid): <const Entity extends EntityId.Any>(entityId: Entity) => PublicEntityIdFor<Entity>;
  <const Entity extends EntityId.Any>(entityId: Entity, id: Cuid): PublicEntityIdFor<Entity>;
} = dual(
  2,
  <const Entity extends EntityId.Any>(entityId: Entity, id: Cuid): PublicEntityIdFor<Entity> =>
    factory(entityId).fromUnknown(`${entityId.tableName}_${id}`)
);

/**
 * Generate a public entity id for an entity schema.
 *
 * **Example** (Generate public entity id)
 *
 * ```ts
 * import { generate } from "@beep/shared-domain/entity/PublicEntityId"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * const program = generate(OrganizationId)
 * console.log(program)
 * ```
 *
 * @effects
 * Uses the existing `@beep/schema/Cuid` generator and therefore requires
 * `CuidState` and platform crypto services.
 * @category constructors
 * @since 0.0.0
 */
export const generate = <const Entity extends EntityId.Any>(entityId: Entity) =>
  Effect.map(cuid, (id) => fromCuid(entityId, id));
