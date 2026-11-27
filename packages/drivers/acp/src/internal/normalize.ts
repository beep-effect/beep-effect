/**
 * Projections between the generated generation-1 / generation-2 wire shapes and the normalized
 * client surface (`@beep/acp/compat`).
 *
 * Every projection is total and decides by validating against the generated member schemas
 * (`S.is`) instead of asserting a shape, so a value that matches no known member is kept as the
 * `_acp_unknown` sentinel rather than mistyped.
 *
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { dual, flow, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { V1_PROTOCOL_VERSION } from "../_generated/meta.gen.ts";
import * as V2 from "../_generated/schema.gen.ts";
import * as V1 from "../_generated/schema-v1.gen.ts";
import * as Compat from "../AcpCompat.models.ts";
import type { AcpRequestId } from "../Acp.errors.ts";
import type { AcpRequestContext } from "../AcpProtocol.service.ts";

const $I = $AcpId.create("internal/normalize");

const ProtocolGenerationBase = LiteralKit([1, 2]);

/**
 * ACP protocol generation a connection negotiated: `1` (schema-v1.26) or `2` (schema-v2).
 *
 * @since 0.0.0
 */
export const ProtocolGeneration = ProtocolGenerationBase.pipe(
  $I.annoteSchema("ProtocolGeneration", {
    description: "ACP protocol generation a connection negotiated.",
  }),
  SchemaUtils.withLiteralKitStatics(ProtocolGenerationBase)
);

/**
 * @since 0.0.0
 */
export type ProtocolGeneration = typeof ProtocolGeneration.Type;

/**
 * Client `info` sent when the caller's initialize request has no `clientInfo`.
 *
 * @since 0.0.0
 */
export const DEFAULT_CLIENT_INFO: V2.Implementation = { name: "@beep/acp", version: "unknown" };

const isGeneration1 = (generation: ProtocolGeneration): boolean => generation === 1;

const requestIdText = (requestId: AcpRequestId): string => (P.isString(requestId) ? requestId : `${requestId}`);

const isCompatContentBlock = S.is(Compat.ContentBlock);

/**
 * Keeps a known content block and turns any other content type into `UnknownContent`.
 *
 * @since 0.0.0
 */
export const normalizeContentBlock = (content: V2.ContentBlock | V1.ContentBlock): Compat.ContentBlock =>
  isCompatContentBlock(content)
    ? content
    : Compat.UnknownContent.make({ type: Compat.ACP_UNKNOWN, originalType: content.type, raw: content });

const normalizeContentList = (
  content: ReadonlyArray<V2.ContentBlock | V1.ContentBlock> | null
): ReadonlyArray<Compat.ContentBlock> | null => (P.isNull(content) ? null : A.map(content, normalizeContentBlock));

const [V2ContentToolCallContent] = V2.ToolCallContent.members;
const [V1ContentToolCallContent] = V1.ToolCallContent.members;
const isContentToolCallContent = S.is(S.Union([V2ContentToolCallContent, V1ContentToolCallContent]));
const isCompatToolCallContent = S.is(Compat.ToolCallContent);

/**
 * Normalizes the content block inside tool-call content, keeps diffs (either generation) and
 * terminals, and turns any other content type into `UnknownContent`.
 *
 * @since 0.0.0
 */
export const normalizeToolCallContent = (content: V2.ToolCallContent | V1.ToolCallContent): Compat.ToolCallContent =>
  Match.value(content).pipe(
    Match.when(isContentToolCallContent, (known) => ({ ...known, content: normalizeContentBlock(known.content) })),
    Match.when(isCompatToolCallContent, (known) => known),
    Match.orElse((other) =>
      Compat.UnknownContent.make({ type: Compat.ACP_UNKNOWN, originalType: other.type, raw: other })
    )
  );

const normalizeToolCallContents = (
  content: ReadonlyArray<V2.ToolCallContent | V1.ToolCallContent> | null
): ReadonlyArray<Compat.ToolCallContent> | null =>
  P.isNull(content) ? null : A.map(content, normalizeToolCallContent);

/**
 * Normalizes the tool-call content of a tool-call update; every other field is kept.
 *
 * @since 0.0.0
 */
export const normalizeToolCallUpdate = (update: V2.ToolCallUpdate | V1.ToolCallUpdate): Compat.ToolCallUpdate => {
  const { content, ...rest } = update;
  return {
    ...rest,
    ...O.getSomesStruct({ content: O.map(O.fromUndefinedOr(content), normalizeToolCallContents) }),
  };
};

