// In-memory tests for `@beep/acp/client`: generation negotiation, prompt lifecycle, request ids,
// peer requests, notification buffering and handler isolation. The scripted-peer cases port the
// in-memory cases of t3code effect-acp `client.test.ts` (31dcc7c513); the buffered-replay and
// unknown-variant cases replace its spawned mock peer with a scripted one. Generation pinning,
// the pending-notification cap, concurrent-prompt rejection and termination cases are beep-only.
import * as AcpClient from "@beep/acp/client";
import * as Compat from "@beep/acp/compat";
import * as AcpError from "@beep/acp/errors";
import * as AcpJson from "@beep/acp/json";
import { collectStderrTail } from "@beep/acp/stderr";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A, currentHostPlatform } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { antigravityInitialize } from "./fixtures/antigravity-initialize.ts";
import { makeInMemoryStdio } from "./helpers.ts";
import type * as AcpProtocol from "@beep/acp/protocol";
import type * as Cause from "effect/Cause";

const encoder = new TextEncoder();

const JsonRpcId = S.Union([S.Finite, S.String]);
const WireRequest = S.Struct({ id: JsonRpcId, method: S.String, params: S.optionalKey(S.Unknown) });
const WireResponse = S.Struct({ id: JsonRpcId, result: S.optionalKey(S.Unknown), error: S.optionalKey(S.Unknown) });
const WireError = S.Struct({ id: JsonRpcId, error: S.Struct({ code: S.Finite, message: S.String }) });
const WireNotification = S.Struct({ method: S.String, params: S.optionalKey(S.Unknown) });

const encodeUnknownJsonText = S.encodeUnknownEffect(AcpJson.fromJsonText(S.Unknown));
const decodeWireRequest = S.decodeEffect(AcpJson.fromJsonText(WireRequest));
const decodeWireResponse = S.decodeEffect(AcpJson.fromJsonText(WireResponse));
const decodeWireError = S.decodeEffect(AcpJson.fromJsonText(WireError));
const decodeWireNotification = S.decodeEffect(AcpJson.fromJsonText(WireNotification));
const decodeProtocolVersion = S.decodeUnknownOption(S.Struct({ protocolVersion: S.Finite }));
const isNegotiatingInitialize = S.is(S.Struct({ clientCapabilities: S.Unknown, info: S.Unknown }));

type Input = Queue.Queue<Uint8Array, Cause.Done>;
type Output = Queue.Queue<string>;

// One stdin chunk holding every message, so the client must frame a batch.
const sendAll = (input: Input, messages: ReadonlyArray<unknown>) =>
  Effect.forEach(messages, (message) => encodeUnknownJsonText(message)).pipe(
    Effect.map((lines) =>
      encoder.encode(
        A.join(
          A.map(lines, (line) => `${line}\n`),
          ""
        )
      )
    ),
    Effect.flatMap((bytes) => Queue.offer(input, bytes))
  );
const send = (input: Input, message: unknown) => sendAll(input, [message]);
const takeRequest = (output: Output) => Effect.flatMap(Queue.take(output), decodeWireRequest);
const takeResponse = (output: Output) => Effect.flatMap(Queue.take(output), decodeWireResponse);
const takeError = (output: Output) => Effect.flatMap(Queue.take(output), decodeWireError);
const takeNotification = (output: Output) => Effect.flatMap(Queue.take(output), decodeWireNotification);

const request = (id: string | number, method: string, params: unknown) => ({ jsonrpc: "2.0", id, method, params });
const notification = (method: string, params: unknown) => ({ jsonrpc: "2.0", method, params });
const result = (id: string | number, value: unknown) => ({ jsonrpc: "2.0", id, result: value });

// Answers the next outbound request with `value` and returns that request.
const answerNext = Effect.fnUntraced(function* (input: Input, output: Output, value: unknown) {
  const outbound = yield* takeRequest(output);
  yield* send(input, result(outbound.id, value));
  return outbound;
});

const exchange = Effect.fnUntraced(function* <A>(
  input: Input,
  output: Output,
  call: Effect.Effect<A, AcpError.AcpError>,
  value: unknown = {}
) {
  const fiber = yield* Effect.forkScoped(call);
  const outbound = yield* answerNext(input, output, value);
  const answer = yield* Fiber.join(fiber);
  return { answer, outbound };
});

const v1ClientInfo = { name: "effect-acp-test", version: "0.0.0" };
const v1Initialize: Compat.InitializeRequest = {
  protocolVersion: 1,
  clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
  clientInfo: v1ClientInfo,
};
const v2InitializeResult = { protocolVersion: 2, capabilities: {}, info: { name: "mock-agent", version: "0.0.0" } };
const allow: Compat.RequestPermissionResponse = { outcome: { outcome: "selected", optionId: "allow" } };
const textChunk = (sessionId: string, text: string) =>
  notification("session/update", {
    sessionId,
    update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } },
  });
const idle = (sessionId: string, extra: Record<string, unknown> = {}) =>
  notification("session/update", {
    sessionId,
    update: { sessionUpdate: "state_update", state: "idle", stopReason: "end_turn", ...extra },
  });
const usageUpdate = (used: number) =>
  notification("session/update", {
    sessionId: "session-1",
    update: { sessionUpdate: "usage_update", size: 1000, used },
  });

const toolCallPermission = {
  sessionId: "session-1",
  title: "Shared tool",
  subject: { type: "tool_call", toolCall: { toolCallId: "shared-tool", title: "Shared tool" } },
  options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
};

const expectFailure = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.match(effect, {
    onFailure: (error) => error,
    onSuccess: () => assert.fail("expected the effect to fail"),
  });

const expectMethodNotFound = Effect.fnUntraced(function* <A>(effect: Effect.Effect<A, AcpError.AcpError>) {
  const error = yield* expectFailure(effect);
  assert.isTrue(AcpError.AcpRequestError.is(error));
  assert.equal(AcpError.AcpRequestError.is(error) ? error.code : 0, -32601);
});

