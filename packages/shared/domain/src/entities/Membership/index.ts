/**
 * Shared-kernel Membership entity namespace.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Membership model schema namespace.
 *
 * @example
 * ```ts
 * import { Model } from "@beep/shared-domain/entities/Membership"
 *
 * console.log(Model.definition.entityId.tableName)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export * from "./Membership.model.ts";
/**
 * Membership value schemas.
 *
 * @example
 * ```ts
 * import { Role } from "@beep/shared-domain/entities/Membership"
 *
 * console.log(Role.is.member("member"))
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export * from "./Membership.values.ts";
