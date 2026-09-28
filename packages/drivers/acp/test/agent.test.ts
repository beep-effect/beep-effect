import { Agent as AcpAgent, Schema as AcpSchema } from "@beep/acp";
import { $AcpId } from "@beep/identity/packages";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { assert } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import { encodeJsonl, jsonRpcNotification, jsonRpcRequest, jsonRpcResponse, makeInMemoryStdio } from "./helpers.ts";

const RequestPermissionRequest = jsonRpcRequest("session/request_permission", AcpSchema.RequestPermissionRequest);
const InitializeRequest = jsonRpcRequest("initialize", AcpSchema.InitializeRequest);
const InitializeResponse = jsonRpcResponse(AcpSchema.InitializeResponse);
const RequestPermissionResponse = jsonRpcResponse(AcpSchema.RequestPermissionResponse);
const SessionCancelNotification = jsonRpcNotification("session/cancel", AcpSchema.CancelNotification);
const ExtPingNotification = jsonRpcNotification("x/ping", Schema.Struct({ count: Schema.Finite }));
const ExtRequest = jsonRpcRequest("x/test", Schema.Struct({ hello: Schema.String }));
const ExtResponse = jsonRpcResponse(Schema.Struct({ ok: Schema.Boolean }));
const decodeRequestPermissionRequest = Schema.decodeEffect(Schema.fromJsonString(RequestPermissionRequest));
const decodeInitializeResponse = Schema.decodeEffect(Schema.fromJsonString(InitializeResponse));
const decodeSessionCancelNotification = Schema.decodeEffect(Schema.fromJsonString(SessionCancelNotification));
const decodeExtRequest = Schema.decodeEffect(Schema.fromJsonString(ExtRequest));
const encodeInitializeResponse = Schema.encodeEffect(Schema.fromJsonString(InitializeResponse));
const encodeSessionCancelNotification = Schema.encodeEffect(Schema.fromJsonString(SessionCancelNotification));
const InitializeResponseArbitrary = Arbitrary.schema(InitializeResponse);
const SessionCancelNotificationArbitrary = Arbitrary.schema(SessionCancelNotification);

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
    assert.equal(yield* encodeInitializeResponse(decodedInitializeResponse), encodedInitializeResponse);

    const encodedCancelNotification = yield* encodeSessionCancelNotification(cancelNotification);
    const decodedCancelNotification = yield* decodeSessionCancelNotification(encodedCancelNotification);
    assert.equal(yield* encodeSessionCancelNotification(decodedCancelNotification), encodedCancelNotification);
  }),
  { arbitrary: fcRuns(25) }
);

