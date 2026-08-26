/**
 * Namespace-first public module for reusable Duration schemas.
 *
 * **When to use**
 *
 * Use as the namespace-first entry point for duration schemas and aliases.
 *
 * **Example** (Decode from the Duration namespace)
 *
 * ```ts
 * import * as Duration from "@beep/schema/Duration"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(Duration.FromInput)
 * console.log(decode("5 minutes"))
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * @since 0.0.0
 * @category schemas
 */
export * from "./Duration.input.ts";
/**
 * @since 0.0.0
 * @category schemas
 */
export * from "./Duration.schema.ts";
/**
 * @since 0.0.0
 * @category schemas
 */
export * from "./Duration.transforms.ts";
