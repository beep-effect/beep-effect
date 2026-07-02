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
 * @example
 * ```ts
 * import { SERVER_CONFIG } from "@beep/uspto-mcp/bin"
 *
 * console.log(SERVER_CONFIG.name)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const SERVER_CONFIG = UsptoMcpServerConfig.make({ name: "beep-uspto", version: "0.0.0" });

Layer.launch(makeServerLayer(SERVER_CONFIG).pipe(Layer.provide(NodeStdio.layer))).pipe(NodeRuntime.runMain);
