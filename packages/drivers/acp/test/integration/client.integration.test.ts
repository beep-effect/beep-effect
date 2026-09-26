import { Client as AcpClient, Errors as AcpError, Schema as AcpSchema } from "@beep/acp";
import { currentHostPlatform } from "@beep/utils/HostProcess";
import * as O from "@beep/utils/Option";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { encodeJsonl, jsonRpcRequest, jsonRpcResponse, makeInMemoryStdio } from "../helpers.ts";

const InitializeRequest = jsonRpcRequest("initialize", AcpSchema.InitializeRequest);
const InitializeResponse = jsonRpcResponse(AcpSchema.InitializeResponse);
const ExtRequestPayload = Schema.Struct({ hello: Schema.String });
const ExtResponsePayload = Schema.Struct({ ok: Schema.Boolean });
const TypedRequestPayload = Schema.Struct({ message: Schema.String });
const TypedNotificationPayload = Schema.Struct({ count: Schema.Finite });
const ExtRequest = jsonRpcRequest("x/test", ExtRequestPayload);
const ExtResponse = jsonRpcResponse(ExtResponsePayload);
const decodeInitializeRequest = Schema.decodeEffect(Schema.fromJsonString(InitializeRequest));
const decodeExtRequest = Schema.decodeEffect(Schema.fromJsonString(ExtRequest));
const mockPeerPath = Effect.map(Effect.service(Path.Path), (path) =>
  path.join(import.meta.dirname, "../fixtures/acp-mock-peer.ts")
);

