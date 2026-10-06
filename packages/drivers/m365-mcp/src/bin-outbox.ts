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
import { Effect, Layer } from "effect";
import { VERSION } from "./index.ts";
import { loadOutboxConfig } from "./OutboxConfig.ts";
import { makeOutboxLiveServices, makeOutboxServerLayer, outboxHandlerSettings } from "./OutboxServer.ts";
import { M365McpServerConfig } from "./Server.ts";

const ServerConfig = M365McpServerConfig.make({
  name: "beep-m365-outbox",
  version: VERSION,
});

// Configuration is read before stdio is touched, so a session without the
// credentials sees a failed server and a plain error, not a hung one.
const OutboxLive = Layer.unwrap(
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

Layer.launch(OutboxLive).pipe(NodeRuntime.runMain);
