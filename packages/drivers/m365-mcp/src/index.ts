/**
 * Microsoft 365 Model Context Protocol stdio server.
 *
 * @remarks
 * This package exposes read-only Microsoft 365 driver verbs as schema-first MCP
 * tools. It intentionally delegates Graph auth, transport, decoding, and
 * redaction to `@beep/m365`.
 *
 * @example
 * ```ts
 * import { makeServerLayer, M365McpServerConfig } from "@beep/m365-mcp"
 * import { M365 } from "@beep/m365"
 * import { NodeRuntime, NodeStdio } from "@effect/platform-node"
 * import { Layer } from "effect"
 *
 * Layer.launch(
 *   makeServerLayer(
 *     M365McpServerConfig.make({ name: "beep-m365", version: "0.1.0" }),
 *   ).pipe(Layer.provide(NodeStdio.layer), Layer.provide(M365.layer)),
 * ).pipe(NodeRuntime.runMain)
 * ```
 *
 * @packageDocumentation
 * @since 0.1.0
 */
/**
 * Microsoft 365 MCP tool handlers.
 *
 * @category handlers
 * @since 0.1.0
 */
export * from "./M365Handlers.ts";
/**
 * Schema-first Microsoft 365 MCP tool declarations.
 *
 * @category tools
 * @since 0.1.0
 */
export * from "./M365Tools.ts";
/**
 * Microsoft 365 MCP server configuration and layer constructors.
 *
 * @category layers
 * @since 0.1.0
 */
export * from "./Server.ts";

/**
 * Package version.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/m365-mcp"
 *
 * console.log(VERSION)
 * // "0.1.0"
 * ```
 *
 * @category constants
 * @since 0.1.0
 */
export const VERSION = "0.1.0";
