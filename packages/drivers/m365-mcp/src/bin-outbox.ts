/**
 * Microsoft 365 outbox MCP stdio executable.
 *
 * @category services
 * @since 0.1.0
 */
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { VERSION } from "./index.ts";
import { loadOutboxConfig } from "./OutboxConfig.ts";
import { makeOutboxLiveServices, makeOutboxServerLayer, outboxHandlerSettings } from "./OutboxServer.ts";
import { M365McpServerConfig } from "./Server.ts";

const ServerConfig = M365McpServerConfig.make({
  name: "beep-m365-outbox",
  version: VERSION,
});

const configFirstOutboxLive = Layer.unwrap(
  loadOutboxConfig().pipe(
    Effect.map((config) =>
      makeOutboxServerLayer(ServerConfig, outboxHandlerSettings(config)).pipe(
        Layer.provide(NodeStdio.layer),
        Layer.provide(makeOutboxLiveServices(config)),
        Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, NodeCrypto.layer))
      )
    )
  )
);

Layer.launch(configFirstOutboxLive).pipe(NodeRuntime.runMain);