const [V2SelectConfigOption, V2BooleanConfigOption] = V2.SessionConfigOption.members;
const isV2SelectConfigOption = S.is(V2SelectConfigOption);
const isV2BooleanConfigOption = S.is(V2BooleanConfigOption);

/**
 * Renames a generation-2 `configId` to `id`; config option types other than `select` and
 * `boolean` have no client shape and are dropped.
 *
 * @since 0.0.0
 */
export const normalizeConfigOption = (option: V2.SessionConfigOption): O.Option<Compat.SessionConfigOption> =>
  Match.value(option).pipe(
    Match.when(isV2SelectConfigOption, ({ configId, ...rest }) => O.some({ ...rest, id: configId })),
    Match.when(isV2BooleanConfigOption, ({ configId, ...rest }) => O.some({ ...rest, id: configId })),
    Match.orElse(() => O.none())
  );

/**
 * Normalizes every generation-2 config option and drops the unknown ones.
 *
 * @since 0.0.0
 */
export const normalizeConfigOptions: (
  options: ReadonlyArray<V2.SessionConfigOption>
) => ReadonlyArray<Compat.SessionConfigOption> = flow(A.map(normalizeConfigOption), A.getSomes);

const [
  V2UserMessageChunk,
  V2UserMessage,
  V2AgentMessageChunk,
  V2AgentMessage,
  V2AgentThoughtChunk,
  V2AgentThought,
  V2StateUpdate,
  V2ToolCallContentChunk,
  V2ToolCallUpdate,
  V2TerminalUpdate,
  V2TerminalOutputChunk,
  V2PlanUpdate,
  V2PlanRemoved,
  V2AvailableCommandsUpdate,
  V2ConfigOptionUpdate,
  V2SessionInfoUpdate,
  V2UsageUpdate,
  V2Notice,
  V2CompactionUpdate,
  V2CompactionSummaryChunk,
  V2SubagentUpdate,
  V2SessionMessage,
  V2SessionMessageChunk,
] = V2.SessionUpdate.members;
const [V2RunningState, , V2RequiresActionState] = V2StateUpdate.members;
const [
  V1UserMessageChunk,
  V1AgentMessageChunk,
  V1AgentThoughtChunk,
  V1ToolCall,
  V1ToolCallUpdate,
  V1Plan,
  V1PlanUpdate,
  V1PlanRemoved,
  V1AvailableCommandsUpdate,
  V1CurrentModeUpdate,
  V1ConfigOptionUpdate,
  V1SessionInfoUpdate,
  V1UsageUpdate,
  V1Notice,
  V1CompactionUpdate,
  V1CompactionSummaryChunk,
  V1SubagentUpdate,
  V1SessionMessage,
  V1SessionMessageChunk,
] = V1.SessionUpdate.members;

const isMessageChunk = S.is(
  S.Union([
    V2UserMessageChunk,
    V2AgentMessageChunk,
    V2AgentThoughtChunk,
    V1UserMessageChunk,
    V1AgentMessageChunk,
    V1AgentThoughtChunk,
    V2SessionMessageChunk,
    V1SessionMessageChunk,
  ])
);
const isMessage = S.is(S.Union([V2UserMessage, V2AgentMessage, V2AgentThought, V2SessionMessage, V1SessionMessage]));
const isToolCall = S.is(V1ToolCall);
const isToolCallUpdate = S.is(S.Union([V2ToolCallUpdate, V1ToolCallUpdate]));
const isToolCallContentChunk = S.is(V2ToolCallContentChunk);
const isCompatIdleState = S.is(Compat.IdleStateUpdate);
const isIdleWithMalformedError = S.is(
  S.StructWithRest(
    Compat.IdleStateUpdate.schema.pipe(S.fieldsAssign({ error: S.Json })),
    Compat.IdleStateUpdate.records
  )
);
// decision: shared-update-kinds-match-both-generations
const isPassThroughUpdate = S.is(
  S.Union([
    V2RunningState,
    V2RequiresActionState,
    V2TerminalUpdate,
    V2TerminalOutputChunk,
    V2PlanUpdate,
    V2PlanRemoved,
    V2SessionInfoUpdate,
    V2UsageUpdate,
    V2Notice,
    V2SubagentUpdate,
    V1Plan,
    V1PlanUpdate,
    V1PlanRemoved,
    V1CurrentModeUpdate,
    V1ConfigOptionUpdate,
    V1SessionInfoUpdate,
    V1UsageUpdate,
    V1Notice,
    V1SubagentUpdate,
  ])
);
const isAvailableCommandsUpdate = S.is(S.Union([V2AvailableCommandsUpdate, V1AvailableCommandsUpdate]));
const isV2ConfigOptionUpdate = S.is(V2ConfigOptionUpdate);
const isCompatConfigOptionUpdate = S.is(
  S.StructWithRest(
    V2ConfigOptionUpdate.schema.pipe(S.fieldsAssign({ configOptions: S.Array(Compat.SessionConfigOption) })),
    V2ConfigOptionUpdate.records
  )
);
const isCompactionUpdate = S.is(S.Union([V2CompactionUpdate, V1CompactionUpdate]));
const isCompactionSummaryChunk = S.is(S.Union([V2CompactionSummaryChunk, V1CompactionSummaryChunk]));
const isUnknownSessionUpdate = S.is(Compat.UnknownSessionUpdate);

