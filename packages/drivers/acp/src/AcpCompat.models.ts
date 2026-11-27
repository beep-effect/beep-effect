/**
 * Normalized ACP client surface shared by protocol generations 1 and 2.
 *
 * **Details**
 *
 * The dual-generation client speaks one shape to its callers whatever generation the agent
 * negotiates. That shape is generation-1 flavoured (`clientCapabilities`, `agentCapabilities`,
 * `authMethods[].id`, session `modes` and the legacy `models`) and widened to carry generation-2
 * content: message, state, terminal and compaction session updates, structured diffs, and
 * permission subjects. Every name here is a schema built from the generated generation-1
 * (`@beep/acp/schema-v1`) and generation-2 (`@beep/acp/schema`) members:
 *
 * - names that are identical in both generations are re-exported unchanged;
 * - names whose fields differ are derived from a generated member with the differing fields
 *   replaced, so unknown keys keep flowing through the open (rest) part of the struct;
 * - content, tool-call content and session-update variants that neither generation's client
 *   understands are carried by the `_acp_unknown` sentinel members (`UnknownContent`,
 *   `UnknownSessionUpdate`) with the original JSON in `raw`;
 * - the removed unstable model-selection API (`session/set_model`) that older generation-1
 *   agents still advertise is modeled here as `ModelInfo`, `SessionModelState`,
 *   `SetSessionModelRequest` and `SetSessionModelResponse`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as V2 from "./_generated/schema.gen.ts";
import * as V1 from "./_generated/schema-v1.gen.ts";

const $I = $AcpId.create("compat");

/**
 * Sentinel `type` / `sessionUpdate` value for variants the client does not understand.
 *
 * **Example** (Recognize an unknown content block)
 *
 * ```ts
 * import { ACP_UNKNOWN } from "@beep/acp/compat"
 *
 * console.log(ACP_UNKNOWN) // "_acp_unknown"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ACP_UNKNOWN = "_acp_unknown";

const LegacyMeta = S.Record(S.String, S.Json).pipe(S.NullOr, S.optionalKey).annotateKey({
  description: "Reserved ACP `_meta` extension payload.",
});

// decision: unknown-sentinels-stay-structural
const UnknownContentFields = S.Struct({
  type: S.tag(ACP_UNKNOWN).annotateKey({
    description: "The `_acp_unknown` sentinel.",
  }),
  originalType: S.String.annotateKey({
    description: "The `type` the agent sent.",
  }),
  raw: S.Json.annotateKey({
    description: "The complete wire object, unchanged.",
  }),
});

const UnknownSessionUpdateFields = S.Struct({
  sessionUpdate: S.tag(ACP_UNKNOWN).annotateKey({
    description: "The `_acp_unknown` sentinel.",
  }),
  originalSessionUpdate: S.String.annotateKey({
    description: "The `sessionUpdate` kind the agent sent.",
  }),
  raw: S.Json.annotateKey({
    description: "The complete wire update object, unchanged.",
  }),
});

/**
 * **Details**
 *
 * Generation 2 lets agents send content types added after the pinned schema. The client keeps
 * them instead of failing: `originalType` is the wire `type` and `raw` is the whole wire object.
 *
 * **Example** (Make an unknown content block)
 *
 * ```ts
 * import { UnknownContent } from "@beep/acp/compat"
 *
 * const content = UnknownContent.make({
 *   type: "_acp_unknown",
 *   originalType: "chart",
 *   raw: { type: "chart", points: [] }
 * })
 * console.log(content.originalType) // "chart"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UnknownContent = UnknownContentFields.pipe(
  $I.annoteSchema("UnknownContent", {
    description: "Content block or tool-call content whose type the client does not understand.",
  })
);

/**
 * **Example** (Read the original content type)
 *
 * ```ts
 * import type { UnknownContent } from "@beep/acp/compat"
 *
 * const originalTypeOf = (content: UnknownContent) => content.originalType
 * console.log(originalTypeOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UnknownContent = typeof UnknownContent.Type;

/**
 * **Example** (Make an unknown session update)
 *
 * ```ts
 * import { UnknownSessionUpdate } from "@beep/acp/compat"
 *
 * const update = UnknownSessionUpdate.make({
 *   sessionUpdate: "_acp_unknown",
 *   originalSessionUpdate: "timeline_update",
 *   raw: { sessionUpdate: "timeline_update", entries: [] }
 * })
 * console.log(update.originalSessionUpdate) // "timeline_update"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UnknownSessionUpdate = UnknownSessionUpdateFields.pipe(
  $I.annoteSchema("UnknownSessionUpdate", {
    description: "Session update whose kind the client does not understand.",
  })
);

/**
 * **Example** (Read the original update kind)
 *
 * ```ts
 * import type { UnknownSessionUpdate } from "@beep/acp/compat"
 *
 * const originalKindOf = (update: UnknownSessionUpdate) => update.originalSessionUpdate
 * console.log(originalKindOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UnknownSessionUpdate = typeof UnknownSessionUpdate.Type;

/**
 * **Example** (Make model info)
 *
 * ```ts
 * import { ModelInfo } from "@beep/acp/compat"
 *
 * const model = ModelInfo.make({ modelId: "fast", name: "Fast" })
 * console.log(model.modelId) // "fast"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelInfo extends S.Opaque<ModelInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    modelId: S.String.annotateKey({ description: "Agent-defined model identifier." }),
    name: S.String.annotateKey({ description: "Human-readable model name." }),
    description: S.String.pipe(S.NullOr, S.optionalKey).annotateKey({
      description: "Optional model description.",
    }),
    _meta: LegacyMeta,
  }).pipe(
    $I.annoteSchema("ModelInfo", {
      description: "Model an older generation-1 agent offers through the removed session/set_model API.",
    })
  )
) {}

/**
 * **Example** (Make a model state)
 *
 * ```ts
 * import { ModelInfo, SessionModelState } from "@beep/acp/compat"
 *
 * const state = SessionModelState.make({
 *   currentModelId: "fast",
 *   availableModels: [ModelInfo.make({ modelId: "fast", name: "Fast" })]
 * })
 * console.log(state.availableModels.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionModelState extends S.Opaque<SessionModelState, { readonly brand: unique symbol }>()(
  S.Struct({
    currentModelId: S.String.annotateKey({ description: "Identifier of the selected model." }),
    availableModels: S.Array(ModelInfo).annotateKey({ description: "Models the agent offers." }),
    _meta: LegacyMeta,
  }).pipe(
    $I.annoteSchema("SessionModelState", {
      description: "Current and available models reported by an older generation-1 agent.",
    })
  )
) {}

/**
 * **Example** (Make a set-model request)
 *
 * ```ts
 * import { SetSessionModelRequest } from "@beep/acp/compat"
 *
 * const request = SetSessionModelRequest.make({ sessionId: "session-1", modelId: "fast" })
 * console.log(request.modelId) // "fast"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SetSessionModelRequest extends S.Opaque<SetSessionModelRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    sessionId: S.String.annotateKey({ description: "Session whose model changes." }),
    modelId: S.String.annotateKey({ description: "Model to select." }),
    _meta: LegacyMeta,
  }).pipe(
    $I.annoteSchema("SetSessionModelRequest", {
      description: "Payload of the legacy session/set_model request.",
    })
  )
) {}

/**
 * **Example** (Make an empty set-model response)
 *
 * ```ts
 * import { SetSessionModelResponse } from "@beep/acp/compat"
 *
 * console.log(SetSessionModelResponse.make({}))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SetSessionModelResponse extends S.Opaque<SetSessionModelResponse, { readonly brand: unique symbol }>()(
  S.Struct({ _meta: LegacyMeta }).pipe(
    $I.annoteSchema("SetSessionModelResponse", {
      description: "Result of the legacy session/set_model request.",
    })
  )
) {}

/**
 * **Details**
 *
 * The client's elicitation handler returns the flat `CreateElicitationResponse`. For the legacy
 * method names the client wraps it as `{ action: <response without _meta>, _meta }`.
 *
 * **Example** (Wrap a decline)
 *
 * ```ts
 * import { LegacyElicitationResponse } from "@beep/acp/compat"
 *
 * const response = LegacyElicitationResponse.make({ action: { action: "decline" } })
 * console.log(response.action)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegacyElicitationResponse extends S.Opaque<LegacyElicitationResponse, { readonly brand: unique symbol }>()(
  S.Struct({
    action: V2.CreateElicitationResponse.annotateKey({
      description: "The flat elicitation response, without its `_meta`.",
    }),
    _meta: LegacyMeta,
  }).pipe(
    $I.annoteSchema("LegacyElicitationResponse", {
      description: "Nested elicitation result expected by native agents from the legacy session/elicitation methods.",
    })
  )
) {}

const [V2TextContent, V2ImageContent, V2AudioContent, V2ResourceLinkContent, V2ResourceContent] =
  V2.ContentBlock.members;

/**
 * **Details**
 *
 * The five known generation-2 content types, the generation-1 content block, or `UnknownContent`
 * for a type added after the pinned schema.
 *
 * **Example** (Check a text block)
 *
 * ```ts
 * import { ContentBlock } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ContentBlock)({ type: "text", text: "hello" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContentBlock = S.Union([
  V2TextContent,
  V2ImageContent,
  V2AudioContent,
  V2ResourceLinkContent,
  V2ResourceContent,
  V1.ContentBlock,
  UnknownContent,
]).pipe(
  $I.annoteSchema("ContentBlock", {
    description: "Content block as the client delivers it: known generation-2 or generation-1 content, or unknown.",
  })
);

/**
 * **Example** (Read a content block type)
 *
 * ```ts
 * import type { ContentBlock } from "@beep/acp/compat"
 *
 * const typeOf = (block: ContentBlock) => block.type
 * console.log(typeOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContentBlock = typeof ContentBlock.Type;

const [V2TextCommandInput] = V2.AvailableCommandInput.members;

/**
 * **Details**
 *
 * Generation-1 hints (`{ hint }`) are rewritten to the generation-2 `{ type: "text", hint }`
 * shape, and generation-2 input kinds other than `text` become `null`.
 *
 * **Example** (Check an available command)
 *
 * ```ts
 * import { AvailableCommand } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(
 *   S.is(AvailableCommand)({ name: "web", description: "Search", input: { type: "text", hint: "query" } })
 * ) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AvailableCommand = S.StructWithRest(
  V2.AvailableCommand.schema.pipe(
    S.fieldsAssign({
      input: V2TextCommandInput.pipe(S.NullOr, S.optionalKey).annotateKey({
        description: "Text input hint, or null when the command takes no text input.",
      }),
    })
  ),
  V2.AvailableCommand.records
).pipe(
  $I.annoteSchema("AvailableCommand", {
    description: "Slash command an agent advertises, with a text input hint only.",
  })
);

/**
 * **Example** (Read a command name)
 *
 * ```ts
 * import type { AvailableCommand } from "@beep/acp/compat"
 *
 * const nameOf = (command: AvailableCommand) => command.name
 * console.log(nameOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AvailableCommand = typeof AvailableCommand.Type;

const [V1TerminalAuthMethod] = V1.AuthMethod.members;

const AuthEnvVariable = S.StructWithRest(
  S.Struct({
    name: S.String.annotateKey({ description: "Environment variable name." }),
    label: S.optionalKey(S.String).annotateKey({ description: "Optional human-readable label." }),
  }),
  [S.Record(S.String, S.Json)]
).pipe(
  $I.annoteSchema("AuthEnvVariable", {
    description: "Environment variable an env_var auth method asks the user to set.",
  })
);

const EnvVarAuthMethod = S.StructWithRest(
  V1.AuthMethodAgent.schema.pipe(
    S.fieldsAssign({
      type: S.Literal("env_var").annotateKey({ description: "Environment-variable auth method." }),
      vars: S.Array(AuthEnvVariable).annotateKey({ description: "Variables the user must set." }),
      link: S.String.pipe(S.NullOr, S.optionalKey).annotateKey({
        description: "Optional link where the user obtains the values.",
      }),
    })
  ),
  V1.AuthMethodAgent.records
).pipe(
  $I.annoteSchema("EnvVarAuthMethod", {
    description: "Auth method that asks the user to set environment variables.",
  })
);

/**
 * **Details**
 *
 * A terminal method (environment as a record), an environment-variable method, or an
 * agent-driven method. Generation-2 `methodId` keys are renamed to `id`, terminal `env` arrays
 * become records, and generation-2 method types the client does not know are dropped.
 *
 * **Example** (Check an agent auth method)
 *
 * ```ts
 * import { AuthMethod } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AuthMethod)({ id: "login", name: "Log in" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AuthMethod = S.Union([V1TerminalAuthMethod, EnvVarAuthMethod, V1.AuthMethodAgent]).pipe(
  $I.annoteSchema("AuthMethod", {
    description: "Auth method as the client delivers it, with generation-1 id keys.",
  })
);

/**
 * **Example** (Read an auth method id)
 *
 * ```ts
 * import type { AuthMethod } from "@beep/acp/compat"
 *
 * const idOf = (method: AuthMethod) => method.id
 * console.log(idOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AuthMethod = typeof AuthMethod.Type;

/**
 * **Details**
 *
 * A generation-2 result (`info`, `capabilities`) is projected onto `agentInfo` and
 * `agentCapabilities`. The generation is detected from the shape of the reply, not from
 * `protocolVersion`, because some agents report version 2 with the generation-1 shape.
 *
 * **Example** (Check an initialize result)
 *
 * ```ts
 * import { InitializeResponse } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(InitializeResponse)({ protocolVersion: 1, agentCapabilities: { loadSession: true } })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const InitializeResponse = S.StructWithRest(
  V1.InitializeResponse.schema.pipe(
    S.fieldsAssign({
      authMethods: AuthMethod.pipe(S.Array, S.optionalKey).annotateKey({
        description: "Auth methods the agent supports.",
      }),
    })
  ),
  V1.InitializeResponse.records
).pipe(
  $I.annoteSchema("InitializeResponse", {
    description: "Initialize result as the client delivers it, in the generation-1 shape.",
  })
);

/**
 * **Example** (Read the agent info)
 *
 * ```ts
 * import type { InitializeResponse } from "@beep/acp/compat"
 *
 * const agentNameOf = (response: InitializeResponse) => response.agentInfo?.name
 * console.log(agentNameOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type InitializeResponse = typeof InitializeResponse.Type;

const [V1SelectConfigOption, V1BooleanConfigOption] = V1.SessionConfigOption.members;

/**
 * **Details**
 *
 * Generation 1 keys a group by `group` and generation 2 by `groupId`; both group shapes are
 * accepted and kept as the agent sent them.
 *
 * **Example** (Check flat choices)
 *
 * ```ts
 * import { SessionConfigSelectOptions } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SessionConfigSelectOptions)([{ value: "fast", name: "Fast" }])) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SessionConfigSelectOptions = S.Union([V2.SessionConfigSelectOptions, V1.SessionConfigSelectOptions]).pipe(
  $I.annoteSchema("SessionConfigSelectOptions", {
    description: "Choices of a select config option, flat or grouped in either generation's group shape.",
  })
);

/**
 * **Example** (Count the choices)
 *
 * ```ts
 * import type { SessionConfigSelectOptions } from "@beep/acp/compat"
 *
 * const sizeOf = (options: SessionConfigSelectOptions) => options.length
 * console.log(sizeOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SessionConfigSelectOptions = typeof SessionConfigSelectOptions.Type;

const SelectConfigOption = S.StructWithRest(
  V1SelectConfigOption.schema.pipe(
    S.fieldsAssign({
      options: SessionConfigSelectOptions.annotateKey({ description: "Choices the user can select." }),
    })
  ),
  V1SelectConfigOption.records
).pipe(
  $I.annoteSchema("SelectConfigOption", {
    description: "Select config option keyed by id.",
  })
);

/**
 * **Details**
 *
 * A `select` option (flat or grouped choices) or a `boolean` option. Generation-2 options are
 * renamed from `configId` to `id`; generation-2 option types other than these two are dropped.
 *
 * **Example** (Check a boolean option)
 *
 * ```ts
 * import { SessionConfigOption } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(
 *   S.is(SessionConfigOption)({ id: "plan", name: "Plan mode", type: "boolean", currentValue: false })
 * ) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SessionConfigOption = S.Union([SelectConfigOption, V1BooleanConfigOption]).pipe(
  $I.annoteSchema("SessionConfigOption", {
    description: "Session config option as the client delivers it, keyed by id.",
  })
);

/**
 * **Example** (Read the option id)
 *
 * ```ts
 * import type { SessionConfigOption } from "@beep/acp/compat"
 *
 * const idOf = (option: SessionConfigOption) => option.id
 * console.log(idOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SessionConfigOption = typeof SessionConfigOption.Type;

const ConfigOptions = SessionConfigOption.pipe(S.Array, S.NullOr, S.optionalKey).annotateKey({
  description: "Configuration options of the session.",
});

/**
 * **Example** (Check a set-config-option result)
 *
 * ```ts
 * import { SetSessionConfigOptionResponse } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SetSessionConfigOptionResponse)({ configOptions: [] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SetSessionConfigOptionResponse = S.StructWithRest(
  V1.SetSessionConfigOptionResponse.schema.pipe(
    S.fieldsAssign({
      configOptions: S.Array(SessionConfigOption).annotateKey({
        description: "Configuration options after the change.",
      }),
    })
  ),
  V1.SetSessionConfigOptionResponse.records
).pipe(
  $I.annoteSchema("SetSessionConfigOptionResponse", {
    description: "Result of session/set_config_option as the client delivers it.",
  })
);

/**
 * **Example** (Count the options)
 *
 * ```ts
 * import type { SetSessionConfigOptionResponse } from "@beep/acp/compat"
 *
 * const sizeOf = (response: SetSessionConfigOptionResponse) => response.configOptions.length
 * console.log(sizeOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SetSessionConfigOptionResponse = typeof SetSessionConfigOptionResponse.Type;

const LegacyStdioMcpServer = S.StructWithRest(
  V1.McpServerStdio.schema.pipe(
    S.fieldsAssign({
      args: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Command-line arguments." }),
      env: V2.EnvVariable.pipe(S.Array, S.optionalKey).annotateKey({
        description: "Environment variables for the server process.",
      }),
    })
  ),
  V1.McpServerStdio.records
).pipe(
  $I.annoteSchema("LegacyStdioMcpServer", {
    description: "Generation-1 stdio MCP server, which carries no type tag.",
  })
);

/**
 * MCP server configuration the client accepts.
 *
 * **Details**
 *
 * Any generation-2 server (tagged by `type`) or a generation-1 stdio server without a `type`. The
 * client adds `type: "stdio"` before it sends an untagged server to a generation-2 agent. The
 * untagged member is listed first, so constructing a value never fills in a generation-2 `type`
 * default.
 *
 * **Example** (Check an untagged stdio server)
 *
 * ```ts
 * import { McpServer } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(McpServer)({ name: "files", command: "/usr/bin/mcp-files" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const McpServer = S.Union([LegacyStdioMcpServer, V2.McpServer]).pipe(
  $I.annoteSchema("McpServer", {
    description: "MCP server configuration: any generation-2 server or an untagged generation-1 stdio server.",
  })
);

/**
 * **Example** (Read a server name)
 *
 * ```ts
 * import type { McpServer } from "@beep/acp/compat"
 *
 * const nameOf = (server: McpServer) => server.name
 * console.log(nameOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type McpServer = typeof McpServer.Type;

const McpServers = S.Array(McpServer).annotateKey({
  description: "MCP servers the agent connects to for this session.",
});

/**
 * **Example** (Check a new-session request)
 *
 * ```ts
 * import { NewSessionRequest } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(NewSessionRequest)({ cwd: "/work", mcpServers: [] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NewSessionRequest = S.StructWithRest(
  V2.NewSessionRequest.schema.pipe(S.fieldsAssign({ mcpServers: McpServers })),
  V2.NewSessionRequest.records
).pipe(
  $I.annoteSchema("NewSessionRequest", {
    description: "Payload of session/new as the client accepts it.",
  })
);

/**
 * **Example** (Read the working directory)
 *
 * ```ts
 * import type { NewSessionRequest } from "@beep/acp/compat"
 *
 * const cwdOf = (request: NewSessionRequest) => request.cwd
 * console.log(cwdOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NewSessionRequest = typeof NewSessionRequest.Type;

/**
 * **Example** (Check a resume request)
 *
 * ```ts
 * import { ResumeSessionRequest } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ResumeSessionRequest)({ sessionId: "session-1", cwd: "/work" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ResumeSessionRequest = S.StructWithRest(
  V2.ResumeSessionRequest.schema.pipe(S.fieldsAssign({ mcpServers: S.optionalKey(McpServers) })),
  V2.ResumeSessionRequest.records
).pipe(
  $I.annoteSchema("ResumeSessionRequest", {
    description: "Payload of session/resume as the client accepts it.",
  })
);

/**
 * **Example** (Read the resumed session id)
 *
 * ```ts
 * import type { ResumeSessionRequest } from "@beep/acp/compat"
 *
 * const sessionIdOf = (request: ResumeSessionRequest) => request.sessionId
 * console.log(sessionIdOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ResumeSessionRequest = typeof ResumeSessionRequest.Type;

/**
 * Payload of `session/load` (generation 1); a generation-2 agent is asked to resume and replay
 * from the start instead.
 *
 * **Example** (Check a load request)
 *
 * ```ts
 * import { LoadSessionRequest } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LoadSessionRequest)({ sessionId: "session-1", cwd: "/work" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LoadSessionRequest = S.StructWithRest(
  V1.LoadSessionRequest.schema.pipe(S.fieldsAssign({ mcpServers: S.optionalKey(McpServers) })),
  V1.LoadSessionRequest.records
).pipe(
  $I.annoteSchema("LoadSessionRequest", {
    description: "Payload of session/load as the client accepts it.",
  })
);

/**
 * **Example** (Read the loaded session id)
 *
 * ```ts
 * import type { LoadSessionRequest } from "@beep/acp/compat"
 *
 * const sessionIdOf = (request: LoadSessionRequest) => request.sessionId
 * console.log(sessionIdOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LoadSessionRequest = typeof LoadSessionRequest.Type;

/**
 * **Example** (Check a fork request)
 *
 * ```ts
 * import { ForkSessionRequest } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ForkSessionRequest)({ sessionId: "session-1", cwd: "/work" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ForkSessionRequest = S.StructWithRest(
  V2.ForkSessionRequest.schema.pipe(S.fieldsAssign({ mcpServers: S.optionalKey(McpServers) })),
  V2.ForkSessionRequest.records
).pipe(
  $I.annoteSchema("ForkSessionRequest", {
    description: "Payload of session/fork as the client accepts it.",
  })
);

/**
 * **Example** (Read the forked session id)
 *
 * ```ts
 * import type { ForkSessionRequest } from "@beep/acp/compat"
 *
 * const sessionIdOf = (request: ForkSessionRequest) => request.sessionId
 * console.log(sessionIdOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ForkSessionRequest = typeof ForkSessionRequest.Type;

const LegacyModels = SessionModelState.pipe(S.NullOr, S.optionalKey).annotateKey({
  description: "Models advertised through the removed unstable model-selection API.",
});

/**
 * **Example** (Check a new-session result)
 *
 * ```ts
 * import { NewSessionResponse } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(NewSessionResponse)({ sessionId: "session-1" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NewSessionResponse = S.StructWithRest(
  V1.NewSessionResponse.schema.pipe(S.fieldsAssign({ models: LegacyModels, configOptions: ConfigOptions })),
  V1.NewSessionResponse.records
).pipe(
  $I.annoteSchema("NewSessionResponse", {
    description: "Result of session/new in the generation-1 shape plus the legacy models.",
  })
);

/**
 * **Example** (Read the new session id)
 *
 * ```ts
 * import type { NewSessionResponse } from "@beep/acp/compat"
 *
 * const sessionIdOf = (response: NewSessionResponse) => response.sessionId
 * console.log(sessionIdOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NewSessionResponse = typeof NewSessionResponse.Type;

/**
 * **Example** (Check an empty load result)
 *
 * ```ts
 * import { LoadSessionResponse } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LoadSessionResponse)({})) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LoadSessionResponse = S.StructWithRest(
  V1.LoadSessionResponse.schema.pipe(S.fieldsAssign({ models: LegacyModels, configOptions: ConfigOptions })),
  V1.LoadSessionResponse.records
).pipe(
  $I.annoteSchema("LoadSessionResponse", {
    description: "Result of session/load in the generation-1 shape plus the legacy models.",
  })
);

/**
 * **Example** (Read the session modes)
 *
 * ```ts
 * import type { LoadSessionResponse } from "@beep/acp/compat"
 *
 * const modesOf = (response: LoadSessionResponse) => response.modes
 * console.log(modesOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LoadSessionResponse = typeof LoadSessionResponse.Type;

/**
 * **Example** (Check an empty resume result)
 *
 * ```ts
 * import { ResumeSessionResponse } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ResumeSessionResponse)({})) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ResumeSessionResponse = S.StructWithRest(
  V1.ResumeSessionResponse.schema.pipe(S.fieldsAssign({ models: LegacyModels, configOptions: ConfigOptions })),
  V1.ResumeSessionResponse.records
).pipe(
  $I.annoteSchema("ResumeSessionResponse", {
    description: "Result of session/resume in the generation-1 shape plus the legacy models.",
  })
);

/**
 * **Example** (Read the config options)
 *
 * ```ts
 * import type { ResumeSessionResponse } from "@beep/acp/compat"
 *
 * const optionsOf = (response: ResumeSessionResponse) => response.configOptions
 * console.log(optionsOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ResumeSessionResponse = typeof ResumeSessionResponse.Type;

/**
 * **Example** (Check a fork result)
 *
 * ```ts
 * import { ForkSessionResponse } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ForkSessionResponse)({ sessionId: "session-2" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ForkSessionResponse = S.StructWithRest(
  V1.ForkSessionResponse.schema.pipe(S.fieldsAssign({ models: LegacyModels, configOptions: ConfigOptions })),
  V1.ForkSessionResponse.records
).pipe(
  $I.annoteSchema("ForkSessionResponse", {
    description: "Result of session/fork in the generation-1 shape plus the legacy models.",
  })
);

/**
 * **Example** (Read the forked session id)
 *
 * ```ts
 * import type { ForkSessionResponse } from "@beep/acp/compat"
 *
 * const sessionIdOf = (response: ForkSessionResponse) => response.sessionId
 * console.log(sessionIdOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ForkSessionResponse = typeof ForkSessionResponse.Type;

/**
 * **Details**
 *
 * `prompt` accepts every content block the client delivers, so a caller can re-send what it
 * received. The client sends an `UnknownContent` block as the original block in its `raw` and
 * fails the prompt locally when `raw` holds no content block; the `_acp_unknown` sentinel never
 * reaches the agent.
 *
 * **Example** (Check a prompt request)
 *
 * ```ts
 * import { PromptRequest } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PromptRequest)({ sessionId: "session-1", prompt: [{ type: "text", text: "hi" }] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PromptRequest = S.StructWithRest(
  V2.PromptRequest.schema.pipe(
    S.fieldsAssign({
      prompt: S.Array(ContentBlock).annotateKey({ description: "Content of the user turn." }),
    })
  ),
  V2.PromptRequest.records
).pipe(
  $I.annoteSchema("PromptRequest", {
    description: "Payload of session/prompt as the client accepts it.",
  })
);

/**
 * **Example** (Count prompt blocks)
 *
 * ```ts
 * import type { PromptRequest } from "@beep/acp/compat"
 *
 * const sizeOf = (request: PromptRequest) => request.prompt.length
 * console.log(sizeOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PromptRequest = typeof PromptRequest.Type;

const KnownStopReason = LiteralKit(["end_turn", "max_tokens", "max_turn_requests", "refusal", "cancelled", "error"]);

/**
 * Why a turn ended, as the client delivers it.
 *
 * **Details**
 *
 * The known reasons of both generations (generation 1 has no `error`) or any other string, so
 * custom (`_`-prefixed) and future reasons are kept. Since `schema-v2.0.0-alpha.9`, generation 2
 * spells the stop reason only as the discriminator of its idle `state_update` variants and exports
 * no `StopReason` schema of its own.
 *
 * **Example** (Check a custom stop reason)
 *
 * ```ts
 * import { StopReason } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(StopReason)("_vendor_timeout")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StopReason = S.Union([KnownStopReason, S.String]).pipe(
  $I.annoteSchema("StopReason", {
    description: "Why a turn ended: a known stop reason or any custom or future string.",
  })
);

/**
 * **Example** (Default a missing stop reason)
 *
 * ```ts
 * import type { StopReason } from "@beep/acp/compat"
 *
 * const orEndTurn = (reason: StopReason | null | undefined): StopReason => reason ?? "end_turn"
 * console.log(orEndTurn(null)) // "end_turn"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type StopReason = typeof StopReason.Type;

/**
 * **Details**
 *
 * A generation-1 agent returns it from `session/prompt`; for a generation-2 agent the client
 * builds it from the idle `state_update` that ends the turn. The stop reason is the open
 * {@link StopReason}, so custom and future reasons are kept.
 *
 * **Example** (Check a prompt result)
 *
 * ```ts
 * import { PromptResponse } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PromptResponse)({ stopReason: "end_turn" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PromptResponse = S.StructWithRest(
  V1.PromptResponse.schema.pipe(
    S.fieldsAssign({
      stopReason: StopReason.annotateKey({ description: "Why the turn ended." }),
      usage: V2.Usage.pipe(S.NullOr, S.optionalKey).annotateKey({
        description: "Token usage of the turn, when the agent reports it.",
      }),
    })
  ),
  V1.PromptResponse.records
).pipe(
  $I.annoteSchema("PromptResponse", {
    description: "Result of session/prompt as the client delivers it, with an open stop reason.",
  })
);

/**
 * **Example** (Read the stop reason)
 *
 * ```ts
 * import type { PromptResponse } from "@beep/acp/compat"
 *
 * const stopReasonOf = (response: PromptResponse) => response.stopReason
 * console.log(stopReasonOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PromptResponse = typeof PromptResponse.Type;

const [V2ContentToolCallContent, V2DiffToolCallContent, V2TerminalToolCallContent] = V2.ToolCallContent.members;
const [, V1DiffToolCallContent] = V1.ToolCallContent.members;

const ContentToolCallContent = S.StructWithRest(
  V2ContentToolCallContent.schema.pipe(
    S.fieldsAssign({ content: ContentBlock.annotateKey({ description: "Content produced by the tool call." }) })
  ),
  V2ContentToolCallContent.records
).pipe(
  $I.annoteSchema("ContentToolCallContent", {
    description: "Tool-call content that carries a content block.",
  })
);

/**
 * **Details**
 *
 * A content block, a generation-1 text diff (`path`, `oldText`, `newText`), a generation-2
 * structured diff (`changes`, `patch`), a terminal, or `UnknownContent`.
 *
 * **Example** (Check a generation-1 diff)
 *
 * ```ts
 * import { ToolCallContent } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ToolCallContent)({ type: "diff", path: "/a.ts", newText: "x" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ToolCallContent = S.Union([
  ContentToolCallContent,
  V1DiffToolCallContent,
  V2DiffToolCallContent,
  V2TerminalToolCallContent,
  UnknownContent,
]).pipe(
  $I.annoteSchema("ToolCallContent", {
    description: "Content a tool call produces, in either generation's shape or unknown.",
  })
);

/**
 * **Example** (Read a tool-call content type)
 *
 * ```ts
 * import type { ToolCallContent } from "@beep/acp/compat"
 *
 * const typeOf = (content: ToolCallContent) => content.type
 * console.log(typeOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ToolCallContent = typeof ToolCallContent.Type;

const ToolCallContents = ToolCallContent.pipe(S.Array, S.NullOr, S.optionalKey).annotateKey({
  description: "Content the tool call produced.",
});

/**
 * Partial tool-call state, as carried by `tool_call_update` and permission requests.
 *
 * **Example** (Check a tool-call update)
 *
 * ```ts
 * import { ToolCallUpdate } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ToolCallUpdate)({ toolCallId: "tool-1", title: "Read file" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ToolCallUpdate = S.StructWithRest(
  V2.ToolCallUpdate.schema.pipe(S.fieldsAssign({ content: ToolCallContents })),
  V2.ToolCallUpdate.records
).pipe(
  $I.annoteSchema("ToolCallUpdate", {
    description: "Partial tool-call state with normalized tool-call content.",
  })
);

/**
 * **Example** (Read the tool-call id)
 *
 * ```ts
 * import type { ToolCallUpdate } from "@beep/acp/compat"
 *
 * const idOf = (update: ToolCallUpdate) => update.toolCallId
 * console.log(idOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ToolCallUpdate = typeof ToolCallUpdate.Type;

const [
  ,
  V2UserMessage,
  ,
  V2AgentMessage,
  ,
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
const [V2RunningState, V2IdleState, V2RequiresActionState] = V2StateUpdate.members;
const [, , , , , V2IdleErrorState] = V2IdleState.members;
const [V1UserMessageChunk, V1AgentMessageChunk, V1AgentThoughtChunk, V1ToolCall, , V1Plan] = V1.SessionUpdate.members;
const V1CurrentModeUpdate = V1.SessionUpdate.members[9];
// decision: shared-update-kinds-match-both-generations
const V1UsageUpdate = V1.SessionUpdate.members[12];
const V1Notice = V1.SessionUpdate.members[13];
const V1SubagentUpdate = V1.SessionUpdate.members[16];

const ContentField = ContentBlock.annotateKey({ description: "Content of this update." });
const ContentListField = ContentBlock.pipe(S.Array, S.NullOr, S.optionalKey).annotateKey({
  description: "Content of the complete message.",
});

const UserMessageChunk = S.StructWithRest(
  V1UserMessageChunk.schema.pipe(S.fieldsAssign({ content: ContentField })),
  V1UserMessageChunk.records
);
const AgentMessageChunk = S.StructWithRest(
  V1AgentMessageChunk.schema.pipe(S.fieldsAssign({ content: ContentField })),
  V1AgentMessageChunk.records
);
const AgentThoughtChunk = S.StructWithRest(
  V1AgentThoughtChunk.schema.pipe(S.fieldsAssign({ content: ContentField })),
  V1AgentThoughtChunk.records
);
const UserMessage = S.StructWithRest(
  V2UserMessage.schema.pipe(S.fieldsAssign({ content: ContentListField })),
  V2UserMessage.records
);
const AgentMessage = S.StructWithRest(
  V2AgentMessage.schema.pipe(S.fieldsAssign({ content: ContentListField })),
  V2AgentMessage.records
);
const AgentThought = S.StructWithRest(
  V2AgentThought.schema.pipe(S.fieldsAssign({ content: ContentListField })),
  V2AgentThought.records
);
const SessionMessage = S.StructWithRest(
  V2SessionMessage.schema.pipe(S.fieldsAssign({ content: ContentListField })),
  V2SessionMessage.records
);
const SessionMessageChunk = S.StructWithRest(
  V2SessionMessageChunk.schema.pipe(S.fieldsAssign({ content: ContentField })),
  V2SessionMessageChunk.records
);
const ToolCall = S.StructWithRest(
  V1ToolCall.schema.pipe(
    S.fieldsAssign({
      content: ToolCallContent.pipe(S.Array, S.optionalKey).annotateKey({
        description: "Content the tool call produced.",
      }),
    })
  ),
  V1ToolCall.records
);
const ToolCallUpdateSessionUpdate = S.StructWithRest(
  V2ToolCallUpdate.schema.pipe(S.fieldsAssign({ content: ToolCallContents })),
  V2ToolCallUpdate.records
);
const ToolCallContentChunk = S.StructWithRest(
  V2ToolCallContentChunk.schema.pipe(
    S.fieldsAssign({ content: ToolCallContent.annotateKey({ description: "Tool-call content chunk." }) })
  ),
  V2ToolCallContentChunk.records
);
const AvailableCommandsUpdate = S.StructWithRest(
  V2AvailableCommandsUpdate.schema.pipe(
    S.fieldsAssign({
      availableCommands: S.Array(AvailableCommand).annotateKey({
        description: "Commands the agent currently offers.",
      }),
    })
  ),
  V2AvailableCommandsUpdate.records
);
const CompactionUpdate = S.StructWithRest(
  V2CompactionUpdate.schema.pipe(S.fieldsAssign({ summary: ContentListField })),
  V2CompactionUpdate.records
);
const CompactionSummaryChunk = S.StructWithRest(
  V2CompactionSummaryChunk.schema.pipe(S.fieldsAssign({ content: ContentField })),
  V2CompactionSummaryChunk.records
);

/**
 * Generation-2 idle `state_update` as the client delivers it: one struct with an open stop reason.
 *
 * **Details**
 *
 * The generated idle update is a union keyed by `stopReason`, and only its `error` variant carries
 * `error`. Agents written against earlier drafts, such as Claude Agent ACP, report a failed turn's
 * `error` next to other stop reasons, so the client surface flattens the variants: `stopReason` is
 * any {@link StopReason}, omitted or `null`, and every idle may carry `error`. The client still
 * completes the prompt with the idle `stopReason`.
 *
 * **Example** (Check an idle update with an error)
 *
 * ```ts
 * import { IdleStateUpdate } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(
 *   S.is(IdleStateUpdate)({
 *     sessionUpdate: "state_update",
 *     state: "idle",
 *     stopReason: "end_turn",
 *     error: { code: -32603, message: "Internal error" }
 *   })
 * ) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IdleStateUpdate = S.StructWithRest(
  V2IdleErrorState.schema.pipe(
    S.fieldsAssign({
      stopReason: StopReason.pipe(S.NullOr, S.optionalKey).annotateKey({
        description: "Why foreground work stopped; omitted or null when the agent reports no stop reason.",
      }),
      error: V2.Error.pipe(S.NullOr, S.optionalKey).annotateKey({
        description: "Error that ended the turn, when the agent reports one.",
      }),
    })
  ),
  V2IdleErrorState.records
).pipe(
  $I.annoteSchema("IdleStateUpdate", {
    description: "Generation-2 idle state update with an open stop reason and an optional error.",
  })
);

/**
 * **Example** (Read the stop reason)
 *
 * ```ts
 * import type { IdleStateUpdate } from "@beep/acp/compat"
 *
 * const stopReasonOf = (update: IdleStateUpdate) => update.stopReason
 * console.log(stopReasonOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type IdleStateUpdate = typeof IdleStateUpdate.Type;

/**
 * **Details**
 *
 * The union of both generations' kinds: message chunks (the `messageId` generation 2 requires is
 * optional), complete messages, tool calls and tool-call content chunks, `running`, `idle` and
 * `requires_action` state updates, terminal, plan, command, config-option, session-info, usage
 * and compaction updates, the `notice`, `subagent_update`, `session_message` and
 * `session_message_chunk` kinds both generations gained in `schema-v2.0.0-alpha.9` /
 * `schema-v1.26.0`, the generation-1 `plan` and `current_mode_update`, and
 * `UnknownSessionUpdate` for any other kind or state. A usage update may take either generation's shape:
 * generation 1 accepts any currency code, generation 2 only an upper-case ISO 4217 code.
 *
 * **Example** (Check an agent message chunk)
 *
 * ```ts
 * import { SessionUpdate } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(
 *   S.is(SessionUpdate)({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } })
 * ) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SessionUpdate = S.Union([
  UserMessageChunk,
  AgentMessageChunk,
  AgentThoughtChunk,
  UserMessage,
  AgentMessage,
  AgentThought,
  ToolCall,
  ToolCallUpdateSessionUpdate,
  ToolCallContentChunk,
  V2RunningState,
  IdleStateUpdate,
  V2RequiresActionState,
  V2TerminalUpdate,
  V2TerminalOutputChunk,
  V2PlanUpdate,
  V2PlanRemoved,
  AvailableCommandsUpdate,
  V2SessionInfoUpdate,
  V2UsageUpdate,
  V1UsageUpdate,
  CompactionUpdate,
  CompactionSummaryChunk,
  V2Notice,
  V1Notice,
  V2SubagentUpdate,
  V1SubagentUpdate,
  SessionMessage,
  SessionMessageChunk,
  S.StructWithRest(
    V2ConfigOptionUpdate.schema.pipe(
      S.fieldsAssign({
        configOptions: S.Array(SessionConfigOption).annotateKey({
          description: "Current configuration options, keyed by `id`.",
        }),
      })
    ),
    V2ConfigOptionUpdate.records
  ),
  V1Plan,
  V1CurrentModeUpdate,
  UnknownSessionUpdate,
]).pipe(
  $I.annoteSchema("SessionUpdate", {
    description: "Session update as the client delivers it, covering both generations and unknown kinds.",
  })
);

/**
 * **Example** (Read the update kind)
 *
 * ```ts
 * import type { SessionUpdate } from "@beep/acp/compat"
 *
 * const kindOf = (update: SessionUpdate) => update.sessionUpdate
 * console.log(kindOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SessionUpdate = typeof SessionUpdate.Type;

/**
 * **Example** (Check a session notification)
 *
 * ```ts
 * import { SessionNotification } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(
 *   S.is(SessionNotification)({
 *     sessionId: "session-1",
 *     update: { sessionUpdate: "state_update", state: "running" }
 *   })
 * ) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SessionNotification = S.StructWithRest(
  V2.UpdateSessionNotification.schema.pipe(
    S.fieldsAssign({ update: SessionUpdate.annotateKey({ description: "The normalized session update." }) })
  ),
  V2.UpdateSessionNotification.records
).pipe(
  $I.annoteSchema("SessionNotification", {
    description: "Params of the session/update notification as the client delivers them.",
  })
);

/**
 * **Example** (Read the session id)
 *
 * ```ts
 * import type { SessionNotification } from "@beep/acp/compat"
 *
 * const sessionIdOf = (notification: SessionNotification) => notification.sessionId
 * console.log(sessionIdOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SessionNotification = typeof SessionNotification.Type;

/**
 * **Details**
 *
 * `toolCall` is always present. For a generation-2 request it is the subject's tool call, or a
 * tool call synthesized from a command subject (kind `execute`) or from the request itself
 * (kind `other`). The generation-2 `title`, `description` and `subject` are kept when sent.
 *
 * **Example** (Check a generation-1 permission request)
 *
 * ```ts
 * import { RequestPermissionRequest } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(
 *   S.is(RequestPermissionRequest)({
 *     sessionId: "session-1",
 *     toolCall: { toolCallId: "tool-1" },
 *     options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }]
 *   })
 * ) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RequestPermissionRequest = S.StructWithRest(
  V2.RequestPermissionRequest.schema.pipe(
    S.fieldsAssign({
      title: S.optionalKey(S.String).annotateKey({ description: "Title of the permission prompt." }),
      toolCall: ToolCallUpdate.annotateKey({ description: "Tool call the permission is for." }),
      options: S.Array(V2.PermissionOption).annotateKey({ description: "Choices offered to the user." }),
    })
  ),
  V2.RequestPermissionRequest.records
).pipe(
  $I.annoteSchema("RequestPermissionRequest", {
    description: "Params of session/request_permission as the client delivers them, with toolCall always present.",
  })
);

/**
 * **Example** (Read the tool-call id)
 *
 * ```ts
 * import type { RequestPermissionRequest } from "@beep/acp/compat"
 *
 * const toolCallIdOf = (request: RequestPermissionRequest) => request.toolCall.toolCallId
 * console.log(toolCallIdOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RequestPermissionRequest = typeof RequestPermissionRequest.Type;

// Biome's import organizer merges re-exports from one module into a single statement, and docgen
// reads only the last JSDoc block of a statement, so each statement carries exactly one block.

/**
 * Generation-2 schemas the client surface uses unchanged.
 *
 * **Details**
 *
 * The auth, logout and cancel schemas are re-exported under their generation-1 names:
 * `AuthenticateRequest` and `AuthenticateResponse` are `auth/login`, `LogoutRequest` and
 * `LogoutResponse` are `auth/logout`, and `CancelNotification` is `session/cancel`.
 *
 * **Example** (Check a usage record and an authenticate request)
 *
 * ```ts
 * import { AuthenticateRequest, Usage } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Usage)({ inputTokens: 1, outputTokens: 2, totalTokens: 3 })) // true
 * console.log(S.is(AuthenticateRequest)({ methodId: "login" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  AbsolutePath,
  CancelSessionNotification as CancelNotification,
  CloseSessionRequest,
  CloseSessionResponse,
  CompleteElicitationNotification,
  CreateElicitationRequest,
  CreateElicitationResponse,
  DeleteSessionRequest,
  DeleteSessionResponse,
  DisableProviderRequest,
  DisableProviderResponse,
  ElicitationContentValue,
  ListProvidersRequest,
  ListProvidersResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  LoginAuthRequest as AuthenticateRequest,
  LoginAuthResponse as AuthenticateResponse,
  LogoutAuthRequest as LogoutRequest,
  LogoutAuthResponse as LogoutResponse,
  MessageMcpNotification,
  MessageMcpRequest,
  MessageMcpResponse,
  PermissionOption,
  RequestPermissionResponse,
  SessionConfigSelectOption,
  SetProviderRequest,
  SetProviderResponse,
  TerminalExitStatus,
  ToolCallLocation,
  ToolCallStatus,
  ToolKind,
  Usage,
} from "./_generated/schema.gen.ts";
/**
 * Generation-1 schemas the client surface uses unchanged: initialize request and capabilities,
 * session modes, the set-config-option request, and the client file-system and terminal methods.
 *
 * **Example** (Check an initialize request)
 *
 * ```ts
 * import { InitializeRequest } from "@beep/acp/compat"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(InitializeRequest)({ protocolVersion: 1, clientCapabilities: { terminal: true } })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  AgentCapabilities,
  ClientCapabilities,
  CreateTerminalRequest,
  CreateTerminalResponse,
  InitializeRequest,
  KillTerminalRequest,
  KillTerminalResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  SessionMode,
  SessionModeState,
  SetSessionConfigOptionRequest,
  SetSessionModeRequest,
  SetSessionModeResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from "./_generated/schema-v1.gen.ts";
