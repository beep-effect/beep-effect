/**
 * Private managed session implementation.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AiProviderCliId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $AiProviderCliId.create("AiProviderCliSession.wire.models");
/**
 * Verifies the Codex thread identity, pinned model and effective read-only permission policy.
 *
 * **Example** (Decode a synthetic CodexStart envelope)
 * ```ts
 * import { CodexStart } from "../../src/AiProviderCliSession.wire.models.ts"
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownSync(CodexStart)({ thread: { id: "owned-thread" }, model: "gpt-6.1-sol", reasoningEffort: "medium", approvalPolicy: "never", sandbox: { type: "readOnly", networkAccess: false } })
 * console.log(decoded.approvalPolicy) // never
 * ```
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CodexStart extends S.Class<CodexStart>($I`CodexStart`)(
  {
    thread: S.Struct({ id: S.NonEmptyString }),
    model: S.Literal("gpt-6.1-sol"),
    reasoningEffort: S.Literal("medium"),
    approvalPolicy: S.Literal("never"),
    sandbox: S.Struct({ type: S.Literal("readOnly"), networkAccess: S.Literal(false) }),
  },
  $I.annote("CodexStart", {
    description: "Verifies the Codex thread identity, pinned model and effective read-only permission policy.",
  })
) {}
/**
 * Decodes the owned turn identifier returned by Codex turn/start.
 *
 * **Example** (Decode a synthetic CodexTurn envelope)
 * ```ts
 * import { CodexTurn } from "../../src/AiProviderCliSession.wire.models.ts"
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownSync(CodexTurn)({ turn: { id: "owned-turn" } })
 * console.log(decoded.turn.id) // owned-turn
 * ```
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CodexTurn extends S.Class<CodexTurn>($I`CodexTurn`)(
  { turn: S.Struct({ id: S.NonEmptyString }) },
  $I.annote("CodexTurn", { description: "Decodes the owned turn identifier returned by Codex turn/start." })
) {}
/**
 * Correlates a Codex assistant text item with its owning thread and turn.
 *
 * **Example** (Decode a synthetic CodexItem envelope)
 * ```ts
 * import { CodexItem } from "../../src/AiProviderCliSession.wire.models.ts"
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownSync(CodexItem)({ threadId: "owned-thread", turnId: "owned-turn", item: { type: "agentMessage", text: "synthetic reply" } })
 * console.log(decoded.item.text) // synthetic reply
 * ```
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CodexItem extends S.Class<CodexItem>($I`CodexItem`)(
  {
    threadId: S.String,
    turnId: S.String,
    item: S.Struct({ type: S.Literal("agentMessage"), text: S.String }),
  },
  $I.annote("CodexItem", { description: "Correlates a Codex assistant text item with its owning thread and turn." })
) {}
/**
 * Decodes Codex terminal status together with the thread and turn identifiers.
 *
 * **Example** (Decode a synthetic CodexComplete envelope)
 * ```ts
 * import { CodexComplete } from "../../src/AiProviderCliSession.wire.models.ts"
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownSync(CodexComplete)({ threadId: "owned-thread", turn: { id: "owned-turn", status: "completed" } })
 * console.log(decoded.turn.status) // completed
 * ```
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CodexComplete extends S.Class<CodexComplete>($I`CodexComplete`)(
  {
    threadId: S.String,
    turn: S.Struct({ id: S.NonEmptyString, status: S.NonEmptyString }),
  },
  $I.annote("CodexComplete", {
    description: "Decodes Codex terminal status together with the thread and turn identifiers.",
  })
) {}
/**
 * Decodes an ACP assistant text chunk with its owning session identifier.
 *
 * **Example** (Decode a synthetic AcpText envelope)
 * ```ts
 * import { AcpText } from "../../src/AiProviderCliSession.wire.models.ts"
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownSync(AcpText)({ sessionId: "owned-session", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "synthetic reply" } } })
 * console.log(decoded.update.content.text) // synthetic reply
 * ```
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class AcpText extends S.Class<AcpText>($I`AcpText`)(
  {
    sessionId: S.String,
    update: S.Struct({
      sessionUpdate: S.Literal("agent_message_chunk"),
      content: S.Struct({ type: S.Literal("text"), text: S.String }),
    }),
  },
  $I.annote("AcpText", { description: "Decodes an ACP assistant text chunk with its owning session identifier." })
) {}
/**
 * Verifies the Cursor session model identifier including context, effort and fast-mode qualifiers.
 *
 * **Example** (Decode a synthetic CursorIdentity envelope)
 * ```ts
 * import { CursorIdentity } from "../../src/AiProviderCliSession.wire.models.ts"
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownSync(CursorIdentity)({ sessionId: "owned-cursor", models: { currentModelId: "claude-opus-5-5[context=300k,effort=medium,fast=false]" } })
 * console.log(decoded.sessionId) // owned-cursor
 * ```
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CursorIdentity extends S.Class<CursorIdentity>($I`CursorIdentity`)(
  {
    sessionId: S.NonEmptyString,
    models: S.Struct({ currentModelId: S.Literal("claude-opus-5-5[context=300k,effort=medium,fast=false]") }),
  },
  $I.annote("CursorIdentity", {
    description: "Verifies the Cursor session model identifier including context, effort and fast-mode qualifiers.",
  })
) {}
/**
 * Decodes the Grok session model and configuration options for subsequent effort verification.
 *
 * **Example** (Decode a synthetic GrokIdentity envelope)
 * ```ts
 * import { GrokIdentity } from "../../src/AiProviderCliSession.wire.models.ts"
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownSync(GrokIdentity)({ sessionId: "owned-grok", models: { currentModelId: "grok-4.7" }, configOptions: [{ id: "reasoning_effort", currentValue: "medium" }] })
 * console.log(decoded.models.currentModelId) // grok-4.7
 * ```
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class GrokIdentity extends S.Class<GrokIdentity>($I`GrokIdentity`)(
  {
    sessionId: S.NonEmptyString,
    models: S.Struct({ currentModelId: S.Literal("grok-4.7") }),
    configOptions: S.Array(S.Struct({ id: S.String, currentValue: S.Unknown })),
  },
  $I.annote("GrokIdentity", {
    description: "Decodes the Grok session model and configuration options for subsequent effort verification.",
  })
) {}
/**
 * Defines the six exact MCP messaging tool names accepted by the managed permission callback.
 *
 * **Example** (Select a scoped acknowledgement tool)
 * ```ts
 * import { MessagingToolName } from "../../src/AiProviderCliSession.wire.models.ts"
 * console.log(MessagingToolName.make("agent_message_acknowledge")) // agent_message_acknowledge
 * ```
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const MessagingToolName = LiteralKit([
  "agent_message_send",
  "agent_message_reply",
  "agent_message_inbox",
  "agent_message_acknowledge",
  "agent_message_inspect",
  "agent_message_discover",
]).annotate($I.annote("MessagingToolName", { description: "Exact scoped MCP messaging tool identifiers." }));

/**
 * Decoded identifier of an allowed scoped MCP messaging tool.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type MessagingToolName = typeof MessagingToolName.Type;
/**
 * Verifies the Claude initialize control response and its dontAsk permission mode.
 *
 * **Example** (Decode a synthetic ClaudeHandshake envelope)
 * ```ts
 * import { ClaudeHandshake } from "../../src/AiProviderCliSession.wire.models.ts"
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownSync(ClaudeHandshake)({ type: "control_response", response: { subtype: "success", request_id: "beep-initialize", response: { current_permission_mode: "dontAsk" } } })
 * console.log(decoded.response.response.current_permission_mode) // dontAsk
 * ```
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class ClaudeHandshake extends S.Class<ClaudeHandshake>($I`ClaudeHandshake`)(
  {
    type: S.Literal("control_response"),
    response: S.Struct({
      subtype: S.Literal("success"),
      request_id: S.Literal("beep-initialize"),
      response: S.Struct({ current_permission_mode: S.Literal("dontAsk") }),
    }),
  },
  $I.annote("ClaudeHandshake", {
    description: "Verifies the Claude initialize control response and its dontAsk permission mode.",
  })
) {}
/**
 * Verifies the Claude session initialization model and permission-mode readback.
 *
 * **Example** (Decode a synthetic ClaudeInit envelope)
 * ```ts
 * import { ClaudeInit } from "../../src/AiProviderCliSession.wire.models.ts"
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownSync(ClaudeInit)({ type: "system", subtype: "init", session_id: "owned-claude", model: "claude-opus-5-5", permissionMode: "dontAsk" })
 * console.log(decoded.model) // claude-opus-5-5
 * ```
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class ClaudeInit extends S.Class<ClaudeInit>($I`ClaudeInit`)(
  {
    type: S.Literal("system"),
    subtype: S.Literal("init"),
    session_id: S.NonEmptyString,
    model: S.Literal("claude-opus-5-5"),
    permissionMode: S.Literal("dontAsk"),
  },
  $I.annote("ClaudeInit", {
    description: "Verifies the Claude session initialization model and permission-mode readback.",
  })
) {}
/**
 * Decodes a Claude terminal result without treating its subtype as proof of success.
 *
 * **Example** (Decode a synthetic ClaudeResult envelope)
 * ```ts
 * import { ClaudeResult } from "../../src/AiProviderCliSession.wire.models.ts"
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownSync(ClaudeResult)({ type: "result", subtype: "success", is_error: false, session_id: "owned-claude", result: "synthetic reply" })
 * console.log(decoded.subtype) // success
 * ```
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class ClaudeResult extends S.Class<ClaudeResult>($I`ClaudeResult`)(
  {
    type: S.Literal("result"),
    subtype: S.String,
    is_error: S.Boolean,
    result: S.optionalKey(S.String),
    session_id: S.NonEmptyString,
  },
  $I.annote("ClaudeResult", {
    description: "Decodes a Claude terminal result without treating its subtype as proof of success.",
  })
) {}
/**
 * Decodes the identifier of a reverse Claude control request for host permission handling.
 *
 * **Example** (Decode a synthetic ClaudeControl envelope)
 * ```ts
 * import { ClaudeControl } from "../../src/AiProviderCliSession.wire.models.ts"
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownSync(ClaudeControl)({ type: "control_request", request_id: "owned-request" })
 * console.log(decoded.request_id) // owned-request
 * ```
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class ClaudeControl extends S.Class<ClaudeControl>($I`ClaudeControl`)(
  { type: S.Literal("control_request"), request_id: S.String },
  $I.annote("ClaudeControl", {
    description: "Decodes the identifier of a reverse Claude control request for host permission handling.",
  })
) {}
/**
 * Decodes the stream message discriminator before selecting a Claude payload schema.
 *
 * **Example** (Decode a synthetic ClaudeEnvelope envelope)
 * ```ts
 * import { ClaudeEnvelope } from "../../src/AiProviderCliSession.wire.models.ts"
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownSync(ClaudeEnvelope)({ type: "system" })
 * console.log(decoded.type) // system
 * ```
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class ClaudeEnvelope extends S.Class<ClaudeEnvelope>($I`ClaudeEnvelope`)(
  { type: S.String },
  $I.annote("ClaudeEnvelope", {
    description: "Decodes the stream message discriminator before selecting a Claude payload schema.",
  })
) {}
