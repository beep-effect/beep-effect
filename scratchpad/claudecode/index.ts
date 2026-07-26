/**
 * Effect-first library for writing Claude Code hooks, plugins, skills,
 * subagents, and settings in a maximally Effect-native way.
 *
 * @category tools
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * Project-scoped cached Claude Code resources.
 *
 * @category services
 * @since 0.0.0
 */
export * as ClaudeProject from "./ClaudeProject.ts";

/**
 * Managed runtime constructors and platform layers.
 *
 * @category constructors
 * @since 0.0.0
 */
export * as ClaudeRuntime from "./ClaudeRuntime.ts";

// ---------------------------------------------------------------------------
// Shared runtime
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Hook runner + event schemas + context service
// ---------------------------------------------------------------------------

/**
 * Hook event schemas, constructors, dispatch, and execution.
 *
 * @category hooks
 * @since 0.0.0
 */
export * as Hook from "./Hook.ts";

// ---------------------------------------------------------------------------
// Settings.json schemas + loader
// ---------------------------------------------------------------------------

/**
 * Claude Code settings schemas and layered loaders.
 *
 * @category configuration
 * @since 0.0.0
 */
export * as Settings from "./Settings.ts";

// ---------------------------------------------------------------------------
// Plugin manifest schemas + Plugin.define / Plugin.write
// ---------------------------------------------------------------------------

/**
 * Claude Code plugin schemas, builders, validation, and persistence.
 *
 * @category tools
 * @since 0.0.0
 */
export * as Plugin from "./Plugin.ts";

// ---------------------------------------------------------------------------
// Frontmatter parsers + per-file-type schemas
// ---------------------------------------------------------------------------

/**
 * Frontmatter schemas, parsers, and renderers for plugin components.
 *
 * @category parsing
 * @since 0.0.0
 */
export * as Frontmatter from "./Frontmatter.ts";

// ---------------------------------------------------------------------------
// MCP server schemas + .mcp.json loader
// ---------------------------------------------------------------------------

/**
 * Model Context Protocol configuration schemas and loaders.
 *
 * @category protocols
 * @since 0.0.0
 */
export * as Mcp from "./Mcp.ts";

// ---------------------------------------------------------------------------
// Cross-module tagged errors
// ---------------------------------------------------------------------------

/**
 * Typed failures shared across harness subsystems.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Errors.ts";

// ---------------------------------------------------------------------------
// Testing helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic hook, stdio, filesystem, and plugin test harnesses.
 *
 * @category testing
 * @since 0.0.0
 */
export * as Testing from "./Testing.ts";
