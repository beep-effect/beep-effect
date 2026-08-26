/**
 * Namespace-first public module for HTTP method schemas.
 *
 * **Example** (Decode HTTP method schema)
 *
 * ```ts import.meta.vitest name="Decode HTTP method schema"
 * import * as HttpMethod from "@beep/schema/HttpMethod"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownOption(HttpMethod.Schema)
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
export * from "./HttpMethod.schema.ts";
