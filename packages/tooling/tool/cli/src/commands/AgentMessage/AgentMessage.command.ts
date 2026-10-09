/**
 * Operator and provider entry points for durable local agent messaging.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import { Command, Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { agentMessageStoreLayer, requirePrivateAgentPath } from "./AgentMessage.layer.ts";
import { EndpointBinding, Envelope, LaunchGrant, Receipt, RouterError } from "./AgentMessage.models.ts";
import { agentMessageServeCommand } from "./AgentMessage.runtime.ts";
import { AgentMessageStore } from "./AgentMessage.store.ts";
import { agentMessageMcpLayer } from "./AgentMessage.tools.ts";

const stateDir = Flag.String("state-dir").pipe(
  Flag.withDescription("Absolute private directory containing messages.sqlite")
);
const file = Flag.String("file").pipe(Flag.withDescription("Schema-validated JSON input file"));
const messageId = Flag.String("message-id");
const endpointId = Flag.String("endpoint");
const UnknownJson = S.fromJsonString(S.Unknown);
const EndpointBindings = S.Array(EndpointBinding);
const Envelopes = S.Array(Envelope);
const Receipts = S.Array(Receipt);
const encodeUnknownJson = S.encodeEffect(UnknownJson);
const encodeEndpointBindings = S.encodeEffect(EndpointBindings);
const encodeEnvelopes = S.encodeEffect(Envelopes);
const encodeReceipts = S.encodeEffect(Receipts);
const encodeEnvelope = S.encodeEffect(Envelope);
const encodeReceipt = S.encodeEffect(Receipt);
const print = (value: unknown) => encodeUnknownJson(value).pipe(Effect.flatMap(Console.log));
const read = Effect.fn("AgentMessage.readDocument")(function* <T, I>(filename: string, schema: S.Codec<T, I>) {
  const fs = yield* FileSystem.FileSystem;
  return yield* S.decodeEffect(S.fromJsonString(schema))(yield* fs.readFileString(filename));
});
const list = Command.make(
  "list",
  { stateDir },
  Effect.fnUntraced(function* () {
    yield* print(yield* encodeEndpointBindings(yield* (yield* AgentMessageStore).endpoints));
  })
).pipe(
  Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)),
  Command.withDescription("List enrolled endpoints and their capability evidence")
);

const register = Command.make(
  "register",
  { stateDir, file },
  Effect.fnUntraced(function* ({ file }) {
    const binding = yield* read(file, EndpointBinding);
    yield* (yield* AgentMessageStore).register(binding);
    yield* print({ registered: binding.endpointId, generation: binding.generation });
  })
).pipe(
  Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)),
  Command.withDescription("Register an explicitly owned endpoint from a JSON binding")
);

const grant = Command.make(
  "grant",
  { stateDir, file },
  Effect.fnUntraced(function* ({ file }) {
    yield* requirePrivateAgentPath(file, "File");
    const authority = yield* read(file, LaunchGrant);
    yield* (yield* AgentMessageStore).registerGrant(authority);
    yield* print({ granted: authority.grantId, endpoint: authority.endpointId });
  })
).pipe(
  Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)),
  Command.withDescription("Register a private scoped launch grant; existing quota is preserved")
);

const send = Command.make(
  "send",
  { stateDir, file },
  Effect.fnUntraced(function* ({ file }) {
    const envelope = yield* read(file, Envelope);
    const receipt = yield* (yield* AgentMessageStore).accept(envelope, yield* Clock.currentTimeMillis);
    yield* print(yield* encodeEnvelope(envelope));
    yield* print(yield* encodeReceipt(receipt));
  })
).pipe(
  Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)),
  Command.withDescription("Accept an operator-authored envelope; delivery remains a separate receipt")
);

const reply = Command.make(
  "reply",
  { stateDir, file },
  Effect.fnUntraced(function* ({ file }) {
    const envelope = yield* read(file, Envelope);
    if (O.isNone(envelope.replyTo)) {
      return yield* RouterError.make({ code: "conflict", message: "A reply envelope must name its original message." });
    }
    const receipt = yield* (yield* AgentMessageStore).accept(envelope, yield* Clock.currentTimeMillis);
    yield* print(yield* encodeEnvelope(envelope));
    yield* print(yield* encodeReceipt(receipt));
  })
).pipe(
  Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)),
  Command.withDescription("Accept an operator-authored reply with validated conversation and participant correlation")
);

const inbox = Command.make(
  "inbox",
  { stateDir, endpointId },
  Effect.fnUntraced(function* ({ endpointId }) {
    yield* print(yield* encodeEnvelopes(yield* (yield* AgentMessageStore).inbox(endpointId)));
  })
).pipe(
  Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)),
  Command.withDescription("Read queued messages for a direct endpoint")
);

const inspect = Command.make(
  "inspect",
  { stateDir, messageId },
  Effect.fnUntraced(function* ({ messageId }) {
    yield* print(yield* encodeReceipts(yield* (yield* AgentMessageStore).receipts(messageId)));
  })
).pipe(
  Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)),
  Command.withDescription("Read ordered durable delivery receipts")
);

const acknowledge = Command.make(
  "acknowledge",
  { stateDir, messageId, endpointId },
  Effect.fnUntraced(function* ({ messageId, endpointId }) {
    yield* print(
      yield* encodeReceipt(
        yield* (yield* AgentMessageStore).acknowledge(messageId, endpointId, yield* Clock.currentTimeMillis)
      )
    );
  })
).pipe(
  Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)),
  Command.withDescription("Record explicit recipient acknowledgement without claiming task completion")
);

const recover = Command.make(
  "recover",
  { stateDir },
  Effect.fnUntraced(function* () {
    yield* print({ recovered: yield* (yield* AgentMessageStore).recover(yield* Clock.currentTimeMillis) });
  })
).pipe(
  Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)),
  Command.withDescription("Hold expired in-flight claims as ambiguous without resending them")
);

const watch = Command.make(
  "watch",
  { stateDir, messageId },
  Effect.fnUntraced(function* ({ messageId }) {
    const store = yield* AgentMessageStore;
    return yield* store
      .subscribe(messageId)
      .pipe(Stream.runForEach((row) => encodeReceipt(row).pipe(Effect.flatMap(print))));
  })
).pipe(
  Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)),
  Command.withDescription("Subscribe to durable receipts as JSON lines; interrupt to stop")
);

const tools = Command.make(
  "tools",
  {
    stateDir,
    grantFile: Flag.String("grant-file").pipe(
      Flag.withDescription("Private launch-grant JSON file created by the owning host")
    ),
  },
  Effect.fnUntraced(function* ({ grantFile }) {
    yield* requirePrivateAgentPath(grantFile, "File");
    const expected = yield* read(grantFile, LaunchGrant);
    // MCP discovery can precede session enrollment. Every operation validates the
    // persisted grant; starting a transport does not grant messaging authority.
    return yield* Layer.launch(agentMessageMcpLayer(expected.grantId));
  })
).pipe(
  Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)),
  Command.withDescription("Serve only enrollment-bound messaging tools on stdio")
);

/**
 * Operator command family and provider-owned MCP entry point.
 *
 * **Example** (Inspect the command group)
 *
 * ```ts
 * import { agentMessageCommand } from "@beep/repo-cli/commands/AgentMessage"
 * console.log(agentMessageCommand.name) // "agent-message"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const agentMessageCommand = Command.make("agent-message").pipe(
  Command.withDescription("Durable scoped messages between explicitly owned agent sessions"),
  Command.withSubcommands([
    list,
    register,
    grant,
    send,
    reply,
    inbox,
    inspect,
    acknowledge,
    recover,
    watch,
    tools,
    agentMessageServeCommand,
  ])
);