it.effect(
  "keeps RPC ids within int32 and apart from extension ids",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);

    const initializeFiber = yield* Effect.forkScoped(acp.agent.initialize(v1Initialize));
    const initialize = yield* takeRequest(output);
    const extFiber = yield* Effect.forkScoped(acp.raw.request("x/test", { hello: "world" }));
    const ext = yield* takeRequest(output);

    assert.equal(initialize.method, "initialize");
    // Locally generated ids stay numeric and within int32 for SDKs that decode ids as Int.
    assert.strictEqual(initialize.id, 2 ** 30);
    assert.isAtMost(Number(initialize.id), 2 ** 31 - 1);
    assert.strictEqual(ext.id, 1);

    yield* sendAll(input, [result(initialize.id, v2InitializeResult), result(ext.id, { ok: true })]);
    yield* Fiber.join(initializeFiber);
    assert.deepEqual(yield* Fiber.join(extFiber), { ok: true });

    const { answer, outbound } = yield* exchange(
      input,
      output,
      acp.agent.createSession({ cwd: "/tmp", mcpServers: [] }),
      {
        sessionId: "session-1",
      }
    );
    assert.strictEqual(outbound.id, 2 ** 30 + 1);
    assert.equal(answer.sessionId, "session-1");
  })
);

// The recorded agent reports version 2 (and, in the variant, 1) with the generation-1 result shape.
A.forEach([1, 2], (protocolVersion) =>
  it.effect(
    `keeps generation-1 wire behavior for an agent reporting version ${protocolVersion}`,
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const acp = yield* AcpClient.make(stdio);
      const updates = yield* Ref.make<ReadonlyArray<Compat.SessionNotification>>([]);
      yield* acp.handleSessionUpdate((update) => Ref.update(updates, A.append(update)));

      const recorded = yield* antigravityInitialize;
      const initialized = yield* exchange(
        input,
        output,
        acp.agent.initialize({
          protocolVersion: 2,
          clientInfo: v1ClientInfo,
          clientCapabilities: { _meta: { "terminal-auth": true } },
        }),
        { ...recorded, protocolVersion }
      );
      assert.deepInclude(initialized.outbound.params, {
        protocolVersion: 2,
        clientCapabilities: { _meta: { "terminal-auth": true } },
        clientInfo: v1ClientInfo,
      });
      assert.equal(initialized.answer.protocolVersion, protocolVersion);
      assert.equal(initialized.answer.agentInfo?.name, "antigravity-acp");

      const login = yield* exchange(input, output, acp.agent.authenticate({ methodId: "oauth-personal" }));
      assert.deepEqual(
        [login.outbound.method, login.outbound.params],
        ["authenticate", { methodId: "oauth-personal" }]
      );

      const mcpServers = [{ name: "fixture", command: "fixture-only", args: [], env: [] }];
      const created = yield* exchange(input, output, acp.agent.createSession({ cwd: "/work", mcpServers }), {
        sessionId: "native-session-1",
        models: {
          currentModelId: "native-model",
          availableModels: [{ modelId: "native-model", name: "Native model" }],
        },
      });
      assert.deepInclude(created.outbound.params, { mcpServers });
      assert.equal(created.answer.sessionId, "native-session-1");
      assert.equal(created.answer.models?.currentModelId, "native-model");

      const resume = { sessionId: "native-session-1", cwd: "/work", mcpServers };
      const resumed = yield* exchange(input, output, acp.agent.resumeSession(resume));
      assert.deepEqual([resumed.outbound.method, resumed.outbound.params], ["session/resume", resume]);
      const loaded = yield* exchange(input, output, acp.agent.loadSession(resume));
      assert.deepEqual([loaded.outbound.method, loaded.outbound.params], ["session/load", resume]);

      const model = yield* exchange(
        input,
        output,
        acp.agent.setSessionModel(
          Compat.SetSessionModelRequest.make({ sessionId: "native-session-1", modelId: "native-model" })
        )
      );
      assert.deepEqual(
        [model.outbound.method, model.outbound.params],
        ["session/set_model", { sessionId: "native-session-1", modelId: "native-model" }]
      );
      const mode = yield* exchange(
        input,
        output,
        acp.agent.setSessionMode({ sessionId: "native-session-1", modeId: "yolo" })
      );
      assert.deepEqual(
        [mode.outbound.method, mode.outbound.params],
        ["session/set_mode", { sessionId: "native-session-1", modeId: "yolo" }]
      );

      yield* acp.handleElicitation(() => Effect.succeed({ action: "accept", content: { branch: "main" } }));
      const question = {
        sessionId: "native-session-1",
        mode: "form",
        message: "Choose a branch",
        requestedSchema: { type: "object", properties: {} },
      };
      // `session/elicitation` and the older underscore name (recorded from Devin) get the nested result.
      yield* send(input, request("legacy-question", "session/elicitation", question));
      assert.deepEqual(yield* takeResponse(output), {
        id: "legacy-question",
        result: { action: { action: "accept", content: { branch: "main" } } },
      });
      yield* send(input, request("devin-question", "_session/elicitation", question));
      assert.deepEqual(yield* takeResponse(output), {
        id: "devin-question",
        result: { action: { action: "accept", content: { branch: "main" } } },
      });

      const completed = yield* Deferred.make<Compat.CompleteElicitationNotification>();
      yield* acp.handleElicitationComplete((done) => Deferred.succeed(completed, done).pipe(Effect.asVoid));
      yield* send(input, notification("session/elicitation/complete", { elicitationId: "legacy-login" }));
      assert.deepEqual(yield* Deferred.await(completed), { elicitationId: "legacy-login" });

      const promptFiber = yield* Effect.forkScoped(
        acp.agent.prompt({ sessionId: "native-session-1", prompt: [{ type: "text", text: "hello" }] })
      );
      const prompt = yield* takeRequest(output);
      assert.equal(prompt.method, "session/prompt");
      yield* sendAll(input, [
        notification("session/update", {
          sessionId: "native-session-1",
          update: {
            sessionUpdate: "available_commands_update",
            availableCommands: [{ name: "review", description: "Review changes", input: { hint: "scope" } }],
          },
        }),
        result(prompt.id, { stopReason: "end_turn" }),
      ]);
      assert.deepEqual(yield* Fiber.join(promptFiber), { stopReason: "end_turn" });
      assert.deepEqual(yield* Ref.get(updates), [
        {
          sessionId: "native-session-1",
          update: {
            sessionUpdate: "available_commands_update",
            availableCommands: [
              { name: "review", description: "Review changes", input: { type: "text", hint: "scope" } },
            ],
          },
        },
      ]);

      const logout = yield* exchange(input, output, acp.agent.logout({}));
      assert.equal(logout.outbound.method, "logout");
    })
  )
);

