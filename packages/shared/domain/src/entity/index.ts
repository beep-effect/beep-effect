/**
 * Shared-kernel entity constructor modules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Audit entity tier namespace.
 *
 * **Example** (Access the audit tier factory)
 *
 * ```ts
 * import { AuditEntity } from "@beep/shared-domain/entity"
 *
 * console.log(typeof AuditEntity.Entity)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export * as AuditEntity from "./AuditEntity.ts";
/**
 * Base entity tier namespace.
 *
 * **Example** (Access the base tier factory)
 *
 * ```ts
 * import { BaseEntity } from "@beep/shared-domain/entity"
 *
 * console.log(typeof BaseEntity.Entity)
 * ```
 *
 * @category factories
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
 * Entity tier machinery and capability mixins.
 *
 * **Example** (Access the audit mixin)
 *
 * ```ts
 * import { EntityKit } from "@beep/shared-domain/entity"
 *
 * console.log(typeof EntityKit.withAudit)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * as EntityKit from "./EntityKit.ts";
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
 * Org entity tier namespace.
 *
 * **Example** (Access the org tier factory)
 *
 * ```ts
 * import { OrgEntity } from "@beep/shared-domain/entity"
 *
 * console.log(typeof OrgEntity.Entity)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export * as OrgEntity from "./OrgEntity.ts";
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
 * Product entity tier namespace.
 *
 * @category factories
 * @since 0.0.0
 */
export * as ProductEntity from "./ProductEntity.ts";
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