const Generation1OnlySessionUpdateKindBase = LiteralKit(["tool_call", "plan", "current_mode_update"]);
const Generation1OnlySessionUpdateKind = Generation1OnlySessionUpdateKindBase.pipe(
  $I.annoteSchema("Generation1OnlySessionUpdateKind", {
    description: "Session update kinds that only generation 1 defines.",
  }),
  SchemaUtils.withLiteralKitStatics(Generation1OnlySessionUpdateKindBase)
);

const [V2TextCommandInput] = V2.AvailableCommandInput.members;
const isTextCommandInput = S.is(V2TextCommandInput);
const isV1CommandInput = S.is(V1.UnstructuredCommandInput);

type CommandInput = Exclude<Compat.AvailableCommand["input"], undefined>;

const normalizeCommandInput = (generation: ProtocolGeneration, input: unknown): O.Option<CommandInput> =>
  Match.value(input).pipe(
    Match.when(isTextCommandInput, (text) => O.some(text)),
    Match.when(isV1CommandInput, (legacy) =>
      isGeneration1(generation) ? O.some<CommandInput>({ type: "text", hint: legacy.hint }) : O.some(null)
    ),
    Match.orElse(() => (isGeneration1(generation) ? O.none() : O.some(null)))
  );

const normalizeAvailableCommand =
  (generation: ProtocolGeneration) =>
  (command: V2.AvailableCommand | V1.AvailableCommand): Compat.AvailableCommand => {
    const { input, ...rest } = command;
    return { ...rest, ...O.getSomesStruct({ input: normalizeCommandInput(generation, input) }) };
  };

type WireSessionUpdate = V2.SessionUpdate | V1.SessionUpdate | Compat.SessionUpdate;

const toUnknownSessionUpdate = (update: WireSessionUpdate): Compat.SessionUpdate =>
  Compat.UnknownSessionUpdate.make({
    sessionUpdate: Compat.ACP_UNKNOWN,
    originalSessionUpdate: update.sessionUpdate,
    raw: update,
  });

const normalizeKnownSessionUpdate = (generation: ProtocolGeneration, update: WireSessionUpdate): Compat.SessionUpdate =>
  Match.value(update).pipe(
    Match.when(isUnknownSessionUpdate, (unknownUpdate) => unknownUpdate),
    Match.when(isMessageChunk, (chunk) => ({ ...chunk, content: normalizeContentBlock(chunk.content) })),
    Match.when(isMessage, ({ content, ...rest }) => ({
      ...rest,
      ...O.getSomesStruct({ content: O.map(O.fromUndefinedOr(content), normalizeContentList) }),
    })),
    Match.when(isToolCall, ({ content, ...rest }) => ({
      ...rest,
      ...O.getSomesStruct({ content: O.map(O.fromUndefinedOr(content), A.map(normalizeToolCallContent)) }),
    })),
    Match.when(isToolCallUpdate, ({ sessionUpdate, ...toolCall }) => ({
      ...normalizeToolCallUpdate(toolCall),
      sessionUpdate,
    })),
    Match.when(isToolCallContentChunk, (chunk) => ({ ...chunk, content: normalizeToolCallContent(chunk.content) })),
    Match.when(isCompatIdleState, (idle) => idle),
    Match.when(isIdleWithMalformedError, ({ error: _invalidError, ...idle }) => idle),
    Match.when(isPassThroughUpdate, (passThrough) => passThrough),
    Match.when(isCompatConfigOptionUpdate, (options) => options),
    Match.when(isAvailableCommandsUpdate, (commands) => ({
      ...commands,
      availableCommands: A.map(commands.availableCommands, normalizeAvailableCommand(generation)),
    })),
    Match.when(isV2ConfigOptionUpdate, (options) => ({
      ...options,
      configOptions: normalizeConfigOptions(options.configOptions),
    })),
    Match.when(isCompactionUpdate, ({ summary, ...rest }) => ({
      ...rest,
      ...O.getSomesStruct({ summary: O.map(O.fromUndefinedOr(summary), normalizeContentList) }),
    })),
    Match.when(isCompactionSummaryChunk, (chunk) => ({ ...chunk, content: normalizeContentBlock(chunk.content) })),
    Match.orElse(toUnknownSessionUpdate)
  );