it.effect(
  "sends a pure generation-1 initialize when pinned to v1 and fails generation-2-only methods locally",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio, { protocolGeneration: "v1" });

    const initialized = yield* exchange(input, output, acp.agent.initialize({ ...v1Initialize, protocolVersion: 2 }), {
      protocolVersion: 1,
      agentCapabilities: { loadSession: true },
    });
    assert.deepEqual(initialized.outbound.params, { ...v1Initialize, protocolVersion: 1 });
    assert.equal(initialized.answer.protocolVersion, 1);

    // Generation 1 defines these methods, but the client fails them locally (t3code parity).
    yield* expectMethodNotFound(acp.agent.deleteSession({ sessionId: "session-1" }));
    yield* expectMethodNotFound(acp.agent.listProviders({}));
    yield* expectMethodNotFound(
      acp.agent.setProvider({ providerId: "provider", apiType: "openai", baseUrl: "https://x.test" })
    );
    yield* expectMethodNotFound(acp.agent.disableProvider({ providerId: "provider" }));
    assert.equal(yield* Queue.size(output), 0);

    const mode = yield* exchange(input, output, acp.agent.setSessionMode({ sessionId: "session-1", modeId: "ask" }));
    assert.equal(mode.outbound.method, "session/set_mode");
  })
);

it.effect(
  "sends a pure generation-2 initialize with the default client info when pinned to v2",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio, { protocolGeneration: "v2" });

    const initialized = yield* exchange(
      input,
      output,
      acp.agent.initialize({ protocolVersion: 1 }),
      v2InitializeResult
    );
    assert.deepEqual(initialized.outbound.params, {
      protocolVersion: 2,
      info: { name: "@beep/acp", version: "unknown" },
      capabilities: {},
    });
    assert.equal(initialized.answer.agentInfo?.name, "mock-agent");
    const providers = yield* exchange(input, output, acp.agent.listProviders({}), { providers: [] });
    assert.deepEqual([providers.outbound.method, providers.answer], ["providers/list", { providers: [] }]);
    const provider = { providerId: "provider", apiType: "openai", baseUrl: "https://x.test" };
    const configured = yield* exchange(input, output, acp.agent.setProvider(provider));
    assert.deepEqual([configured.outbound.method, configured.outbound.params], ["providers/set", provider]);
    const disabled = yield* exchange(input, output, acp.agent.disableProvider({ providerId: "provider" }));
    assert.deepEqual(
      [disabled.outbound.method, disabled.outbound.params],
      ["providers/disable", { providerId: "provider" }]
    );
    const deleted = yield* exchange(input, output, acp.agent.deleteSession({ sessionId: "session-1" }));
    assert.deepEqual(
      [deleted.outbound.method, deleted.outbound.params],
      ["session/delete", { sessionId: "session-1" }]
    );
    yield* expectMethodNotFound(acp.agent.setSessionMode({ sessionId: "session-1", modeId: "ask" }));
    assert.equal(yield* Queue.size(output), 0);
  })
);

// Negotiation and the v2 pin send `protocolVersion: 2`; only the v1 pin sends 1, and only
// negotiation keeps the generation-1 `clientCapabilities` beside the generation-2 fields.
it.effect.prop(
  "sends the initialize request of the configured generation mode",
  [Arbitrary.schema(AcpClient.AcpClientProtocolGeneration)],
  Effect.fnUntraced(function* ([protocolGeneration]) {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio, { protocolGeneration });
    const { outbound } = yield* exchange(input, output, acp.agent.initialize(v1Initialize), v2InitializeResult);
    const params = decodeProtocolVersion(outbound.params);
    assert.deepEqual(
      O.map(params, ({ protocolVersion }) => protocolVersion),
      O.some(AcpClient.AcpClientProtocolGeneration.is.v1(protocolGeneration) ? 1 : 2)
    );
    assert.equal(
      isNegotiatingInitialize(outbound.params),
      AcpClient.AcpClientProtocolGeneration.is.negotiate(protocolGeneration)
    );
  }),
  { arbitrary: fcRuns(12) }
);

it.effect(
  "preserves exact ids for parallel requests with identical payloads",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const contexts = yield* Ref.make<ReadonlyArray<AcpProtocol.AcpRequestContext>>([]);
    yield* acp.handleRequestPermission((_request, context) =>
      Ref.update(contexts, A.append(context)).pipe(Effect.as(allow))
    );

    yield* sendAll(input, [
      request("permission-a", "session/request_permission", toolCallPermission),
      request("permission-b", "session/request_permission", toolCallPermission),
    ]);
    const responses = yield* Effect.all([takeResponse(output), takeResponse(output)]);
    assert.sameMembers(
      A.map(responses, ({ id }) => id),
      ["permission-a", "permission-b"]
    );
    assert.sameDeepMembers(
      A.map(yield* Ref.get(contexts), ({ method, requestId }) => ({ method, requestId })),
      [
        { method: "session/request_permission", requestId: "permission-a" },
        { method: "session/request_permission", requestId: "permission-b" },
      ]
    );
  })
);

it.effect(
  "gives a generation-2 permission request the tool call of its subject",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const received = yield* Deferred.make<Compat.RequestPermissionRequest>();
    yield* acp.handleRequestPermission((permission) => Deferred.succeed(received, permission).pipe(Effect.as(allow)));

    yield* send(input, request(9, "session/request_permission", toolCallPermission));
    assert.deepEqual(yield* takeResponse(output), { id: 9, result: allow });
    assert.deepEqual((yield* Deferred.await(received)).toolCall, { toolCallId: "shared-tool", title: "Shared tool" });
  })
);

it.effect(
  "routes a standard prompt response after extension notifications in the same batch",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const promptFiber = yield* Effect.forkScoped(
      acp.agent.prompt({ sessionId: "agent-session-1", prompt: [{ type: "text", text: "run the ls command" }] })
    );
    const prompt = yield* takeRequest(output);
    const meta = { sessionId: "agent-session-1", requestId: "prompt-1", promptId: "prompt-1", modelId: "model-1" };

    yield* sendAll(input, [
      notification("x/queue/changed", { sessionId: "agent-session-1", entries: [] }),
      notification("x/session/prompt_complete", {
        sessionId: "agent-session-1",
        promptId: "prompt-1",
        stopReason: "end_turn",
        agentResult: null,
      }),
      notification("x/sessions/changed", {
        upserted: [{ sessionId: "agent-session-1", activity: "idle" }],
        removed: [],
      }),
      result(prompt.id, {}),
      idle("agent-session-1", { _meta: meta }),
    ]);

    assert.deepEqual(yield* Fiber.join(promptFiber), { stopReason: "end_turn", _meta: meta });
  })
);

