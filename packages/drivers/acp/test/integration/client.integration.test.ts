import { Client as AcpClient, Errors as AcpError, Schema as AcpSchema } from "@beep/acp";
import { RPC_REQUEST_ID_START } from "@beep/acp/protocol";
import { it } from "@beep/test-runner";
import { currentHostPlatform } from "@beep/utils/HostProcess";
import * as O from "@beep/utils/Option";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { encodeJsonl, jsonRpcNotification, jsonRpcRequest, jsonRpcResponse, makeInMemoryStdio } from "../helpers.ts";
import type * as AcpCompat from "@beep/acp/compat";
import type * as AcpProtocol from "@beep/acp/protocol";

const InitializeRequest = jsonRpcRequest("initialize", AcpSchema.InitializeRequest);
const InitializeResponse = jsonRpcResponse(AcpSchema.InitializeResponse);
const PromptResponse = jsonRpcResponse(AcpSchema.PromptResponse);
const SessionUpdateNotification = jsonRpcNotification("session/update", Schema.Unknown);
const ExtRequestPayload = Schema.Struct({ hello: Schema.String });
const ExtResponsePayload = Schema.Struct({ ok: Schema.Boolean });
const TypedRequestPayload = Schema.Struct({ message: Schema.String });
const TypedNotificationPayload = Schema.Struct({ count: Schema.Finite });
const McpNotifiedPayload = Schema.Struct({ method: Schema.String });
const ExtRequest = jsonRpcRequest("x/test", ExtRequestPayload);
const ExtResponse = jsonRpcResponse(ExtResponsePayload);
const decodeInitializeRequest = Schema.decodeEffect(Schema.fromJsonString(InitializeRequest));
const decodeExtRequest = Schema.decodeEffect(Schema.fromJsonString(ExtRequest));
const mockPeerPath = Effect.map(Effect.service(Path.Path), (path) =>
  path.join(import.meta.dirname, "../fixtures/acp-mock-peer.ts")
);

const mockStartupNotice = "Mock ACP startup notice";
const stripMockStartupNotice = (stdout: ChildProcessSpawner.ChildProcessHandle["stdout"]) =>
  stdout.pipe(
    Stream.decodeText,
    Stream.splitLines,
    Stream.filter((line) => line !== mockStartupNotice),
    Stream.map((line) => `${line}\n`),
    Stream.encodeText
  );
const oneBytePerChunk = (stdout: ChildProcessSpawner.ChildProcessHandle["stdout"]) =>
  stdout.pipe(
    Stream.flatMap((chunk) => Stream.fromIterable(A.map(A.fromIterable(chunk), (byte) => Uint8Array.of(byte))))
  );

const allowPermission = () => Effect.succeed({ outcome: { outcome: "selected", optionId: "allow" } } as const);
const acceptElicitation = () => Effect.succeed({ action: "accept", content: { approved: true } } as const);
const legacyInitialize = {
  protocolVersion: 1,
  clientCapabilities: {
    fs: { readTextFile: false, writeTextFile: false },
    terminal: false,
  },
  clientInfo: {
    name: "effect-acp-test",
    version: "0.0.0",
  },
} as const;
const helloPrompt = (sessionId: string) => ({ sessionId, prompt: [{ type: "text" as const, text: "hello" }] });