const isGeneration1OnlySessionUpdateKind = S.is(Generation1OnlySessionUpdateKind);

/**
 * Projects one session update onto the client surface.
 *
 * **Details**
 *
 * Content blocks and tool-call content are normalized, generation-2 config options are renamed
 * to `id`, and command inputs follow the generation's rules. A kind both generations define is
 * kept when either generation's member accepts it, so a valid generation-1 `usage_update` whose
 * currency code generation 2 would reject keeps its kind. The generation-1-only kinds
 * (`tool_call`, `plan`, `current_mode_update`) become `UnknownSessionUpdate` on a generation-2
 * connection, and so does every kind the client does not know. Normalizing an already normalized
 * update returns an equal update.
 *
 * @since 0.0.0
 */
export const normalizeSessionUpdate: {
  (generation: ProtocolGeneration): (update: WireSessionUpdate) => Compat.SessionUpdate;
  (update: WireSessionUpdate, generation: ProtocolGeneration): Compat.SessionUpdate;
} = dual(
  2,
  (update: WireSessionUpdate, generation: ProtocolGeneration): Compat.SessionUpdate =>
    !isGeneration1(generation) && isGeneration1OnlySessionUpdateKind(update.sessionUpdate)
      ? toUnknownSessionUpdate(update)
      : normalizeKnownSessionUpdate(generation, update)
);

/**
 * `session/update` params as the protocol decodes them, before or after normalization.
 *
 * @since 0.0.0
 */
export type WireSessionNotification =
  | V2.UpdateSessionNotification
  | V1.SessionNotification
  | Compat.SessionNotification;

/**
 * Projects decoded `session/update` params onto the client surface (see
 * {@link normalizeSessionUpdate}).
 *
 * **Details**
 *
 * The data-last form plugs straight into the protocol's `transformSessionUpdate` option.
 *
 * @since 0.0.0
 */
export const normalizeSessionNotification: {
  (generation: ProtocolGeneration): (notification: WireSessionNotification) => Compat.SessionNotification;
  (notification: WireSessionNotification, generation: ProtocolGeneration): Compat.SessionNotification;
} = dual(
  2,
  (notification: WireSessionNotification, generation: ProtocolGeneration): Compat.SessionNotification => ({
    ...notification,
    update: normalizeSessionUpdate(notification.update, generation),
  })
);

/**
 * Guard for the idle `state_update` that completes a generation-2 prompt.
 *
 * @since 0.0.0
 */
export const isIdleStateUpdate = isCompatIdleState;

/**
 * Builds the prompt result a generation-2 turn reports on its idle `state_update`; the stop
 * reason defaults to `end_turn`.
 *
 * @since 0.0.0
 */
export const promptResponseFromIdle = (idle: Compat.IdleStateUpdate): Compat.PromptResponse => ({
  stopReason: idle.stopReason ?? "end_turn",
  ...O.getSomesStruct({ usage: O.fromUndefinedOr(idle.usage), _meta: O.fromUndefinedOr(idle._meta) }),
});

/**
 * Generation-2 `session/prompt` acknowledgement whose `messageId` may be missing.
 *
 * **Details**
 *
 * `schema-v2.0.0-alpha.9` requires `messageId`. The client decodes a prompt result as the compat
 * result first and through this open member second, so a generation-1 result outside both
 * schemas, or an acknowledgement from an agent on an earlier draft, still decodes and keeps its
 * stop reason.
 *
 * @since 0.0.0
 */
export const OpenPromptAcknowledgement = S.StructWithRest(
  V2.PromptResponse.schema.pipe(S.fieldsAssign({ messageId: V2.MessageId.pipe(S.optionalKey) })),
  V2.PromptResponse.records
).pipe(
  $I.annoteSchema("OpenPromptAcknowledgement", {
    description: "Generation-2 session/prompt acknowledgement with an optional messageId.",
  })
);

/**
 * @since 0.0.0
 */
export type OpenPromptAcknowledgement = typeof OpenPromptAcknowledgement.Type;

const isCompatPromptResponse = S.is(Compat.PromptResponse);
const isUsage = S.is(V2.Usage);

/**
 * Projects the result a generation-1 agent returns from `session/prompt` onto the client shape.
 *
 * **Details**
 *
 * A result the client shape accepts (any stop reason string) is kept. Any other result was
 * decoded through the open generation-2 acknowledgement member; its stop reason is still kept when
 * it is a string, a malformed `usage` is dropped, and only a missing or non-string stop reason
 * becomes `end_turn`.
 *
 * @since 0.0.0
 */