it.effect(
  "rejects a second prompt on a session while the first one runs",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const prompt = { sessionId: "session-1", prompt: [{ type: "text" as const, text: "hello" }] };
    const first = yield* Effect.forkScoped(acp.agent.prompt(prompt));
    const firstRequest = yield* takeRequest(output);

    const rejected = yield* expectFailure(acp.agent.prompt(prompt));
    assert.equal(rejected.message, "ACP session 'session-1' already has an active prompt.");
    assert.equal(yield* Queue.size(output), 0);

    yield* sendAll(input, [result(firstRequest.id, {}), idle("session-1")]);
    assert.deepEqual(yield* Fiber.join(first), { stopReason: "end_turn" });

    // The session accepts a new prompt once the first one completed.
    const second = yield* Effect.forkScoped(acp.agent.prompt(prompt));
    const secondRequest = yield* takeRequest(output);
    yield* sendAll(input, [result(secondRequest.id, {}), idle("session-1", { stopReason: "cancelled" })]);
    assert.deepEqual(yield* Fiber.join(second), { stopReason: "cancelled" });
  })
);

// `usage` and `error` on a v2 idle are unstable draft fields. An idle whose only defect is one of
// them must still end the prompt instead of being dropped as undecodable.
it.effect(
  "ends a generation-2 prompt when the idle update carries an undecodable usage or error",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const prompt = { sessionId: "session-1", prompt: [{ type: "text" as const, text: "hello" }] };

    const first = yield* Effect.forkScoped(acp.agent.prompt(prompt));
    const firstRequest = yield* takeRequest(output);
    yield* sendAll(input, [result(firstRequest.id, {}), idle("session-1", { usage: { totalTokens: 1 } })]);
    assert.deepEqual(yield* Fiber.join(first), { stopReason: "end_turn" });

    const second = yield* Effect.forkScoped(acp.agent.prompt(prompt));
    const secondRequest = yield* takeRequest(output);
    yield* sendAll(input, [
      result(secondRequest.id, {}),
      idle("session-1", { stopReason: "cancelled", error: "not an error object", usage: "unknown" }),
    ]);
    assert.deepEqual(yield* Fiber.join(second), { stopReason: "cancelled" });
  })
);

// The closed v1.26 result rejects a partial usage and a custom stop reason; the open generation-2
// acknowledgement member must not swallow such a result and report `end_turn`.
it.effect(
  "keeps the stop reason of a generation-1 prompt result outside the v1.26 schema",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio, { protocolGeneration: "v1" });
    const prompt = { sessionId: "session-1", prompt: [{ type: "text" as const, text: "hello" }] };
    const usage = { totalTokens: 3, inputTokens: 1, outputTokens: 2 };

    const cancelled = yield* exchange(input, output, acp.agent.prompt(prompt), {
      stopReason: "cancelled",
      usage: { inputTokens: 1, outputTokens: 2 },
    });
    assert.deepEqual(cancelled.answer, { stopReason: "cancelled" });
    const custom = yield* exchange(input, output, acp.agent.prompt(prompt), { stopReason: "_vendor_limited", usage });
    assert.deepEqual(custom.answer, { stopReason: "_vendor_limited", usage });
    const missing = yield* exchange(input, output, acp.agent.prompt(prompt), {});
    assert.deepEqual(missing.answer, { stopReason: "end_turn" });
  })
);

// A caller may re-send content the client delivered; the agent gets the original block, never the
// sentinel, on either generation's prompt path.
A.forEach(["v1", "v2"] as const, (protocolGeneration) =>
  it.effect(
    `sends a re-sent unknown content block as the original block on ${protocolGeneration}`,
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const acp = yield* AcpClient.make(stdio, { protocolGeneration });
      const chart = { type: "chart", points: [] };
      const text = { type: "text", text: "hi" } as const;
      const resent = Compat.UnknownContent.make({ type: Compat.ACP_UNKNOWN, originalType: "chart", raw: chart });

      const promptFiber = yield* Effect.forkScoped(
        acp.agent.prompt({ sessionId: "session-1", prompt: [text, resent] })
      );
      const outbound = yield* takeRequest(output);
      assert.deepEqual(outbound.params, { sessionId: "session-1", prompt: [text, chart] });
      yield* protocolGeneration === "v1"
        ? send(input, result(outbound.id, { stopReason: "end_turn" }))
        : sendAll(input, [result(outbound.id, {}), idle("session-1")]);
      assert.deepEqual(yield* Fiber.join(promptFiber), { stopReason: "end_turn" });

      // A sentinel without an original content block fails locally instead of reaching the agent.
      const opaque = Compat.UnknownContent.make({ type: Compat.ACP_UNKNOWN, originalType: "chart", raw: 5 });
      const rejected = yield* expectFailure(acp.agent.prompt({ sessionId: "session-1", prompt: [opaque] }));
      assert.equal(AcpError.AcpRequestError.is(rejected) ? rejected.code : 0, -32602);
      assert.equal(yield* Queue.size(output), 0);
    })
  )
);

it.effect(
  "fails a pending generation-2 prompt and later calls with the terminal error",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const terminated = yield* Deferred.make<AcpError.AcpError>();
    const acp = yield* AcpClient.make(stdio, {
      onTermination: (error) => Deferred.succeed(terminated, error).pipe(Effect.asVoid),
    });
    const promptFiber = yield* Effect.forkScoped(
      acp.agent.prompt({ sessionId: "session-1", prompt: [{ type: "text", text: "hello" }] })
    );
    // The agent acknowledges the turn, then its output ends before the idle update.
    yield* answerNext(input, output, {});
    yield* Queue.end(input);

    const terminal = yield* Deferred.await(terminated);
    assert.equal(terminal._tag, "AcpInputStreamEndedError");
    assert.strictEqual(yield* promptFiber.pipe(Fiber.join, expectFailure), terminal);
    assert.strictEqual(yield* expectFailure(acp.agent.listSessions({})), terminal);
    assert.strictEqual(yield* expectFailure(acp.agent.cancel({ sessionId: "session-1" })), terminal);
  })
);

