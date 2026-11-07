/**
 * GitHub command group facade.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * GitHub command registration.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export { githubCommand } from "./Github.command.ts";
/**
 * Typed GitHub command failures.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Github.errors.ts";
/**
 * GitHub App manifest, conversion, and outcome schemas.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Github.schemas.ts";
/**
 * GitHub App registration service and layers.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Github.service.ts";
