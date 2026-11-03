// Projection tests for `@beep/acp/compat` and the generation-1 / generation-2 normalizers. The
// unknown-variant, elicitation and permission cases port the in-memory normalization cases of
// t3code effect-acp `client.test.ts` (31dcc7c513) without a client; the properties are beep-only.
import * as Compat from "@beep/acp/compat";
import * as Normalize from "@beep/acp/internal/normalize";
import * as AcpProtocol from "@beep/acp/protocol";
import * as V2 from "@beep/acp/schema";
import * as V1 from "@beep/acp/schema-v1";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const decodeIncomingNotification = S.decodeUnknownEffect(AcpProtocol.AcpIncomingNotification);
const decodeV2InitializeResponse = S.decodeUnknownEffect(V2.InitializeResponse);
const decodeV1InitializeResponse = S.decodeUnknownEffect(V1.InitializeResponse);
const decodeV2PermissionRequest = S.decodeUnknownEffect(V2.RequestPermissionRequest);
const decodeV1PermissionRequest = S.decodeUnknownEffect(V1.RequestPermissionRequest);
const decodeV2ConfigOption = S.decodeUnknownEffect(V2.SessionConfigOption);
const decodeCompatInitializeRequest = S.decodeUnknownEffect(Compat.InitializeRequest);
const decodeCompatIdleState = S.decodeUnknownEffect(Compat.IdleStateUpdate);
const decodeCompatMcpServer = S.decodeUnknownEffect(Compat.McpServer);
const decodeCompatLoadSessionRequest = S.decodeUnknownEffect(Compat.LoadSessionRequest);
const decodeCompatConfigOptionRequest = S.decodeUnknownEffect(Compat.SetSessionConfigOptionRequest);
const decodeCompatNewSessionResponse = S.decodeUnknownEffect(Compat.NewSessionResponse);
const decodeV2NewSessionResponse = S.decodeUnknownEffect(V2.NewSessionResponse);
// The client's prompt success union (`AcpRpc.models.ts`).
const decodePromptResult = S.decodeUnknownEffect(S.Union([Compat.PromptResponse, Normalize.OpenPromptAcknowledgement]));

const isCompatSessionNotification = S.is(Compat.SessionNotification);
const isCompatInitializeResponse = S.is(Compat.InitializeResponse);
const isCompatPromptResponse = S.is(Compat.PromptResponse);
const isCompatPermissionRequest = S.is(Compat.RequestPermissionRequest);
const isV2McpServer = S.is(V2.McpServer);
const isV2InitializeRequest = S.is(V2.InitializeRequest);
const isGeneration1OnlyKind = S.is(S.Literals(["tool_call", "plan", "current_mode_update"]));

const permissionContext = AcpProtocol.AcpRequestContext.make({
  method: "session/request_permission",
  requestId: 41,
});
const permissionOptions = [{ optionId: "allow", name: "Allow", kind: "allow_once" }];

// Decodes `session/update` params the way the protocol does, then normalizes them.
const normalizeWireUpdate = Effect.fnUntraced(function* (generation: Normalize.ProtocolGeneration, params: unknown) {
  const notification = yield* decodeIncomingNotification({
    _tag: "SessionUpdate",
    method: "session/update",
    params,
  });
  return notification._tag === "SessionUpdate"
    ? Normalize.normalizeSessionNotification(notification.params, generation).update
    : assert.fail("expected a session/update notification");
});

