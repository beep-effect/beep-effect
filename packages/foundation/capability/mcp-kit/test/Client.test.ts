/**
 * `@beep/mcp-kit/client`: wire helpers, the event-stream unwrap, and the two
 * protocol layers driven against the fixture host over HTTP and stdio.
 *
 * @since 0.0.0
 */
import {
  CLIENT_CAPABILITIES_META_KEY,
  connect,
  decodeHttpMessages,
  JsonRpcMessage,
  JsonRpcMessageFromLine,
  layerProtocolHttp,
  layerProtocolNdjson,
  MCP_METHOD_HEADER,
  MCP_NAME_HEADER,
  MCP_PROTOCOL_VERSION_HEADER,
  McpClientOptions,
  McpClientRpcs,
  McpHttpProtocolOptions,
  PROTOCOL_VERSION_META_KEY,
  parseServerSentEvents,
  requestMetadata,
  routingHeaders,
  routingName,
  withRequestMetadata,
} from "@beep/mcp-kit/client";
import {
  ConformanceHttp,
  connectHttp,
  connectStdio,
  layerConformanceHttp,
  withStdioHost,
} from "@beep/mcp-kit/test/Conformance";
import { assert, describe, expect, it, layer } from "@effect/vitest";
import { Deferred, Effect, Fiber, Layer, Queue, Stream } from "effect";
import * as A from "effect/Array";
import { HttpClient, HttpClientResponse } from "effect/http";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { RpcClient } from "effect/rpc";
import * as S from "effect/Schema";
import { fixtureHost } from "./fixtures/FixtureHost.ts";

// One JSON-RPC frame is exactly one wire line, so the kit's own codec builds
// and reads the stub host's traffic instead of hand-rolled JSON.
// Framing a stub's own traffic always codes, so a codec failure is a defect of
// the test rather than an outcome under test.
const encodeFrameLine = S.encodeEffect(JsonRpcMessageFromLine);
const decodeFrameLine = S.decodeEffect(JsonRpcMessageFromLine);
const encodeFrame = (message: JsonRpcMessage) => Effect.orDie(encodeFrameLine(message));
const decodeFrame = (line: string) => Effect.orDie(decodeFrameLine(line));
// A typeless `Blob` body is how a response gets no `content-type` header at
// all: a string body would have one inferred.
const encodeFrameBody = (message: JsonRpcMessage): Effect.Effect<Blob> =>
  Effect.map(encodeFrame(message), (frame) => new Blob([frame]));

