/**
 * stdio entrypoint for the `@beep/nlp` MCP server.
 *
 * Launches the {@link Server.makeServerLayer} stdio-transport MCP server so an
 * MCP client (e.g. an editor or agent runtime) can call the NLP tools over
 * standard input/output. Register in an MCP client config by pointing it at this
 * file via `bun run`.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { makeServerLayer, NlpMcpServerConfig } from "./Server.ts";

/**
 * The server identity advertised to MCP clients by this entrypoint.
 *
 * **Example** (Log server config name)
 *
 * ```ts
 * import { SERVER_CONFIG } from "@beep/nlp-mcp/bin"
 *
 * console.log(SERVER_CONFIG.name)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SERVER_CONFIG = NlpMcpServerConfig.make({ name: "beep-nlp", version: "0.0.0" });

Layer.launch(
  makeServerLayer(SERVER_CONFIG).pipe(
    Layer.provide(NodeStdio.layer),
    Layer.provide(NodeFileSystem.layer),
    Layer.provide(NodePath.layer),
    Layer.provide(FetchHttpClient.layer)
  )
).pipe(NodeRuntime.runMain);
