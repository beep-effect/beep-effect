/**
 * Shared machinery behind the entity tier family.
 *
 * The tiers (`BaseEntity`, `AuditEntity`, `OrgEntity`, `ProductEntity`) are
 * thin compositions over one PostgreSQL effect-drizzle kit lineage. This
 * module owns the shared column packs, the capability mixins, the
 * id-parameterized identity columns, and the typed `Entity` factory that every
 * tier exposes.
 *
 * The identity columns follow the two-artifact law proven in the kit design
 * spike: a runtime closure (whose inferred types may widen — harmless at
 * runtime) plus hand-declared type families ({@link IdentityColumns},
 * {@link ProductIdentityColumns}) as the authoritative public types, joined by
 * a cast at exactly one internal seam.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ModelInvariantError, VariantField } from "@beep/effect-drizzle";
import * as Pg from "@beep/effect-drizzle/pg";
import { PosInt } from "@beep/schema/Int";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Model as M } from "effect/unstable/schema";
import * as Shared from "../identity/Shared/index.ts";
import { Principal } from "./Principal.ts";
import * as PublicEntityId from "./PublicEntityId.ts";
import { SourceKind } from "./SourceKind.ts";
import type { FieldsInput, ModelClass, PatchedField } from "@beep/effect-drizzle";
import type { Annotations } from "effect/Schema";
import type { VariantSchema } from "effect/unstable/schema";
import type * as EntityId from "./EntityId.ts";

/**
 * Timestamp and optimistic-version columns shared by every tier.
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const baseColumns = {
  createdAt: M.DateTimeInsertFromNumber.pipe(Pg.bigint("number")),
  rowVersion: VariantField({
    select: PosInt,
    update: PosInt,
    json: PosInt,
  }).pipe(Pg.integer()),
  updatedAt: M.DateTimeUpdateFromNumber.pipe(Pg.bigint("number")),
};

/**
 * Actor-provenance and schema-lineage columns added by the audit capability.
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const auditColumns = {
  createdByPrincipal: M.GeneratedByApp(Principal).pipe(Pg.jsonb()),
  schemaVersion: M.GeneratedByApp(SemanticVersion).pipe(Pg.text()),
  source: M.GeneratedByApp(SourceKind).pipe(Pg.text(), Pg.index()),
  updatedByPrincipal: M.GeneratedByApp(Principal).pipe(Pg.jsonb()),
};

/**
 * Tenant-scoping column added by the org capability.
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const orgColumns = {
  orgId: M.GeneratedByApp(Shared.OrganizationId).pipe(Pg.integer(), Pg.index()),
};

/**
 * Audit capability mixin: actor principals, source facet, and schema version.
 *
 * **Details**
 *
 * `source` carries a colocated btree index, so extending a kit with this mixin
 * derives `{table}_source_btree_idx` on every entity without an extras
 * callback.
 *
 * **Example** (Compose an audited junction kit)
 *
 * ```ts
 * import { kit } from "@beep/shared-domain/entity/BaseEntity"
 * import { withAudit } from "@beep/shared-domain/entity/EntityKit"
 *
 * const audited = kit.extend(withAudit)
 * console.log(Object.keys(audited.pg).length > 0)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const withAudit = () => ({ columns: auditColumns });

/**
 * Org capability mixin: tenant organization scoping.
 *
 * **Details**
 *
 * `orgId` carries a colocated btree index, so extending a kit with this mixin
 * derives `{table}_org_id_btree_idx` on every entity without an extras
 * callback.
 *
 * **Example** (Compose an org-scoped kit)
 *
 * ```ts
 * import { kit } from "@beep/shared-domain/entity/BaseEntity"
 * import { withAudit, withOrg } from "@beep/shared-domain/entity/EntityKit"
 *
 * const orgScoped = kit.extend(withAudit).extend(withOrg)
 * console.log(Object.keys(orgScoped.pg).length > 0)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const withOrg = () => ({ columns: orgColumns });

// ---------------------------------------------------------------------------
// Identity columns: runtime closure + authoritative declared types
// ---------------------------------------------------------------------------

const identityColumns = (id: EntityId.Any) => ({
  entityType: M.GeneratedByApp(S.Literal(id.entityType)).pipe(Pg.text(), Pg.columnName("entity_type")),
  id: VariantField({ select: id, update: id, json: id }).pipe(Pg.primaryKey(), Pg.serial()),
});

const productIdentityColumns = (id: EntityId.Any) => {
  const publicId = PublicEntityId.factory(id);
  return {
    ...identityColumns(id),
    publicId: VariantField({ select: publicId, insert: publicId, json: publicId }).pipe(
      Pg.text(),
      Pg.columnName("public_id"),
      Pg.uniqueIndex()
    ),
  };
};

/**
 * Identity columns injected for one entity id: branded serial primary key and
 * entity-type literal.
 *
 * **Details**
 *
 * This declared type is the authoritative shape of the runtime identity
 * closure; declaring it by hand (instead of inferring it) is what preserves
 * the id brand and the `entityType` literal through the generic factory.
 *
 * **Example** (Project identity columns for an entity id)
 *
 * ```ts
 * import type { IdentityColumns } from "@beep/shared-domain/entity/EntityKit"
 * import type { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * type Columns = keyof IdentityColumns<typeof OrganizationId>
 * // => "entityType" | "id"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type IdentityColumns<Id extends EntityId.Any> = {
  readonly entityType: PatchedField<
    PatchedField<M.GeneratedByApp<S.Literal<Id["entityType"]>>, { readonly column: Pg.Text }>,
    { readonly columnName: "entity_type" }
  >;
  readonly id: PatchedField<
    PatchedField<
      VariantSchema.Field<{ readonly select: Id; readonly update: Id; readonly json: Id }>,
      { readonly primaryKey: true }
    >,
    { readonly column: Pg.Serial; readonly hasDefault: true }
  >;
};

/**
 * Identity columns injected by the product tier: {@link IdentityColumns} plus
 * the url-safe public id with its colocated unique index.
 *
 * **Example** (Project product identity columns)
 *
 * ```ts
 * import type { ProductIdentityColumns } from "@beep/shared-domain/entity/EntityKit"
 * import type { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * type Columns = keyof ProductIdentityColumns<typeof OrganizationId>
 * // => "entityType" | "id" | "publicId"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ProductIdentityColumns<Id extends EntityId.Any> = IdentityColumns<Id> & {
  readonly publicId: PatchedField<
    PatchedField<
      PatchedField<
        VariantSchema.Field<{
          readonly select: PublicEntityId.PublicEntityId<Id>;
          readonly insert: PublicEntityId.PublicEntityId<Id>;
          readonly json: PublicEntityId.PublicEntityId<Id>;
        }>,
        { readonly column: Pg.Text }
      >,
      { readonly columnName: "public_id" }
    >,
    { readonly indexed: { readonly name: string | undefined; readonly unique: true } }
  >;
};

type IdentityColumnsOf<Id extends EntityId.Any, WithPublicId extends boolean> = WithPublicId extends true
  ? ProductIdentityColumns<Id>
  : IdentityColumns<Id>;

type MissingSelfGeneric = `Missing \`Self\` generic — use \`class Self extends Entity<Self>()(SelfId)({ ... }) {}\``;

/**
 * Declaration-site factory exposed by every entity tier.
 *
 * **Details**
 *
 * The extra `()` before the entity id is deliberate: TypeScript applies
 * type-parameter defaults instead of inferring when `Self` is passed
 * explicitly, so the id needs its own inference position to keep its brand and
 * `entityType` literal. Table name, identity columns, and the publicId unique
 * index (product tier) all derive from the id's statics; the merge order is
 * kit defaults, then own fields, then identity columns — matching the
 * committed migration baseline.
 *
 * **Example** (Declare a product entity)
 *
 * ```ts
 * import { Entity, pg } from "@beep/shared-domain/entity/ProductEntity"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * class Example extends Entity<Example>()(OrganizationId)({
 *   displayName: S.NonEmptyString.pipe(pg.text()),
 * }) {}
 *
 * console.log(Example.sql.tableName) // "shared_organization"
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export type TierEntityFactory<Defaults extends FieldsInput, WithPublicId extends boolean = false> = <
  Self = never,
>() => <Id extends EntityId.Any>(
  id: Id
) => <const Own extends FieldsInput>(
  ownFields: Own &
    Pg.ValidateCollision<Defaults & IdentityColumnsOf<Id, WithPublicId>, Own> &
    Pg.ValidateMergedFields<Defaults & IdentityColumnsOf<Id, WithPublicId>, Own>,
  annotations?: Annotations.Annotations,
  extras?: Pg.Table.Callback<Defaults & IdentityColumnsOf<Id, WithPublicId> & Own>
) => [Self] extends [never]
  ? MissingSelfGeneric
  : ModelClass<Self, Defaults & IdentityColumnsOf<Id, WithPublicId> & Own>;

type RawEntity = (
  identifier: string
) => (
  fields: FieldsInput,
  annotations?: Annotations.Annotations | Pg.Table.Callback<FieldsInput>,
  extras?: Pg.Table.Callback<FieldsInput>
) => object;

const factoryImpl =
  (kit: Pg.PgKit<FieldsInput>, identityFor: (id: EntityId.Any) => FieldsInput) =>
  () =>
  (id: EntityId.Any) =>
  (own: FieldsInput, annotations?: Annotations.Annotations, extras?: Pg.Table.Callback<FieldsInput>): object => {
    const identity = identityFor(id);
    const collision = A.findFirst(Object.keys(own), (key) => P.hasProperty(identity, key));
    if (O.isSome(collision)) {
      throw ModelInvariantError.make({
        message: `'${collision.value}' is an identity column injected from the entity id — remove it.`,
        fieldName: collision.value,
      });
    }
    // Internal seam: the tier factory's declared types (TierEntityFactory) are
    // authoritative; the kit's public Entity factory is generically typed for
    // literal declaration sites and is deliberately widened here.
    const entity = kit.Entity as unknown as RawEntity;
    return entity(id.tableName)({ ...own, ...identity }, annotations, extras);
  };

/**
 * Builds the typed tier `Entity` factory for a kit without a public id.
 *
 * **Example** (Expose a tier factory)
 *
 * ```ts
 * import { entityFactory } from "@beep/shared-domain/entity/EntityKit"
 * import { kit } from "@beep/shared-domain/entity/BaseEntity"
 *
 * const Entity = entityFactory(kit)
 * console.log(typeof Entity) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const entityFactory = <const Defaults extends FieldsInput>(
  kit: Pg.PgKit<Defaults>
): TierEntityFactory<Defaults> =>
  factoryImpl(kit as Pg.PgKit<FieldsInput>, identityColumns) as TierEntityFactory<Defaults>;

/**
 * Builds the typed tier `Entity` factory for a kit with the product identity
 * (branded id, entity type, and public id).
 *
 * **Example** (Expose the product factory)
 *
 * ```ts
 * import { productEntityFactory } from "@beep/shared-domain/entity/EntityKit"
 * import { kit } from "@beep/shared-domain/entity/OrgEntity"
 *
 * const Entity = productEntityFactory(kit)
 * console.log(typeof Entity) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const productEntityFactory = <const Defaults extends FieldsInput>(
  kit: Pg.PgKit<Defaults>
): TierEntityFactory<Defaults, true> =>
  factoryImpl(kit as Pg.PgKit<FieldsInput>, productIdentityColumns) as TierEntityFactory<Defaults, true>;
