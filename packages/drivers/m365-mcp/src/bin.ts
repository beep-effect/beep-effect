/**
 * Microsoft 365 MCP stdio executable.
 *
 * @category services
 * @since 0.1.0
 */
import { M365 } from "@beep/m365";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as Layer from "effect/Layer";
import { M365McpServerConfig, makeServerLayer, VERSION } from "./index.ts";

const ServerConfig = M365McpServerConfig.make({
  name: "beep-m365",
  version: VERSION,
});

Layer.launch(makeServerLayer(ServerConfig).pipe(Layer.provide(NodeStdio.layer), Layer.provide(M365.layer))).pipe(
  NodeRuntime.runMain
);