it.effect(
  "keeps the method and protocol error of a failed agent call",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const fiber = yield* Effect.forkScoped(acp.agent.initialize(v1Initialize));
    const outbound = yield* takeRequest(output);
    yield* send(input, {
      jsonrpc: "2.0",
      id: outbound.id,
      error: { code: -32000, message: "Authentication required" },
    });

    const error = yield* fiber.pipe(Fiber.join, expectFailure);
    assert.isTrue(AcpError.AcpRequestError.is(error));
    if (AcpError.AcpRequestError.is(error)) {
      assert.equal(error.code, -32000);
      assert.equal(error.message, "Authentication required");
      assert.deepEqual(error.method, O.some("initialize"));
    }
  })
);

it.effect(
  "fails only its own call when the agent answers with an error tagged Defect",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const first = yield* Effect.forkScoped(acp.agent.listSessions({}));
    const firstRequest = yield* takeRequest(output);
    const second = yield* Effect.forkScoped(acp.agent.listSessions({}));
    const secondRequest = yield* takeRequest(output);
    // effect-rpc reads this envelope as a connection-level defect that fails every in-flight call.
    yield* send(input, {
      jsonrpc: "2.0",
      id: firstRequest.id,
      error: { _tag: "Defect", code: -32603, message: "peer defect", data: { boom: true } },
    });

    const error = yield* first.pipe(Fiber.join, expectFailure);
    assert.isTrue(AcpError.AcpRequestError.is(error));
    if (AcpError.AcpRequestError.is(error)) {
      assert.equal(error.code, -32603);
      assert.equal(error.message, "peer defect");
      assert.deepEqual(error.data, O.some({ boom: true }));
      assert.deepEqual(error.method, O.some("session/list"));
    }
    yield* send(input, result(secondRequest.id, { sessions: [] }));
    assert.deepEqual(yield* Fiber.join(second), { sessions: [] });
  })
);

it.effect(
  "replays buffered notifications to handlers registered after they arrive",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const typedRequests = yield* Ref.make<ReadonlyArray<unknown>>([]);
    const typedNotifications = yield* Ref.make<ReadonlyArray<unknown>>([]);
    yield* acp.handleExtRequest("x/typed_request", S.Struct({ message: S.String }), (payload) =>
      Ref.update(typedRequests, A.append<unknown>(payload)).pipe(
        Effect.as({ ok: true, echoedMessage: payload.message })
      )
    );
    yield* acp.handleExtNotification("x/typed_notification", S.Struct({ count: S.Finite }), (payload) =>
      Ref.update(typedNotifications, A.append<unknown>(payload))
    );

    yield* sendAll(input, [
      textChunk("session-1", "one"),
      notification("elicitation/complete", { elicitationId: "elicitation-1" }),
      notification("x/typed_notification", { count: 2 }),
      textChunk("session-1", "two"),
      request("typed-1", "x/typed_request", { message: "hello from typed request" }),
    ]);
    // The typed request is read after every earlier notification was dispatched.
    assert.deepEqual(yield* takeResponse(output), {
      id: "typed-1",
      result: { ok: true, echoedMessage: "hello from typed request" },
    });

    const updates = yield* Ref.make<ReadonlyArray<Compat.SessionNotification>>([]);
    const completions = yield* Ref.make<ReadonlyArray<Compat.CompleteElicitationNotification>>([]);
    yield* acp.handleSessionUpdate((update) => Ref.update(updates, A.append(update)));
    yield* acp.handleElicitationComplete((done) => Ref.update(completions, A.append(done)));

    assert.lengthOf(yield* Ref.get(updates), 2);
    assert.deepEqual(yield* Ref.get(completions), [{ elicitationId: "elicitation-1" }]);
    assert.deepEqual(yield* Ref.get(typedRequests), [{ message: "hello from typed request" }]);
    assert.deepEqual(yield* Ref.get(typedNotifications), [{ count: 2 }]);
  })
);

it.effect(
  "keeps only the newest 256 notifications buffered before a handler registers",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    yield* acp.handleExtRequest("x/sync", S.Unknown, () => Effect.succeed({}));

    yield* sendAll(input, [...A.makeBy(300, usageUpdate), request("sync", "x/sync", {})]);
    yield* takeResponse(output);

    const used = yield* Ref.make<ReadonlyArray<unknown>>([]);
    yield* acp.handleSessionUpdate(({ update }) =>
      Ref.update(used, A.append<unknown>(update.sessionUpdate === "usage_update" ? update.used : undefined))
    );
    const replayed = yield* Ref.get(used);
    assert.lengthOf(replayed, 256);
    assert.deepEqual([A.head(replayed), A.last(replayed)], [O.some(44), O.some(299)]);
  })
);

it.effect(
  "projects future content and session-update variants onto the unknown sentinel",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const updates = yield* Queue.unbounded<Compat.SessionNotification>();
    yield* acp.handleSessionUpdate((update) => Queue.offer(updates, update).pipe(Effect.asVoid));
    yield* exchange(input, output, acp.agent.initialize(v1Initialize), v2InitializeResult);

    yield* sendAll(input, [
      notification("session/update", {
        sessionId: "session-1",
        update: {
          sessionUpdate: "agent_message_chunk",
          messageId: "future-content",
          content: { type: "chart", points: [] },
        },
      }),
      notification("session/update", {
        sessionId: "session-1",
        update: { sessionUpdate: "timeline_update", entries: [] },
      }),
    ]);

    assert.deepEqual((yield* Queue.take(updates)).update, {
      sessionUpdate: "agent_message_chunk",
      messageId: "future-content",
      content: { type: Compat.ACP_UNKNOWN, originalType: "chart", raw: { type: "chart", points: [] } },
    });
    assert.deepEqual((yield* Queue.take(updates)).update, {
      sessionUpdate: Compat.ACP_UNKNOWN,
      originalSessionUpdate: "timeline_update",
      raw: { sessionUpdate: "timeline_update", entries: [] },
    });
  })
);

