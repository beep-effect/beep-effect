// Agent tests for `@beep/acp/agent` (generation 2). The core-request, id and dying-handler cases
// port t3code effect-acp `agent.test.ts` (31dcc7c513); request contexts carry the raw JSON-RPC id
// instead of t3code's encoded identity string. The property, layer smoke, resume-dispatch,
// management, MCP-over-ACP and cancel-isolation cases are beep-specific.
import * as AcpAgent from "@beep/acp/agent";
import * as AcpError from "@beep/acp/errors";
import * as AcpProtocol from "@beep/acp/protocol";
import * as AcpSchema from "@beep/acp/schema";
import { $AcpId } from "@beep/identity/packages";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { assert } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { encodeJsonl, jsonRpcNotification, jsonRpcRequest, jsonRpcResponse, makeInMemoryStdio } from "./helpers.ts";

const RequestPermissionRequest = jsonRpcRequest("session/request_permission", AcpSchema.RequestPermissionRequest);
const InitializeRequest = jsonRpcRequest("initialize", AcpSchema.InitializeRequest);
const InitializeResponse = jsonRpcResponse(AcpSchema.InitializeResponse);
const RequestPermissionResponse = jsonRpcResponse(AcpSchema.RequestPermissionResponse);
const SessionCancelNotification = jsonRpcNotification("session/cancel", AcpSchema.CancelSessionNotification);
const ExtPingNotification = jsonRpcNotification("x/ping", S.Struct({ count: S.Finite }));
const ExtRequest = jsonRpcRequest("x/test", S.Struct({ hello: S.String }));
const ExtResponse = jsonRpcResponse(S.Struct({ ok: S.Boolean }));
const ResumeSessionRequest = jsonRpcRequest("session/resume", AcpSchema.ResumeSessionRequest);
const ResumeSessionResponse = jsonRpcResponse(AcpSchema.ResumeSessionResponse);
const DeleteSessionRequest = jsonRpcRequest("session/delete", AcpSchema.DeleteSessionRequest);
const ListProvidersRequest = jsonRpcRequest("providers/list", AcpSchema.ListProvidersRequest);
const ListProvidersResponse = jsonRpcResponse(AcpSchema.ListProvidersResponse);
const EmptyResponse = jsonRpcResponse(S.Struct({}));
const MessageMcpRequest = jsonRpcRequest("mcp/message", AcpSchema.MessageMcpRequest);
const MessageMcpResponse = jsonRpcResponse(AcpSchema.MessageMcpResponse);
const MessageMcpNotification = jsonRpcNotification("mcp/message", AcpSchema.MessageMcpNotification);
const ErrorResponse = S.Struct({
  error: S.Struct({ code: S.Finite, message: S.String }),
  id: S.Union([S.Finite, S.String]),
  jsonrpc: S.tag("2.0"),
});

const decodeRequestPermissionRequest = S.decodeEffect(S.fromJsonString(RequestPermissionRequest));
const decodeInitializeResponse = S.decodeEffect(S.fromJsonString(InitializeResponse));
const decodeExtRequest = S.decodeEffect(S.fromJsonString(ExtRequest));
const decodeExtResponse = S.decodeEffect(S.fromJsonString(ExtResponse));
const decodeResumeSessionResponse = S.decodeEffect(S.fromJsonString(ResumeSessionResponse));
const decodeListProvidersResponse = S.decodeEffect(S.fromJsonString(ListProvidersResponse));
const decodeEmptyResponse = S.decodeEffect(S.fromJsonString(EmptyResponse));
const decodeMessageMcpRequest = S.decodeEffect(S.fromJsonString(MessageMcpRequest));
const decodeErrorResponse = S.decodeEffect(S.fromJsonString(ErrorResponse));
const encodeInitializeResponse = S.encodeEffect(S.fromJsonString(InitializeResponse));
const encodeSessionCancelNotification = S.encodeEffect(S.fromJsonString(SessionCancelNotification));
const decodeSessionCancelNotification = S.decodeEffect(S.fromJsonString(SessionCancelNotification));
const InitializeResponseArbitrary = Arbitrary.schema(InitializeResponse);
const SessionCancelNotificationArbitrary = Arbitrary.schema(SessionCancelNotification);

