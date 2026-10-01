/**
 * XState v6 and `@xstate/effect` driver: Stately inspector wiring and machine
 * serialization. Model-based testing bridges live under `@beep/xstate/test`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Machine JSON export for Stately Studio and the Stately MCP server.
 *
 * @category serialization
 * @since 0.0.0
 */
export * from "./MachineExport.ts";
/**
 * Stately inspector configuration read from the environment.
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./StatelyInspector.config.ts";
/**
 * Stately inspector service, layers and actor attachment.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./StatelyInspector.service.ts";
/**
 * Typed failures of the xstate driver.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Xstate.errors.ts";