it.effect(
  "answers generation-1 file-system and terminal requests, mapping void results to {}",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    yield* acp.handleReadTextFile(() => Effect.succeed({ content: "file text" }));
    yield* acp.handleWriteTextFile(() => Effect.void);
    yield* acp.handleTerminalKill(() => Effect.void);
    yield* acp.handleTerminalRelease(() => Effect.void);

    const terminal = { sessionId: "session-1", terminalId: "terminal-1" };
    yield* send(input, request(1, "fs/read_text_file", { sessionId: "session-1", path: "/work/a.txt" }));
    assert.deepEqual(yield* takeResponse(output), { id: 1, result: { content: "file text" } });
    yield* send(input, request(2, "fs/write_text_file", { sessionId: "session-1", path: "/work/a.txt", content: "x" }));
    assert.deepEqual(yield* takeResponse(output), { id: 2, result: {} });
    yield* send(input, request(3, "terminal/kill", terminal));
    assert.deepEqual(yield* takeResponse(output), { id: 3, result: {} });
    yield* send(input, request(4, "terminal/release", terminal));
    assert.deepEqual(yield* takeResponse(output), { id: 4, result: {} });
    // No terminal/create handler is registered.
    yield* send(input, request(5, "terminal/create", { sessionId: "session-1", command: "ls" }));
    assert.equal((yield* takeError(output)).error.code, -32601);
  })
);

it.effect(
  "serves MCP-over-ACP message requests and sends MCP notifications to the agent",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const received = yield* Deferred.make<Compat.MessageMcpRequest>();
    yield* acp.handleMcpMessage((message) =>
      Deferred.succeed(received, message).pipe(Effect.as({ result: { tools: [] } }))
    );
    const params = { serverId: "test-server", requestId: "mcp-1", method: "tools/list" };

    yield* send(input, request(1, "mcp/message", params));
    assert.deepEqual(yield* takeResponse(output), { id: 1, result: { result: { tools: [] } } });
    assert.deepEqual(yield* Deferred.await(received), params);
    // schema-v2.0.0-alpha.9 and schema-v1.26.0 removed `mcp/connect` and `mcp/disconnect`.
    yield* send(input, request(2, "mcp/connect", { serverId: "test-server" }));
    assert.equal((yield* takeError(output)).error.code, -32601);

    const progress = { serverId: "test-server", requestId: "mcp-1", method: "notifications/progress" };
    yield* acp.agent.notifyMcp(progress);
    assert.deepEqual(yield* takeNotification(output), { method: "mcp/message", params: progress });
  })
);

const elicitationForm = {
  sessionId: "session-1",
  mode: "form",
  message: "Continue?",
  requestedSchema: {
    type: "object",
    properties: { choice: { type: "string" } },
    required: ["choice"],
  },
};

A.forEach(["accept", "decline", "cancel"] as const, (action) =>
  A.forEach(["elicitation/create", "session/elicitation"], (method) =>
    it.effect(
      `answers ${method} with the ${action} result in the method's shape`,
      Effect.fnUntraced(function* () {
        const { stdio, input, output } = yield* makeInMemoryStdio();
        const acp = yield* AcpClient.make(stdio);
        const answer: Compat.CreateElicitationResponse =
          action === "accept" ? { action, content: { choice: "yes" } } : { action };
        const response = { ...answer, _meta: { trace: "fixture" } };
        const received = yield* Deferred.make<Compat.CreateElicitationRequest>();
        yield* acp.handleElicitation((question) => Deferred.succeed(received, question).pipe(Effect.as(response)));

        yield* send(input, request(71, method, elicitationForm));
        assert.deepEqual(yield* takeResponse(output), {
          id: 71,
          result: method === "elicitation/create" ? response : { action: answer, _meta: response._meta },
        });
        assert.deepEqual(yield* Deferred.await(received), elicitationForm);
      })
    )
  )
);

A.forEach(["elicitation/complete", "session/elicitation/complete"], (method) =>
  it.effect(
    `delivers ${method} notifications to the completion handler`,
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const acp = yield* AcpClient.make(stdio);
      const received = yield* Deferred.make<Compat.CompleteElicitationNotification>();
      yield* acp.handleElicitationComplete((done) => Deferred.succeed(received, done).pipe(Effect.asVoid));
      yield* send(input, notification(method, { elicitationId: "elicitation-1" }));
      assert.deepEqual(yield* Deferred.await(received), { elicitationId: "elicitation-1" });
    })
  )
);

it.effect(
  "rejects a malformed elicitation/create with -32602 without calling the handler",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const calls = yield* Ref.make(0);
    yield* acp.handleElicitation(() => Ref.update(calls, (count) => count + 1).pipe(Effect.as({ action: "cancel" })));

    yield* send(input, request(73, "elicitation/create", { ...elicitationForm, message: 123 }));
    const rejected = yield* takeError(output);
    assert.equal(rejected.error.code, -32602);
    assert.notInclude(rejected.error.message, "123");
    assert.equal(yield* Ref.get(calls), 0);
  })
);

it.effect(
  "answers elicitation/create with -32601 when no handler is registered",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    yield* AcpClient.make(stdio);
    yield* send(input, request(74, "elicitation/create", elicitationForm));
    assert.equal((yield* takeError(output)).error.code, -32601);
  })
);

it.effect(
  "applies transformSessionUpdate to the normalized update before handlers and raw notifications",
  Effect.fnUntraced(function* () {
    const { stdio, input } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio, {
      transformSessionUpdate: (update) => ({ ...update, sessionId: `seen:${update.sessionId}` }),
    });
    const received = yield* Deferred.make<string>();
    yield* acp.handleSessionUpdate((update) => Deferred.succeed(received, update.sessionId).pipe(Effect.asVoid));
    yield* send(input, textChunk("session-1", "hi"));
    assert.equal(yield* Deferred.await(received), "seen:session-1");
  })
);

