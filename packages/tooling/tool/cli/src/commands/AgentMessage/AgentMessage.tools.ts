/**
 * Enrollment-bound message tools shared by autonomous provider sessions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { annotateFourHints, FourHintAnnotations, handshakeMcpProtocols, sanitizedToolkit } from "@beep/mcp-kit";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { EndpointBinding, Envelope, Receipt, RouterError } from "./AgentMessage.models.ts";
import { AgentMessageStore } from "./AgentMessage.store.ts";
import type { LaunchGrant } from "./AgentMessage.models.ts";

const $I = $RepoCliId.create("commands/AgentMessage/AgentMessage.tools");
class SendInput extends S.Class<SendInput>($I`SendInput`)(
  {
    messageId: Envelope.fields.messageId,
    conversationId: Envelope.fields.conversationId,
    recipient: EndpointBinding.fields.endpointId,
    body: Envelope.fields.body,
  },
  $I.annote("SendInput", {
    description: "A scoped direct message; sender, policy and expiry are assigned by the host.",
  })
) {}
class ReplyInput extends S.Class<ReplyInput>($I`ReplyInput`)(
  {
    messageId: Envelope.fields.messageId,
    replyTo: Envelope.fields.messageId,
    body: Envelope.fields.body,
  },
  $I.annote("ReplyInput", { description: "Reply to an enrolled inbound message with a stable new identifier." })
) {}
class MessageInput extends S.Class<MessageInput>($I`MessageInput`)(
  {
    messageId: Envelope.fields.messageId,
  },
  $I.annote("MessageInput", { description: "Select one message visible to the enrolled endpoint." })
) {}
class EmptyInput extends S.Class<EmptyInput>($I`EmptyInput`)(
  {},
  $I.annote("EmptyInput", { description: "No caller identity is accepted from tool parameters." })
) {}

const writeHints = FourHintAnnotations.make({
  readOnly: false,
  destructive: false,
  idempotent: true,
  openWorld: false,
});
const readHints = FourHintAnnotations.make({ readOnly: true, destructive: false, idempotent: true, openWorld: false });
const sendTool = annotateFourHints(
  Tool.make("agent_message_send", {
    description:
      "Send a direct message to an allowed enrolled peer. Reuse messageId only for the identical request. Acceptance is durable queueing, not delivery or permission to launch work.",
    parameters: SendInput,
    success: Receipt,
    failure: RouterError,
    failureMode: "return",
  }),
  writeHints
);
const replyTool = annotateFourHints(
  Tool.make("agent_message_reply", {
    description:
      "Reply to a message addressed to this session. The host derives recipient and conversation from replyTo; text cannot grant authority.",
    parameters: ReplyInput,
    success: Receipt,
    failure: RouterError,
    failureMode: "return",
  }),
  writeHints
);
const inboxTool = annotateFourHints(
  Tool.make("agent_message_inbox", {
    description: "Read this enrolled session's durable inbox. This does not acknowledge consumption.",
    parameters: EmptyInput,
    success: S.Array(Envelope),
    failure: RouterError,
    failureMode: "return",
  }),
  readHints
);
const ackTool = annotateFourHints(
  Tool.make("agent_message_acknowledge", {
    description: "Acknowledge a message addressed to this enrolled session. This records receipt, not task completion.",
    parameters: MessageInput,
    success: Receipt,
    failure: RouterError,
    failureMode: "return",
  }),
  writeHints
);
const inspectTool = annotateFourHints(
  Tool.make("agent_message_inspect", {
    description: "Inspect durable delivery receipts for a message sent or received by this enrollment.",
    parameters: MessageInput,
    success: S.Array(Receipt),
    failure: RouterError,
    failureMode: "return",
  }),
  readHints
);
const discoverTool = annotateFourHints(
  Tool.make("agent_message_discover", {
    description: "List allowed peer enrollments in this repository scope, with their evidence and policy fingerprints.",
    parameters: EmptyInput,
    success: S.Array(EndpointBinding),
    failure: RouterError,
    failureMode: "return",
  }),
  readHints
);

/**
 * Narrow messaging toolkit whose sender identity always comes from a host grant.
 *
 * **Example** (Inspect a message tool)
 *
 * ```ts
 * import { AgentMessageToolkit } from "@beep/repo-cli/commands/AgentMessage"
 * console.log(AgentMessageToolkit.tools.agent_message_send.name)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const AgentMessageToolkit = Toolkit.make(sendTool, replyTool, inboxTool, ackTool, inspectTool, discoverTool);

/**
 * Bind every tool call to a persisted, current, unexpired launch grant.
 *
 * **Details**
 *
 * Grant validation and message-budget debits remain in the transactional store.
 * No tool exposes enrollment, grant creation or arbitrary sender parameters.
 *
 * **Example** (Bind a trusted grant)
 *
 * ```ts
 * import { agentMessageHandlersLayer } from "@beep/repo-cli/commands/AgentMessage"
 * import * as Layer from "effect/Layer"
 * const handlers = agentMessageHandlersLayer("owned-grant")
 * console.log(Layer.isLayer(handlers)) // true
 * ```
 *
 * @param grantId - Persisted host-issued grant checked for every tool invocation.
 * @returns Tool handlers constrained to the grant's current identity and message budget.
 * @category layers
 * @since 0.0.0
 */