it.layer(NodeServices.layer, { timeout: "20 seconds" })("effect-acp client", (it) => {
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

  // Spawns the generation-2 mock peer and builds a client on it in the test's scope; both end
  // with the test.
  const spawnClient = Effect.fn("AcpClientIntegrationTest.spawnClient")(function* (
    env?: Record<string, string>,
    options: Omit<AcpClient.AcpClientChildProcessOptions, "handle"> = {}
  ) {
    const handle = yield* makeHandle(env);
    const context = yield* Layer.build(AcpClient.layerChildProcess({ handle, ...options }));
    return { acp: Context.get(context, AcpClient.AcpClient), handle };
  });

  // Registers the handlers every prompt of the mock peer needs.
  const registerPromptHandlers = Effect.fn("AcpClientIntegrationTest.registerPromptHandlers")(function* (
    acp: AcpClient.AcpClientShape
  ) {
    yield* acp.handleRequestPermission(allowPermission);
    yield* acp.handleElicitation(acceptElicitation);
    yield* acp.handleExtRequest("x/typed_request", TypedRequestPayload, () => Effect.succeed({ ok: true }));
    yield* acp.handleExtNotification("x/typed_notification", TypedNotificationPayload, () => Effect.void);
  });

  it.effect(
    "transforms fragmented stdout before parsing and preserves UTF-8",
    Effect.fnUntraced(function* () {
      const { acp } = yield* spawnClient(
        { ACP_MOCK_STDOUT_PREFIX: `${mockStartupNotice}\n` },
        { transformStdout: (stdout) => stdout.pipe(oneBytePerChunk, stripMockStartupNotice) }
      );
      const initialized = yield* acp.agent.initialize({ protocolVersion: 1 });
      assert.equal(initialized.protocolVersion, 2);

      const echoed = yield* acp.raw.request("x/echo", { message: "café" });
      assert.deepEqual(echoed, { echoedMethod: "x/echo", echoedParams: { message: "café" } });
    })
  );

  it.effect(
    "preserves stdout transform errors without logging rejected input",
    Effect.fnUntraced(function* () {
      const privateNotice = "Mock sign-in URL: https://example.test/login?token=mock-private-token";
      const termination = yield* Deferred.make<AcpError.AcpError>();
      const logs = yield* Ref.make(A.empty<AcpProtocol.AcpProtocolLogEvent>());
      const expectedError = AcpError.AcpTransportError.make({
        operation: O.some("read-input-stream"),
        detail: O.some("Sign in to the mock agent."),
      });
      const { acp } = yield* spawnClient(
        { ACP_MOCK_STDOUT_PREFIX: `${privateNotice}\n` },
        {
          logIncoming: true,
          logger: (event) => Ref.update(logs, A.append(event)),
          transformStdout: (stdout) =>
            stdout.pipe(
              Stream.decodeText,
              Stream.splitLines,
              Stream.mapEffect((line) =>
                line === privateNotice ? Effect.fail(expectedError) : Effect.succeed(`${line}\n`)
              ),
              Stream.encodeText
            ),
          onTermination: (error) => Deferred.succeed(termination, error).pipe(Effect.asVoid),
        }
      );

      const failure = yield* acp.agent.initialize({ protocolVersion: 1 }).pipe(Effect.flip);
      const await1 = yield* Deferred.await(termination);
      assert.strictEqual(await1, expectedError);
      assert.strictEqual(failure, expectedError);
      const got2 = yield* Ref.get(logs);
      assert.isEmpty(got2);
    })
  );

  it.effect(
    "applies transformSessionUpdate to spawned-peer updates before handlers and raw notifications",
    Effect.fnUntraced(function* () {
      const transformCalls = MutableRef.make(0);
      const omitted = {
        sessionId: "mock-session-1",
        update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Plan omitted." } },
      } satisfies AcpCompat.SessionNotification;
      const { acp } = yield* spawnClient(undefined, {
        transformSessionUpdate: (notification) => {
          if (notification.update.sessionUpdate !== "plan_update") {
            return notification;
          }
          MutableRef.increment(transformCalls);
          return omitted;
        },
      });
      const updates = yield* Ref.make(A.empty<AcpCompat.SessionNotification>());
      yield* registerPromptHandlers(acp);
      yield* acp.handleSessionUpdate((notification) => Ref.update(updates, A.append(notification)));

      yield* acp.agent.initialize({ protocolVersion: 2 });
      const session = yield* acp.agent.createSession({ cwd: process.cwd(), mcpServers: [] });
      yield* acp.agent.prompt(helloPrompt(session.sessionId));

      const handled = yield* Ref.get(updates);
      assert.deepEqual(
        A.map(handled, (notification) => notification.update.sessionUpdate),
        ["agent_message_chunk", "state_update"]
      );
      assert.strictEqual(handled[0], omitted);
      const [retained] = yield* acp.raw.notifications.pipe(Stream.take(1), Stream.runCollect);
      assert.deepEqual(retained, { _tag: "SessionUpdate", method: "session/update", params: omitted });
      assert.equal(MutableRef.get(transformCalls), 1);
    })
  );

  it.effect(
    "keeps the JSON-RPC error of a failed v2 idle and still completes the prompt",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const delivered = yield* Deferred.make<AcpCompat.SessionNotification>();
      const acp = yield* AcpClient.make(stdio);
      yield* acp.handleSessionUpdate((notification) => Deferred.succeed(delivered, notification).pipe(Effect.asVoid));
      const error = { code: -32000, message: "Please sign in to the agent", data: { retry: false } };
      const idle = { sessionUpdate: "state_update", state: "idle", stopReason: "error", error } as const;

      // A negotiating client takes the generation-2 path until `initialize` answers.
      const prompt = yield* acp.agent.prompt(helloPrompt("session-1")).pipe(Effect.forkScoped);
      // The first typed RPC of a connection takes the first typed id.
      const take3 = yield* Queue.take(output);
      assert.include(take3, `"id":${RPC_REQUEST_ID_START}`);
      const encodedJsonl = yield* encodeJsonl(SessionUpdateNotification, {
        jsonrpc: "2.0",
        method: "session/update",
        params: { sessionId: "session-1", update: idle },
      });
      yield* Queue.offer(input, encodedJsonl);
      const encodedJsonl4 = yield* encodeJsonl(PromptResponse, {
        jsonrpc: "2.0",
        id: RPC_REQUEST_ID_START,
        result: { messageId: "message-1" },
      });
      yield* Queue.offer(input, encodedJsonl4);

      const { update } = yield* Deferred.await(delivered);
      assert.deepEqual(update.sessionUpdate === "state_update" && update.state === "idle" ? update : undefined, idle);
      assert.equal((yield* Fiber.join(prompt)).stopReason, "error");
    })
  );

  it.effect(
    "reports idle child termination and rejects later requests and notifications with the same error",
    Effect.fnUntraced(function* () {
      const termination = yield* Deferred.make<AcpError.AcpError>();
      const { acp, handle } = yield* spawnClient(undefined, {
        onTermination: (error) => Deferred.succeed(termination, error).pipe(Effect.asVoid),
      });
      yield* acp.agent.initialize({ protocolVersion: 1 });
      yield* handle.kill();

      const error = yield* Deferred.await(termination);
      if (error._tag !== "AcpProcessExitedError") {
        return assert.fail(`Expected a process exit, got ${error._tag}`);
      }
      const expected = yield* AcpClient.makeTerminationError(handle);
      if (expected._tag !== "AcpProcessExitedError") {
        return assert.fail(`Expected the classifier to report a process exit, got ${expected._tag}`);
      }
      assert.deepStrictEqual(error.pid, O.some(handle.pid));
      assert.deepStrictEqual(error.code, expected.code);
      assert.deepStrictEqual(error.signal, expected.signal);

      // A success would surface as a defect here; only the failure is compared.
      const pipe5 = yield* acp.raw.request("x/echo", {}).pipe(Effect.flip, Effect.orDie);
      assert.strictEqual(pipe5, error);
      const pipe6 = yield* acp.raw.notify("x/notify", {}).pipe(Effect.flip);
      assert.strictEqual(pipe6, error);
      const pipe7 = yield* acp.agent.cancel({ sessionId: "mock-session-1" }).pipe(Effect.flip);
      assert.strictEqual(pipe7, error);
      const pipe8 = yield* acp.agent.createSession({ cwd: process.cwd(), mcpServers: [] }).pipe(Effect.flip);
      assert.strictEqual(pipe8, error);
    })
  );

  it.effect(
    "initializes, prompts, receives updates, and handles permission requests end to end over v2",
    Effect.fnUntraced(function* () {
      const updates = yield* Ref.make(A.empty<unknown>());
      const elicitationCompletions = yield* Ref.make(A.empty<unknown>());
      const typedRequests = yield* Ref.make(A.empty<unknown>());
      const typedNotifications = yield* Ref.make(A.empty<unknown>());
      const requestContexts = yield* Ref.make(A.empty<AcpProtocol.AcpRequestContext>());
      const recordContext = (context: AcpProtocol.AcpRequestContext) => Ref.update(requestContexts, A.append(context));
      const { acp } = yield* spawnClient();

      yield* acp.handleRequestPermission((_request, context) =>
        recordContext(context).pipe(Effect.andThen(allowPermission()))
      );
      yield* acp.handleElicitation((_request, context) =>
        recordContext(context).pipe(Effect.andThen(acceptElicitation()))
      );
      yield* acp.handleSessionUpdate((notification) => Ref.update(updates, A.append<unknown>(notification)));
      yield* acp.handleElicitationComplete((notification) =>
        Ref.update(elicitationCompletions, A.append<unknown>(notification))
      );
      yield* acp.handleExtRequest("x/typed_request", TypedRequestPayload, (payload, context) =>
        Ref.update(typedRequests, A.append<unknown>(payload)).pipe(
          Effect.andThen(recordContext(context)),
          Effect.as({ ok: true, echoedMessage: payload.message })
        )
      );
      yield* acp.handleExtNotification("x/typed_notification", TypedNotificationPayload, (payload) =>
        Ref.update(typedNotifications, A.append<unknown>(payload))
      );

      const init = yield* acp.agent.initialize(legacyInitialize);
      assert.equal(init.protocolVersion, 2);

      yield* acp.agent.authenticate({ methodId: "cursor_login" });

      const session = yield* acp.agent.createSession({ cwd: process.cwd(), mcpServers: [] });
      assert.equal(session.sessionId, "mock-session-1");
      // ACP v2 removed session/set_mode; the client fails it locally.
      const setMode = yield* acp.agent
        .setSessionMode({ sessionId: session.sessionId, modeId: "code" })
        .pipe(Effect.flip);
      assert.equal(setMode._tag === "AcpRequestError" ? setMode.code : undefined, -32601);

      const prompt = yield* acp.agent.prompt(helloPrompt(session.sessionId));
      assert.equal(prompt.stopReason, "end_turn");

      const streamed = yield* Stream.runCollect(Stream.take(acp.raw.notifications, 2));
      assert.equal(streamed.length, 2);
      assert.equal(streamed[0]?._tag, "SessionUpdate");
      assert.equal(streamed[1]?._tag, "ElicitationComplete");
      assert.equal((yield* Ref.get(updates)).length, 2);
      assert.equal((yield* Ref.get(elicitationCompletions)).length, 1);
      const got9 = yield* Ref.get(typedRequests);
      assert.deepEqual(got9, [{ message: "hello from typed request" }]);
      const got10 = yield* Ref.get(typedNotifications);
      assert.deepEqual(got10, [{ count: 2 }]);
      const observedContexts = yield* Ref.get(requestContexts);
      assert.deepEqual(
        A.map(observedContexts, (context) => context.method),
        ["session/request_permission", "elicitation/create", "x/typed_request"]
      );
      assert.equal(
        HashSet.size(HashSet.fromIterable(A.map(observedContexts, (context) => context.requestId))),
        observedContexts.length
      );

      const ext = yield* acp.raw.request("x/echo", { hello: "world" });
      assert.deepEqual(ext, { echoedMethod: "x/echo", echoedParams: { hello: "world" } });
    })
  );

  it.effect(
    "returns structured invalid params without exposing values from typed extension request payloads",
    Effect.fnUntraced(function* () {
      const { acp } = yield* spawnClient({ ACP_MOCK_BAD_TYPED_REQUEST: "1" });
      yield* acp.handleRequestPermission(allowPermission);
      yield* acp.handleElicitation(acceptElicitation);
      yield* acp.handleExtRequest("x/typed_request", TypedRequestPayload, () => Effect.succeed({ ok: true }));

      yield* acp.agent.initialize(legacyInitialize);
      yield* acp.agent.authenticate({ methodId: "cursor_login" });
      const session = yield* acp.agent.createSession({ cwd: process.cwd(), mcpServers: [] });
      const result = yield* Effect.exit(acp.agent.prompt(helloPrompt(session.sessionId)));

      if (result._tag !== "Failure") {
        return assert.fail("Expected prompt to fail for invalid typed extension payload");
      }
      const rendered = Cause.pretty(result.cause);
      assert.include(rendered, "Invalid payload for ACP extension method 'x/typed_request'.");
      assert.notInclude(rendered, "Expected string, got 123");
    })
  );

  it.effect(
    "preserves ACP v2 structured diff semantics",
    Effect.fnUntraced(function* () {
      const updates = yield* Ref.make(A.empty<AcpCompat.SessionNotification>());
      const { acp } = yield* spawnClient({ ACP_MOCK_V2_DIFF: "1" });
      yield* registerPromptHandlers(acp);
      yield* acp.handleSessionUpdate((notification) => Ref.update(updates, A.append(notification)));

      yield* acp.agent.initialize({ protocolVersion: 2 });
      yield* acp.agent.authenticate({ methodId: "cursor_login" });
      const session = yield* acp.agent.createSession({ cwd: process.cwd(), mcpServers: [] });
      yield* acp.agent.prompt({ sessionId: session.sessionId, prompt: [{ type: "text", text: "show the diff" }] });

      const got11 = yield* Ref.get(updates);
      const diffUpdate = A.findFirst(got11, (notification) => notification.update.sessionUpdate === "tool_call_update");
      assert.deepEqual(O.getOrUndefined(O.map(diffUpdate, (notification) => notification.update)), {
        sessionUpdate: "tool_call_update",
        toolCallId: "tool-diff",
        content: [
          {
            type: "diff",
            changes: [
              {
                operation: "move",
                oldPath: "/workspace/old.ts",
                path: "/workspace/new.ts",
                fileType: "text",
                mimeType: "text/typescript",
              },
            ],
            patch: {
              format: "git_patch",
              text: "diff --git a/old.ts b/new.ts\nsimilarity index 100%\nrename from old.ts\nrename to new.ts\n",
            },
          },
        ],
      });
    })
  );

  it.effect(
    "does not turn unsupported ACP v2 auth methods into agent login",
    Effect.fnUntraced(function* () {
      const { acp } = yield* spawnClient({ ACP_MOCK_CUSTOM_AUTH: "1" });
      const response = yield* acp.agent.initialize({ protocolVersion: 2 });
      assert.deepEqual(response.authMethods, []);
    })
  );

  it.effect(
    "preserves registry env-var authentication extensions",
    Effect.fnUntraced(function* () {
      const { acp } = yield* spawnClient({ ACP_MOCK_ENV_VAR_AUTH: "1" });
      const response = yield* acp.agent.initialize({ protocolVersion: 2 });
      assert.deepEqual(response.authMethods, [
        {
          id: "api_key",
          name: "API key",
          type: "env_var",
          vars: [{ name: "MOCK_API_KEY", label: "Mock API key" }],
          link: "https://example.test/keys",
        },
      ]);
    })
  );

  it.effect(
    "routes MCP-over-ACP message requests and notifications through a spawned peer",
    Effect.fnUntraced(function* () {
      const methods = yield* Ref.make(A.empty<string>());
      const record = (method: string) => Ref.update(methods, A.append(method));
      const notified = yield* Deferred.make<string>();
      const { acp } = yield* spawnClient({ ACP_MOCK_MCP_OVER_ACP: "1" });
      yield* acp.handleRequestPermission(allowPermission);
      yield* acp.handleElicitation(() => Effect.succeed({ action: "decline" } as const));
      yield* acp.handleExtRequest("x/typed_request", TypedRequestPayload, () => Effect.succeed({ ok: true }));
      yield* acp.handleExtNotification("x/typed_notification", TypedNotificationPayload, () => Effect.void);
      yield* acp.handleMcpMessage(() => record("message").pipe(Effect.as({ result: { tools: [] } })));
      yield* acp.handleExtNotification("x/mcp_notified", McpNotifiedPayload, ({ method }) =>
        Deferred.succeed(notified, method).pipe(Effect.asVoid)
      );

      yield* acp.agent.initialize({
        protocolVersion: 2,
        clientCapabilities: {},
        clientInfo: { name: "effect-acp-test", version: "0.0.0" },
      });
      const session = yield* acp.agent.createSession({ cwd: process.cwd(), mcpServers: [] });
      yield* acp.agent.prompt({ sessionId: session.sessionId, prompt: [{ type: "text", text: "exercise MCP" }] });

      const got12 = yield* Ref.get(methods);
      assert.deepEqual(got12, ["message"]);
      yield* acp.agent.notifyMcp({ serverId: "test-server", requestId: "mcp-1", method: "notifications/progress" });
      const await13 = yield* Deferred.await(notified);
      assert.equal(await13, "notifications/progress");
    })
  );

  it.effect(
    "replays buffered notifications to handlers registered after they arrive",
    Effect.fnUntraced(function* () {
      const updates = yield* Ref.make(A.empty<unknown>());
      const elicitationCompletions = yield* Ref.make(A.empty<unknown>());
      const typedRequests = yield* Ref.make(A.empty<unknown>());
      const typedNotifications = yield* Ref.make(A.empty<unknown>());
      const { acp } = yield* spawnClient();

      yield* acp.handleRequestPermission(allowPermission);
      yield* acp.handleElicitation(acceptElicitation);
      yield* acp.handleExtRequest("x/typed_request", TypedRequestPayload, (payload) =>
        Ref.update(typedRequests, A.append<unknown>(payload)).pipe(
          Effect.as({ ok: true, echoedMessage: payload.message })
        )
      );
      yield* acp.handleExtNotification("x/typed_notification", TypedNotificationPayload, (payload) =>
        Ref.update(typedNotifications, A.append<unknown>(payload))
      );

      yield* acp.agent.initialize(legacyInitialize);
      yield* acp.agent.authenticate({ methodId: "cursor_login" });
      const session = yield* acp.agent.createSession({ cwd: process.cwd(), mcpServers: [] });
      yield* acp.agent.prompt(helloPrompt(session.sessionId));

      yield* acp.handleSessionUpdate((notification) => Ref.update(updates, A.append<unknown>(notification)));
      yield* acp.handleElicitationComplete((notification) =>
        Ref.update(elicitationCompletions, A.append<unknown>(notification))
      );

      assert.equal((yield* Ref.get(updates)).length, 2);
      assert.equal((yield* Ref.get(elicitationCompletions)).length, 1);
      const got14 = yield* Ref.get(typedRequests);
      assert.deepEqual(got14, [{ message: "hello from typed request" }]);
      const got15 = yield* Ref.get(typedNotifications);
      assert.deepEqual(got15, [{ count: 2 }]);
    })
  );

  it.effect(
    "continues dispatching session updates after one handler fails",
    Effect.fnUntraced(function* () {
      const successfulHandlers = yield* Ref.make(0);
      const { acp } = yield* spawnClient();
      yield* registerPromptHandlers(acp);
      yield* acp.handleSessionUpdate(() =>
        Effect.fail(AcpError.AcpRequestError.internalError("session update handler failed"))
      );
      yield* acp.handleSessionUpdate(() => Ref.update(successfulHandlers, (count) => count + 1));

      yield* acp.agent.initialize(legacyInitialize);
      yield* acp.agent.authenticate({ methodId: "cursor_login" });
      const session = yield* acp.agent.createSession({ cwd: process.cwd(), mcpServers: [] });
      yield* acp.agent.prompt(helloPrompt(session.sessionId));

      // The plan update and the idle state update each reach the healthy handler.
      const got16 = yield* Ref.get(successfulHandlers);
      assert.equal(got16, 2);
    })
  );

  it.effect(
    "uses distinct ids for RPC calls and extension requests",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const acp = yield* AcpClient.make(stdio);

      const initializeFiber = yield* acp.agent.initialize(legacyInitialize).pipe(Effect.forkScoped);
      const extFiber = yield* acp.raw.request("x/test", { hello: "world" }).pipe(Effect.forkScoped);

      const firstOutbound = yield* Queue.take(output);
      const secondOutbound = yield* Queue.take(output);

      const firstIsInitialize = yield* decodeInitializeRequest(firstOutbound).pipe(Effect.isSuccess);

      const initializeRequest = firstIsInitialize
        ? yield* decodeInitializeRequest(firstOutbound)
        : yield* decodeInitializeRequest(secondOutbound);
      const extRequest = firstIsInitialize
        ? yield* decodeExtRequest(secondOutbound)
        : yield* decodeExtRequest(firstOutbound);

      assert.notEqual(initializeRequest.id, extRequest.id);

      const encodedJsonl17 = yield* encodeJsonl(InitializeResponse, {
        jsonrpc: "2.0",
        id: initializeRequest.id,
        result: {
          protocolVersion: 2,
          capabilities: {},
          info: { name: "mock-agent", version: "0.0.0" },
        },
      });
      yield* Queue.offer(input, encodedJsonl17);
      const encodedJsonl18 = yield* encodeJsonl(ExtResponse, {
        jsonrpc: "2.0",
        id: extRequest.id,
        result: { ok: true },
      });
      yield* Queue.offer(input, encodedJsonl18);

      assert.equal((yield* Fiber.join(initializeFiber)).protocolVersion, 2);
      const join19 = yield* Fiber.join(extFiber);
      assert.deepEqual(join19, { ok: true });
    })
  );
});