it.effect(
  "routes generation-2 agent methods to their generation-2 wire methods and shapes",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio, { protocolGeneration: "v2" });
    const wire = Effect.fnUntraced(function* <A>(call: Effect.Effect<A, AcpError.AcpError>, value: unknown = {}) {
      const { answer, outbound } = yield* exchange(input, output, call, value);
      return { answer, call: [outbound.method, outbound.params] };
    });
    const session = { sessionId: "session-1", cwd: "/work" };
    const mcpServers = [{ name: "fixture", command: "fixture-only", args: [], env: [] }];
    const v2McpServers = [{ name: "fixture", command: "fixture-only", args: [], env: [], type: "stdio" }];

    assert.deepEqual((yield* wire(acp.agent.authenticate({ methodId: "oauth" }))).call, [
      "auth/login",
      { methodId: "oauth" },
    ]);
    assert.deepEqual((yield* wire(acp.agent.logout({}))).call, ["auth/logout", {}]);

    // `session/load` becomes a `session/resume` that replays from the start; `session/resume`
    // keeps its own replay point.
    const loaded = yield* wire(acp.agent.loadSession({ ...session, mcpServers }));
    assert.deepEqual(loaded.call, [
      "session/resume",
      { ...session, mcpServers: v2McpServers, replayFrom: { type: "start" } },
    ]);
    assert.deepEqual(loaded.answer, {});
    const resumed = yield* wire(acp.agent.resumeSession({ ...session, mcpServers }));
    assert.deepEqual(resumed.call, ["session/resume", { ...session, mcpServers: v2McpServers }]);

    const forked = yield* wire(acp.agent.forkSession({ ...session, mcpServers }), {
      sessionId: "fork-1",
      _meta: { trace: "fork" },
    });
    assert.deepEqual(forked.call, ["session/fork", { ...session, mcpServers: v2McpServers }]);
    assert.deepEqual(forked.answer, { sessionId: "fork-1", _meta: { trace: "fork" } });

    assert.deepEqual((yield* wire(acp.agent.closeSession({ sessionId: "session-1" }))).call, [
      "session/close",
      { sessionId: "session-1" },
    ]);
    assert.deepEqual((yield* wire(acp.agent.deleteSession({ sessionId: "session-1" }))).call, [
      "session/delete",
      { sessionId: "session-1" },
    ]);

    // Generation 2 requires the `type` discriminator on an id-valued config option.
    const configured = yield* wire(
      acp.agent.setSessionConfigOption({ sessionId: "session-1", configId: "mode", value: "fast" }),
      { configOptions: [] }
    );
    assert.deepEqual(configured.call, [
      "session/set_config_option",
      { sessionId: "session-1", configId: "mode", value: "fast", type: "id" },
    ]);
    assert.deepEqual(configured.answer, { configOptions: [] });

    const providers = yield* wire(acp.agent.listProviders({}), { providers: [] });
    assert.deepEqual([providers.call, providers.answer], [["providers/list", {}], { providers: [] }]);
    const provider: Compat.SetProviderRequest = {
      providerId: "provider",
      apiType: "openai",
      baseUrl: "https://x.test",
    };
    assert.deepEqual((yield* wire(acp.agent.setProvider(provider))).call, ["providers/set", provider]);
    assert.deepEqual((yield* wire(acp.agent.disableProvider({ providerId: "provider" }))).call, [
      "providers/disable",
      { providerId: "provider" },
    ]);
  })
);

it.effect(
  "sends generation-1 fork, close and config-option requests when pinned to v1",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio, { protocolGeneration: "v1" });
    const fork = { sessionId: "session-1", cwd: "/work" };

    const forked = yield* exchange(input, output, acp.agent.forkSession(fork), { sessionId: "fork-1" });
    assert.deepEqual([forked.outbound.method, forked.outbound.params], ["session/fork", fork]);
    assert.deepEqual(forked.answer, { sessionId: "fork-1" });

    const closed = yield* exchange(input, output, acp.agent.closeSession({ sessionId: "session-1" }));
    assert.deepEqual([closed.outbound.method, closed.outbound.params], ["session/close", { sessionId: "session-1" }]);

    const option = { sessionId: "session-1", configId: "mode", value: "fast" };
    const configured = yield* exchange(input, output, acp.agent.setSessionConfigOption(option), { configOptions: [] });
    // The compat payload union tries the generation-2 member first, so an id-valued option keeps
    // its fields and also carries the `type: "id"` discriminator on generation 1.
    assert.equal(configured.outbound.method, "session/set_config_option");
    assert.deepInclude(configured.outbound.params, option);
    assert.deepEqual(configured.answer, { configOptions: [] });
  })
);

it.effect(
  "frees the session of a generation-2 prompt the agent rejects",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const updates = yield* Queue.unbounded<Compat.SessionNotification>();
    yield* acp.handleSessionUpdate((update) => Queue.offer(updates, update).pipe(Effect.asVoid));
    const prompt = { sessionId: "session-1", prompt: [{ type: "text" as const, text: "hello" }] };

    const rejectedFiber = yield* Effect.forkScoped(acp.agent.prompt(prompt));
    const rejectedRequest = yield* takeRequest(output);
    yield* send(input, {
      jsonrpc: "2.0",
      id: rejectedRequest.id,
      error: { code: -32000, message: "Session is busy" },
    });
    const rejected = yield* rejectedFiber.pipe(Fiber.join, expectFailure);
    assert.equal(AcpError.AcpRequestError.is(rejected) ? rejected.code : 0, -32000);

    // No prompt is pending, so a stray idle update only reaches the session-update handlers.
    yield* send(input, idle("session-1"));
    assert.deepEqual((yield* Queue.take(updates)).update, {
      sessionUpdate: "state_update",
      state: "idle",
      stopReason: "end_turn",
    });

    // The rejected turn released the session, so the next prompt is admitted.
    const next = yield* Effect.forkScoped(acp.agent.prompt(prompt));
    const nextRequest = yield* takeRequest(output);
    yield* sendAll(input, [result(nextRequest.id, {}), idle("session-1")]);
    assert.deepEqual(yield* Fiber.join(next), { stopReason: "end_turn" });
  })
);

it.effect(
  "delivers extension notifications without a registered handler to the unknown handler",
  Effect.fnUntraced(function* () {
    const { stdio, input } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const known = yield* Queue.unbounded<unknown>();
    const unknown = yield* Queue.unbounded<readonly [string, unknown]>();
    yield* acp.handleExtNotification("x/known", S.Struct({ count: S.Finite }), (payload) =>
      Queue.offer(known, payload).pipe(Effect.asVoid)
    );
    yield* acp.handleUnknownExtNotification((method, params) =>
      Queue.offer(unknown, [method, params]).pipe(Effect.asVoid)
    );

    yield* sendAll(input, [notification("x/unregistered", { hello: "world" }), notification("x/known", { count: 1 })]);
    assert.deepEqual(yield* Queue.take(unknown), ["x/unregistered", { hello: "world" }]);
    assert.deepEqual(yield* Queue.take(known), { count: 1 });
    assert.equal(yield* Queue.size(unknown), 0);
  })
);

