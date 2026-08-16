/**
 * Shared-kernel User entity namespace.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * User model schema namespace.
 *
 * **Example** (Read model table name)
 *
 * ```ts
 * import { Model } from "@beep/shared-domain/entities/User"
 *
 * console.log(Model.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./User.model.ts";
