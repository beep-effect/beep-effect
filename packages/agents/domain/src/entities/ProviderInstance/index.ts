/**
 * ProviderInstance entity subpath exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * ProviderInstance login-guidance behavior exports.
 *
 * **Example** (Decode snapshot and guide login)
 *
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
export * from "./ProviderInstance.behavior.ts";
/**
 * ProviderInstance entity schema exports.
 *
 * **Example** (Log ProviderInstance entity type)
 *
 * ```ts
 * import { ProviderInstance } from "@beep/agents-domain/entities/ProviderInstance"
 *
 * console.log(ProviderInstance.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export * from "./ProviderInstance.model.ts";
/**
 * ProviderInstance value-schema exports.
 *
 * **Example** (Check ProviderKind is claude)
 *
 * ```ts
 * import { ProviderKind } from "@beep/agents-domain/entities/ProviderInstance"
 *
 * console.log(ProviderKind.is.claude("claude"))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ProviderInstance.values.ts";
