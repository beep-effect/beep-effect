import { Agent } from "@beep/acp";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import type { Schema } from "@beep/acp";

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
  let authenticated = false;
  yield* agent.handleInitialize(() =>
    checkpoint("initialize").pipe(Effect.andThen(Effect.succeed({ protocolVersion: 1, agentCapabilities: {} })))
  );
  yield* agent.handleAuthenticate(() =>
    checkpoint("authenticate").pipe(
      Effect.andThen(
        Effect.sync(() => {
          authenticated = true;
          return {};
        })
      )
    )
  );
  yield* agent.handleCreateSession(() =>
    checkpoint("session/new").pipe(
      Effect.andThen(
        Effect.sync(
          (): Schema.NewSessionResponse => ({
            sessionId: authenticated ? "owned-grok" : "unauthenticated",
            models: { currentModelId: "grok-4.7", availableModels: [{ modelId: "grok-4.7", name: "synthetic" }] },
            configOptions: [
              {
                id: "reasoning_effort",
                name: "Effort",
                type: "select",
                currentValue: "medium",
                options: [{ value: "medium", name: "Medium" }],
              },
            ],
          })
        )
      )
    )
  );
  yield* agent.handlePrompt((request) =>
    Effect.gen(function* () {
      for (const block of request.prompt) {
        if (block.type === "text" && block.text.startsWith("permission:")) {
          const testCase = block.text.slice(11);
          const toolName =
            testCase === "wrong-server"
              ? "foreign__agent_message_acknowledge"
              : testCase === "builtin"
                ? "shell"
                : testCase === "unknown"
                  ? "peer__unknown"
                  : "peer__agent_message_acknowledge";
          const decision = yield* agent.client.requestPermission({
            sessionId: testCase === "wrong-session" ? "foreign-session" : request.sessionId,
            toolCall: { toolCallId: "synthetic-tool", title: "synthetic", rawInput: { tool_name: toolName } },
            options: [{ optionId: "allow", name: "Allow once", kind: "allow_once" }],
          });
          yield* agent.client.sessionUpdate({
            sessionId: request.sessionId,
            update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: decision.outcome.outcome } },
          });
        } else if (block.type === "text")
          yield* agent.client.sessionUpdate({
            sessionId: request.sessionId,
            update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: block.text } },
          });
      }
      return { stopReason: "end_turn" };
    })
  );
  yield* agent.handleSetSessionMode(() => checkpoint("session/set_mode").pipe(Effect.andThen(Effect.succeed({}))));
  return yield* Effect.never;
});
Agent.layerStdio().pipe(
  Layer.provideMerge(NodeServices.layer),
  Layer.build,
  Effect.flatMap((context) => program.pipe(Effect.provide(context))),
  Effect.scoped,
  NodeRuntime.runMain
);
