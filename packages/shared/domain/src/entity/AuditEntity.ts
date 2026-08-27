/**
 * Audit entity tier: base identity plus actor provenance and schema lineage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as BaseEntity from "./BaseEntity.ts";
import { entityFactory, withAudit } from "./EntityKit.ts";
import type * as Pg from "@beep/effect-drizzle/pg";

/**
 * The audit tier kit: base columns plus principals, source, and schema version.
 *
 * **Example** (Extend the audit kit with org scoping)
 *
 * ```ts
 * import { kit } from "@beep/shared-domain/entity/AuditEntity"
 * import { withOrg } from "@beep/shared-domain/entity/EntityKit"
 *
 * const orgScoped = kit.extend(withOrg)
 * console.log(typeof orgScoped.Entity) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const kit = BaseEntity.kit.extend(withAudit);

/**
 * Declares an audit-tier entity from its entity id and own fields.
 *
 * **Example** (Declare an audited entity)
 *
 * ```ts
 * import { Entity, pg } from "@beep/shared-domain/entity/AuditEntity"
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
 * PostgreSQL toolkit bound to the audit tier (column combinators plus `Table`).
 *
 * **Example** (Use the audit toolkit)
 *
 * ```ts
 * import { pg } from "@beep/shared-domain/entity/AuditEntity"
 *
 * console.log(typeof pg.jsonb) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const pg: Pg.PgToolkit = kit.pg;

/**
 * Table-extras namespace for multi-column indexes and checks.
 *
 * **Example** (Access audit table extras)
 *
 * ```ts
 * import { Table } from "@beep/shared-domain/entity/AuditEntity"
 *
 * console.log(typeof Table.index) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Table: typeof Pg.Table = kit.Table;