const mockAgentInitializeResponse = {
  protocolVersion: 2,
  capabilities: {},
  info: { name: "mock-agent", version: "0.0.0" },
};

const permissionRequest: AcpSchema.RequestPermissionRequest = {
  sessionId: "session-1",
  title: "Allow mock action",
  subject: {
    type: "tool_call",
    toolCall: { toolCallId: "tool-1", title: "Allow mock action" },
  },
  options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
};

const initializeRequest = (id: number) =>
  encodeJsonl(InitializeRequest, {
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: 2,
      capabilities: {},
      info: { name: "test-client", version: "0.0.0" },
    },
    headers: [],
  });

const $I = $AcpId.create("test/agent.test");
class AgentTransport extends Context.Service<AgentTransport, Effect.Success<ReturnType<typeof makeInMemoryStdio>>>()(
  $I`AgentTransport`
) {}

// Each single-case registration owns a fresh transport and public agent layer.
const agentFixtureLayer = Layer.unwrap(
  Effect.map(makeInMemoryStdio(), (transport) =>
    Layer.merge(AcpAgent.layer({ stdio: transport.stdio }), Layer.succeed(AgentTransport, transport))
  )
);

it("constructs the stdio agent layer with default options", () => {
  assert.isDefined(AcpAgent.layerStdio());
});

it.effect.prop(
  "round-trips schema-derived agent JSON-RPC responses and notifications through JSON boundaries",
  [InitializeResponseArbitrary, SessionCancelNotificationArbitrary],
  Effect.fnUntraced(function* ([initializeResponse, cancelNotification]) {
    const encodedInitializeResponse = yield* encodeInitializeResponse(initializeResponse);
    const decodedInitializeResponse = yield* decodeInitializeResponse(encodedInitializeResponse);
    const encodedInitializeResponse1 = yield* encodeInitializeResponse(decodedInitializeResponse);
    assert.equal(encodedInitializeResponse1, encodedInitializeResponse);

    const encodedCancelNotification = yield* encodeSessionCancelNotification(cancelNotification);
    const decodedCancelNotification = yield* decodeSessionCancelNotification(encodedCancelNotification);
    const encodedSessionCancelNotification = yield* encodeSessionCancelNotification(decodedCancelNotification);
    assert.equal(encodedSessionCancelNotification, encodedCancelNotification);
  }),
  { arbitrary: fcRuns(25) }
);