describe("wire helpers", () => {
  it.effect("builds request metadata from the client options", () =>
    Effect.gen(function* () {
      const metadata = yield* requestMetadata(McpClientOptions.make({}));
      expect(metadata[PROTOCOL_VERSION_META_KEY]).toBe("2026-07-28");
      expect(metadata[CLIENT_CAPABILITIES_META_KEY]).toEqual({});
    })
  );

  it("merges metadata under _meta and lets caller keys win", () => {
    const params = withRequestMetadata(
      { name: "echo", _meta: { [PROTOCOL_VERSION_META_KEY]: "override" } },
      { [PROTOCOL_VERSION_META_KEY]: "2026-07-28", [CLIENT_CAPABILITIES_META_KEY]: {} }
    );
    expect(params).toEqual({
      name: "echo",
      _meta: { [PROTOCOL_VERSION_META_KEY]: "override", [CLIENT_CAPABILITIES_META_KEY]: {} },
    });
    expect(withRequestMetadata("not-an-object", {})).toEqual({ _meta: {} });
  });

  it("derives the routing name per method", () => {
    const message = (method: string, params: unknown) => JsonRpcMessage.make({ id: 1, method, params });
    expect(routingName(message("tools/call", { name: "echo" }))).toEqual(O.some("echo"));
    expect(routingName(message("prompts/get", { name: "p" }))).toEqual(O.some("p"));
    expect(routingName(message("resources/read", { uri: "file:///x" }))).toEqual(O.some("file:///x"));
    expect(routingName(message("tools/list", {}))).toEqual(O.none());
    expect(routingName(message("tools/call", { name: 1 }))).toEqual(O.none());
  });

  it("mirrors the frame into routing headers, taking the version from _meta", () => {
    const headers = routingHeaders(
      JsonRpcMessage.make({
        id: 1,
        method: "tools/call",
        params: { name: "echo", _meta: { [PROTOCOL_VERSION_META_KEY]: "2027-01-01" } },
      })
    );
    expect(headers).toEqual({
      [MCP_PROTOCOL_VERSION_HEADER]: "2027-01-01",
      [MCP_METHOD_HEADER]: "tools/call",
      [MCP_NAME_HEADER]: "echo",
    });
    expect(routingHeaders(JsonRpcMessage.make({ id: 1, method: "tools/list", params: {} }))).toEqual({
      [MCP_PROTOCOL_VERSION_HEADER]: "2026-07-28",
      [MCP_METHOD_HEADER]: "tools/list",
    });
    // A response frame has no method to mirror, so only the version travels.
    expect(routingHeaders(JsonRpcMessage.make({ id: 1, result: {} }))).toEqual({
      [MCP_PROTOCOL_VERSION_HEADER]: "2026-07-28",
    });
  });

  it("splits server-sent events into data payloads", () => {
    expect(parseServerSentEvents('data: {"a":1}\r\n\r\nevent: x\ndata:{"b":\ndata: 2}\n\n')).toEqual([
      '{"a":1}',
      '{"b":\n2}',
    ]);
  });

  it.effect("decodes JSON and event-stream bodies", () =>
    Effect.gen(function* () {
      const json = yield* decodeHttpMessages('{"jsonrpc":"2.0","id":1,"result":{}}', "application/json");
      assert.strictEqual(json.length, 1);
      const sse = yield* decodeHttpMessages(
        'data: {"jsonrpc":"2.0","method":"notifications/progress"}\n\ndata: {"jsonrpc":"2.0","id":2,"result":{"ok":true}}\n\n',
        "text/event-stream"
      );
      assert.deepStrictEqual(
        A.map(sse, (message) => message.id),
        [undefined, 2]
      );
      const empty = yield* decodeHttpMessages("", "application/json");
      assert.strictEqual(empty.length, 0);
      // A JSON body may be a batch: the array is the message list itself, not
      // a single message to be wrapped.
      const batch = yield* decodeHttpMessages(
        '[{"jsonrpc":"2.0","id":1,"result":{}},{"jsonrpc":"2.0","id":2,"result":{}}]',
        "application/json"
      );
      assert.deepStrictEqual(
        A.map(batch, (message) => message.id),
        [1, 2]
      );
    })
  );
});