export const normalizePromptResponse = (
  response: Compat.PromptResponse | OpenPromptAcknowledgement
): Compat.PromptResponse =>
  isCompatPromptResponse(response)
    ? response
    : {
        stopReason: O.getOrElse(O.liftPredicate(response.stopReason, P.isString), () => "end_turn"),
        ...O.getSomesStruct({
          usage: O.liftPredicate(response.usage, isUsage),
          _meta: O.fromUndefinedOr(response._meta),
        }),
      };

const isUnknownContent = S.is(Compat.UnknownContent);
const isWireContentBlock = S.is(S.Union([V2.ContentBlock, V1.ContentBlock]));

/**
 * Projects a content block the caller sends back onto the wire.
 *
 * **Details**
 *
 * A caller may re-send content the client delivered. An `UnknownContent` becomes the original
 * block it carries in `raw`, and a known block is kept. `None` when `raw` is not a content block
 * or is itself an `_acp_unknown` sentinel, so the sentinel never reaches the agent.
 *
 * @since 0.0.0
 */
export const toWireContentBlock = (content: Compat.ContentBlock): O.Option<V2.ContentBlock | V1.ContentBlock> =>
  isUnknownContent(content)
    ? pipe(
        O.liftPredicate(content.raw, isWireContentBlock),
        O.filter((block) => block.type !== Compat.ACP_UNKNOWN)
      )
    : O.some(content);

/**
 * Projects a `session/prompt` payload onto the wire (see {@link toWireContentBlock}); `None` when a
 * prompt block has no wire form.
 *
 * @since 0.0.0
 */
export const toWirePromptRequest = (request: Compat.PromptRequest): O.Option<V2.PromptRequest> =>
  O.map(O.all(A.map(request.prompt, toWireContentBlock)), (prompt) => ({ ...request, prompt }));

/**
 * Projects the caller's initialize request onto a generation-2 request; `info` defaults to
 * {@link DEFAULT_CLIENT_INFO}.
 *
 * @since 0.0.0
 */
export const toV2InitializeRequest = (request: Compat.InitializeRequest): V2.InitializeRequest => {
  const capabilities = O.fromUndefinedOr(request.clientCapabilities);
  return {
    protocolVersion: 2,
    info: request.clientInfo ?? DEFAULT_CLIENT_INFO,
    capabilities: O.getSomesStruct({
      auth: pipe(
        capabilities,
        O.flatMapNullishOr((value) => value.auth),
        O.filter((auth) => auth.terminal === true),
        O.as({ terminal: {} })
      ),
      elicitation: O.flatMapNullishOr(capabilities, (value) => value.elicitation),
      _meta: O.flatMap(capabilities, (value) => O.fromUndefinedOr(value._meta)),
    }),
    ...O.getSomesStruct({ _meta: O.fromUndefinedOr(request._meta) }),
  };
};

/**
 * Builds the negotiating initialize request: the generation-2 fields (`protocolVersion: 2`,
 * `info`, `capabilities`) plus the generation-1 `clientCapabilities` and `clientInfo`, so an agent
 * of either generation can answer it.
 *
 * @since 0.0.0
 */
export const toNegotiatingInitializeRequest = (request: Compat.InitializeRequest): V2.InitializeRequest => ({
  ...toV2InitializeRequest(request),
  clientCapabilities: request.clientCapabilities ?? {},
  ...O.getSomesStruct({ clientInfo: O.fromUndefinedOr(request.clientInfo) }),
});

/**
 * Builds a pure generation-1 initialize request (`protocolVersion: 1`) for connections pinned to
 * generation 1.
 *
 * @since 0.0.0
 */
export const toV1InitializeRequest = (request: Compat.InitializeRequest): V1.InitializeRequest => ({
  ...request,
  protocolVersion: V1_PROTOCOL_VERSION,
});

/**
 * Detects a generation-2 initialize result by its shape (`info`), not by `protocolVersion`: some
 * agents report version 2 with the generation-1 shape.
 *
 * @since 0.0.0
 */
export const isV2InitializeResponse: (
  response: V1.InitializeResponse | V2.InitializeResponse
) => response is V2.InitializeResponse = S.is(V2.InitializeResponse);

const [V2TerminalAuthMethod, V2AgentAuthMethod] = V2.AuthMethod.members;
const isV2TerminalAuthMethod = S.is(V2TerminalAuthMethod);
const isV2AgentAuthMethod = S.is(V2AgentAuthMethod);