describe("compat session updates", () => {
  it.effect("preserves future content and session-update variants as _acp_unknown", () =>
    Effect.gen(function* () {
      const chunk = yield* normalizeWireUpdate(2, {
        sessionId: "session-1",
        update: {
          sessionUpdate: "agent_message_chunk",
          messageId: "future-content",
          content: { type: "chart", points: [] },
        },
      });
      assert.deepStrictEqual(chunk, {
        sessionUpdate: "agent_message_chunk",
        messageId: "future-content",
        content: { type: "_acp_unknown", originalType: "chart", raw: { type: "chart", points: [] } },
      });

      const timeline = yield* normalizeWireUpdate(2, {
        sessionId: "session-1",
        update: { sessionUpdate: "timeline_update", entries: [] },
      });
      assert.deepStrictEqual(timeline, {
        sessionUpdate: "_acp_unknown",
        originalSessionUpdate: "timeline_update",
        raw: { sessionUpdate: "timeline_update", entries: [] },
      });
    })
  );

  it.effect("keeps generation-1-only kinds on generation 1 and marks them unknown on generation 2", () =>
    Effect.gen(function* () {
      const plan = {
        sessionId: "session-1",
        update: { sessionUpdate: "plan", entries: [{ content: "step", priority: "high", status: "pending" }] },
      } as const;
      const normalizeWireUpdate1 = yield* normalizeWireUpdate(1, plan);
      assert.deepStrictEqual(normalizeWireUpdate1, plan.update);
      const normalizeWireUpdate2 = yield* normalizeWireUpdate(2, plan);
      assert.deepStrictEqual(normalizeWireUpdate2, {
        sessionUpdate: "_acp_unknown",
        originalSessionUpdate: "plan",
        raw: plan.update,
      });
    })
  );

  // Generation 2 tightens fields the kinds share (`Cost.currency` must match `^[A-Z]{3}$`,
  // `Annotations.priority` must lie in [0, 1]), so these updates decode only as generation 1.
  it.effect("keeps shared kinds that only the generation-1 member accepts, on either generation", () =>
    Effect.gen(function* () {
      const lowerCaseCurrency = {
        sessionUpdate: "usage_update",
        used: 53000,
        size: 200000,
        cost: { amount: 0.045, currency: "usd" },
      } as const;
      const highPriority = { type: "text", text: "Summary", annotations: { priority: 5 } } as const;
      const summaryChunk = {
        sessionUpdate: "compaction_summary_chunk",
        compactionId: "c1",
        content: highPriority,
      } as const;
      const compaction = {
        sessionUpdate: "compaction_update",
        compactionId: "c1",
        status: "completed",
        summary: [highPriority],
      } as const;
      for (const update of [lowerCaseCurrency, summaryChunk, compaction]) {
        for (const generation of [1, 2] as const) {
          const normalized = yield* normalizeWireUpdate(generation, { sessionId: "session-1", update });
          assert.deepStrictEqual(normalized, update);
          assert.isTrue(isCompatSessionNotification({ sessionId: "session-1", update: normalized }));
        }
      }
    })
  );

  it.effect("accepts a generation-1 message chunk without a messageId", () =>
    Effect.gen(function* () {
      const update = { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } } as const;
      const normalizeWireUpdate3 = yield* normalizeWireUpdate(1, { sessionId: "session-1", update });
      assert.deepStrictEqual(normalizeWireUpdate3, update);
    })
  );

  it.effect("rewrites command inputs per generation", () =>
    Effect.gen(function* () {
      const v1 = yield* normalizeWireUpdate(1, {
        sessionId: "session-1",
        update: {
          sessionUpdate: "available_commands_update",
          availableCommands: [
            { name: "plan", description: "Plan", input: { hint: "Task" } },
            { name: "clear", description: "Clear", input: null },
          ],
        },
      });
      assert.deepStrictEqual(v1, {
        sessionUpdate: "available_commands_update",
        availableCommands: [
          { name: "plan", description: "Plan", input: { type: "text", hint: "Task" } },
          { name: "clear", description: "Clear" },
        ],
      });

      const v2 = yield* normalizeWireUpdate(2, {
        sessionId: "session-1",
        update: {
          sessionUpdate: "available_commands_update",
          availableCommands: [
            { name: "web", description: "Search", input: { type: "text", hint: "query" } },
            { name: "pick", description: "Pick", input: { type: "file_picker", filter: "*.ts" } },
            { name: "go", description: "Go" },
          ],
        },
      });
      assert.deepStrictEqual(v2, {
        sessionUpdate: "available_commands_update",
        availableCommands: [
          { name: "web", description: "Search", input: { type: "text", hint: "query" } },
          { name: "pick", description: "Pick", input: null },
          { name: "go", description: "Go", input: null },
        ],
      });
    })
  );

  it.effect("renames configId to id and drops unknown config option types", () =>
    Effect.gen(function* () {
      const update = yield* normalizeWireUpdate(2, {
        sessionId: "session-1",
        update: {
          sessionUpdate: "config_option_update",
          configOptions: [
            { configId: "plan", name: "Plan", type: "boolean", currentValue: true },
            {
              configId: "model",
              name: "Model",
              type: "select",
              currentValue: "fast",
              options: [{ groupId: "g", name: "Group", options: [{ value: "fast", name: "Fast" }] }],
            },
            { configId: "dial", name: "Dial", type: "slider", min: 0 },
          ],
        },
      });
      assert.deepStrictEqual(update, {
        sessionUpdate: "config_option_update",
        configOptions: [
          { id: "plan", name: "Plan", type: "boolean", currentValue: true },
          {
            id: "model",
            name: "Model",
            type: "select",
            currentValue: "fast",
            options: [{ groupId: "g", name: "Group", options: [{ value: "fast", name: "Fast" }] }],
          },
        ],
      });
      const decodedV2ConfigOption = yield* decodeV2ConfigOption({
        configId: "dial",
        name: "Dial",
        type: "slider",
      });
      assertNone(Normalize.normalizeConfigOption(decodedV2ConfigOption));
    })
  );

  it.effect("normalizes tool-call content of both generations", () =>
    Effect.gen(function* () {
      const update = yield* normalizeWireUpdate(2, {
        sessionId: "session-1",
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: "tool-1",
          content: [
            { type: "content", content: { type: "chart" } },
            { type: "diff", changes: [], patch: null },
            { type: "terminal", terminalId: "term-1" },
            { type: "hologram", frames: 2 },
          ],
        },
      });
      assert.deepStrictEqual(update, {
        sessionUpdate: "tool_call_update",
        toolCallId: "tool-1",
        content: [
          { type: "content", content: { type: "_acp_unknown", originalType: "chart", raw: { type: "chart" } } },
          { type: "diff", changes: [], patch: null },
          { type: "terminal", terminalId: "term-1" },
          { type: "_acp_unknown", originalType: "hologram", raw: { type: "hologram", frames: 2 } },
        ],
      });
      const legacyDiff = { type: "diff", path: "/a.ts", oldText: null, newText: "x" } as const;
      assert.deepStrictEqual(Normalize.normalizeToolCallContent(legacyDiff), legacyDiff);
    })
  );

  it.effect("keeps a well-formed idle error and drops a malformed one", () =>
    Effect.gen(function* () {
      const failed = yield* normalizeWireUpdate(2, {
        sessionId: "session-1",
        update: {
          sessionUpdate: "state_update",
          state: "idle",
          stopReason: "end_turn",
          error: { code: -32603, message: "Internal error" },
        },
      });
      assert.deepStrictEqual(failed, {
        sessionUpdate: "state_update",
        state: "idle",
        stopReason: "end_turn",
        error: { code: -32603, message: "Internal error" },
      });
      const malformed = yield* normalizeWireUpdate(2, {
        sessionId: "session-1",
        update: { sessionUpdate: "state_update", state: "idle", error: "boom" },
      });
      assert.deepStrictEqual(malformed, { sessionUpdate: "state_update", state: "idle" });
    })
  );

  it.effect("completes a generation-2 prompt from its idle update", () =>
    Effect.gen(function* () {
      const idle = yield* decodeCompatIdleState({
        sessionUpdate: "state_update",
        state: "idle",
        usage: { totalTokens: 3, inputTokens: 1, outputTokens: 2 },
      });
      assert.isTrue(Normalize.isIdleStateUpdate(idle));
      assert.deepStrictEqual(Normalize.promptResponseFromIdle(idle), {
        stopReason: "end_turn",
        usage: { totalTokens: 3, inputTokens: 1, outputTokens: 2 },
      });
      assert.deepStrictEqual(Normalize.normalizePromptResponse({ stopReason: "refusal" }), {
        stopReason: "refusal",
      });
      assert.deepStrictEqual(Normalize.normalizePromptResponse({}), { stopReason: "end_turn" });
    })
  );

  // A generation-1 result outside the closed v1.26 schema decodes through the open generation-2
  // member; its stop reason must survive, and only the malformed usage is dropped.
  it.effect("keeps the stop reason of an off-schema generation-1 prompt result", () =>
    Effect.gen(function* () {
      const partialUsage = { inputTokens: 10, outputTokens: 5 };
      const usage = { totalTokens: 15, inputTokens: 10, outputTokens: 5 };
      const cases = [
        [{ stopReason: "cancelled", usage: partialUsage }, { stopReason: "cancelled" }],
        [
          { stopReason: "refusal", usage: partialUsage, _meta: { trace: "t" } },
          { stopReason: "refusal", _meta: { trace: "t" } },
        ],
        [
          { stopReason: "_vendor_rate_limited", usage },
          { stopReason: "_vendor_rate_limited", usage },
        ],
        [{ stopReason: 7 }, { stopReason: "end_turn" }],
      ] as const;
      for (const [wire, expected] of cases) {
        const decodedPromptResult = yield* decodePromptResult(wire);
        assert.deepStrictEqual(Normalize.normalizePromptResponse(decodedPromptResult), expected);
      }
    })
  );
});

