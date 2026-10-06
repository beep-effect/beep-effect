/**
 * Microsoft 365 Model Context Protocol stdio server.
 *
 * **Details**
 *
 * This package exposes read-only Microsoft 365 driver verbs as schema-first MCP
 * tools. It intentionally delegates Graph auth, transport, decoding, and
 * redaction to `@beep/m365`.
 *
 * A second server, the outbox (`bin-outbox.ts`), prepares and sends mail and
 * writes calendar events for one configured mailbox. Its tools, send guard,
 * attachment source and audit log are the `Outbox*` modules; the read-only
 * toolkit gains no write tool.
 *
 * **Example** (Launch M365 MCP server)
 *
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
 * Local attachment source of the outbox server.
 *
 * @category services
 * @since 0.1.0
 */
export * from "./OutboxAttachmentSource.ts";
/**
 * Local audit log of the outbox server.
 *
 * @category services
 * @since 0.1.0
 */
export * from "./OutboxAuditLog.ts";
/**
 * Outbox server configuration.
 *
 * @category configuration
 * @since 0.1.0
 */
export * from "./OutboxConfig.ts";
/**
 * Outbox tool handlers.
 *
 * @category handlers
 * @since 0.1.0
 */
export * from "./OutboxHandlers.ts";
/**
 * The outbox send guard.
 *
 * @category guards
 * @since 0.1.0
 */
export * from "./OutboxSendGuard.ts";
/**
 * Outbox server layer constructors.
 *
 * @category layers
 * @since 0.1.0
 */
export * from "./OutboxServer.ts";
/**
 * Summaries of a draft's stored attachments.
 *
 * @category services
 * @since 0.1.0
 */
export * from "./OutboxStoredAttachments.ts";
/**
 * Schema-first outbox tool declarations.
 *
 * @category tools
 * @since 0.1.0
 */
export * from "./OutboxTools.ts";
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
 * **Example** (Log package version)
 *
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