it.layer(Layer.fresh(agentFixtureLayer), { timeout: "10 seconds" })((it) => {
  it.effect(
    "handles core agent requests and outbound client requests",
    Effect.fnUntraced(function* () {
      const { input, output } = yield* AgentTransport;
      const cancelNotifications = yield* Ref.make<ReadonlyArray<string>>([]);
      const extNotifications = yield* Ref.make<ReadonlyArray<number>>([]);
      const requestContexts = yield* Ref.make<ReadonlyArray<AcpProtocol.AcpRequestContext>>([]);
      const cancelReceived = yield* Deferred.make<void>();
      const extReceived = yield* Deferred.make<void>();
      const agent = yield* AcpAgent.AcpAgent;

      yield* agent.handleInitialize((_request, requestContext) =>
        Ref.update(requestContexts, (current) => [...current, requestContext]).pipe(
          Effect.as(mockAgentInitializeResponse)
        )
      );
      yield* agent.handleExtRequest("x/test", S.Struct({ hello: S.String }), (_payload, requestContext) =>
        Ref.update(requestContexts, (current) => [...current, requestContext]).pipe(Effect.as({ ok: true }))
      );
      yield* agent.handleCancel((notification) =>
        Ref.update(cancelNotifications, (current) => [...current, notification.sessionId]).pipe(
          Effect.andThen(Deferred.succeed(cancelReceived, undefined))
        )
      );
      yield* agent.handleExtNotification("x/ping", S.Struct({ count: S.Finite }), (payload) =>
        Ref.update(extNotifications, (current) => [...current, payload.count]).pipe(
          Effect.andThen(Deferred.succeed(extReceived, undefined))
        )
      );

      const permissionFiber = yield* agent.client.requestPermission(permissionRequest).pipe(Effect.forkScoped);
      const take2 = yield* Queue.take(output);
      const outbound = yield* decodeRequestPermissionRequest(take2);
      assert.equal(outbound.jsonrpc, "2.0");
      assert.equal(outbound.method, "session/request_permission");
      assert.deepStrictEqual(outbound.params, permissionRequest);
      assert.deepStrictEqual(outbound.headers, []);

      const encodedJsonl = yield* encodeJsonl(RequestPermissionResponse, {
        jsonrpc: "2.0",
        id: outbound.id,
        result: { outcome: { outcome: "selected", optionId: "allow" } },
      });
      yield* Queue.offer(input, encodedJsonl);
      assert.equal((yield* Fiber.join(permissionFiber)).outcome.outcome, "selected");

      const initializeRequest3 = yield* initializeRequest(2);
      yield* Queue.offer(input, initializeRequest3);
      const take43 = yield* Queue.take(output);
      const decodedInitializeResponse4 = yield* decodeInitializeResponse(take43);
      assert.deepStrictEqual(decodedInitializeResponse4, {
        jsonrpc: "2.0",
        id: 2,
        result: mockAgentInitializeResponse,
      });

      const encodedJsonl5 = yield* encodeJsonl(ExtRequest, {
        jsonrpc: "2.0",
        id: "extension-3",
        method: "x/test",
        params: { hello: "world" },
        headers: [],
      });
      yield* Queue.offer(input, encodedJsonl5);
      const take44 = yield* Queue.take(output);
      const decodedExtResponse = yield* decodeExtResponse(take44);
      assert.deepStrictEqual(decodedExtResponse, {
        jsonrpc: "2.0",
        id: "extension-3",
        result: { ok: true },
      });
      const got = yield* Ref.get(requestContexts);
      assert.deepStrictEqual(got, [
        AcpProtocol.AcpRequestContext.make({ method: "initialize", requestId: 2 }),
        AcpProtocol.AcpRequestContext.make({ method: "x/test", requestId: "extension-3" }),
      ]);

      const encodedJsonl6 = yield* encodeJsonl(SessionCancelNotification, {
        jsonrpc: "2.0",
        method: "session/cancel",
        params: { sessionId: "session-1" },
      });
      yield* Queue.offer(input, encodedJsonl6);
      const encodedJsonl7 = yield* encodeJsonl(ExtPingNotification, {
        jsonrpc: "2.0",
        method: "x/ping",
        params: { count: 2 },
      });
      yield* Queue.offer(input, encodedJsonl7);

      yield* Deferred.await(cancelReceived);
      yield* Deferred.await(extReceived);
      const got8 = yield* Ref.get(cancelNotifications);
      assert.deepStrictEqual(got8, ["session-1"]);
      const got9 = yield* Ref.get(extNotifications);
      assert.deepStrictEqual(got9, [2]);
    })
  );
});