it.effect(
  "fails calls with the terminal error when the connection ends without an onTermination hook",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const acp = yield* AcpClient.make(stdio);
    const pending = yield* Effect.forkScoped(acp.agent.listSessions({}));
    yield* takeRequest(output);
    yield* Queue.end(input);

    const terminal = yield* pending.pipe(Fiber.join, expectFailure);
    assert.equal(terminal._tag, "AcpInputStreamEndedError");
    assert.strictEqual(yield* expectFailure(acp.agent.listSessions({})), terminal);
  })
);

// A child agent that answers every request with an empty session list.
const echoAgentScript = A.join(
  [
    'let buffer = "";',
    'process.stdin.on("data", (chunk) => {',
    "  buffer += chunk;",
    '  for (let at = buffer.indexOf("\\n"); at >= 0; at = buffer.indexOf("\\n")) {',
    "    const message = JSON.parse(buffer.slice(0, at));",
    "    buffer = buffer.slice(at + 1);",
    '    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { sessions: [] } }) + "\\n");',
    "  }",
    "});",
  ],
  "\n"
);
// A child agent that reports a fatal error on stderr and exits with `code`.
const crashingAgentScript = (code: number) =>
  `process.stderr.write("fatal: agent config is broken\\n", () => process.exit(${code}));`;

const spawnChildAgent = Effect.fnUntraced(function* (script: string) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return yield* spawner.spawn(
    ChildProcess.make("bun", ["-e", script], {
      shell: currentHostPlatform === "win32",
      stderr: "pipe",
      stdin: "pipe",
      stdout: "pipe",
    })
  );
});

// The spawner reads the filesystem only to check that an explicit cwd is accessible; every child
// agent here runs in the test's own working directory.
const SpawnerLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provide(Layer.mergeAll(FileSystem.layerNoop({ access: () => Effect.void }), NodePath.layer))
);

it.layer(SpawnerLayer, { timeout: "30 seconds" })("effect-acp client child-process layer", (it) => {
  it.effect(
    "talks to the child over its stdio, reading stdout through transformStdout",
    Effect.fnUntraced(function* () {
      const handle = yield* spawnChildAgent(echoAgentScript);
      yield* handle.stderr.pipe(Stream.runDrain, Effect.forkScoped);
      const chunks = yield* Ref.make(0);
      const acp = Context.get(
        yield* Layer.build(
          AcpClient.layerChildProcess({
            handle,
            transformStdout: Stream.tap(() => Ref.update(chunks, (count) => count + 1)),
          })
        ),
        AcpClient.AcpClient
      );
      const sessions = yield* acp.agent.listSessions({});
      assert.deepEqual(sessions, { sessions: [] });
      assert.isAtLeast(yield* Ref.get(chunks), 1);
    })
  );

  it.effect(
    "ends the connection with the child exit status and its stderr excerpt",
    Effect.fnUntraced(function* () {
      const handle = yield* spawnChildAgent(crashingAgentScript(3));
      const stderrTail = yield* collectStderrTail(handle.stderr);
      const terminated = yield* Deferred.make<AcpError.AcpError>();
      yield* Layer.build(
        AcpClient.layerChildProcess({
          handle,
          stderrTail,
          onTermination: (terminal) => Deferred.succeed(terminated, terminal).pipe(Effect.asVoid),
        })
      );
      const error = yield* Deferred.await(terminated);
      if (error._tag !== "AcpProcessExitedError") {
        return assert.fail("expected a process exit error");
      }
      assert.deepEqual(error.code, O.some(3));
      assert.include(
        O.getOrElse(error.stderr, () => ""),
        "fatal: agent config is broken"
      );
    })
  );

  it.effect(
    "ends the connection with the child exit status when no stderr collector is given",
    Effect.fnUntraced(function* () {
      const handle = yield* spawnChildAgent(crashingAgentScript(4));
      yield* handle.stderr.pipe(Stream.runDrain, Effect.forkScoped);
      const terminated = yield* Deferred.make<AcpError.AcpError>();
      yield* Layer.build(
        AcpClient.layerChildProcess({
          handle,
          onTermination: (terminal) => Deferred.succeed(terminated, terminal).pipe(Effect.asVoid),
        })
      );
      const error = yield* Deferred.await(terminated);
      if (error._tag !== "AcpProcessExitedError") {
        return assert.fail("expected a process exit error");
      }
      assert.deepEqual(error.code, O.some(4));
      assertNone(error.stderr);
    })
  );
});

// Each failing handler is answered on its own id (or dropped for a notification) and logged once;
// reading continues.
const errorLogs = A.empty<string>();
const errorCollector = Logger.make(({ logLevel, message }) => {
  if (logLevel === "Error") {
    A.appendInPlace(errorLogs, `${A.ensure(message)[0]}`);
  }
});

it.layer(Logger.layer([errorCollector]), { timeout: "10 seconds" })("effect-acp client handler isolation", (it) => {
  it.effect(
    "answers each request whose handler dies, and keeps reading",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const acp = yield* AcpClient.make(stdio);
      const bug = () => Effect.die(new Error("handler bug"));
      yield* acp.handleRequestPermission(bug);
      yield* acp.handleExtRequest("x/dies", S.Unknown, bug);
      yield* acp.handleExtNotification("x/notification-dies", S.Unknown, bug);
      yield* acp.handleSessionUpdate(bug);
      const updates = yield* Queue.unbounded<string>();
      yield* acp.handleSessionUpdate((update) => Queue.offer(updates, update.sessionId).pipe(Effect.asVoid));
      yield* acp.handleExtRequest("x/test", S.Struct({ hello: S.String }), () => Effect.succeed({ ok: true }));

      yield* send(input, request("permission-a", "session/request_permission", toolCallPermission));
      const died = yield* takeResponse(output);
      assert.equal(died.id, "permission-a");
      assert.isDefined(died.error);

      yield* send(input, request("ext-a", "x/dies", {}));
      assert.equal((yield* takeError(output)).id, "ext-a");

      yield* sendAll(input, [notification("x/notification-dies", {}), textChunk("session-1", "hi")]);
      assert.equal(yield* Queue.take(updates), "session-1");

      yield* send(input, request("ext-b", "x/test", { hello: "world" }));
      assert.deepEqual(yield* takeResponse(output), { id: "ext-b", result: { ok: true } });

      assert.deepEqual(A.sort(errorLogs, Str.Order), [
        "ACP extension request handler failed for 'x/dies'",
        "ACP notification handler failed",
        "ACP notification handler failed",
        "ACP request handler failed for 'session/request_permission'",
      ]);
    })
  );
});