it.layer(NodeServices.layer, { timeout: "10 seconds" })("effect-acp client", (it) => {
  const makeHandle = Effect.fn("AcpClientIntegrationTest.makeHandle")(function* (env?: Record<string, string>) {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const path = yield* Path.Path;
    const command = ChildProcess.make("bun", ["run", yield* mockPeerPath], {
      cwd: path.join(import.meta.dirname, "../.."),
      extendEnv: true,
      shell: currentHostPlatform === "win32",
      stdin: "pipe",
      stderr: "inherit",
      stdout: "pipe",
      ...O.getSomesStruct({ env: O.fromUndefinedOr(env) }),
    });
    return yield* spawner.spawn(command);
  });

  it.layer(Layer.unwrap(Effect.map(makeHandle(), (handle) => AcpClient.layerChildProcess({ handle }))), {
    timeout: "10 seconds",
  })((it) => {
    it.effect(
      "initializes, prompts, receives updates, and handles permission requests",
      Effect.fnUntraced(function* () {
        const updates = yield* Ref.make<Array<unknown>>([]);
        const elicitationCompletions = yield* Ref.make<Array<unknown>>([]);
        const typedRequests = yield* Ref.make<Array<unknown>>([]);
        const typedNotifications = yield* Ref.make<Array<unknown>>([]);
        const acp = yield* AcpClient.AcpClient;

        yield* acp.handleRequestPermission(() =>
          Effect.succeed({
            outcome: {
              outcome: "selected",
              optionId: "allow",
            },
          })
        );
        yield* acp.handleElicitation(() =>
          Effect.succeed({
            action: {
              action: "accept",
              content: {
                approved: true,
              },
            },
          })
        );
        yield* acp.handleSessionUpdate((notification) => Ref.update(updates, (current) => [...current, notification]));
        yield* acp.handleElicitationComplete((notification) =>
          Ref.update(elicitationCompletions, (current) => [...current, notification])
        );
        yield* acp.handleExtRequest("x/typed_request", TypedRequestPayload, (payload) =>
          Ref.update(typedRequests, (current) => [...current, payload]).pipe(
            Effect.as({
              ok: true,
              echoedMessage: payload.message,
            })
          )
        );
        yield* acp.handleExtNotification("x/typed_notification", TypedNotificationPayload, (payload) =>
          Ref.update(typedNotifications, (current) => [...current, payload])
        );

        const init = yield* acp.agent.initialize({
          protocolVersion: 1,
          clientCapabilities: {
            fs: { readTextFile: false, writeTextFile: false },
            terminal: false,
          },
          clientInfo: {
            name: "effect-acp-test",
            version: "0.0.0",
          },
        });
        assert.equal(init.protocolVersion, 1);

        yield* acp.agent.authenticate({ methodId: "cursor_login" });

        const session = yield* acp.agent.createSession({
          cwd: process.cwd(),
          mcpServers: [],
        });
        assert.equal(session.sessionId, "mock-session-1");

        const prompt = yield* acp.agent.prompt({
          sessionId: session.sessionId,
          prompt: [{ type: "text", text: "hello" }],
        });
        assert.equal(prompt.stopReason, "end_turn");

        const streamed = yield* Stream.runCollect(Stream.take(acp.raw.notifications, 2));
        assert.equal(streamed.length, 2);
        assert.equal(streamed[0]?._tag, "SessionUpdate");
        assert.equal(streamed[1]?._tag, "ElicitationComplete");
        assert.equal((yield* Ref.get(updates)).length, 1);
        assert.equal((yield* Ref.get(elicitationCompletions)).length, 1);
        assert.deepEqual(yield* Ref.get(typedRequests), [{ message: "hello from typed request" }]);
        assert.deepEqual(yield* Ref.get(typedNotifications), [{ count: 2 }]);

        const ext = yield* acp.raw.request("x/echo", {
          hello: "world",
        });

        assert.deepEqual(ext, {
          echoedMethod: "x/echo",
          echoedParams: {
            hello: "world",
          },
        });
      })
    );
  });

  it.layer(
    Layer.unwrap(
      Effect.map(makeHandle({ ACP_MOCK_BAD_TYPED_REQUEST: "1" }), (handle) => AcpClient.layerChildProcess({ handle }))
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect(
      "returns formatted invalid params when a typed extension request payload is wrong",
      Effect.fnUntraced(function* () {
        const acp = yield* AcpClient.AcpClient;

        yield* acp.handleRequestPermission(() =>
          Effect.succeed({
            outcome: {
              outcome: "selected",
              optionId: "allow",
            },
          })
        );
        yield* acp.handleElicitation(() =>
          Effect.succeed({
            action: {
              action: "accept",
              content: {
                approved: true,
              },
            },
          })
        );
        yield* acp.handleExtRequest("x/typed_request", TypedRequestPayload, () => Effect.succeed({ ok: true }));

        yield* acp.agent.initialize({
          protocolVersion: 1,
          clientCapabilities: {
            fs: { readTextFile: false, writeTextFile: false },
            terminal: false,
          },
          clientInfo: {
            name: "effect-acp-test",
            version: "0.0.0",
          },
        });

        yield* acp.agent.authenticate({ methodId: "cursor_login" });

        const session = yield* acp.agent.createSession({
          cwd: process.cwd(),
          mcpServers: [],
        });

        const result = yield* Effect.exit(
          acp.agent.prompt({
            sessionId: session.sessionId,
            prompt: [{ type: "text", text: "hello" }],
          })
        );

        if (result._tag !== "Failure") {
          assert.fail("Expected prompt to fail for invalid typed extension payload");
        }
        const rendered = Cause.pretty(result.cause);
        assert.include(rendered, "Invalid x/typed_request payload:");
        assert.include(rendered, "Expected string");
      })
    );
  });

  it.layer(Layer.unwrap(Effect.map(makeHandle(), (handle) => AcpClient.layerChildProcess({ handle }))), {
    timeout: "10 seconds",
  })((it) => {
    it.effect(
      "replays buffered notifications to handlers registered after they arrive",
      Effect.fnUntraced(function* () {
        const updates = yield* Ref.make<Array<unknown>>([]);
        const elicitationCompletions = yield* Ref.make<Array<unknown>>([]);
        const typedRequests = yield* Ref.make<Array<unknown>>([]);
        const typedNotifications = yield* Ref.make<Array<unknown>>([]);
        const acp = yield* AcpClient.AcpClient;

        yield* acp.handleRequestPermission(() =>
          Effect.succeed({
            outcome: {
              outcome: "selected",
              optionId: "allow",
            },
          })
        );
        yield* acp.handleElicitation(() =>
          Effect.succeed({
            action: {
              action: "accept",
              content: {
                approved: true,
              },
            },
          })
        );
        yield* acp.handleExtRequest("x/typed_request", TypedRequestPayload, (payload) =>
          Ref.update(typedRequests, (current) => [...current, payload]).pipe(
            Effect.as({
              ok: true,
              echoedMessage: payload.message,
            })
          )
        );
        yield* acp.handleExtNotification("x/typed_notification", TypedNotificationPayload, (payload) =>
          Ref.update(typedNotifications, (current) => [...current, payload])
        );

        yield* acp.agent.initialize({
          protocolVersion: 1,
          clientCapabilities: {
            fs: { readTextFile: false, writeTextFile: false },
            terminal: false,
          },
          clientInfo: {
            name: "effect-acp-test",
            version: "0.0.0",
          },
        });
        yield* acp.agent.authenticate({ methodId: "cursor_login" });

        const session = yield* acp.agent.createSession({
          cwd: process.cwd(),
          mcpServers: [],
        });
        yield* acp.agent.prompt({
          sessionId: session.sessionId,
          prompt: [{ type: "text", text: "hello" }],
        });

        yield* acp.handleSessionUpdate((notification) => Ref.update(updates, (current) => [...current, notification]));
        yield* acp.handleElicitationComplete((notification) =>
          Ref.update(elicitationCompletions, (current) => [...current, notification])
        );

        assert.equal((yield* Ref.get(updates)).length, 1);
        assert.equal((yield* Ref.get(elicitationCompletions)).length, 1);
        assert.deepEqual(yield* Ref.get(typedRequests), [{ message: "hello from typed request" }]);
        assert.deepEqual(yield* Ref.get(typedNotifications), [{ count: 2 }]);
      })
    );
  });

  it.layer(Layer.unwrap(Effect.map(makeHandle(), (handle) => AcpClient.layerChildProcess({ handle }))), {
    timeout: "10 seconds",
  })((it) => {
    it.effect(
      "continues dispatching session updates after one handler fails",
      Effect.fnUntraced(function* () {
        const successfulHandlers = yield* Ref.make(0);
        const acp = yield* AcpClient.AcpClient;

        yield* acp.handleRequestPermission(() =>
          Effect.succeed({
            outcome: {
              outcome: "selected",
              optionId: "allow",
            },
          })
        );
        yield* acp.handleElicitation(() =>
          Effect.succeed({
            action: {
              action: "accept",
              content: {
                approved: true,
              },
            },
          })
        );
        yield* acp.handleExtRequest("x/typed_request", TypedRequestPayload, () => Effect.succeed({ ok: true }));
        yield* acp.handleExtNotification("x/typed_notification", TypedNotificationPayload, () => Effect.void);
        yield* acp.handleSessionUpdate(() =>
          Effect.fail(AcpError.AcpRequestError.internalError("session update handler failed"))
        );
        yield* acp.handleSessionUpdate(() => Ref.update(successfulHandlers, (count) => count + 1));

        yield* acp.agent.initialize({
          protocolVersion: 1,
          clientCapabilities: {
            fs: { readTextFile: false, writeTextFile: false },
            terminal: false,
          },
          clientInfo: {
            name: "effect-acp-test",
            version: "0.0.0",
          },
        });
        yield* acp.agent.authenticate({ methodId: "cursor_login" });

        const session = yield* acp.agent.createSession({
          cwd: process.cwd(),
          mcpServers: [],
        });
        yield* acp.agent.prompt({
          sessionId: session.sessionId,
          prompt: [{ type: "text", text: "hello" }],
        });

        assert.equal(yield* Ref.get(successfulHandlers), 1);
      })
    );
  });

  it.effect(
    "uses distinct ids for RPC calls and extension requests",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const acp = yield* AcpClient.make(stdio);

      const initializeFiber = yield* acp.agent
        .initialize({
          protocolVersion: 1,
          clientCapabilities: {
            fs: { readTextFile: false, writeTextFile: false },
            terminal: false,
          },
          clientInfo: {
            name: "effect-acp-test",
            version: "0.0.0",
          },
        })
        .pipe(Effect.forkScoped);
      const extFiber = yield* acp.raw.request("x/test", { hello: "world" }).pipe(Effect.forkScoped);

      const firstOutbound = yield* Queue.take(output);
      const secondOutbound = yield* Queue.take(output);

      const firstIsInitialize = yield* decodeInitializeRequest(firstOutbound).pipe(
        Effect.match({
          onFailure: () => false,
          onSuccess: () => true,
        })
      );

      const initializeRequest = firstIsInitialize
        ? yield* decodeInitializeRequest(firstOutbound)
        : yield* decodeInitializeRequest(secondOutbound);
      const extRequest = firstIsInitialize
        ? yield* decodeExtRequest(secondOutbound)
        : yield* decodeExtRequest(firstOutbound);

      assert.notEqual(initializeRequest.id, extRequest.id);

      yield* Queue.offer(
        input,
        yield* encodeJsonl(InitializeResponse, {
          jsonrpc: "2.0",
          id: initializeRequest.id,
          result: {
            protocolVersion: 1,
            agentCapabilities: {},
            agentInfo: {
              name: "mock-agent",
              version: "0.0.0",
            },
          },
        })
      );
      yield* Queue.offer(
        input,
        yield* encodeJsonl(ExtResponse, {
          jsonrpc: "2.0",
          id: extRequest.id,
          result: { ok: true },
        })
      );

      yield* Fiber.join(initializeFiber);
      assert.deepEqual(yield* Fiber.join(extFiber), { ok: true });
    })
  );
});