const WireEnvVarAuthVariable = S.StructWithRest(
  S.Struct({
    name: S.String,
    label: S.optionalKey(S.Json),
  }),
  [S.Record(S.String, S.Json)]
);
const WireEnvVarAuthMethod = S.StructWithRest(
  S.Struct({
    type: S.tag("env_var"),
    vars: S.Array(WireEnvVarAuthVariable),
    link: S.optionalKey(S.Json),
  }),
  [S.Record(S.String, S.Json)]
);
const isWireEnvVarAuthMethod = S.is(WireEnvVarAuthMethod);

const keepString = (value: unknown): O.Option<string> => O.liftPredicate(value, P.isString);

const authMethodBase = (method: V2.AuthMethod) => ({
  id: method.methodId,
  name: method.name,
  ...O.getSomesStruct({
    description: O.fromUndefinedOr(method.description),
    _meta: O.fromUndefinedOr(method._meta),
  }),
});

const normalizeAuthMethod = (method: V2.AuthMethod): O.Option<Compat.AuthMethod> =>
  Match.value(method).pipe(
    Match.when(isV2TerminalAuthMethod, (terminal) =>
      O.some({
        ...authMethodBase(terminal),
        type: "terminal" as const,
        ...O.getSomesStruct({
          args: O.fromUndefinedOr(terminal.args),
          env: O.map(
            O.fromUndefinedOr(terminal.env),
            flow(
              A.map((variable): readonly [string, string] => [variable.name, variable.value]),
              R.fromEntries
            )
          ),
        }),
      })
    ),
    Match.when(isV2AgentAuthMethod, (agent) => O.some({ ...authMethodBase(agent), type: "agent" as const })),
    Match.when(isWireEnvVarAuthMethod, (envVar) =>
      O.some({
        ...authMethodBase(method),
        type: "env_var" as const,
        vars: A.map(envVar.vars, (variable) => ({
          name: variable.name,
          ...O.getSomesStruct({ label: keepString(variable.label) }),
        })),
        ...O.getSomesStruct({ link: keepString(envVar.link) }),
      })
    ),
    Match.orElse(() => O.none())
  );

const hasCapability = <A>(self: O.Option<A>, field: (value: A) => unknown): boolean =>
  O.isSome(O.flatMapNullishOr(self, field));

const normalizeAgentCapabilities = (response: V2.InitializeResponse): Compat.AgentCapabilities => {
  const capabilities = O.fromUndefinedOr(response.capabilities);
  const session = O.flatMapNullishOr(capabilities, (value) => value.session);
  const prompt = O.flatMapNullishOr(session, (value) => value.prompt);
  const mcp = O.flatMapNullishOr(session, (value) => value.mcp);
  return {
    loadSession: O.isSome(session),
    promptCapabilities: {
      image: hasCapability(prompt, (value) => value.image),
      audio: hasCapability(prompt, (value) => value.audio),
      embeddedContext: hasCapability(prompt, (value) => value.embeddedContext),
    },
    mcpCapabilities: {
      stdio: hasCapability(mcp, (value) => value.stdio),
      http: hasCapability(mcp, (value) => value.http),
      acp: hasCapability(mcp, (value) => value.acp),
    },
    ...O.getSomesStruct({
      sessionCapabilities: O.map(session, (value) => ({
        list: {},
        resume: {},
        close: {},
        ...O.getSomesStruct({
          delete: O.as(O.fromNullishOr(value.delete), {}),
          fork: O.as(O.fromNullishOr(value.fork), {}),
          additionalDirectories: O.as(O.fromNullishOr(value.additionalDirectories), {}),
        }),
      })),
      providers: O.as(
        O.flatMapNullishOr(capabilities, (value) => value.providers),
        {}
      ),
      auth: pipe(O.fromUndefinedOr(response.authMethods), O.filter(A.isReadonlyArrayNonEmpty), O.as({ logout: {} })),
    }),
  };
};

const fromV2InitializeResponse = (response: V2.InitializeResponse): Compat.InitializeResponse => ({
  protocolVersion: response.protocolVersion,
  agentInfo: response.info,
  agentCapabilities: normalizeAgentCapabilities(response),
  ...O.getSomesStruct({
    authMethods: O.map(O.fromUndefinedOr(response.authMethods), flow(A.map(normalizeAuthMethod), A.getSomes)),
    _meta: O.fromUndefinedOr(response._meta),
  }),
});