it.layer(Layer.fresh(agentFixtureLayer), { timeout: "10 seconds" })((it) => {
  it.effect(
    "keeps RPC ids within int32 and apart from extension ids",
    Effect.fnUntraced(function* () {
      const { input, output } = yield* AgentTransport;
      const agent = yield* AcpAgent.AcpAgent;

      const permissionFiber = yield* agent.client.requestPermission(permissionRequest).pipe(Effect.forkScoped);
      const extFiber = yield* agent.client.extRequest("x/test", { hello: "world" }).pipe(Effect.forkScoped);

      const firstOutbound = yield* Queue.take(output);
      const secondOutbound = yield* Queue.take(output);
      const firstIsPermission = yield* decodeRequestPermissionRequest(firstOutbound).pipe(Effect.isSuccess);
      const outboundPermission = yield* decodeRequestPermissionRequest(
        firstIsPermission ? firstOutbound : secondOutbound
      );
      const outboundExt = yield* decodeExtRequest(firstIsPermission ? secondOutbound : firstOutbound);

      // Locally generated ids stay compatible with SDKs that decode signed int32.
      assert.strictEqual(outboundPermission.id, AcpProtocol.RPC_REQUEST_ID_START);
      assert.strictEqual(outboundPermission.id, 2 ** 30);
      assert.isAtMost(AcpProtocol.RPC_REQUEST_ID_START, 2 ** 31 - 1);
      assert.strictEqual(outboundExt.id, 1);

      const encodedJsonl10 = yield* encodeJsonl(RequestPermissionResponse, {
        jsonrpc: "2.0",
        id: outboundPermission.id,
        result: { outcome: { outcome: "selected", optionId: "allow" } },
      });
      yield* Queue.offer(input, encodedJsonl10);
      const encodedJsonl11 = yield* encodeJsonl(ExtResponse, {
        jsonrpc: "2.0",
        id: outboundExt.id,
        result: { ok: true },
      });
      yield* Queue.offer(input, encodedJsonl11);
      assert.equal((yield* Fiber.join(permissionFiber)).outcome.outcome, "selected");
      const join12 = yield* Fiber.join(extFiber);
      assert.deepStrictEqual(join12, { ok: true });

      const nextPermissionFiber = yield* agent.client.requestPermission(permissionRequest).pipe(Effect.forkScoped);
      const take13 = yield* Queue.take(output);
      const nextPermission = yield* decodeRequestPermissionRequest(take13);
      assert.strictEqual(nextPermission.id, 2 ** 30 + 1);
      const encodedJsonl14 = yield* encodeJsonl(RequestPermissionResponse, {
        jsonrpc: "2.0",
        id: nextPermission.id,
        result: { outcome: { outcome: "cancelled" } },
      });
      yield* Queue.offer(input, encodedJsonl14);
      assert.equal((yield* Fiber.join(nextPermissionFiber)).outcome.outcome, "cancelled");
    })
  );
});

it.effect.each([0, 2 ** 30, 2 ** 32])(
  "answers incoming id %s independently of outbound ids",
  Effect.fnUntraced(function* (requestId) {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const agent = yield* AcpAgent.make(stdio);
    const contexts = yield* Ref.make<ReadonlyArray<AcpProtocol.AcpRequestContext>>([]);
    yield* agent.handleInitialize((_request, context) =>
      Ref.update(contexts, (current) => [...current, context]).pipe(Effect.as(mockAgentInitializeResponse))
    );

    // Opposite directions may reuse an id even while a request is pending.
    const outboundFiber = yield* agent.client.requestPermission(permissionRequest).pipe(Effect.forkScoped);
    const take15 = yield* Queue.take(output);
    const outbound = yield* decodeRequestPermissionRequest(take15);

    const initializeRequest16 = yield* initializeRequest(requestId);
    yield* Queue.offer(input, initializeRequest16);
    const take45 = yield* Queue.take(output);
    const decodedInitializeResponse17 = yield* decodeInitializeResponse(take45);
    assert.deepStrictEqual(decodedInitializeResponse17, {
      jsonrpc: "2.0",
      id: requestId,
      result: mockAgentInitializeResponse,
    });
    const got18 = yield* Ref.get(contexts);
    assert.deepStrictEqual(got18, [AcpProtocol.AcpRequestContext.make({ method: "initialize", requestId })]);

    const encodedJsonl19 = yield* encodeJsonl(RequestPermissionResponse, {
      jsonrpc: "2.0",
      id: outbound.id,
      result: { outcome: { outcome: "cancelled" } },
    });
    yield* Queue.offer(input, encodedJsonl19);
    assert.equal((yield* Fiber.join(outboundFiber)).outcome.outcome, "cancelled");
  })
);

