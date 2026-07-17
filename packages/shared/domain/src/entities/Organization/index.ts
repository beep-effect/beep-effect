/**
 * Organization pure behavior helpers.
 *
 * @example
 * ```ts
 * import { hasParentOrganization } from "@beep/shared-domain/entities/Organization"
 * import * as O from "effect/Option"
 *
 * console.log(hasParentOrganization({ parentOrgId: O.none() }))
 * ```
 *
 * @since 0.0.0
 * @category predicates
 */
export * from "./Organization.behavior.ts";
/**
 * Organization model schema namespace.
 *
 * @example
 * ```ts
 * import { Model } from "@beep/shared-domain/entities/Organization"
 *
 * console.log(Model.definition.entityId.tableName)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export * from "./Organization.model.ts";
/**
 * Organization value schemas.
 *
 * @example
 * ```ts
 * import { LicenseTier } from "@beep/shared-domain/entities/Organization"
 *
 * console.log(LicenseTier.is.team("team"))
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export * from "./Organization.values.ts";
