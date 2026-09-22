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
  layerProtocolHttp,
  MCP_METHOD_HEADER,
  MCP_NAME_HEADER,
  MCP_PROTOCOL_VERSION_HEADER,
  McpClientOptions,
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
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { fixtureHost } from "./fixtures/FixtureHost.ts";

describe("wire helpers", () => {
  it("builds request metadata from the client options", () => {
    const metadata = requestMetadata(McpClientOptions.make({}));
    expect(metadata[PROTOCOL_VERSION_META_KEY]).toBe("2026-07-28");
    expect(metadata[CLIENT_CAPABILITIES_META_KEY]).toEqual({});
  });

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
    Effect.scoped(
      Effect.gen(function* () {
        // Built into the test scope (not `Effect.provide`d) so the protocol
        // outlives `connect` for the follow-up call.
        const protocol = yield* Layer.build(
          layerProtocolHttp({ url: "http://stub/mcp" }).pipe(
            Layer.provide(Layer.succeed(HttpClient.HttpClient, streamingClient))
          )
        );
        const { rpc } = yield* connect.pipe(Effect.provideContext(protocol));
        const result = yield* rpc["tools/call"]({ name: "echo", arguments: { text: "hi" } });
        assert.notStrictEqual(result.isError, true);
        assert.deepStrictEqual(result.content, [{ type: "text", text: "streamed" }]);
      })
    )
  );

  layer(layerConformanceHttp(fixtureHost))("against the fixture host", (it) => {
    it.effect("discovers, calls a tool, and reads structured content", () =>
      Effect.scoped(
        Effect.gen(function* () {
          const { discovery, rpc } = yield* connectHttp();
          assert.strictEqual(discovery.instructions, fixtureHost.instructions);
          const result = yield* rpc["tools/call"]({ name: "echo", arguments: { text: "round-trip" } });
          assert.deepStrictEqual(result.structuredContent, { echoed: "round-trip" });
        })
      )
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
});