it.layer(Layer.fresh(agentFixtureLayer), { timeout: "10 seconds" })((it) => {
  it.effect(
    "answers a request whose handler dies with an error for that request",
    Effect.fnUntraced(function* () {
      const { input, output } = yield* AgentTransport;
      const agent = yield* AcpAgent.AcpAgent;
      yield* agent.handleInitialize(() => Effect.die("handler bug"));

      // A defect answers a generic internal error that does not carry the defect text.
      const initializeRequest20 = yield* initializeRequest(7);
      yield* Queue.offer(input, initializeRequest20);
      const take21 = yield* Queue.take(output);
      const died = yield* decodeErrorResponse(take21);
      assert.strictEqual(died.id, 7);
      assert.strictEqual(died.error.code, -32603);
      assert.notInclude(died.error.message, "handler bug");

      // The connection keeps serving after the defect.
      yield* agent.handleInitialize(() => Effect.succeed(mockAgentInitializeResponse));
      const initializeRequest22 = yield* initializeRequest(8);
      yield* Queue.offer(input, initializeRequest22);
      const take23 = yield* Queue.take(output);
      assert.strictEqual((yield* decodeInitializeResponse(take23)).id, 8);
    })
  );
});

it.layer(Layer.fresh(agentFixtureLayer), { timeout: "10 seconds" })((it) => {
  it.effect(
    "routes session/resume by replay cursor and answers unregistered methods with -32601",
    Effect.fnUntraced(function* () {
      const { input, output } = yield* AgentTransport;
      const agent = yield* AcpAgent.AcpAgent;
      const resumeSession = (id: number, replayFrom: AcpSchema.ResumeSessionRequest["replayFrom"]) =>
        encodeJsonl(ResumeSessionRequest, {
          jsonrpc: "2.0",
          id,
          method: "session/resume",
          params: { sessionId: "session-1", cwd: "/workspace", ...(replayFrom === undefined ? {} : { replayFrom }) },
          headers: [],
        });

      // Without handlers the agent answers method-not-found.
      const resumeSession24 = yield* resumeSession(10, undefined);
      yield* Queue.offer(input, resumeSession24);
      const take25 = yield* Queue.take(output);
      const missing = yield* decodeErrorResponse(take25);
      assert.strictEqual(missing.id, 10);
      assert.strictEqual(missing.error.code, -32601);

      // Only a resume handler: it serves both replay forms.
      yield* agent.handleResumeSession(() => Effect.succeed({ _meta: { handler: "resume" } }));
      const resumeSession26 = yield* resumeSession(11, { type: "start" });
      yield* Queue.offer(input, resumeSession26);
      const take27 = yield* Queue.take(output);
      assert.deepStrictEqual((yield* decodeResumeSessionResponse(take27)).result, {
        _meta: { handler: "resume" },
      });

      // With a load handler too, a replay from the start prefers it; other cursors keep resume.
      yield* agent.handleLoadSession(() => Effect.succeed({ _meta: { handler: "load" } }));
      const resumeSession28 = yield* resumeSession(12, { type: "start" });
      yield* Queue.offer(input, resumeSession28);
      const take29 = yield* Queue.take(output);
      assert.deepStrictEqual((yield* decodeResumeSessionResponse(take29)).result, {
        _meta: { handler: "load" },
      });
      const resumeSession30 = yield* resumeSession(13, null);
      yield* Queue.offer(input, resumeSession30);
      const take31 = yield* Queue.take(output);
      assert.deepStrictEqual((yield* decodeResumeSessionResponse(take31)).result, {
        _meta: { handler: "resume" },
      });
    })
  );
});

