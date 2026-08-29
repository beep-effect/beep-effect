/**
 * Namespace-first public module for Content Security Policy schemas.
 *
 * **Example** (Create CSP directive value)
 *
 * ```ts import.meta.vitest name="Create CSP directive value"
 * import * as Csp from "@beep/schema/Csp"
 *
 * const value = Csp.createDirectiveValue("default-src", "'self'")
 *
 * value // => "default-src 'self'"
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
