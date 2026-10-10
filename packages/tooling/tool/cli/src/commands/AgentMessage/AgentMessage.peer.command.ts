/**
 * Grant-bound CLI return path for externally hosted peers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import { Command, Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { agentMessageStoreLayer, requirePrivateAgentPath } from "./AgentMessage.layer.ts";
import { LaunchGrant, RouterError } from "./AgentMessage.models.ts";
import { AgentMessageToolkit, agentMessageHandlersLayer } from "./AgentMessage.tools.ts";
import type * as Tool from "effect/ai/Tool";

const GrantJson = S.fromJsonString(LaunchGrant);
const WireJson = S.fromJsonString(S.Unknown);
const encodeWire = S.encodeEffect(WireJson);
const stateDir = Flag.String("state-dir");
const grantFile = Flag.String("grant-file");
const messageId = Flag.String("message-id");
const body = Flag.String("body");

/**
 * Execute one messaging handler using a private persisted grant reference.
 *
 * **Details**
 * The file selects a grant; the store remains its authority. All streamed
 * preliminary results are drained. Returned tool failures remain failures.
 *
 * **Example** (Inspect the scoped boundary)
 * ```ts
 * import { callAgentMessagePeer } from "@beep/repo-cli/test/AgentMessage"
 * console.log(typeof callAgentMessagePeer) // "function"
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const callAgentMessagePeer = Effect.fn("AgentMessage.peerCall")(function* <
  Name extends keyof typeof AgentMessageToolkit.tools,
>(filename: string, name: Name, input: Tool.ParametersEncoded<(typeof AgentMessageToolkit.tools)[Name]>) {
  yield* requirePrivateAgentPath(filename, "File");
  const fs = yield* FileSystem.FileSystem;
  const grant = yield* S.decodeEffect(GrantJson)(yield* fs.readFileString(filename));
  const context = yield* Layer.build(agentMessageHandlersLayer(grant.grantId));
  const toolkit = yield* AgentMessageToolkit.pipe(Effect.provide(context));
  const results = yield* toolkit.handle(name, input).pipe(Effect.flatMap(Stream.runCollect));
  const final = A.findLast(results, (result) => !result.preliminary);
  if (O.isNone(final)) {
    return yield* RouterError.make({
      code: "storage",
      message: "Peer operation ended without a final handler result.",
    });
  }
  if (final.value.isFailure) {
    const error = yield* S.decodeUnknownEffect(RouterError)(final.value.result);
    return yield* error;
  }
  return final.value.encodedResult;
});

const execute = Effect.fn("AgentMessage.peerPrint")(function* <Name extends keyof typeof AgentMessageToolkit.tools>(
  filename: string,
  name: Name,
  input: Tool.ParametersEncoded<(typeof AgentMessageToolkit.tools)[Name]>
) {
  const wire = yield* callAgentMessagePeer(filename, name, input);
  yield* Console.log(yield* encodeWire(wire));
});
const send = Command.make(
  "send",
  {
    stateDir,
    grantFile,
    messageId,
    body,
    conversationId: Flag.String("conversation-id"),
    recipient: Flag.String("recipient"),
  },
  Effect.fnUntraced(function* ({ grantFile, messageId, body, conversationId, recipient }) {
    yield* execute(grantFile, "agent_message_send", { messageId, body, conversationId, recipient });
  })
).pipe(Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)));
const reply = Command.make(
  "reply",
  {
    stateDir,
    grantFile,
    messageId,
    body,
    replyTo: Flag.String("reply-to"),
  },
  Effect.fnUntraced(function* ({ grantFile, messageId, body, replyTo }) {
    yield* execute(grantFile, "agent_message_reply", { messageId, body, replyTo });
  })
).pipe(Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)));
const acknowledge = Command.make(
  "acknowledge",
  { stateDir, grantFile, messageId },
  Effect.fnUntraced(function* ({ grantFile, messageId }) {
    yield* execute(grantFile, "agent_message_acknowledge", { messageId });
  })
).pipe(Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)));
const inspect = Command.make(
  "inspect",
  { stateDir, grantFile, messageId },
  Effect.fnUntraced(function* ({ grantFile, messageId }) {
    yield* execute(grantFile, "agent_message_inspect", { messageId });
  })
).pipe(Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)));
const inbox = Command.make(
  "inbox",
  { stateDir, grantFile },
  Effect.fnUntraced(function* ({ grantFile }) {
    yield* execute(grantFile, "agent_message_inbox", {});
  })
).pipe(Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)));
const discover = Command.make(
  "discover",
  { stateDir, grantFile },
  Effect.fnUntraced(function* ({ grantFile }) {
    yield* execute(grantFile, "agent_message_discover", {});
  })
).pipe(Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)));

/**
 * Scoped messaging commands for attached peers.
 * **Example** (Inspect the peer command)
 * ```ts
 * import { agentMessagePeerCommand } from "@beep/repo-cli/commands/AgentMessage"
 * console.log(agentMessagePeerCommand.name) // "peer"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const agentMessagePeerCommand = Command.make("peer").pipe(
  Command.withDescription("Grant-bound messaging only; no sender or administrative arguments"),
  Command.withSubcommands([send, reply, acknowledge, inspect, inbox, discover])
);
