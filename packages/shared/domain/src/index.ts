/**
 * Shared domain role package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Product-facing persisted entity base constructor.
 *
 * **Example** (Inspect createdAt column name)
 *
 * ```ts
 * import { BaseEntity } from "@beep/shared-domain"
 *
 * console.log(BaseEntity.BaseEntity.definition.persisted.createdAt.columnName)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * as BaseEntity from "./entity/BaseEntity.ts";
/**
 * Entity identifier constructor namespace.
 *
 * **Example** (Log EntityIdValue export)
 *
 * ```ts
 * import { EntityId } from "@beep/shared-domain"
 *
 * console.log(EntityId.EntityIdValue)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * as EntityId from "./entity/EntityId.ts";
/**
 * Polymorphic entity reference namespace.
 *
 * **Example** (Log EntityRef schema)
 *
 * ```ts
 * import { EntityRef } from "@beep/shared-domain"
 *
 * console.log(EntityRef.EntityRef)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export * as EntityRef from "./entity/EntityRef.ts";
/**
 * Canonical actor principal namespace.
 *
 * **Example** (Log Principal schema)
 *
 * ```ts
 * import { Principal } from "@beep/shared-domain"
 *
 * console.log(Principal.Principal)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export * as Principal from "./entity/Principal.ts";
/**
 * URL-safe public entity identifier constructor namespace.
 *
 * **Example** (Log PublicEntityId factory)
 *
 * ```ts
 * import { PublicEntityId } from "@beep/shared-domain"
 *
 * console.log(PublicEntityId.factory)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export * as PublicEntityId from "./entity/PublicEntityId.ts";
/**
 * Canonical source-kind namespace.
 *
 * **Example** (Log SourceKind schema)
 *
 * ```ts
 * import { SourceKind } from "@beep/shared-domain"
 *
 * console.log(SourceKind.SourceKind)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * as SourceKind from "./entity/SourceKind.ts";
/**
 * Entity-id registry namespace.
 *
 * **Example** (Log organization id resource)
 *
 * ```ts
 * import { Identity } from "@beep/shared-domain"
 *
 * console.log(Identity.Shared.OrganizationId.resource)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export * as Identity from "./identity/index.ts";
/**
 * Shared-kernel value objects.
 *
 * **Example** (Import shared values namespace)
 *
 * ```ts
 * import { Values } from "@beep/shared-domain"
 *
 * console.log(Values.ClaimLifecycle)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * as Values from "./values/index.ts";
