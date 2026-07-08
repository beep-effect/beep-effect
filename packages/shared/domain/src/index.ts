/**
 * Shared domain role package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Shared domain package version.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/shared-domain"
 *
 * const packageVersion = VERSION
 *
 * console.log(packageVersion === "0.0.0") // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Shared-kernel aggregate concepts.
 *
 * @example
 * ```ts
 * import { Aggregates } from "@beep/shared-domain"
 *
 * console.log(Aggregates)
 * ```
 *
 * @since 0.0.0
 * @category aggregates
 */
export * as Aggregates from "./aggregates/index.ts";
/**
 * Shared-kernel entity concepts.
 *
 * @example
 * ```ts
 * import { Entities } from "@beep/shared-domain"
 *
 * console.log(Entities.Organization.Model.definition.tableName)
 * ```
 *
 * @since 0.0.0
 * @category entities
 */
export * as Entities from "./entities/index.ts";
/**
 * Product-facing persisted entity base constructor.
 *
 * @example
 * ```ts
 * import { BaseEntity } from "@beep/shared-domain"
 *
 * console.log(BaseEntity.BaseEntity.definition.persisted.createdAt.columnName)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export * as BaseEntity from "./entity/BaseEntity.ts";
/**
 * Entity identifier constructor namespace.
 *
 * @example
 * ```ts
 * import { EntityId } from "@beep/shared-domain"
 *
 * console.log(EntityId.EntityIdValue)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export * as EntityId from "./entity/EntityId.ts";
/**
 * Polymorphic entity reference namespace.
 *
 * @example
 * ```ts
 * import { EntityRef } from "@beep/shared-domain"
 *
 * console.log(EntityRef.EntityRef)
 * ```
 *
 * @since 0.0.0
 * @category identifiers
 */
export * as EntityRef from "./entity/EntityRef.ts";
/**
 * Canonical actor principal namespace.
 *
 * @example
 * ```ts
 * import { Principal } from "@beep/shared-domain"
 *
 * console.log(Principal.Principal)
 * ```
 *
 * @since 0.0.0
 * @category identifiers
 */
export * as Principal from "./entity/Principal.ts";
/**
 * URL-safe public entity identifier constructor namespace.
 *
 * @example
 * ```ts
 * import { PublicEntityId } from "@beep/shared-domain"
 *
 * console.log(PublicEntityId.factory)
 * ```
 *
 * @since 0.0.0
 * @category identifiers
 */
export * as PublicEntityId from "./entity/PublicEntityId.ts";
/**
 * Canonical source-kind namespace.
 *
 * @example
 * ```ts
 * import { SourceKind } from "@beep/shared-domain"
 *
 * console.log(SourceKind.SourceKind)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export * as SourceKind from "./entity/SourceKind.ts";
/**
 * Entity-id registry namespace.
 *
 * @example
 * ```ts
 * import { Identity } from "@beep/shared-domain"
 *
 * console.log(Identity.Shared.OrganizationId.resource)
 * ```
 *
 * @since 0.0.0
 * @category entity-ids
 */
export * as Identity from "./identity/index.ts";
/**
 * Shared-kernel value objects.
 *
 * @example
 * ```ts
 * import { Values } from "@beep/shared-domain"
 *
 * console.log(Values.LocalDate.today().toISOString())
 * ```
 *
 * @since 0.0.0
 * @category value-objects
 */
export * as Values from "./values/index.ts";
