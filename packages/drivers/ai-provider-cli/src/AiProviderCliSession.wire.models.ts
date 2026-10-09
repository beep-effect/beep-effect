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
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
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
  $I.annote("CodexStart", { description: "Validated partial CodexStart provider wire envelope." })
) {}
/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
 * @since 0.0.0
 */
export class CodexTurn extends S.Class<CodexTurn>($I`CodexTurn`)(
  { turn: S.Struct({ id: S.NonEmptyString }) },
  $I.annote("CodexTurn", { description: "Validated partial CodexTurn provider wire envelope." })
) {}
/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
 * @since 0.0.0
 */
export class CodexItem extends S.Class<CodexItem>($I`CodexItem`)(
  {
    threadId: S.String,
    turnId: S.String,
    item: S.Struct({ type: S.Literal("agentMessage"), text: S.String }),
  },
  $I.annote("CodexItem", { description: "Validated partial CodexItem provider wire envelope." })
) {}
/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
 * @since 0.0.0
 */
export class CodexComplete extends S.Class<CodexComplete>($I`CodexComplete`)(
  {
    threadId: S.String,
    turn: S.Struct({ id: S.NonEmptyString, status: S.NonEmptyString }),
  },
  $I.annote("CodexComplete", { description: "Validated partial CodexComplete provider wire envelope." })
) {}
/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
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
  $I.annote("AcpText", { description: "Validated partial AcpText provider wire envelope." })
) {}
/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
 * @since 0.0.0
 */
export class CursorIdentity extends S.Class<CursorIdentity>($I`CursorIdentity`)(
  {
    sessionId: S.NonEmptyString,
    models: S.Struct({ currentModelId: S.Literal("claude-opus-5-5[context=300k,effort=medium,fast=false]") }),
  },
  $I.annote("CursorIdentity", { description: "Validated partial CursorIdentity provider wire envelope." })
) {}
/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
 * @since 0.0.0
 */
export class GrokIdentity extends S.Class<GrokIdentity>($I`GrokIdentity`)(
  {
    sessionId: S.NonEmptyString,
    models: S.Struct({ currentModelId: S.Literal("grok-4.7") }),
    configOptions: S.Array(S.Struct({ id: S.String, currentValue: S.Unknown })),
  },
  $I.annote("GrokIdentity", { description: "Validated partial GrokIdentity provider wire envelope." })
) {}
/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
 * @since 0.0.0
 */
export const MessagingToolName = LiteralKit([
  "agent_message_send",
  "agent_message_reply",
  "agent_message_inbox",
  "agent_message_acknowledge",
  "agent_message_inspect",
  "agent_message_discover",
]);
/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
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
  $I.annote("ClaudeHandshake", { description: "Validated partial ClaudeHandshake provider wire envelope." })
) {}
/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
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
  $I.annote("ClaudeInit", { description: "Validated partial ClaudeInit provider wire envelope." })
) {}
/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
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
  $I.annote("ClaudeResult", { description: "Validated partial ClaudeResult provider wire envelope." })
) {}
/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
 * @since 0.0.0
 */
export class ClaudeControl extends S.Class<ClaudeControl>($I`ClaudeControl`)(
  { type: S.Literal("control_request"), request_id: S.String },
  $I.annote("ClaudeControl", { description: "Validated partial ClaudeControl provider wire envelope." })
) {}
/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
 * @since 0.0.0
 */
export class ClaudeEnvelope extends S.Class<ClaudeEnvelope>($I`ClaudeEnvelope`)(
  { type: S.String },
  $I.annote("ClaudeEnvelope", { description: "Validated partial ClaudeEnvelope provider wire envelope." })
) {}
