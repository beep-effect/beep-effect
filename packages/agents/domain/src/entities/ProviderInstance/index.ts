/**
 * ProviderInstance entity subpath exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * ProviderInstance login-guidance behavior exports.
 *
 * @example
 * ```ts
 * import { loginGuidance, UnauthenticatedSnapshot } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const snapshot = S.decodeUnknownSync(UnauthenticatedSnapshot)({
 *   status: "unauthenticated",
 *   probedAt: "2026-07-11T00:00:00.000Z",
 * })
 * console.log(loginGuidance("codex", snapshot))
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export * from "./ProviderInstance.behavior.js";
/**
 * ProviderInstance entity schema exports.
 *
 * @example
 * ```ts
 * import { ProviderInstance } from "@beep/agents-domain/entities/ProviderInstance"
 *
 * console.log(ProviderInstance.definition.entityId.entityType)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./ProviderInstance.model.js";
/**
 * ProviderInstance value-schema exports.
 *
 * @example
 * ```ts
 * import { ProviderKind } from "@beep/agents-domain/entities/ProviderInstance"
 *
 * console.log(ProviderKind.is.claude("claude"))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ProviderInstance.values.js";
