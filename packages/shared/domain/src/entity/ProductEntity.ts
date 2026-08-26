/**
 * Product entity tier backed by `@beep/effect-drizzle`.
 *
 * The full persisted-product contract: base timestamps and row version, audit
 * provenance, tenant org scoping, and the id-derived identity columns
 * (branded serial id, entity-type literal, and url-safe public id with its
 * unique index).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as EntityKit from "./EntityKit.ts";
import * as OrgEntity from "./OrgEntity.ts";

/**
 * The product tier kit. Shares the org tier's default columns; the product
 * identity (including `publicId`) arrives per entity through {@link Entity}.
 *
 * **Example** (Reach the shared toolkit from the product kit)
 *
 * ```ts
 * import { kit } from "@beep/shared-domain/entity/ProductEntity"
 *
 * console.log(typeof kit.pg.jsonb) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const kit = OrgEntity.kit;

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
  ...EntityKit.baseColumns,
  ...EntityKit.auditColumns,
  ...EntityKit.orgColumns,
};

/**
 * Declares a persisted product entity from its entity id and own fields.
 *
 * **Details**
 *
 * The entity id's statics drive everything the old per-entity kit required by
 * hand: the SQL table name, the branded serial primary key, the entity-type
 * literal column, and the public id with its
 * `{table}_public_id_unique_idx` unique index. Audit and org defaults (with
 * their `{table}_org_id_btree_idx` and `{table}_source_btree_idx` indexes)
 * arrive from the tier kit. The physical column order is kit defaults, then
 * own fields, then identity columns — matching the committed migration
 * baseline.
 *
 * **Example** (Define a product entity)
 *
 * ```ts
 * import { Entity, pg } from "@beep/shared-domain/entity/ProductEntity"
 * import { WorkerId } from "@beep/shared-domain/identity/ArchitectureLab"
 * import * as S from "effect/Schema"
 *
 * class ExampleWorker extends Entity<ExampleWorker>()(WorkerId)({
 *   displayName: S.NonEmptyString.pipe(pg.text()),
 * }) {}
 *
 * console.log(ExampleWorker.sql.tableName)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const Entity = EntityKit.productEntityFactory(kit);

/**
 * PostgreSQL toolkit bound to the product tier (column combinators plus
 * `Table`).
 *
 * @category constructors
 * @since 0.0.0
 */
export const pg = kit.pg;

/**
 * Table-extras namespace for multi-column indexes and checks.
 *
 * @category constructors
 * @since 0.0.0
 */
export const Table = kit.Table;
