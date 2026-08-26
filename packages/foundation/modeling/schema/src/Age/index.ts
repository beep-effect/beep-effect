/**
 * Namespace-first public module for age schemas.
 *
 * **Example** (Decoding with Age.Schema)
 *
 * ```ts import.meta.vitest name="Decoding with Age.Schema"
 * import * as Age from "@beep/schema/Age"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownOption(Age.Schema)
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
export * from "./Age.schema.ts";
