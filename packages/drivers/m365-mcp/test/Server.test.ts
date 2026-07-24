/**
 * @since 0.1.0
 */
import {
  GraphDrive,
  GraphDriveItem,
  GraphDriveItemVersion,
  GraphEvent,
  GraphListItem,
  GraphMessage,
  GraphSite,
  M365,
  M365DownloadedContent,
  M365DriveCollection,
  M365DriveItemCollection,
  M365DriveItemVersionCollection,
  M365EventCollection,
  M365MessageCollection,
  M365SiteCollection,
} from "@beep/m365";
import {
  M365McpServerConfig,
  M365ToolError,
  M365Toolkit,
  M365ToolkitHandlersLive,
  makeServerLayer,
} from "@beep/m365-mcp";
import { fcRuns } from "@beep/test-utils";
import { assert, describe, it, layer } from "@effect/vitest";
import { Result } from "effect";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const SiteId = "contoso.sharepoint.com,site,web";
const DriveId = "drive-id";
const ItemId = "item-id";
const EventId = "event-id";
const MessageId = "message-id";

const drive = GraphDrive.make({ id: DriveId, name: O.some("Documents") });
const site = GraphSite.make({ id: SiteId, name: O.some("Contoso") });
const item = GraphDriveItem.make({ id: ItemId, name: O.some("Quarterly.pdf"), size: O.some(12) });
const version = GraphDriveItemVersion.make({ id: "version-id", size: O.some(12) });
const message = GraphMessage.make({ id: MessageId, subject: O.some("Review") });
const event = GraphEvent.make({ id: EventId, subject: O.some("Planning") });
const listItem = GraphListItem.make({ id: "list-item-id", fields: O.none() });

const M365ToolErrorArbitrary = S.toArbitrary(M365ToolError);
const M365McpServerConfigArbitrary = S.toArbitrary(M365McpServerConfig);
const sameM365ToolError = S.toEquivalence(M365ToolError);
const sameM365McpServerConfig = S.toEquivalence(M365McpServerConfig);

const createMockM365 = () =>
  M365.of({
    deltaDriveItems: Effect.fn("M365Test.deltaDriveItems")(function* () {
      return M365DriveItemCollection.make({ value: [item] });
    }),
    downloadDriveItemContent: Effect.fn("M365Test.downloadDriveItemContent")(function* () {
      return yield* Effect.succeed(
        M365DownloadedContent.make({
          bytes: encoder.encode("ok"),
          item,
        })
      );
    }),
    getEvent: Effect.fn("M365Test.getEvent")(function* () {
      return event;
    }),
    getListItem: Effect.fn("M365Test.getListItem")(function* () {
      return listItem;
    }),
    getMessage: Effect.fn("M365Test.getMessage")(function* () {
      return message;
    }),
    getSite: Effect.fn("M365Test.getSite")(function* () {
      return site;
    }),
    listDriveItemVersions: Effect.fn("M365Test.listDriveItemVersions")(function* () {
      return M365DriveItemVersionCollection.make({ value: [version] });
    }),
    listDrives: Effect.fn("M365Test.listDrives")(function* () {
      return M365DriveCollection.make({ value: [drive] });
    }),
    listEvents: Effect.fn("M365Test.listEvents")(function* () {
      return M365EventCollection.make({ value: [event] });
    }),
    listMessages: Effect.fn("M365Test.listMessages")(function* () {
      return M365MessageCollection.make({ value: [message] });
    }),
    listSites: Effect.fn("M365Test.listSites")(function* () {
      return M365SiteCollection.make({ value: [site] });
    }),
  });

const MockM365Layer = Layer.succeed(M365, createMockM365());

const initializeRequest = `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"m365-mcp-test","version":"0.0.0"}}}`;
const initializedAndListRequests = `${pipe(
  [
    `{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}`,
    `{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}`,
  ],
  A.join("\n")
)}`;
const callRequest = `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"m365_list_drives","arguments":{}}}`;

const decodeOutputChunk = (chunk: string | Uint8Array): string => (P.isString(chunk) ? chunk : decoder.decode(chunk));

const encodeRequest = (request: string): Uint8Array => encoder.encode(`${request}\n`);

const continueStdioConversation = Effect.fn("continueStdioConversation")(function* (
  stdin: Queue.Queue<Uint8Array>,
  stage: Ref.Ref<number>,
  ready: Deferred.Deferred<void>,
  output: string
) {
  const currentStage = yield* Ref.get(stage);

  if (currentStage === 0 && Str.includes(`"id":1`)(output)) {
    yield* Ref.set(stage, 1);
    return yield* Queue.offer(stdin, encodeRequest(initializedAndListRequests));
  }

  if (currentStage === 1 && Str.includes(`"id":2`)(output)) {
    yield* Ref.set(stage, 2);
    return yield* Queue.offer(stdin, encodeRequest(callRequest));
  }

  if (Str.includes(DriveId)(output)) {
    return yield* Deferred.succeed(ready, void 0);
  }
});

