/**
 * stdio entrypoint for the `@beep/uspto` MCP proving host.
 *
 * Launches {@link makeServerLayer}'s stdio-transport MCP server so an MCP
 * client (e.g. an editor or agent runtime) can call the USPTO tools over
 * standard input/output. Register in an MCP client config by pointing it at
 * this file via `bun run`.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import { Layer } from "effect";
import { makeServerLayer, UsptoMcpServerConfig } from "./Server.ts";

/**
 * The server identity advertised to MCP clients by this entrypoint.
 *
 * **Example** (Log server config name)
 *
 * ```ts
 * import { SERVER_CONFIG } from "@beep/uspto-mcp/bin"
 *
 * console.log(SERVER_CONFIG.name)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SERVER_CONFIG = UsptoMcpServerConfig.make({ name: "beep-uspto", version: "0.0.0" });

/**
 * Launch the stdio MCP server. Kept behind an explicit function so importing
 * `@beep/uspto-mcp/bin` for metadata never starts a long-lived stdio process.
 *
 * **Example** (Check run function type)
 *
 * ```ts
 * import { runUsptoMcpServer } from "@beep/uspto-mcp/bin"
 *
 * console.log(typeof runUsptoMcpServer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const runUsptoMcpServer = (): void => {
  Layer.launch(makeServerLayer(SERVER_CONFIG).pipe(Layer.provide(NodeStdio.layer))).pipe(NodeRuntime.runMain);
};

if (import.meta.main) {
  runUsptoMcpServer();
}