describe("compat initialize", () => {
  it.effect("sends both generations' fields in the negotiating request", () =>
    Effect.gen(function* () {
      const request = yield* decodeCompatInitializeRequest({
        protocolVersion: 1,
        clientCapabilities: { terminal: true, auth: { terminal: true }, elicitation: { form: {} } },
      });
      const negotiating = Normalize.toNegotiatingInitializeRequest(request);
      assert.isTrue(isV2InitializeRequest(negotiating));
      assert.deepStrictEqual(negotiating, {
        protocolVersion: 2,
        info: { name: "@beep/acp", version: "unknown" },
        capabilities: { auth: { terminal: {} }, elicitation: { form: {} } },
        clientCapabilities: { terminal: true, auth: { terminal: true }, elicitation: { form: {} } },
      });
      assert.deepStrictEqual(Normalize.toV1InitializeRequest(request), request);
      assert.deepStrictEqual(
        Normalize.toV2InitializeRequest({ ...request, clientInfo: { name: "beep", version: "1.0.0" } }).info,
        { name: "beep", version: "1.0.0" }
      );
    })
  );

  it.effect("detects the generation from the reply shape, not the version number", () =>
    Effect.gen(function* () {
      // Antigravity reports version 2 with the generation-1 reply shape.
      const legacy = yield* decodeV1InitializeResponse({
        protocolVersion: 2,
        agentInfo: { name: "antigravity", version: "1.1.1" },
        agentCapabilities: { loadSession: true },
        authMethods: [{ id: "oauth", name: "Google" }],
      });
      assert.isFalse(Normalize.isV2InitializeResponse(legacy));
      assert.deepStrictEqual(Normalize.normalizeInitializeResponse(legacy), legacy);
    })
  );

  it.effect("projects a generation-2 reply onto the generation-1 shape", () =>
    Effect.gen(function* () {
      const reply = yield* decodeV2InitializeResponse({
        protocolVersion: 2,
        info: { name: "agent", version: "0.9.0" },
        capabilities: {
          session: { prompt: { image: {} }, mcp: { acp: {} }, delete: {} },
          providers: {},
        },
        authMethods: [
          { type: "terminal", methodId: "cli", name: "CLI", env: [{ name: "TOKEN", value: "x" }] },
          { type: "agent", methodId: "agent", name: "Agent" },
          {
            type: "env_var",
            methodId: "key",
            name: "Key",
            vars: [{ name: "API_KEY", label: 7 }],
            link: "https://x.test",
          },
          { type: "passkey", methodId: "pk", name: "Passkey" },
        ],
      });
      assert.isTrue(Normalize.isV2InitializeResponse(reply));
      const normalized = Normalize.normalizeInitializeResponse(reply);
      assert.isTrue(isCompatInitializeResponse(normalized));
      assert.deepStrictEqual(normalized, {
        protocolVersion: 2,
        agentInfo: { name: "agent", version: "0.9.0" },
        agentCapabilities: {
          loadSession: true,
          promptCapabilities: { image: true, audio: false, embeddedContext: false },
          mcpCapabilities: { stdio: false, http: false, acp: true },
          sessionCapabilities: { list: {}, resume: {}, close: {}, delete: {} },
          providers: {},
          auth: { logout: {} },
        },
        authMethods: [
          { id: "cli", name: "CLI", type: "terminal", env: { TOKEN: "x" } },
          { id: "agent", name: "Agent", type: "agent" },
          { id: "key", name: "Key", type: "env_var", vars: [{ name: "API_KEY" }], link: "https://x.test" },
        ],
      });
    })
  );
});