/**
 * Projects an initialize result of either generation onto the client's generation-1 shape.
 *
 * **Details**
 *
 * A generation-2 result maps `info` to `agentInfo`, sets `loadSession` and the `list`, `resume`
 * and `close` session capabilities when a session capability is advertised (plus `delete`, `fork`
 * and `additionalDirectories` when present), synthesizes `auth.logout` when auth methods exist,
 * renames auth `methodId` to `id`, turns terminal `env` arrays into records, and drops auth
 * method types it does not know. A generation-1 result is kept.
 *
 * @since 0.0.0
 */
export const normalizeInitializeResponse = (
  response: V1.InitializeResponse | V2.InitializeResponse
): Compat.InitializeResponse => (isV2InitializeResponse(response) ? fromV2InitializeResponse(response) : response);

const isV2McpServer = S.is(V2.McpServer);

/**
 * Adds `type: "stdio"` to an untagged generation-1 stdio server; tagged servers are kept.
 *
 * @since 0.0.0
 */
export const toV2McpServer = (server: Compat.McpServer): V2.McpServer =>
  isV2McpServer(server) ? server : { ...server, type: "stdio" };

const toV2McpServers: (servers: ReadonlyArray<Compat.McpServer>) => ReadonlyArray<V2.McpServer> = A.map(toV2McpServer);

/**
 * Projects a `session/new` payload onto generation 2.
 *
 * @since 0.0.0
 */
export const toV2NewSessionRequest = (request: Compat.NewSessionRequest): V2.NewSessionRequest => ({
  ...request,
  mcpServers: toV2McpServers(request.mcpServers),
});

const toV2ResumeRequest = (
  request: Compat.ResumeSessionRequest | Compat.LoadSessionRequest,
  replayFrom: O.Option<V2.ReplayFrom>
): V2.ResumeSessionRequest => {
  const { mcpServers, ...rest } = request;
  return {
    ...rest,
    ...O.getSomesStruct({ mcpServers: O.map(O.fromUndefinedOr(mcpServers), toV2McpServers), replayFrom }),
  };
};

/**
 * Projects a `session/resume` payload onto generation 2, keeping its `replayFrom`.
 *
 * @since 0.0.0
 */
export const toV2ResumeSessionRequest = (request: Compat.ResumeSessionRequest): V2.ResumeSessionRequest =>
  toV2ResumeRequest(request, O.fromNullishOr(request.replayFrom));

/**
 * Projects a generation-1 `session/load` payload onto a generation-2 `session/resume` that
 * replays the session from the start.
 *
 * @since 0.0.0
 */
export const toV2LoadSessionRequest = (request: Compat.LoadSessionRequest): V2.ResumeSessionRequest =>
  toV2ResumeRequest(request, O.some({ type: "start" }));

/**
 * Projects a `session/fork` payload onto generation 2.
 *
 * @since 0.0.0
 */
export const toV2ForkSessionRequest = (request: Compat.ForkSessionRequest): V2.ForkSessionRequest => {
  const { mcpServers, ...rest } = request;
  return { ...rest, ...O.getSomesStruct({ mcpServers: O.map(O.fromUndefinedOr(mcpServers), toV2McpServers) }) };
};

const [V1BooleanConfigOptionRequest] = V1.SetSessionConfigOptionRequest.members;
const isV1BooleanConfigOptionRequest = S.is(V1BooleanConfigOptionRequest);

/**
 * Adds the `type` generation 2 requires on `session/set_config_option`: `boolean` for a boolean
 * value, `id` otherwise.
 *
 * @since 0.0.0
 */
export const toV2SetSessionConfigOptionRequest = (
  request: Compat.SetSessionConfigOptionRequest
): V2.SetSessionConfigOptionRequest => (isV1BooleanConfigOptionRequest(request) ? request : { ...request, type: "id" });

const setupResponseFields = (response: V2.NewSessionResponse | V2.ResumeSessionResponse | V2.ForkSessionResponse) =>
  O.getSomesStruct({
    configOptions: O.map(O.fromUndefinedOr(response.configOptions), normalizeConfigOptions),
    _meta: O.fromUndefinedOr(response._meta),
  });

const isCompatNewSessionResponse = S.is(Compat.NewSessionResponse);
const isCompatResumeSessionResponse = S.is(Compat.ResumeSessionResponse);
const isCompatForkSessionResponse = S.is(Compat.ForkSessionResponse);

/**
 * Keeps a generation-1 `session/new` result; a generation-2 result keeps `sessionId`, normalized
 * config options and `_meta`.
 *
 * @since 0.0.0
 */
export const normalizeNewSessionResponse = (
  response: Compat.NewSessionResponse | V2.NewSessionResponse
): Compat.NewSessionResponse =>
  isCompatNewSessionResponse(response) ? response : { sessionId: response.sessionId, ...setupResponseFields(response) };

