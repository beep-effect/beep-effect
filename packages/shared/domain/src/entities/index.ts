/**
 * Shared-kernel membership concept namespace.
 *
 * **Example** (Access membership model)
 *
 * ```ts
 * import { Membership } from "@beep/shared-domain/entities"
 *
 * console.log(Membership.Model.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * as Membership from "./Membership/index.ts";
/**
 * Shared-kernel organization concept namespace.
 *
 * **Example** (Access organization model)
 *
 * ```ts
 * import { Organization } from "@beep/shared-domain/entities"
 *
 * console.log(Organization.Model.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * as Organization from "./Organization/index.ts";
/**
 * Shared-kernel user concept namespace.
 *
 * **Example** (Access user model)
 *
 * ```ts
 * import { User } from "@beep/shared-domain/entities"
 *
 * console.log(User.Model.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * as User from "./User/index.ts";
