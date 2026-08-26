/**
 * Org entity tier: audited identity plus tenant organization scoping.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as AuditEntity from "./AuditEntity.ts";
import { entityFactory, withOrg } from "./EntityKit.ts";
import type * as Pg from "@beep/effect-drizzle/pg";

/**
 * The org tier kit: audit columns plus the indexed tenant `orgId`.
 *
 * **Example** (Reach the shared toolkit from the org kit)
 *
 * ```ts
 * import { kit } from "@beep/shared-domain/entity/OrgEntity"
 *
 * console.log(typeof kit.pg.integer) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const kit = AuditEntity.kit.extend(withOrg);

/**
 * Declares an org-tier entity from its entity id and own fields.
 *
 * **Example** (Declare an org-scoped entity)
 *
 * ```ts
 * import { Entity, pg } from "@beep/shared-domain/entity/OrgEntity"
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
 * PostgreSQL toolkit bound to the org tier (column combinators plus `Table`).
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