describe("compat session setup", () => {
  it.effect("tags untagged stdio servers and replays a load from the start", () =>
    Effect.gen(function* () {
      const untagged = yield* decodeCompatMcpServer({ name: "files", command: "/usr/bin/mcp-files" });
      assert.deepStrictEqual(Normalize.toV2McpServer(untagged), {
        name: "files",
        command: "/usr/bin/mcp-files",
        type: "stdio",
      });
      const load = yield* decodeCompatLoadSessionRequest({
        sessionId: "session-1",
        cwd: "/work",
        mcpServers: [untagged],
      });
      assert.deepStrictEqual(Normalize.toV2LoadSessionRequest(load), {
        sessionId: "session-1",
        cwd: "/work",
        mcpServers: [{ name: "files", command: "/usr/bin/mcp-files", type: "stdio" }],
        replayFrom: { type: "start" },
      });
    })
  );

  it.effect("adds the generation-2 type to set_config_option requests", () =>
    Effect.gen(function* () {
      const byId = yield* decodeCompatConfigOptionRequest({ sessionId: "s", configId: "model", value: "fast" });
      assert.deepStrictEqual(Normalize.toV2SetSessionConfigOptionRequest(byId), {
        sessionId: "s",
        configId: "model",
        value: "fast",
        type: "id",
      });
      const boolean = yield* decodeCompatConfigOptionRequest({
        sessionId: "s",
        configId: "plan",
        type: "boolean",
        value: true,
      });
      assert.deepStrictEqual(Normalize.toV2SetSessionConfigOptionRequest(boolean), {
        sessionId: "s",
        configId: "plan",
        type: "boolean",
        value: true,
      });
    })
  );

  it.effect("keeps generation-1 setup results and projects generation-2 ones", () =>
    Effect.gen(function* () {
      const legacy = yield* decodeCompatNewSessionResponse({
        sessionId: "session-1",
        models: { currentModelId: "fast", availableModels: [{ modelId: "fast", name: "Fast" }] },
        modes: { currentModeId: "code", availableModes: [{ id: "code", name: "Code" }] },
      });
      assert.deepStrictEqual(Normalize.normalizeNewSessionResponse(legacy), legacy);
      const decodedV2NewSessionResponse = yield* decodeV2NewSessionResponse({
        sessionId: "session-2",
        configOptions: [{ configId: "plan", name: "Plan", type: "boolean", currentValue: false }],
      });
      assert.deepStrictEqual(Normalize.normalizeNewSessionResponse(decodedV2NewSessionResponse), {
        sessionId: "session-2",
        configOptions: [{ id: "plan", name: "Plan", type: "boolean", currentValue: false }],
      });
      assert.deepStrictEqual(
        Normalize.normalizeSetSessionConfigOptionResponse({
          configOptions: [{ configId: "plan", name: "Plan", type: "boolean", currentValue: false }],
        }),
        { configOptions: [{ id: "plan", name: "Plan", type: "boolean", currentValue: false }] }
      );
    })
  );
});

