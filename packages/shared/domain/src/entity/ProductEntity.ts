/**
 * Product entity modeling kit backed by `@beep/effect-drizzle`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { VariantField } from "@beep/effect-drizzle";
import * as Pg from "@beep/effect-drizzle/pg";
import { PosInt } from "@beep/schema/Int";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import * as S from "effect/Schema";
import { Model } from "effect/unstable/schema";
import * as Shared from "../identity/Shared/index.ts";
import { Principal } from "./Principal.ts";
import * as PublicEntityId from "./PublicEntityId.ts";
import { SourceKind } from "./SourceKind.ts";
import type * as EntityId from "./EntityId.ts";

/**
 * SQL-colocated audit fields shared by every persisted product entity.
 *
 * **Details**
 *
 * Explicit upstream variant fields preserve the legacy constructor authority:
 * audit and context values stay out of JSON writes, created timestamps default
 * only on insert, updated timestamps default on insert and update, and row
 * versions remain absent from insert payloads.
 *
 * **Example** (Inspect shared row-version variants)
 *
 * ```ts
 * import { fields } from "@beep/shared-domain/entity/ProductEntity"
 *
 * console.log(Object.keys(fields.rowVersion.schema.schemas))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const fields = {
  createdAt: Model.DateTimeInsertFromNumber.pipe(Pg.bigint("number")),
  createdByPrincipal: Model.GeneratedByApp(Principal).pipe(Pg.jsonb()),
  orgId: Model.GeneratedByApp(Shared.OrganizationId).pipe(Pg.integer()),
  rowVersion: VariantField({
    select: PosInt,
    update: PosInt,
    json: PosInt,
  }).pipe(Pg.integer()),
  schemaVersion: Model.GeneratedByApp(SemanticVersion).pipe(Pg.text()),
  source: Model.GeneratedByApp(SourceKind).pipe(Pg.text()),
  updatedAt: Model.DateTimeUpdateFromNumber.pipe(Pg.bigint("number")),
  updatedByPrincipal: Model.GeneratedByApp(Principal).pipe(Pg.jsonb()),
};

const identityFields = <const Entity extends EntityId.Any>(entityId: Entity) => {
  const publicId = PublicEntityId.factory(entityId);
  return {
    entityType: Model.GeneratedByApp(S.Literal(entityId.entityType)).pipe(Pg.text(), Pg.columnName("entity_type")),
    id: VariantField({
      select: entityId,
      update: entityId,
      json: entityId,
    }).pipe(Pg.primaryKey(), Pg.serial()),
    publicId: VariantField({
      select: publicId,
      insert: publicId,
      json: publicId,
    }).pipe(Pg.text(), Pg.columnName("public_id")),
  };
};

type IdentityFields<Entity extends EntityId.Any> = ReturnType<typeof identityFields<Entity>>;

/**
 * Public result of composing product semantics with a consolidated entity id.
 *
 * @category models
 * @since 0.0.0
 */
export interface ProductEntityKit<Entity extends EntityId.Any> extends Pg.PgKit<typeof fields> {
  readonly entityExtras: <F extends typeof fields & IdentityFields<Entity>>(
    columns: Pg.Table.BoundColumns<F>
  ) => ReadonlyArray<Pg.Table.Node>;
  readonly entityId: Entity;
  readonly generatePublicId: ReturnType<typeof PublicEntityId.generate<Entity>>;
  readonly identityFields: IdentityFields<Entity>;
  readonly publicId: PublicEntityId.PublicEntityId<Entity>;
  readonly tableName: Entity["tableName"];
}

/**
 * Creates the thin product-entity kit for one consolidated entity identity.
 *
 * **Details**
 *
 * The returned value is the PostgreSQL effect-drizzle kit plus the three
 * entity-specific fields, exact legacy table name, shared index callback, and
 * public-id generator. Entity-local fields remain the model's responsibility
 * and must precede the spread `identityFields` to retain baseline column order.
 *
 * **Gotchas**
 *
 * Use `toPgTable`, not schema assembly, during the parity migration. EntityId
 * reference metadata must not introduce foreign keys that are absent from the
 * committed baseline.
 *
 * **Example** (Define a product entity)
 *
 * ```ts
 * import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity"
 * import { WorkerId } from "@beep/shared-domain/identity/ArchitectureLab"
 * import * as S from "effect/Schema"
 *
 * const WorkerEntity = ProductEntity.make(WorkerId)
 * class ExampleWorker extends WorkerEntity.Entity<ExampleWorker>(WorkerEntity.tableName)(
 *   {
 *     displayName: S.NonEmptyString,
 *     ...WorkerEntity.identityFields
 *   },
 *   undefined,
 *   WorkerEntity.entityExtras
 * ) {}
 *
 * console.log(ExampleWorker.sql.tableName)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const make = <const Entity extends EntityId.Any>(entityId: Entity): ProductEntityKit<Entity> => {
  const productIdentityFields = identityFields(entityId);
  const sqlTableName: string = entityId.tableName;
  const orgIndexName: string = `${sqlTableName}_org_id_btree_idx`;
  const sourceIndexName: string = `${sqlTableName}_source_btree_idx`;
  const publicIdIndexName: string = `${sqlTableName}_public_id_unique_idx`;
  const kit = Pg.make({
    dialect: "pg",
    defaultColumns: () => fields,
    defaultExtras: (columns) => [
      Pg.Table.index(orgIndexName, [columns.orgId]),
      Pg.Table.index(sourceIndexName, [columns.source]),
    ],
  });
  const entityExtras = <F extends typeof fields & typeof productIdentityFields>(columns: Pg.Table.BoundColumns<F>) => [
    Pg.Table.uniqueIndex(publicIdIndexName, [columns.publicId]),
  ];

  return {
    ...kit,
    entityExtras,
    entityId,
    generatePublicId: PublicEntityId.generate(entityId),
    identityFields: productIdentityFields,
    publicId: PublicEntityId.factory(entityId),
    tableName: entityId.tableName,
  };
};
