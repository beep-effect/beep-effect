/**
 * Namespace-first public module for HTTP status schemas.
 *
 * **Example** (Decode HTTP status schema)
 *
 * ```ts import.meta.vitest name="Decode HTTP status schema"
 * import * as HttpStatus from "@beep/schema/HttpStatus"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownOption(HttpStatus.Schema)
 * console.log(decode)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * @category validation
 * @since 0.0.0
 */
export * from "./HttpStatus.category.ts";
/**
 * @category validation
 * @since 0.0.0
 */
export * from "./HttpStatus.client-error.core.ts";
/**
 * @category validation
 * @since 0.0.0
 */
export * from "./HttpStatus.client-error.extended.ts";
/**
 * @category validation
 * @since 0.0.0
 */
export * from "./HttpStatus.client-error.resource.ts";
/**
 * @category validation
 * @since 0.0.0
 */
export * from "./HttpStatus.client-error.ts";
/**
 * @category validation
 * @since 0.0.0
 */
export * from "./HttpStatus.informational.ts";
/**
 * @category validation
 * @since 0.0.0
 */
export * from "./HttpStatus.redirection.ts";
/**
 * @category validation
 * @since 0.0.0
 */
export * from "./HttpStatus.schema.ts";
/**
 * @category validation
 * @since 0.0.0
 */
export * from "./HttpStatus.server-error.aggregate.ts";
/**
 * @category validation
 * @since 0.0.0
 */
export * from "./HttpStatus.server-error.ts";
/**
 * @category validation
 * @since 0.0.0
 */
export * from "./HttpStatus.success.ts";
/**
 * @category validation
 * @since 0.0.0
 */
export * from "./HttpStatus.unofficial.aggregate.ts";
/**
 * @category validation
 * @since 0.0.0
 */
export * from "./HttpStatus.unofficial.ts";