it.layer(Layer.fresh(agentFixtureLayer), { timeout: "10 seconds" })((it) => {
  it.effect(
    "effect-acp agent handles core agent requests and outbound client requests",
    Effect.fnUntraced(function* () {
      const { input, output } = yield* AgentTransport;
      const cancelNotifications = yield* Ref.make<Array<string>>([]);
      const extNotifications = yield* Ref.make<Array<number>>([]);
      const cancelReceived = yield* Deferred.make<void>();
      const extReceived = yield* Deferred.make<void>();
      const agent = yield* AcpAgent.AcpAgent;

      yield* agent.handleInitialize(() =>
        Effect.succeed({
          protocolVersion: 1,
          agentCapabilities: {},
          agentInfo: {
            name: "mock-agent",
            version: "0.0.0",
          },
        })
      );
      yield* agent.handleCancel((notification) =>
        Ref.update(cancelNotifications, (current) => [...current, notification.sessionId]).pipe(
          Effect.andThen(Deferred.succeed(cancelReceived, undefined))
        )
      );
      yield* agent.handleExtNotification("x/ping", Schema.Struct({ count: Schema.Finite }), (payload) =>
        Ref.update(extNotifications, (current) => [...current, payload.count]).pipe(
          Effect.andThen(Deferred.succeed(extReceived, undefined))
        )
      );

      const permissionFiber = yield* agent.client
        .requestPermission({
          sessionId: "session-1",
          toolCall: {
            toolCallId: "tool-1",
            title: "Allow mock action",
          },
          options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
        })
        .pipe(Effect.forkScoped);

      yield* Effect.logInfo("ACP test phase", { phase: "agent.permission-output", state: "waiting" });
      const permissionRequest = yield* decodeRequestPermissionRequest(yield* Queue.take(output));
      yield* Effect.logInfo("ACP test phase", { phase: "agent.permission-output", state: "completed" });
      assert.equal(permissionRequest.jsonrpc, "2.0");
      assert.equal(permissionRequest.method, "session/request_permission");
      assert.deepEqual(permissionRequest.params, {
        sessionId: "session-1",
        toolCall: {
          toolCallId: "tool-1",
          title: "Allow mock action",
        },
        options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
      });
      assert.deepEqual(permissionRequest.headers, []);

      yield* Queue.offer(
        input,
        yield* encodeJsonl(RequestPermissionResponse, {
          jsonrpc: "2.0",
          id: permissionRequest.id,
          result: {
            outcome: {
              outcome: "selected",
              optionId: "allow",
            },
          },
        })
      );

      yield* Effect.logInfo("ACP test phase", { phase: "agent.permission-response", state: "waiting" });
      const permission = yield* Fiber.join(permissionFiber);
      yield* Effect.logInfo("ACP test phase", { phase: "agent.permission-response", state: "completed" });
      assert.equal(permission.outcome.outcome, "selected");

      yield* Queue.offer(
        input,
        yield* encodeJsonl(InitializeRequest, {
          jsonrpc: "2.0",
          id: 2,
          method: "initialize",
          params: {
            protocolVersion: 1,
            clientCapabilities: {
              fs: { readTextFile: false, writeTextFile: false },
              terminal: false,
            },
            clientInfo: {
              name: "effect-acp-test",
              version: "0.0.0",
            },
          },
          headers: [],
        })
      );

      yield* Effect.logInfo("ACP test phase", { phase: "agent.initialize-response", state: "waiting" });
      const initResponse = yield* decodeInitializeResponse(yield* Queue.take(output));
      yield* Effect.logInfo("ACP test phase", { phase: "agent.initialize-response", state: "completed" });
      assert.deepEqual(initResponse, {
        jsonrpc: "2.0",
        id: 2,
        result: {
          protocolVersion: 1,
          agentCapabilities: {},
          agentInfo: {
            name: "mock-agent",
            version: "0.0.0",
          },
        },
      });

      yield* Queue.offer(
        input,
        yield* encodeJsonl(SessionCancelNotification, {
          jsonrpc: "2.0",
          method: "session/cancel",
          params: {
            sessionId: "session-1",
          },
        })
      );
      yield* Queue.offer(
        input,
        yield* encodeJsonl(ExtPingNotification, {
          jsonrpc: "2.0",
          method: "x/ping",
          params: { count: 2 },
        })
      );

      yield* Effect.logInfo("ACP test phase", { phase: "agent.cancellation", state: "waiting" });
      yield* Deferred.await(cancelReceived);
      yield* Effect.logInfo("ACP test phase", { phase: "agent.cancellation", state: "completed" });
      yield* Effect.logInfo("ACP test phase", { phase: "agent.extension-notification", state: "waiting" });
      yield* Deferred.await(extReceived);
      yield* Effect.logInfo("ACP test phase", { phase: "agent.extension-notification", state: "completed" });
      assert.deepEqual(yield* Ref.get(cancelNotifications), ["session-1"]);
      assert.deepEqual(yield* Ref.get(extNotifications), [2]);
    })
  );
});

it.layer(Layer.fresh(agentFixtureLayer), { timeout: "10 seconds" })((it) => {
  it.effect(
    "effect-acp agent uses distinct ids for RPC calls and extension requests",
    Effect.fnUntraced(function* () {
      const { input, output } = yield* AgentTransport;
      const agent = yield* AcpAgent.AcpAgent;

      const permissionFiber = yield* agent.client
        .requestPermission({
          sessionId: "session-1",
          toolCall: {
            toolCallId: "tool-1",
            title: "Allow mock action",
          },
          options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
        })
        .pipe(Effect.forkScoped);
      const extFiber = yield* agent.client.extRequest("x/test", { hello: "world" }).pipe(Effect.forkScoped);

      yield* Effect.logInfo("ACP test phase", { phase: "agent.first-outbound", state: "waiting" });
      const firstOutbound = yield* Queue.take(output);
      yield* Effect.logInfo("ACP test phase", { phase: "agent.first-outbound", state: "completed" });
      yield* Effect.logInfo("ACP test phase", { phase: "agent.second-outbound", state: "waiting" });
      const secondOutbound = yield* Queue.take(output);
      yield* Effect.logInfo("ACP test phase", { phase: "agent.second-outbound", state: "completed" });

      const firstIsPermission = yield* decodeRequestPermissionRequest(firstOutbound).pipe(
        Effect.match({
          onFailure: () => false,
          onSuccess: () => true,
        })
      );

      const permissionRequest = firstIsPermission
        ? yield* decodeRequestPermissionRequest(firstOutbound)
        : yield* decodeRequestPermissionRequest(secondOutbound);
      const extRequest = firstIsPermission
        ? yield* decodeExtRequest(secondOutbound)
        : yield* decodeExtRequest(firstOutbound);

      assert.notEqual(permissionRequest.id, extRequest.id);

      yield* Queue.offer(
        input,
        yield* encodeJsonl(RequestPermissionResponse, {
          jsonrpc: "2.0",
          id: permissionRequest.id,
          result: {
            outcome: {
              outcome: "selected",
              optionId: "allow",
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

      yield* Effect.logInfo("ACP test phase", { phase: "agent.permission-response", state: "waiting" });
      const permission = yield* Fiber.join(permissionFiber);
      yield* Effect.logInfo("ACP test phase", { phase: "agent.permission-response", state: "completed" });
      assert.equal(permission.outcome.outcome, "selected");
      assert.deepEqual(yield* Fiber.join(extFiber), { ok: true });
    })
  );
});