const makeStdioTestLayer = (
  stdin: Queue.Queue<Uint8Array>,
  stdout: Ref.Ref<string>,
  stage: Ref.Ref<number>,
  ready: Deferred.Deferred<void>
) =>
  Stdio.layerTest({
    stdin: Stream.fromQueue(stdin),
    stdout: () =>
      Sink.forEach((chunk: string | Uint8Array) =>
        Ref.updateAndGet(stdout, (current) => `${current}${decodeOutputChunk(chunk)}`).pipe(
          Effect.flatMap((output) => continueStdioConversation(stdin, stage, ready, output))
        )
      ),
  });

describe("M365 MCP server", () => {
  it("keeps encoded schema wire shapes byte-identical", () => {
    const failure = M365ToolError.make({
      message: "Microsoft 365 listDrives failed: throttled",
      operation: "listDrives",
      reason: O.some("throttled"),
      retryable: true,
      toolName: "m365_list_drives",
    });
    const failureWithoutReason = M365ToolError.make({
      message: "Microsoft 365 getSite failed",
      operation: "getSite",
      retryable: false,
      toolName: "m365_get_site",
    });
    const config = M365McpServerConfig.make({
      name: "beep-m365-test",
      version: "0.0.0",
    });

    assert.deepStrictEqual(Result.getOrThrow(S.encodeResult(M365ToolError)(failure)), {
      message: "Microsoft 365 listDrives failed: throttled",
      operation: "listDrives",
      reason: "throttled",
      retryable: true,
      toolName: "m365_list_drives",
    });
    assert.deepStrictEqual(Result.getOrThrow(S.encodeResult(M365ToolError)(failureWithoutReason)), {
      message: "Microsoft 365 getSite failed",
      operation: "getSite",
      retryable: false,
      toolName: "m365_get_site",
    });
    assert.deepStrictEqual(Result.getOrThrow(S.encodeResult(M365McpServerConfig)(config)), {
      name: "beep-m365-test",
      version: "0.0.0",
    });
  });

  it("round-trips schema-derived MCP schemas through their encoded shape", () =>
    fc.assert(
      fc.property(M365ToolErrorArbitrary, M365McpServerConfigArbitrary, (failure, config) => {
        assert.isTrue(
          sameM365ToolError(
            Result.getOrThrow(
              S.decodeUnknownResult(M365ToolError)(Result.getOrThrow(S.encodeResult(M365ToolError)(failure)))
            ),
            failure
          )
        );
        assert.isTrue(
          sameM365McpServerConfig(
            Result.getOrThrow(
              S.decodeUnknownResult(M365McpServerConfig)(Result.getOrThrow(S.encodeResult(M365McpServerConfig)(config)))
            ),
            config
          )
        );
      }),
      fcRuns(50)
    ));

  it("exposes the supported read-only Microsoft 365 tools", () => {
    const toolNames = pipe(Object.keys(M365Toolkit.tools), A.sort(Order.String));

    assert.deepStrictEqual(toolNames, [
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
    ]);
  });

  layer(M365ToolkitHandlersLive.pipe(Layer.provide(MockM365Layer)))("via the mounted toolkit", (it) => {
    it.effect(
      "returns driver results through toolkit handlers",
      Effect.fnUntraced(function* () {
        const toolkit = yield* M365Toolkit;
        const stream = yield* toolkit.handle("m365_get_site", { siteId: SiteId });
        const first = yield* Stream.runHead(stream);

        assert.isTrue(O.isSome(first));
        if (O.isSome(first)) {
          assert.isFalse(first.value.isFailure);
        }
      })
    );
  });

  it.effect(
    "serves tool listing and tool calls over stdio",
    Effect.fnUntraced(function* () {
      const stdout = yield* Ref.make("");
      const stdin = yield* Queue.make<Uint8Array>();
      const stage = yield* Ref.make(0);
      const ready = yield* Deferred.make<void>();
      const serverLayer = makeServerLayer(
        M365McpServerConfig.make({
          name: "beep-m365-test",
          version: "0.0.0",
        })
      ).pipe(Layer.provide(makeStdioTestLayer(stdin, stdout, stage, ready)), Layer.provide(MockM365Layer));

      yield* Queue.offer(stdin, encodeRequest(initializeRequest));
      const fiber = yield* serverLayer.pipe(Layer.launch, Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      yield* Deferred.await(ready);
      const output = yield* Ref.get(stdout);
      yield* Fiber.interrupt(fiber).pipe(Effect.forkDetach({ startImmediately: true }), Effect.ignore);

      assert.isTrue(Str.includes(`"id":1`)(output), output);
      assert.isTrue(Str.includes(`"id":2`)(output), output);
      assert.isTrue(Str.includes(`"id":3`)(output), output);
      assert.isTrue(Str.includes("m365_list_drives")(output), output);
      assert.isTrue(Str.includes(DriveId)(output), output);
    })
  );
});
