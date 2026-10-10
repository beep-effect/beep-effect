import { Agent } from "@beep/acp";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

const model = "claude-opus-5-5[context=300k,effort=medium,fast=false]";
const program = Effect.gen(function* () {
  const agent = yield* Agent.AcpAgent;
  const stalled = yield* Config.String("STALL_AT").pipe(Config.withDefault("none"));
  const home = yield* Config.String("HOME");
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const checkpoint = (operation: string) =>
    operation === stalled
      ? fs.writeFileString(path.join(home, "stall-reached"), operation).pipe(Effect.andThen(Effect.never), Effect.orDie)
      : Effect.void;
  yield* agent.handleInitialize(() =>
    checkpoint("initialize").pipe(Effect.andThen(Effect.succeed({ protocolVersion: 1, agentCapabilities: {} })))
  );
  yield* agent.handleCreateSession(() =>
    checkpoint("session/new").pipe(
      Effect.andThen(
        Effect.succeed({
          sessionId: "owned-cursor",
          models: { currentModelId: model, availableModels: [{ modelId: model, name: "synthetic" }] },
        })
      )
    )
  );
  yield* agent.handleSetSessionMode(() => checkpoint("session/set_mode").pipe(Effect.andThen(Effect.succeed({}))));
  yield* agent.handlePrompt((request) =>
    agent.client
      .sessionUpdate({
        sessionId: request.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "Upgrade your plan to continue" },
        },
      })
      .pipe(Effect.as({ stopReason: "end_turn" }))
  );
  return yield* Effect.never;
});
Agent.layerStdio().pipe(
  Layer.provideMerge(NodeServices.layer),
  Layer.build,
  Effect.flatMap((context) => program.pipe(Effect.provide(context))),
  Effect.scoped,
  NodeRuntime.runMain
);
