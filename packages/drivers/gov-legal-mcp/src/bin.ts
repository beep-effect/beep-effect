/**
 * Import-safe stdio entrypoint for the gov-legal MCP host.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import { Effect, Layer, Logger } from "effect";
import { VERSION } from "./_generated/version.ts";
import { GovLegalMcpServerConfig, makeServerLayer } from "./Server.ts";

/**
 * Server identity advertised by the executable entrypoint.
 *
 * @example
 * ```ts
 * import { SERVER_CONFIG } from "@beep/gov-legal-mcp/bin"
 *
 * console.log(SERVER_CONFIG.name)
 * // "beep-gov-legal"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SERVER_CONFIG = GovLegalMcpServerConfig.make({ name: "beep-gov-legal", version: VERSION });

/**
 * Launch the stdio server explicitly; importing this module does not launch it.
 *
 * @example
 * ```ts
 * import { runGovLegalMcpServer } from "@beep/gov-legal-mcp/bin"
 *
 * console.log(typeof runGovLegalMcpServer)
 * // "function"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const runGovLegalMcpServer = (): void => {
  Layer.launch(makeServerLayer(SERVER_CONFIG).pipe(Layer.provide(NodeStdio.layer))).pipe(
    Effect.provideService(Logger.LogToStderr, true),
    NodeRuntime.runMain
  );
};

if (import.meta.main) {
  runGovLegalMcpServer();
}