/**
 * Keeps a generation-1 `session/load` or `session/resume` result; a generation-2 result keeps
 * normalized config options and `_meta`.
 *
 * @since 0.0.0
 */
export const normalizeResumeSessionResponse = (
  response: Compat.ResumeSessionResponse | V2.ResumeSessionResponse
): Compat.ResumeSessionResponse => (isCompatResumeSessionResponse(response) ? response : setupResponseFields(response));

/**
 * Keeps a generation-1 `session/fork` result; a generation-2 result keeps `sessionId`, normalized
 * config options and `_meta`.
 *
 * @since 0.0.0
 */
export const normalizeForkSessionResponse = (
  response: Compat.ForkSessionResponse | V2.ForkSessionResponse
): Compat.ForkSessionResponse =>
  isCompatForkSessionResponse(response)
    ? response
    : { sessionId: response.sessionId, ...setupResponseFields(response) };

const isV1SetSessionConfigOptionResponse = S.is(V1.SetSessionConfigOptionResponse);

/**
 * Keeps a generation-1 `session/set_config_option` result; a generation-2 result becomes its
 * normalized config options.
 *
 * @since 0.0.0
 */
export const normalizeSetSessionConfigOptionResponse = (
  response: V1.SetSessionConfigOptionResponse | V2.SetSessionConfigOptionResponse
): Compat.SetSessionConfigOptionResponse =>
  isV1SetSessionConfigOptionResponse(response)
    ? response
    : { configOptions: normalizeConfigOptions(response.configOptions) };

/**
 * `session/request_permission` params as either generation sends them.
 *
 * @since 0.0.0
 */
export type WirePermissionRequest = V2.RequestPermissionRequest | V1.RequestPermissionRequest;

const isV1RequestPermissionRequest = S.is(V1.RequestPermissionRequest);
const [V2ToolCallSubject, V2CommandSubject] = V2.RequestPermissionSubject.members;
const isToolCallSubject = S.is(V2ToolCallSubject);
const isCommandSubject = S.is(V2CommandSubject);

const permissionToolCall = (request: V2.RequestPermissionRequest, context: AcpRequestContext): Compat.ToolCallUpdate =>
  Match.value(request.subject).pipe(
    Match.when(isToolCallSubject, (subject) => normalizeToolCallUpdate(subject.toolCall)),
    Match.when(isCommandSubject, (subject) => ({
      toolCallId: subject.toolCallId ?? requestIdText(context.requestId),
      title: request.title,
      kind: "execute" as const,
    })),
    Match.orElse(() => ({ toolCallId: requestIdText(context.requestId), title: request.title, kind: "other" as const }))
  );

/**
 * Projects a `session/request_permission` request of either generation onto the client shape, in
 * which `toolCall` is always present.
 *
 * **Details**
 *
 * A generation-1 request keeps its tool call (with normalized content). A generation-2 request
 * takes the tool call from a `tool_call` subject; a `command` subject yields an `execute` tool
 * call whose id is the subject's `toolCallId` or the request id; any other subject yields an
 * `other` tool call with the request id. The request `title` titles the synthesized tool call.
 *
 * @since 0.0.0
 */
export const normalizePermissionRequest: {
  (context: AcpRequestContext): (request: WirePermissionRequest) => Compat.RequestPermissionRequest;
  (request: WirePermissionRequest, context: AcpRequestContext): Compat.RequestPermissionRequest;
} = dual(
  2,
  (request: WirePermissionRequest, context: AcpRequestContext): Compat.RequestPermissionRequest =>
    isV1RequestPermissionRequest(request)
      ? { ...request, toolCall: normalizeToolCallUpdate(request.toolCall) }
      : { ...request, toolCall: permissionToolCall(request, context) }
);

const decodeElicitationRequestUnknown = S.decodeUnknownEffect(
  S.Union([V2.CreateElicitationRequest, V1.CreateElicitationRequest])
);

/**
 * Decodes an `elicitation/create` payload as either generation's request.
 *
 * @since 0.0.0
 */
export const decodeElicitationRequest = (input: unknown) => decodeElicitationRequestUnknown(input);

/**
 * Wraps a flat elicitation result as the nested result the legacy `session/elicitation` methods
 * expect: `{ action: <result without _meta>, _meta }`.
 *
 * @since 0.0.0
 */
export const toLegacyElicitationResponse = (
  response: Compat.CreateElicitationResponse
): Compat.LegacyElicitationResponse => {
  const { _meta, ...action } = response;
  return Compat.LegacyElicitationResponse.make({
    action,
    ...O.getSomesStruct({ _meta: O.fromUndefinedOr(_meta) }),
  });
};