describe("layerProtocolHttp", () => {
  // A stub host whose every response is an event stream carrying a
  // notification before the response, so the unwrap is proven independently
  // of when a real host chooses to upgrade.
  const streamingClient = HttpClient.make((request) =>
    Effect.map(
      request.body._tag === "Uint8Array" ? Effect.succeed(request.body.body) : Effect.die("unexpected body"),
      (bytes) => {
        const frame = JSON.parse(new TextDecoder().decode(bytes)) as { readonly id: number; readonly method: string };
        const events = [
          { jsonrpc: "2.0", method: "notifications/progress", params: { progressToken: 1, progress: 1 } },
          {
            jsonrpc: "2.0",
            id: frame.id,
            result:
              frame.method === "server/discover"
                ? { supportedVersions: ["2026-07-28"], capabilities: { tools: {} } }
                : { content: [{ type: "text", text: "streamed" }], isError: false },
          },
        ];
        return HttpClientResponse.fromWeb(
          request,
          new Response(
            A.join(
              A.map(events, (event) => `data: ${JSON.stringify(event)}\n\n`),
              ""
            ),
            {
              status: 200,
              headers: { "content-type": "text/event-stream" },
            }
          )
        );
      }
    )
  );

  it.effect("unwraps a text/event-stream tools/call response", () =>
    Effect.gen(function* () {
      // Built into the test scope (not `Effect.provide`d) so the protocol
      // outlives `connect` for the follow-up call.
      const protocol = yield* Layer.build(
        layerProtocolHttp(McpHttpProtocolOptions.make({ url: "http://stub/mcp" })).pipe(
          Layer.provide(Layer.succeed(HttpClient.HttpClient, streamingClient))
        )
      );
      const { rpc } = yield* connect.pipe(Effect.provideContext(protocol));
      const result = yield* rpc["tools/call"]({ name: "echo", arguments: { text: "hi" } });
      assert.notStrictEqual(result.isError, true);
      assert.deepStrictEqual(result.content, [{ type: "text", text: "streamed" }]);
    })
  );

  it.effect("decodes a body with no content-type header and fails the call on a JSON-RPC error", () =>
    Effect.gen(function* () {
      // No `content-type` at all: the decoder must fall back to JSON rather
      // than dying on a missing header, and a host error frame must reach the
      // caller as a failure instead of an empty success.
      const erroringClient = HttpClient.make(
        Effect.fnUntraced(function* (request) {
          const sent =
            request.body._tag === "Uint8Array"
              ? yield* decodeFrame(new TextDecoder().decode(request.body.body))
              : JsonRpcMessage.make({});
          const id = sent.id ?? 1;
          const body =
            sent.method === "server/discover"
              ? JsonRpcMessage.make({ id, result: { supportedVersions: ["2026-07-28"], capabilities: {} } })
              : JsonRpcMessage.make({ id, error: { code: -32603, message: "host said no" } });
          return HttpClientResponse.fromWeb(request, new Response(yield* encodeFrameBody(body), { status: 200 }));
        })
      );
      const protocol = yield* Layer.build(
        layerProtocolHttp(McpHttpProtocolOptions.make({ url: "http://stub/mcp" })).pipe(
          Layer.provide(Layer.succeed(HttpClient.HttpClient, erroringClient))
        )
      );
      const { rpc } = yield* connect.pipe(Effect.provideContext(protocol));
      const error = yield* Effect.flip(rpc["tools/list"]({}));
      // The host's JSON-RPC error object is the failure: it must not be
      // swallowed into an empty success because the body carried no type.
      assert.strictEqual(P.hasProperty(error, "code") ? error.code : undefined, -32603);
      assert.strictEqual(P.hasProperty(error, "message") ? error.message : undefined, "host said no");
    })
  );

  layer(layerConformanceHttp(fixtureHost))("against the fixture host", (it) => {
    it.effect("discovers, calls a tool, and reads structured content", () =>
      Effect.gen(function* () {
        // Explicit client options exercise the identity the connection
        // presents, rather than the runner's default.
        const { discovery, rpc } = yield* connectHttp(McpClientOptions.make({}));
        assert.strictEqual(discovery.instructions, fixtureHost.instructions);
        const result = yield* rpc["tools/call"]({ name: "echo", arguments: { text: "round-trip" } });
        assert.deepStrictEqual(result.structuredContent, { echoed: "round-trip" });
      })
    );

    it.effect("rejects a POST missing request metadata with 400", () =>
      Effect.gen(function* () {
        const http = yield* ConformanceHttp;
        const message = JsonRpcMessage.make({ id: 1, method: "tools/list", params: {} });
        const exchange = yield* http.post(message, routingHeaders(message));
        assert.strictEqual(exchange.status, 400);
      })
    );
  });
});

