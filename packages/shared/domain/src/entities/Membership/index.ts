/**
 * Shared-kernel Membership entity namespace.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Membership model schema namespace.
 *
 * **Example** (Access model table name)
 *
 * ```ts
 * import { Model } from "@beep/shared-domain/entities/Membership"
 *
 * console.log(Model.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Membership.model.ts";
/**
 * Membership value schemas.
 *
 * **Example** (Check member role value)
 *
 * ```ts
 * import { Role } from "@beep/shared-domain/entities/Membership"
 *
 * console.log(Role.is.member("member"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Membership.values.ts";
