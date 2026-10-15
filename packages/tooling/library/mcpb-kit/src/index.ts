/**
 * Package Bun-compiled MCP servers with DuckDB native bindings as Claude
 * Desktop `.mcpb` bundles.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Process boundary for bundled executables.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./McpbKit.entrypoint.ts";
/**
 * Typed failures produced while packaging.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./McpbKit.errors.ts";
/**
 * Targets and the per-app packaging spec.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./McpbKit.models.ts";
/**
 * The packaging command and per-target settings.
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./McpbKit.package.ts";