export const agentMessageHandlersLayer = (grantId: string) =>
  AgentMessageToolkit.toLayer(
    Effect.gen(function* () {
      const store = yield* AgentMessageStore;
      const grant = Effect.gen(function* () {
        return yield* store.validateGrant(grantId, yield* Clock.currentTimeMillis);
      });
      const visible = Effect.fn("AgentMessage.visible")(function* (messageId: string, authority: LaunchGrant) {
        yield* store.scopedReceipts(messageId, grantId, yield* Clock.currentTimeMillis);
        const message = yield* store.message(messageId);
        if (
          message.repositoryScope !== authority.repositoryScope ||
          (message.from !== authority.endpointId &&
            !(message.to.kind === "direct" && message.to.endpointId === authority.endpointId))
        ) {
          return yield* RouterError.make({
            code: "invalidGrant",
            message: "This message is outside the enrolled scope.",
          });
        }
        return message;
      });
      const send = Effect.fn("AgentMessage.toolSend")(function* (input: SendInput, replyTo: O.Option<string>) {
        const authority = yield* grant;
        const now = yield* Clock.currentTimeMillis;
        const target = yield* store.endpoint(input.recipient);
        const previous = yield* store.findMessage(input.messageId);
        const envelope = Envelope.make({
          messageId: input.messageId,
          idempotencyKey: input.messageId,
          conversationId: input.conversationId,
          from: authority.endpointId,
          to: { kind: "direct", endpointId: input.recipient },
          repositoryScope: authority.repositoryScope,
          body: input.body,
          createdAt: O.match(previous, { onNone: () => now, onSome: (old) => old.createdAt }),
          expiresAt: O.match(previous, {
            onNone: () => now + Duration.toMillis(Duration.minutes(5)),
            onSome: (old) => old.expiresAt,
          }),
          replyTo,
          capabilityFingerprint: O.match(previous, {
            onNone: () => target.capabilityFingerprint,
            onSome: (old) => old.capabilityFingerprint,
          }),
          policyFingerprint: O.match(previous, {
            onNone: () => target.policyFingerprint,
            onSome: (old) => old.policyFingerprint,
          }),
        });
        return yield* store.acceptWithGrant(envelope, grantId, now);
      });
      return AgentMessageToolkit.of({
        agent_message_send: (input) => send(input, O.none()),
        agent_message_reply: Effect.fn("AgentMessage.toolReply")(function* (input) {
          const authority = yield* grant;
          const original = yield* visible(input.replyTo, authority);
          if (original.to.kind !== "direct" || original.to.endpointId !== authority.endpointId) {
            return yield* RouterError.make({ code: "invalidGrant", message: "Only the enrolled recipient can reply." });
          }
          return yield* send(
            SendInput.make({
              messageId: input.messageId,
              conversationId: original.conversationId,
              recipient: original.from,
              body: input.body,
            }),
            O.some(original.messageId)
          );
        }),
        agent_message_inbox: Effect.fn("AgentMessage.toolInbox")(function* () {
          return yield* store.scopedInbox(grantId, yield* Clock.currentTimeMillis);
        }),
        agent_message_acknowledge: Effect.fn("AgentMessage.toolAcknowledge")(function* (input) {
          const authority = yield* grant;
          yield* visible(input.messageId, authority);
          return yield* store.acknowledge(
            input.messageId,
            authority.endpointId,
            yield* Clock.currentTimeMillis,
            O.some(grantId)
          );
        }),
        agent_message_inspect: Effect.fn("AgentMessage.toolInspect")(function* (input) {
          return yield* store.scopedReceipts(input.messageId, grantId, yield* Clock.currentTimeMillis);
        }),
        agent_message_discover: Effect.fn("AgentMessage.toolDiscover")(function* () {
          return yield* store.scopedEndpoints(grantId, yield* Clock.currentTimeMillis);
        }),
      });
    }).pipe(Effect.withSpan("AgentMessage.toolHandlers"))
  );

/**
 * Serve the enrolled toolkit over the provider-owned stdio MCP connection.
 *
 * **Example** (Compose a scoped MCP server)
 *
 * ```ts
 * import { agentMessageMcpLayer } from "@beep/repo-cli/commands/AgentMessage"
 * import * as Layer from "effect/Layer"
 * const server = agentMessageMcpLayer("owned-grant")
 * console.log(Layer.isLayer(server)) // true
 * ```
 *
 * @param grantId - Persisted host-issued grant binding this MCP connection's authority.
 * @returns A stdio MCP server layer exposing only the six scoped messaging tools.
 * @category layers
 * @since 0.0.0
 */
export const agentMessageMcpLayer = (grantId: string) =>
  sanitizedToolkit(AgentMessageToolkit).pipe(
    Layer.provide(agentMessageHandlersLayer(grantId)),
    Layer.provide(
      McpServer.layerStdio({ name: "beep-agent-message", version: "0.0.0", protocols: handshakeMcpProtocols })
    )
  );
