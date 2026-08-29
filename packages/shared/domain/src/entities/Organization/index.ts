/**
 * Organization pure behavior helpers.
 *
 * **Example** (Check absent parent organization)
 *
 * ```ts
 * import { hasParentOrganization } from "@beep/shared-domain/entities/Organization"
 * import * as O from "effect/Option"
 *
 * console.log(hasParentOrganization({ parentOrgId: O.none() }))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export * from "./Organization.behavior.ts";
/**
 * Organization model schema namespace.
 *
 * **Example** (Read model table name)
 *
 * ```ts
 * import { Model } from "@beep/shared-domain/entities/Organization"
 *
 * console.log(Model.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Organization.model.ts";
/**
 * Organization value schemas.
 *
 * **Example** (Check team license tier)
 *
 * ```ts
 * import { LicenseTier } from "@beep/shared-domain/entities/Organization"
 *
 * console.log(LicenseTier.is.team("team"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Organization.values.ts";
