/**
 * Shared-kernel entity constructor modules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Product-facing persisted entity base constructor.
 *
 * **Example** (Access createdAt column name)
 *
 * ```ts
 * import { BaseEntity } from "@beep/shared-domain/entity"
 *
 * console.log(BaseEntity.BaseEntity.definition.persisted.createdAt.columnName)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * as BaseEntity from "./BaseEntity.ts";
/**
 * Entity identifier constructor namespace.
 *
 * **Example** (Access EntityIdValue export)
 *
 * ```ts
 * import { EntityId } from "@beep/shared-domain/entity"
 *
 * console.log(EntityId.EntityIdValue)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * as EntityId from "./EntityId.ts";
/**
 * Polymorphic entity reference namespace.
 *
 * **Example** (Access EntityRef export)
 *
 * ```ts
 * import { EntityRef } from "@beep/shared-domain/entity"
 *
 * console.log(EntityRef.EntityRef)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export * as EntityRef from "./EntityRef.ts";
/**
 * Canonical actor principal namespace.
 *
 * **Example** (Access Principal export)
 *
 * ```ts
 * import { Principal } from "@beep/shared-domain/entity"
 *
 * console.log(Principal.Principal)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export * as Principal from "./Principal.ts";
/**
 * URL-safe public entity identifier constructor namespace.
 *
 * **Example** (Access PublicEntityId factory)
 *
 * ```ts
 * import { PublicEntityId } from "@beep/shared-domain/entity"
 *
 * console.log(PublicEntityId.factory)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export * as PublicEntityId from "./PublicEntityId.ts";
/**
 * Shared entity primitives namespace.
 *
 * **Example** (Access VectorClock primitive)
 *
 * ```ts
 * import { primitives } from "@beep/shared-domain/entity"
 *
 * console.log(primitives.VectorClock)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * as primitives from "./primitives.ts";
/**
 * Canonical source-kind namespace.
 *
 * **Example** (Access SourceKind export)
 *
 * ```ts
 * import { SourceKind } from "@beep/shared-domain/entity"
 *
 * console.log(SourceKind.SourceKind)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * as SourceKind from "./SourceKind.ts";
