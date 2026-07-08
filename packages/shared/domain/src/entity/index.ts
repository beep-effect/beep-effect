/**
 * Shared-kernel entity constructor modules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Product-facing persisted entity base constructor.
 *
 * @example
 * ```ts
 * import { BaseEntity } from "@beep/shared-domain/entity"
 *
 * console.log(BaseEntity.BaseEntity.definition.persisted.createdAt.columnName)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export * as BaseEntity from "./BaseEntity.ts";
/**
 * Entity identifier constructor namespace.
 *
 * @example
 * ```ts
 * import { EntityId } from "@beep/shared-domain/entity"
 *
 * console.log(EntityId.EntityIdValue)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export * as EntityId from "./EntityId.ts";
/**
 * Polymorphic entity reference namespace.
 *
 * @example
 * ```ts
 * import { EntityRef } from "@beep/shared-domain/entity"
 *
 * console.log(EntityRef.EntityRef)
 * ```
 *
 * @since 0.0.0
 * @category identifiers
 */
export * as EntityRef from "./EntityRef.ts";
/**
 * Canonical actor principal namespace.
 *
 * @example
 * ```ts
 * import { Principal } from "@beep/shared-domain/entity"
 *
 * console.log(Principal.Principal)
 * ```
 *
 * @since 0.0.0
 * @category identifiers
 */
export * as Principal from "./Principal.ts";
/**
 * URL-safe public entity identifier constructor namespace.
 *
 * @example
 * ```ts
 * import { PublicEntityId } from "@beep/shared-domain/entity"
 *
 * console.log(PublicEntityId.factory)
 * ```
 *
 * @since 0.0.0
 * @category identifiers
 */
export * as PublicEntityId from "./PublicEntityId.ts";
/**
 * Shared entity primitives namespace.
 *
 * @example
 * ```ts
 * import { primitives } from "@beep/shared-domain/entity"
 *
 * console.log(primitives.VectorClock)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export * as primitives from "./primitives.ts";
/**
 * Canonical source-kind namespace.
 *
 * @example
 * ```ts
 * import { SourceKind } from "@beep/shared-domain/entity"
 *
 * console.log(SourceKind.SourceKind)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export * as SourceKind from "./SourceKind.ts";