describe("compat prompt requests", () => {
  it.effect("sends a delivered unknown content block as the original block it carries", () =>
    Effect.gen(function* () {
      const chart = { type: "chart", points: [] };
      const text = { type: "text", text: "hi" } as const;
      const resent = Compat.UnknownContent.make({ type: Compat.ACP_UNKNOWN, originalType: "chart", raw: chart });
      assert.deepStrictEqual(
        Normalize.toWirePromptRequest({ sessionId: "session-1", prompt: [text, resent], _meta: { trace: "t" } }),
        O.some({ sessionId: "session-1", prompt: [text, chart], _meta: { trace: "t" } })
      );

      // A sentinel whose `raw` is no content block (or is itself a sentinel) has no wire form.
      for (const raw of [5, { points: [] }, { type: Compat.ACP_UNKNOWN, originalType: "chart", raw: chart }]) {
        const opaque = Compat.UnknownContent.make({ type: Compat.ACP_UNKNOWN, originalType: "chart", raw });
        assertNone(Normalize.toWirePromptRequest({ sessionId: "session-1", prompt: [text, opaque] }));
      }
    })
  );

  it.prop(
    "never puts the unknown sentinel on the wire",
    [Arbitrary.schema(Compat.PromptRequest)],
    ([request]) => {
      const wire = Normalize.toWirePromptRequest(request);
      assert.isTrue(
        O.match(wire, {
          onNone: () => A.some(request.prompt, (block) => block.type === Compat.ACP_UNKNOWN),
          onSome: ({ prompt }) =>
            prompt.length === request.prompt.length && !A.some(prompt, (block) => block.type === Compat.ACP_UNKNOWN),
        })
      );
    },
    { arbitrary: fcRuns(50) }
  );
});

