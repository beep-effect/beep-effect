/**
 * Namespace-first public module for nominal safe-object schemas.
 *
 * **Example** (Import SafeObject namespace)
 *
 * ```ts
 * import * as SafeObject from "@beep/schema/SafeObject"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const value = await Effect.runPromise(
 *   S.decodeUnknownEffect(SafeObject.Schema)({ enabled: true })
 * )
 * console.log(value.enabled) // true
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Public safe-object schema exports.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./SafeObject.schema.ts";
