/**
 * `@beep/api-transport` — shared hand-authored HTTP transport transformer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Reason-free egress denial vocabulary shared by governed transport
 * boundaries and their consumers.
 *
 * @since 0.0.0
 * @category errors
 */
export * from "./EgressDenied.ts";
/**
 * The shared transport transformer (auth, rate-limit, retry) and its models.
 *
 * @since 0.0.0
 * @category ports
 */
export * from "./Transport.ts";
export { VERSION } from "./Version.ts";