describe("compat peer requests", () => {
  it.effect("always delivers a tool call with a permission request", () =>
    Effect.gen(function* () {
      const fromToolCall = yield* decodeV2PermissionRequest({
        sessionId: "session-1",
        title: "Edit file",
        subject: { type: "tool_call", toolCall: { toolCallId: "tool-7", title: "Edit" } },
        options: permissionOptions,
      });
      assert.deepStrictEqual(Normalize.normalizePermissionRequest(fromToolCall, permissionContext).toolCall, {
        toolCallId: "tool-7",
        title: "Edit",
      });

      const fromCommand = yield* decodeV2PermissionRequest({
        sessionId: "session-1",
        title: "Run tests",
        subject: { type: "command", command: "bun test", cwd: "/work" },
        options: permissionOptions,
      });
      assert.deepStrictEqual(Normalize.normalizePermissionRequest(permissionContext)(fromCommand).toolCall, {
        toolCallId: "41",
        title: "Run tests",
        kind: "execute",
      });

      const bare = yield* decodeV2PermissionRequest({
        sessionId: "session-1",
        title: "Continue?",
        options: permissionOptions,
      });
      const normalized = Normalize.normalizePermissionRequest(bare, permissionContext);
      assert.isTrue(isCompatPermissionRequest(normalized));
      assert.deepStrictEqual(normalized.toolCall, { toolCallId: "41", title: "Continue?", kind: "other" });

      const legacy = yield* decodeV1PermissionRequest({
        sessionId: "session-1",
        toolCall: { toolCallId: "tool-1", content: [{ type: "content", content: { type: "text", text: "x" } }] },
        options: permissionOptions,
      });
      assert.deepStrictEqual(Normalize.normalizePermissionRequest(legacy, permissionContext), legacy);
    })
  );

  it.effect("decodes flat elicitation requests of either generation and nests legacy results", () =>
    Effect.gen(function* () {
      const form = {
        sessionId: "session-1",
        mode: "form",
        message: "Continue?",
        requestedSchema: { type: "object", properties: { choice: { type: "string" } }, required: ["choice"] },
      };
      const decodedElicitationRequest = yield* Normalize.decodeElicitationRequest(form);
      assert.deepStrictEqual(decodedElicitationRequest, form);
      const malformed = yield* Normalize.decodeElicitationRequest({ mode: "form" }).pipe(Effect.flip);
      assert.strictEqual(malformed._tag, "SchemaError");

      for (const answer of [
        { action: "accept", content: { choice: "yes" } },
        { action: "decline" },
        { action: "cancel" },
      ] as const) {
        const traced = Normalize.toLegacyElicitationResponse({ ...answer, _meta: { trace: "fixture" } });
        assert.deepStrictEqual(traced.action, answer);
        assert.deepStrictEqual(traced._meta, { trace: "fixture" });
        const untraced = Normalize.toLegacyElicitationResponse(answer);
        assert.deepStrictEqual(untraced.action, answer);
        assert.notProperty(untraced, "_meta");
      }
    })
  );
});

