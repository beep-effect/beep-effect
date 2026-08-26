/**
 * Namespace-first public module for cardinal direction schemas.
 *
 * **Example** (Import and decode schema)
 *
 * ```ts import.meta.vitest name="Import and decode schema"
 * import * as CardinalDirection from "@beep/schema/CardinalDirection"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownOption(CardinalDirection.Schema)
 * console.log(decode)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Public schema module export.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./CardinalDirection.schema.ts";