it.layer(Layer.fresh(agentFixtureLayer), { timeout: "10 seconds" })((it) => {
  it.effect(
    "serves the session/delete and providers handlers",
    Effect.fnUntraced(function* () {
      const { input, output } = yield* AgentTransport;
      const agent = yield* AcpAgent.AcpAgent;
      const deleted = yield* Deferred.make<string>();
      yield* agent.handleDeleteSession((request) => Deferred.succeed(deleted, request.sessionId).pipe(Effect.as({})));
      yield* agent.handleListProviders(() =>
        Effect.succeed({
          providers: [{ providerId: "mock-provider", supported: ["openai"], required: false, current: null }],
        })
      );

      const encodedJsonl32 = yield* encodeJsonl(DeleteSessionRequest, {
        jsonrpc: "2.0",
        id: 21,
        method: "session/delete",
        params: { sessionId: "session-9" },
        headers: [],
      });
      yield* Queue.offer(input, encodedJsonl32);
      const await33 = yield* Deferred.await(deleted);
      assert.strictEqual(await33, "session-9");
      const take46 = yield* Queue.take(output);
      const decodedEmptyResponse = yield* decodeEmptyResponse(take46);
      assert.deepStrictEqual(decodedEmptyResponse, {
        jsonrpc: "2.0",
        id: 21,
        result: {},
      });

      const encodedJsonl34 = yield* encodeJsonl(ListProvidersRequest, {
        jsonrpc: "2.0",
        id: 22,
        method: "providers/list",
        params: {},
        headers: [],
      });
      yield* Queue.offer(input, encodedJsonl34);
      const take35 = yield* Queue.take(output);
      const providers = yield* decodeListProvidersResponse(take35);
      assert.strictEqual(providers.id, 22);
      assert.deepStrictEqual(
        A.map(providers.result.providers, ({ providerId }) => providerId),
        ["mock-provider"]
      );
    })
  );
});

it.layer(Layer.fresh(agentFixtureLayer), { timeout: "10 seconds" })((it) => {
  it.effect(
    "sends MCP-over-ACP requests to the client and handles its notifications",
    Effect.fnUntraced(function* () {
      const { input, output } = yield* AgentTransport;
      const agent = yield* AcpAgent.AcpAgent;
      const params = { serverId: "test-server", requestId: "mcp-1", method: "tools/list" };

      const messageFiber = yield* agent.client.messageMcp(params).pipe(Effect.forkScoped);
      const take36 = yield* Queue.take(output);
      const message = yield* decodeMessageMcpRequest(take36);
      assert.strictEqual(message.id, AcpProtocol.RPC_REQUEST_ID_START);
      assert.deepStrictEqual(message.params, params);
      const encodedJsonl37 = yield* encodeJsonl(MessageMcpResponse, {
        jsonrpc: "2.0",
        id: message.id,
        result: { result: { tools: [] } },
      });
      yield* Queue.offer(input, encodedJsonl37);
      const join38 = yield* Fiber.join(messageFiber);
      assert.deepStrictEqual(join38, { result: { tools: [] } });

      const notified = yield* Deferred.make<AcpSchema.MessageMcpNotification>();
      yield* agent.handleMcpNotification((notification) =>
        Deferred.succeed(notified, notification).pipe(Effect.asVoid)
      );
      const progress = { serverId: "test-server", requestId: "mcp-1", method: "notifications/progress" };
      const encodedJsonl39 = yield* encodeJsonl(MessageMcpNotification, {
        jsonrpc: "2.0",
        method: "mcp/message",
        params: progress,
      });
      yield* Queue.offer(input, encodedJsonl39);
      const await40 = yield* Deferred.await(notified);
      assert.deepStrictEqual(await40, progress);
    })
  );
});

it.layer(Layer.fresh(agentFixtureLayer), { timeout: "10 seconds" })((it) => {
  it.effect(
    "runs every cancel handler even when an earlier one fails or dies",
    Effect.fnUntraced(function* () {
      const { input } = yield* AgentTransport;
      const agent = yield* AcpAgent.AcpAgent;
      const reached = yield* Deferred.make<string>();
      yield* agent.handleCancel(() => Effect.fail(AcpError.AcpRequestError.internalError()));
      yield* agent.handleCancel(() => Effect.die("cancel handler bug"));
      yield* agent.handleCancel((notification) => Deferred.succeed(reached, notification.sessionId));

      const encodedJsonl41 = yield* encodeJsonl(SessionCancelNotification, {
        jsonrpc: "2.0",
        method: "session/cancel",
        params: { sessionId: "session-2" },
      });
      yield* Queue.offer(input, encodedJsonl41);
      const await42 = yield* Deferred.await(reached);
      assert.strictEqual(await42, "session-2");
    })
  );
});
