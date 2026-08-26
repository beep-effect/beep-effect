/**
 * Namespace-first public module for HTTP protocol schemas.
 *
 * **Example** (Decode HTTP protocol schema)
 *
 * ```ts
 * import * as HttpProtocol from "@beep/schema/HttpProtocol"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownOption(HttpProtocol.Schema)
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
export * from "./HttpProtocol.schema.ts";
