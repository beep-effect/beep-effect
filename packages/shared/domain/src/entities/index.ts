/**
 * Shared-kernel membership concept namespace.
 *
 * @example
 * ```ts
 * import { Membership } from "@beep/shared-domain/entities"
 *
 * console.log(Membership.Model.definition.tableName)
 * ```
 *
 * @since 0.0.0
 * @category entities
 */
export * as Membership from "./Membership/index.ts";
/**
 * Shared-kernel organization concept namespace.
 *
 * @example
 * ```ts
 * import { Organization } from "@beep/shared-domain/entities"
 *
 * console.log(Organization.Model.definition.tableName)
 * ```
 *
 * @since 0.0.0
 * @category entities
 */
export * as Organization from "./Organization/index.ts";
/**
 * Shared-kernel user concept namespace.
 *
 * @example
 * ```ts
 * import { User } from "@beep/shared-domain/entities"
 *
 * console.log(User.Model.definition.tableName)
 * ```
 *
 * @since 0.0.0
 * @category entities
 */
export * as User from "./User/index.ts";
