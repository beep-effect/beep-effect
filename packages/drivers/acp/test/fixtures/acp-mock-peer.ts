import { Agent as AcpAgent } from "@beep/acp";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";

const sessionId = "mock-session-1";

const program = Effect.gen(function* () {
  const malformedOutput = yield* Config.option(Config.String("ACP_MOCK_MALFORMED_OUTPUT"));
  if (O.isSome(malformedOutput) && malformedOutput.value === "1") {
    const exitCode = yield* Config.String("ACP_MOCK_MALFORMED_OUTPUT_EXIT_CODE").pipe(Config.withDefault("0"));

    return yield* Effect.sync(() => {
      process.stdout.write("{not-json}\n");
      process.exit(Number(exitCode));
    });
  }

  const immediateExitCode = yield* Config.option(Config.String("ACP_MOCK_EXIT_IMMEDIATELY_CODE"));
  if (O.isSome(immediateExitCode)) {
    return yield* Effect.sync(() => {
      process.exit(Number(immediateExitCode.value));
    });
  }

  const badTypedRequest = yield* Config.option(Config.String("ACP_MOCK_BAD_TYPED_REQUEST"));
  const agent = yield* AcpAgent.AcpAgent;

  yield* agent.handleInitialize(() =>
    Effect.succeed({
      protocolVersion: 1,
      agentCapabilities: {
        sessionCapabilities: {
          list: {},
        },
      },
      agentInfo: {
        name: "mock-agent",
        version: "0.0.0",
      },
    })
  );

  yield* agent.handleAuthenticate(() => Effect.succeed({}));
  yield* agent.handleLogout(() => Effect.succeed({}));
  yield* agent.handleCreateSession(() =>
    Effect.succeed({
      sessionId,
    })
  );
  yield* agent.handleLoadSession(() => Effect.succeed({}));
  yield* agent.handleListSessions(() =>
    Effect.succeed({
      sessions: [
        {
          sessionId,
          cwd: process.cwd(),
        },
      ],
    })
  );

  yield* agent.handlePrompt(() =>
    Effect.gen(function* () {
      yield* agent.client.requestPermission({
        sessionId,
        options: [
          {
            optionId: "allow",
            name: "Allow",
            kind: "allow_once",
          },
        ],
        toolCall: {
          toolCallId: "tool-1",
          title: "Read project files",
        },
      });

      yield* agent.client.elicit({
        sessionId,
        message: "Need confirmation before continuing.",
        mode: "form",
        requestedSchema: {
          type: "object",
          title: "Need confirmation",
          properties: {
            approved: {
              type: "boolean",
              title: "Approved",
            },
          },
          required: ["approved"],
        },
      });

      yield* agent.client.sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: "plan",
          entries: [
            {
              content: "Inspect the repository",
              priority: "high",
              status: "in_progress",
            },
          ],
        },
      });

      yield* agent.client.elicitationComplete({
        elicitationId: "elicitation-1",
      });

      yield* agent.client.extRequest("x/typed_request", {
        message: O.isSome(badTypedRequest) && badTypedRequest.value === "1" ? 123 : "hello from typed request",
      });

      yield* agent.client.extNotification("x/typed_notification", {
        count: 2,
      });

      return {
        stopReason: "end_turn" as const,
      };
    })
  );

  yield* agent.handleUnknownExtRequest((method, params) =>
    Effect.succeed({
      echoedMethod: method,
      echoedParams: params ?? null,
    })
  );

  return yield* Effect.never;
});

const runtimeLayer = AcpAgent.layerStdio().pipe(Layer.provide(NodeServices.layer));

const main = Effect.scoped(
  runtimeLayer.pipe(
    Layer.build,
    Effect.flatMap(
      Effect.fnUntraced(function* (context) {
        return yield* program.pipe(Effect.provide(context));
      })
    )
  )
);

NodeRuntime.runMain(main);