describe("compat projections (properties)", () => {
  const WireNotificationArbitrary = Arbitrary.schema(S.Union([V2.UpdateSessionNotification, V1.SessionNotification]));

  it.prop(
    "normalizes any decoded session/update into the compat shape, idempotently",
    [WireNotificationArbitrary, Arbitrary.schema(Normalize.ProtocolGeneration)],
    ([notification, generation]) => {
      const normalized = Normalize.normalizeSessionNotification(notification, generation);
      assert.isTrue(isCompatSessionNotification(normalized));
      assert.deepStrictEqual(Normalize.normalizeSessionNotification(normalized, generation), normalized);
    },
    { arbitrary: fcRuns(50) }
  );

  // A valid generation-1 update keeps its kind; only the generation-1-only kinds become
  // `_acp_unknown`, and only on a generation-2 connection.
  it.prop(
    "keeps the kind of every generation-1 update",
    [Arbitrary.schema(V1.SessionNotification), Arbitrary.schema(Normalize.ProtocolGeneration)],
    ([notification, generation]) => {
      const kind = notification.update.sessionUpdate;
      assert.strictEqual(
        Normalize.normalizeSessionNotification(notification, generation).update.sessionUpdate,
        generation === 2 && isGeneration1OnlyKind(kind) ? Compat.ACP_UNKNOWN : kind
      );
    },
    { arbitrary: fcRuns(200) }
  );

  // Every v1.26 prompt result is already a compat result, so the client returns it unchanged.
  it.prop(
    "returns every generation-1 prompt result unchanged",
    [Arbitrary.schema(V1.PromptResponse)],
    ([response]) => {
      assert.isTrue(isCompatPromptResponse(response));
      assert.deepStrictEqual(Normalize.normalizePromptResponse(response), response);
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "projects any initialize reply onto the compat shape",
    [Arbitrary.schema(V2.InitializeResponse), Arbitrary.schema(V1.InitializeResponse)],
    ([v2, v1]) => {
      assert.isTrue(isCompatInitializeResponse(Normalize.normalizeInitializeResponse(v2)));
      assert.isTrue(isCompatInitializeResponse(Normalize.normalizeInitializeResponse(v1)));
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "delivers a compat permission request for any request of either generation",
    [Arbitrary.schema(V2.RequestPermissionRequest), Arbitrary.schema(V1.RequestPermissionRequest)],
    ([v2, v1]) => {
      assert.isTrue(isCompatPermissionRequest(Normalize.normalizePermissionRequest(v2, permissionContext)));
      assert.isTrue(isCompatPermissionRequest(Normalize.normalizePermissionRequest(v1, permissionContext)));
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "sends every compat MCP server as a tagged generation-2 server",
    [Arbitrary.schema(Compat.McpServer)],
    ([server]) => {
      assert.isTrue(isV2McpServer(Normalize.toV2McpServer(server)));
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "nests a flat elicitation result without losing fields",
    [Arbitrary.schema(V2.CreateElicitationResponse)],
    ([response]) => {
      const legacy = Normalize.toLegacyElicitationResponse(response);
      assert.isTrue(S.is(Compat.LegacyElicitationResponse)(legacy));
      assert.deepStrictEqual(
        legacy._meta === undefined ? legacy.action : { ...legacy.action, _meta: legacy._meta },
        response
      );
    },
    { arbitrary: fcRuns(50) }
  );
});
