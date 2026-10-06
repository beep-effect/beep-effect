import {
  M365_MCP_INSTRUCTIONS,
  M365_OUTBOX_MCP_INSTRUCTIONS,
  M365McpServerConfig,
  M365Toolkit,
  makeOutboxRegistrations,
  makeOutboxServerLayer,
  makeServerLayer,
  OutboxToolkit,
} from "@beep/m365-mcp";
import { JsonRpcMessage, JsonRpcMessageFromLine } from "@beep/mcp-kit/client";
import { conformance2026 } from "@beep/mcp-kit/test/Conformance";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { Context, Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import { Tool } from "effect/ai";
import * as Deferred from "effect/Deferred";
import * as Fiber from "effect/Fiber";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { DRAFT_ID, OutboxWorldServices, SETTINGS } from "./OutboxWorld.fixture.ts";

const OUTBOX_TOOL_NAMES = [
  "m365_outbox_create_draft",
  "m365_outbox_create_event",
  "m365_outbox_delete_draft",
  "m365_outbox_get_draft",
  "m365_outbox_send_draft",
  "m365_outbox_update_event",
];

const READ_ONLY_TOOL_NAMES = [
  "m365_delta_drive_items",
  "m365_download_drive_item_content",
  "m365_get_event",
  "m365_get_list_item",
  "m365_get_message",
  "m365_get_site",
  "m365_list_drive_item_versions",
  "m365_list_drives",
  "m365_list_events",
  "m365_list_messages",
  "m365_list_sites",
];

const sortedNames = (tools: Readonly<Record<string, unknown>>): ReadonlyArray<string> =>
  pipe(Object.keys(tools), A.sort(Order.String));

const hints = (tool: Tool.Any) => ({
  destructive: Context.get(tool.annotations, Tool.Destructive),
  openWorld: Context.get(tool.annotations, Tool.OpenWorld),
  readOnly: Context.get(tool.annotations, Tool.Readonly),
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const encodeFrame = S.encodeEffect(JsonRpcMessageFromLine);
const frame = (message: JsonRpcMessage) =>
  encodeFrame(message).pipe(
    Effect.map((line) => encoder.encode(`${line}\n`)),
    Effect.orDie
  );

const initializeRequest = frame(
  JsonRpcMessage.make({
    id: 1,
    method: "initialize",
    params: {
      capabilities: {},
      clientInfo: { name: "handshake-client", version: "0.0.0" },
      protocolVersion: "2025-11-25",
    },
  })
);
const initializedNotification = frame(JsonRpcMessage.make({ method: "notifications/initialized" }));
const listRequest = frame(JsonRpcMessage.make({ id: 2, method: "tools/list", params: {} }));

// Sends `initialize` (2025-11-25), `notifications/initialized` and `tools/list` to a built stdio
// server the way Claude Code and Claude Desktop open one, and returns everything it wrote.
const handshake = Effect.fnUntraced(function* <E>(
  serverOver: (stdio: Layer.Layer<Stdio.Stdio>) => Layer.Layer<never, E>
) {
  const stdin = yield* Queue.make<Uint8Array>();
  const stdout = yield* Ref.make("");
  const stage = yield* Ref.make(0);
  const done = yield* Deferred.make<void>();
  const advance = Effect.fnUntraced(function* (output: string) {
    const current = yield* Ref.get(stage);
    if (current === 0 && Str.includes(`"id":1`)(output)) {
      yield* Ref.set(stage, 1);
      yield* Queue.offer(stdin, yield* initializedNotification);
      yield* Queue.offer(stdin, yield* listRequest);
    } else if (current === 1 && Str.includes(`"id":2`)(output)) {
      yield* Deferred.succeed(done, void 0);
    }
  });
  const stdio = Stdio.layerTest({
    stdin: Stream.fromQueue(stdin),
    stdout: () =>
      Sink.forEach((chunk: string | Uint8Array) =>
        Ref.updateAndGet(stdout, (text) => `${text}${P.isString(chunk) ? chunk : decoder.decode(chunk)}`).pipe(
          Effect.flatMap(advance)
        )
      ),
  });

  yield* Queue.offer(stdin, yield* initializeRequest);
  const fiber = yield* serverOver(stdio).pipe(Layer.launch, Effect.forkChild({ startImmediately: true }));
  yield* Deferred.await(done);
  const output = yield* Ref.get(stdout);
  yield* Fiber.interrupt(fiber);
  return output;
});

describe("@beep/m365-mcp outbox server", () => {
  it("pins the outbox tool names", () => {
    assert.deepStrictEqual(sortedNames(OutboxToolkit.tools), OUTBOX_TOOL_NAMES);
  });

  it("keeps the read-only toolkit free of write tools", () => {
    assert.deepStrictEqual(sortedNames(M365Toolkit.tools), READ_ONLY_TOOL_NAMES);
    assert.deepStrictEqual(A.intersection(sortedNames(M365Toolkit.tools), OUTBOX_TOOL_NAMES), []);
    for (const tool of Object.values(M365Toolkit.tools)) {
      assert.deepStrictEqual(hints(tool), { destructive: false, openWorld: true, readOnly: true }, tool.name);
    }
    assert.isTrue(Str.startsWith("Read-only Microsoft 365")(M365_MCP_INSTRUCTIONS));
  });

  it("marks send and delete destructive, the other writes non-read-only, and get_draft read-only", () => {
    const { tools } = OutboxToolkit;

    assert.deepStrictEqual(hints(tools.m365_outbox_send_draft), {
      destructive: true,
      openWorld: true,
      readOnly: false,
    });
    assert.deepStrictEqual(hints(tools.m365_outbox_delete_draft), {
      destructive: true,
      openWorld: true,
      readOnly: false,
    });
    assert.deepStrictEqual(hints(tools.m365_outbox_get_draft), { destructive: false, openWorld: true, readOnly: true });
    for (const tool of [
      tools.m365_outbox_create_draft,
      tools.m365_outbox_create_event,
      tools.m365_outbox_update_event,
    ]) {
      assert.deepStrictEqual(hints(tool), { destructive: false, openWorld: true, readOnly: false }, tool.name);
    }
  });

  it("says plainly which tool sends and what to do after an unknown outcome", () => {
    assert.isTrue(Str.startsWith("Microsoft 365 outbox")(M365_OUTBOX_MCP_INSTRUCTIONS));
    assert.include(M365_OUTBOX_MCP_INSTRUCTIONS, "Only m365_outbox_send_draft sends mail");
    assert.include(OutboxToolkit.tools.m365_outbox_send_draft.description, "never send again blindly");
    assert.include(OutboxToolkit.tools.m365_outbox_create_draft.description, "does not send anything");
  });

  it.effect(
    "answers a Claude-style initialize handshake (2025-11-25) and then lists the six outbox tools",
    Effect.fnUntraced(function* () {
      const output = yield* handshake((stdio) =>
        makeOutboxServerLayer(
          M365McpServerConfig.make({ name: "beep-m365-outbox-test", version: "0.0.0" }),
          SETTINGS
        ).pipe(Layer.provide(stdio), Layer.provide(OutboxWorldServices))
      );

      assert.include(output, `"protocolVersion":"2025-11-25"`);
      assert.notInclude(output, `"error"`);
      for (const name of OUTBOX_TOOL_NAMES) {
        assert.include(output, `"name":"${name}"`);
      }
      assert.notInclude(output, `"name":"m365_list_drives"`);
    }),
    { timeout: 10_000 }
  );

  it.effect(
    "answers the same handshake on the read-only server and lists only its read-only tools",
    Effect.fnUntraced(function* () {
      const output = yield* handshake((stdio) =>
        makeServerLayer(M365McpServerConfig.make({ name: "beep-m365-test", version: "0.0.0" })).pipe(
          Layer.provide(stdio),
          Layer.provide(OutboxWorldServices)
        )
      );

      assert.include(output, `"protocolVersion":"2025-11-25"`);
      assert.notInclude(output, `"error"`);
      for (const name of READ_ONLY_TOOL_NAMES) {
        assert.include(output, `"name":"${name}"`);
      }
      assert.notInclude(output, "m365_outbox_");
    }),
    { timeout: 10_000 }
  );
});

conformance2026({
  name: "beep-m365-outbox-test",
  version: "0.0.0",
  instructions: M365_OUTBOX_MCP_INSTRUCTIONS,
  registrations: makeOutboxRegistrations(SETTINGS).pipe(Layer.provide(OutboxWorldServices)),
  tool: {
    name: "m365_outbox_get_draft",
    arguments: { draftId: DRAFT_ID },
    invalidArguments: { draftId: 1 },
  },
});