describe("layerProtocolNdjson", () => {
  it.effect("sends server/discover then tools/call over stdio", () =>
    withStdioHost(fixtureHost)((io) =>
      Effect.gen(function* () {
        const { discovery, rpc } = yield* connectStdio(io);
        assert.deepStrictEqual(discovery.supportedVersions, ["2026-07-28"]);
        const result = yield* rpc["tools/call"]({ name: "echo", arguments: { text: "stdio" } });
        assert.deepStrictEqual(result.structuredContent, { echoed: "stdio" });
      })
    )
  );

  it.effect("ignores blank, undecodable and unmatched lines while still answering the pending request", () =>
    Effect.gen(function* () {
      const written = yield* Queue.unbounded<string>();
      const incoming = yield* Queue.unbounded<string>();
      const protocol = yield* Layer.build(
        layerProtocolNdjson({
          write: (line) => Effect.asVoid(Queue.offer(written, line)),
          lines: Stream.fromQueue(incoming),
        })
      );
      const rpc = yield* RpcClient.make(McpClientRpcs).pipe(Effect.provideContext(protocol));
      const fiber = yield* Effect.forkScoped(rpc["tools/list"]({}));
      const request = yield* Queue.take(written);
      const id = (yield* decodeFrame(request)).id ?? 1;

      // A stdio host interleaves keep-alive blanks, log noise and responses
      // to requests this client never sent; none of them may settle or
      // corrupt the waiter for the request that is actually pending.
      yield* Queue.offerAll(incoming, [
        "   ",
        "this is not a json-rpc line",
        yield* encodeFrame(JsonRpcMessage.make({ method: "notifications/progress", params: {} })),
        yield* encodeFrame(JsonRpcMessage.make({ id: "unknown-request", result: {} })),
        yield* encodeFrame(JsonRpcMessage.make({ id, result: { tools: [] } })),
      ]);

      const result = yield* Fiber.join(fiber);
      assert.deepStrictEqual(result.tools, []);
    })
  );

  it.effect("releases the pending waiter and sends notifications/cancelled when a request is interrupted", () =>
    Effect.gen(function* () {
      // A host that never answers: the only way the call ends is interruption.
      const written = yield* Queue.unbounded<string>();
      const protocol = yield* Layer.build(
        layerProtocolNdjson({ write: (line) => Effect.asVoid(Queue.offer(written, line)), lines: Stream.never })
      );
      const rpc = yield* RpcClient.make(McpClientRpcs).pipe(Effect.provideContext(protocol));
      const fiber = yield* Effect.forkScoped(rpc["tools/list"]({}));
      const request = yield* Queue.take(written);
      assert.include(request, '"method":"tools/list"');
      yield* Fiber.interrupt(fiber);
      const cancelled = yield* Queue.take(written);
      assert.include(cancelled, '"method":"notifications/cancelled"');
      // A second request after the interrupt still round-trips through the
      // same protocol: the interrupted waiter left no residue that could
      // shadow the new id, and the router keeps running.
      const answered = yield* Deferred.make<void>();
      const echo = yield* Effect.forkScoped(
        rpc["tools/list"]({}).pipe(Effect.tap(() => Deferred.succeed(answered, undefined)))
      );
      const second = yield* Queue.take(written);
      assert.include(second, '"method":"tools/list"');
      yield* Fiber.interrupt(echo);
      assert.isFalse(yield* Deferred.isDone(answered));
    })
  );
});

describe("layerProtocolHttp headers", () => {
  it.effect("keeps the routing mirrors above caller headers and content negotiation fixed", () =>
    Effect.gen(function* () {
      const seen: Array<Readonly<Record<string, string>>> = [];
      // Echoes the request id so the reply routes back to whichever id the
      // RpcClient allocated for this call.
      const recordingClient = HttpClient.make((request) => {
        seen.push(request.headers);
        const sent = request.body._tag === "Uint8Array" ? JSON.parse(new TextDecoder().decode(request.body.body)) : {};
        const frame = JsonRpcMessage.make({
          id: (sent as { readonly id: number }).id,
          result: { supportedVersions: ["2026-07-28"], capabilities: {} },
        });
        return Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify(frame), { status: 200, headers: { "content-type": "application/json" } })
          )
        );
      });
      const protocol = yield* Layer.build(
        layerProtocolHttp(
          McpHttpProtocolOptions.make({
            url: "http://stub/mcp",
            headers: {
              authorization: "Bearer test-token",
              [MCP_METHOD_HEADER]: "tools/call",
              accept: "text/plain",
            },
          })
        ).pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient, recordingClient)))
      );
      yield* connect.pipe(Effect.provideContext(protocol));
      const [headers] = seen;
      assert.strictEqual(headers?.authorization, "Bearer test-token");
      assert.strictEqual(headers?.[MCP_METHOD_HEADER.toLowerCase()], "server/discover");
      assert.strictEqual(headers?.[MCP_PROTOCOL_VERSION_HEADER.toLowerCase()], "2026-07-28");
      assert.strictEqual(headers?.accept, "application/json, text/event-stream");
    })
  );
});
