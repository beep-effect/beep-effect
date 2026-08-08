/**
 * Namespace-first public module for Content Security Policy schemas.
 *
 * **Example** (Create CSP directive value)
 *
 * ```ts
 * import * as Csp from "@beep/schema/Csp"
 *
 * const value = Csp.createDirectiveValue("default-src", "'self'")
 *
 * console.log(value) // "default-src 'self'"
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
export * from "./Csp.schema.ts";
