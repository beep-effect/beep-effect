/**
 * Base entity tier: branded identity plus timestamps and optimistic version.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as EffectDrizzle from "@beep/effect-drizzle";
import { baseColumns, entityFactory } from "./EntityKit.ts";
import type * as Pg from "@beep/effect-drizzle/pg";

/**
 * The base tier kit: timestamps and row version, no audit or org columns.
 *
 * **Example** (Extend the base kit with a capability)
 *
 * ```ts
 * import { kit } from "@beep/shared-domain/entity/BaseEntity"
 * import { withAudit } from "@beep/shared-domain/entity/EntityKit"
 *
 * const audited = kit.extend(withAudit)
 * console.log(typeof audited.Entity) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const kit = EffectDrizzle.make("pg", () => ({ defaultColumns: baseColumns }));

/**
 * Declares a base-tier entity from its entity id and own fields.
 *
 * **Example** (Declare a base entity)
 *
 * ```ts
 * import { Entity, pg } from "@beep/shared-domain/entity/BaseEntity"
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
export const Entity = entityFactory(kit);

/**
 * PostgreSQL toolkit bound to the base tier (column combinators plus `Table`).
 *
 * @category constructors
 * @since 0.0.0
 */
export const pg: Pg.PgToolkit = kit.pg;

/**
 * Table-extras namespace for multi-column indexes and checks.
 *
 * @category constructors
 * @since 0.0.0
 */
export const Table: typeof Pg.Table = kit.Table;
