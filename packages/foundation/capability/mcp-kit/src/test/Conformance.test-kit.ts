/**
 * Conformance runner for MCP `2026-07-28` hosts built on the kit — a test-only
 * surface (`@beep/mcp-kit/test/Conformance`).
 *
 * Port of the host-relevant arms of Effect's `test/unstable/ai/McpServer`
 * conformance suite at `effect@4.0.0-rc.117` (`v2026_07_28.test.ts`,
 * `McpConformance/{BaseProtocol,Transports,Tools,Prompts}Test.ts`,
 * `TestUtils/{McpHttpHarness,McpStdioHarness}.ts`), driven through
 * `@beep/mcp-kit/client` over streamable HTTP and over newline-delimited
 * stdio. The upstream suite exercises Effect's own fixture server; this one
 * takes a host's registration layer and proves the host answers the
 * revision's lifecycle, framing, routing and tool semantics.
 *
 * Known upstream gap (recorded, not waived): on stdio a legacy `initialize`
 * is answered with `-32022` but without `data.supported`; the runner asserts
 * the code only.
 *
 * @internal
 * @since 0.0.0
 */

import { assert, describe, it, layer } from "@effect/vitest";
import { Cause, Context, Deferred, Effect, Exit, Fiber, Layer, Queue, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as McpSchema from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import { HttpClient, HttpClientRequest, HttpClientResponse, HttpRouter } from "effect/http";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  connect,
  decodeLines,
  JsonRpcMessage,
  JsonRpcMessageFromLine,
  layerProtocolHttp,
  layerProtocolNdjson,
  MCP_PROTOCOL_VERSION_HEADER,
  McpClientOptions,
  McpHttpProtocolOptions,
  PROTOCOL_VERSION_META_KEY,
  postJsonRpc,
  requestMetadata,
  routingHeaders,
  UNSUPPORTED_PROTOCOL_VERSION_ERROR_CODE,
  withRequestMetadata,
} from "../client.ts";
import { MCP_PROTOCOL_VERSION, statelessMcpProtocols } from "../Version.ts";
import type * as Scope from "effect/Scope";
import type { McpClientConnection, McpHttpExchange } from "../client.ts";

/**
 * What the runner needs to know about a host: its identity, its registration
 * layer (toolkits, prompts, resources — everything but the transport), one
 * tool it can call with valid and with invalid arguments, and optionally one
 * prompt whose title it advertises.
 *
 * @internal
 * @since 0.0.0
 */
export interface ConformanceHost<E> {
  readonly instructions?: string | undefined;
  readonly name: string;
  readonly prompt?:
    | {
        readonly name: string;
        readonly title: string;
        readonly arguments?: Readonly<Record<string, string>> | undefined;
      }
    | undefined;
  readonly registrations: Layer.Layer<never, E>;
  readonly tool: {
    readonly name: string;
    readonly arguments: Readonly<Record<string, unknown>>;
    readonly invalidArguments: Readonly<Record<string, unknown>>;
  };
  readonly version: string;
}

const MCP_URL = "http://localhost/mcp";

/**
 * Streamable HTTP harness around a host: a web handler built from
 * `McpServer.layerHttp`, an `HttpClient` that calls it in-process, and the
 * raw `post` primitive for hand-built frames.
 *
 * @internal
 * @since 0.0.0
 */
export class ConformanceHttp extends Context.Service<
  ConformanceHttp,
  {
    readonly url: string;
    readonly httpClient: HttpClient.HttpClient;
    readonly post: (
      message: JsonRpcMessage,
      headers: Readonly<Record<string, string>>
    ) => Effect.Effect<McpHttpExchange>;
  }
>()("@beep/mcp-kit/test/Conformance.test-kit/ConformanceHttp") {}

/**
 * Builds the HTTP harness for a host.
 *
 * @internal
 * @since 0.0.0
 */
export const layerConformanceHttp = <E>(host: ConformanceHost<E>): Layer.Layer<ConformanceHttp> =>
  Layer.effect(ConformanceHttp)(
    Effect.gen(function* () {
      const app = host.registrations.pipe(
        Layer.provideMerge(
          McpServer.layerHttp({
            name: host.name,
            version: host.version,
            instructions: host.instructions,
            path: "/mcp",
            protocols: statelessMcpProtocols,
          })
        )
      );
      const { dispose, handler } = HttpRouter.toWebHandler(app, { disableLogger: true });
      yield* Effect.addFinalizer(() => Effect.promise(() => dispose()));
      const httpClient = HttpClient.make((request) =>
        HttpClientRequest.toWeb(request).pipe(
          Effect.orDie,
          Effect.flatMap((web) => Effect.promise(() => handler(web))),
          Effect.map((response) => HttpClientResponse.fromWeb(request, response))
        )
      );
      return ConformanceHttp.of({
        url: MCP_URL,
        httpClient,
        post: Effect.fn("ConformanceHttp.post")((message, headers) =>
          postJsonRpc(MCP_URL, message, headers).pipe(
            Effect.orDie,
            Effect.provideService(HttpClient.HttpClient, httpClient)
          )
        ),
      });
    })
  );

/**
 * Connects the kit client to the harness host over HTTP (sends
 * `server/discover` first).
 *
 * @internal
 * @since 0.0.0
 */
export const connectHttp = (
  options?: McpClientOptions
): Effect.Effect<McpClientConnection, McpSchema.McpError, ConformanceHttp | Scope.Scope> =>
  Effect.gen(function* () {
    const http = yield* ConformanceHttp;
    // Built into the ambient scope, not `Effect.provide`d: the protocol must
    // outlive `connect` so later calls on the returned client still route.
    const protocol = yield* Layer.build(
      layerProtocolHttp(
        McpHttpProtocolOptions.make({ url: http.url, ...(options === undefined ? {} : { client: options }) })
      ).pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient, http.httpClient)))
    );
    return yield* connect.pipe(Effect.provideContext(protocol), Effect.orDie);
  });

/**
 * Raw stdio harness around a host: writes reach the host's stdin, its stdout
 * is split into lines, and the server fiber can be awaited for shutdown.
 *
 * @internal
 * @since 0.0.0
 */
export interface StdioHost {
  readonly close: Effect.Effect<void>;
  readonly lines: Stream.Stream<string>;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly nextLine: Effect.Effect<string>;
  readonly nextMessage: Effect.Effect<JsonRpcMessage>;
  readonly sendChunk: (chunk: string | Uint8Array) => Effect.Effect<void>;
  readonly sendMessage: (message: JsonRpcMessage) => Effect.Effect<void>;
  readonly serverExit: Effect.Effect<Exit.Exit<never, unknown>>;
}

const encoder = new TextEncoder();
const toBytes = (chunk: string | Uint8Array): Uint8Array => (P.isString(chunk) ? encoder.encode(chunk) : chunk);
const encodeLine = S.encodeEffect(JsonRpcMessageFromLine);
const decodeLine = S.decodeEffect(JsonRpcMessageFromLine);
// Harness framing: a line the runner builds or the host emits always codes, so
// a codec failure is a harness defect rather than a conformance outcome.
const encodeLineOrDie = (message: JsonRpcMessage) => Effect.orDie(encodeLine(message));
const decodeLineOrDie = (line: string) => Effect.orDie(decodeLine(line));
const defaultRequestMetadata = Effect.orDie(requestMetadata(McpClientOptions.make({})));

/**
 * Runs `use` against a fresh stdio instance of the host built on
 * `Stdio.layerTest`, mirroring upstream `McpStdioHarness`.
 *
 * @internal
 * @since 0.0.0
 */
export const withStdioHost =
  <E>(host: ConformanceHost<E>) =>
  <A, E2, R>(use: (io: StdioHost) => Effect.Effect<A, E2, R>): Effect.Effect<A, E2, R> =>
    Effect.scoped(
      Effect.gen(function* () {
        const stdin = yield* Queue.unbounded<Uint8Array, Cause.Done>();
        const stdout = yield* Queue.unbounded<string | Uint8Array>();
        const lines = yield* Queue.unbounded<string>();
        const stdioLayer = Stdio.layerTest({
          stdin: Stream.fromQueue(stdin),
          stdout: () => Sink.forEach((chunk) => Queue.offer(stdout, chunk)),
          stderr: () => Sink.drain,
        });
        // The stdio protocol interrupts the fiber that built it when stdin ends
        // (rc.117 `RpcServer.makeProtocolStdio`), so the transport must build in
        // the harness fiber itself: registrations depend on it, never the reverse.
        const serverLayer = host.registrations.pipe(
          Layer.provideMerge(
            McpServer.layerStdio({
              name: host.name,
              version: host.version,
              instructions: host.instructions,
              protocols: statelessMcpProtocols,
            }).pipe(Layer.provide(stdioLayer))
          )
        );
        // The transport answers as soon as it is up, but a host's registrations
        // may open databases or read bundles while they build. Hand `io` to the
        // caller only once the whole server layer is built, or fail with the
        // build's own failure, so a slow host cannot answer "tool not found".
        const ready = yield* Deferred.make<void>();
        const serverFiber = yield* Layer.build(serverLayer).pipe(
          Effect.tap(() => Deferred.succeed(ready, void 0)),
          Effect.andThen(Effect.never),
          Effect.scoped,
          Effect.forkScoped
        );
        // A host that fails to build is a harness defect, not an arm outcome.
        yield* Effect.raceFirst(Deferred.await(ready), Fiber.join(serverFiber)).pipe(Effect.orDie);
        yield* Stream.fromQueue(stdout).pipe(
          Stream.map(toBytes),
          decodeLines,
          Stream.runForEach((line) => Queue.offer(lines, line)),
          Effect.forkScoped
        );
        const sendChunk = (chunk: string | Uint8Array) => Effect.asVoid(Queue.offer(stdin, toBytes(chunk)));
        const metadata = yield* defaultRequestMetadata;
        return yield* use({
          sendChunk,
          sendMessage: (message) => Effect.flatMap(encodeLineOrDie(message), (line) => sendChunk(`${line}\n`)),
          nextLine: Queue.take(lines),
          nextMessage: Effect.flatMap(Queue.take(lines), decodeLineOrDie),
          lines: Stream.fromQueue(lines),
          close: Effect.asVoid(Queue.end(stdin)),
          serverExit: Fiber.await(serverFiber),
          metadata,
        });
      })
    );

/**
 * Connects the kit client to a stdio instance of the host through
 * {@link layerProtocolNdjson} (sends `server/discover` first).
 *
 * @internal
 * @since 0.0.0
 */
export const connectStdio = (io: StdioHost): Effect.Effect<McpClientConnection, McpSchema.McpError, Scope.Scope> =>
  Effect.gen(function* () {
    // Same as `connectHttp`: the NDJSON router fiber lives in the protocol
    // layer's scope, so the layer is built into the ambient scope.
    const protocol = yield* Layer.build(
      layerProtocolNdjson({
        write: (line) => io.sendChunk(`${line}\n`),
        lines: io.lines,
      })
    );
    return yield* connect.pipe(Effect.provideContext(protocol), Effect.orDie);
  });

const errorOf = (exchange: McpHttpExchange) =>
  O.flatMap(A.head(exchange.messages), (message) => O.fromNullishOr(message.error));

// One assertion for "the host answered this JSON-RPC error code", optionally
// with the HTTP status the stateless transport pairs it with.
const assertErrorCode = (
  exchange: McpHttpExchange,
  code: number,
  options?: { readonly status?: number | undefined; readonly label?: string | undefined }
): void => {
  if (options?.status !== undefined) {
    assert.strictEqual(exchange.status, options.status, options.label);
  }
  assert.deepStrictEqual(
    O.map(errorOf(exchange), (error) => error.code),
    O.some(code),
    options?.label
  );
};

const legacyInitialize = (id: number) =>
  JsonRpcMessage.make({
    id,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "legacy-client", version: "0.0.0" },
    },
  });

/**
 * Registers the `conformance 2026-07-28` suite for a host.
 *
 * @internal
 * @since 0.0.0
 */
export const conformance2026 = <E>(host: ConformanceHost<E>): void => {
  describe(`conformance 2026-07-28: ${host.name}`, () => {
    layer(layerConformanceHttp(host))("over streamable HTTP", (it) => {
      it.effect("discovers the server without initialize or a session", () =>
        Effect.gen(function* () {
          const { discovery } = yield* connectHttp();
          assert.include(discovery.supportedVersions, MCP_PROTOCOL_VERSION);
          assert.isDefined(discovery.capabilities.tools);
          assert.strictEqual(discovery.instructions, host.instructions);
          assert.deepStrictEqual(
            O.map(discovery.serverInfo, (info) => ({ name: info.name, version: info.version })),
            O.some({ name: host.name, version: host.version })
          );
        })
      );

      it.effect("lists tools with object-rooted input schemas", () =>
        Effect.gen(function* () {
          const { rpc } = yield* connectHttp();
          const listed = yield* rpc["tools/list"]({});
          assert.include(
            A.map(listed.tools, (tool) => tool.name),
            host.tool.name
          );
          for (const tool of listed.tools) {
            assert.strictEqual(tool.inputSchema.type, "object", `${tool.name} inputSchema root`);
          }
        })
      );

      it.effect("calls a tool and returns a non-error result", () =>
        Effect.gen(function* () {
          const { rpc } = yield* connectHttp();
          const result = yield* rpc["tools/call"]({ name: host.tool.name, arguments: host.tool.arguments });
          assert.notStrictEqual(result.isError, true);
          assert.isAtLeast(result.content.length, 1);
        })
      );

      it.effect("projects invalid arguments as a tool error and malformed arguments as InvalidParams", () =>
        Effect.gen(function* () {
          // rc.117's 2026-07-28 adapter projects a tool validation failure as
          // `isError: true` with a scrubbed message (upstream ToolsTest
          // "distinguishes malformed requests from tool validation errors by
          // protocol revision"); the kit adapter still classifies it as
          // `InvalidParams` underneath, which the direct-dispatch test proves.
          const { rpc } = yield* connectHttp();
          const result = yield* rpc["tools/call"]({ name: host.tool.name, arguments: host.tool.invalidArguments });
          assert.isTrue(result.isError);
          assert.isUndefined(result.structuredContent);
          const [first] = result.content;
          const text = first?.type === "text" ? first.text : "";
          assert.include(text, `Invalid parameters for tool '${host.tool.name}'`);
          assert.notMatch(text, /AiError|ToolParameterValidationError|Toolkit/);

          const http = yield* ConformanceHttp;
          const metadata = yield* defaultRequestMetadata;
          const malformed = JsonRpcMessage.make({
            id: 11,
            method: "tools/call",
            params: withRequestMetadata({ name: host.tool.name, arguments: "invalid" }, metadata),
          });
          const exchange = yield* http.post(malformed, routingHeaders(malformed));
          assertErrorCode(exchange, McpSchema.INVALID_PARAMS_ERROR_CODE);
        })
      );

      it.effect("answers a legacy initialize with a 400 header mismatch", () =>
        Effect.gen(function* () {
          const http = yield* ConformanceHttp;
          const exchange = yield* http.post(legacyInitialize(1), {});
          assertErrorCode(exchange, McpSchema.HEADER_MISMATCH_ERROR_CODE, { status: 400 });
        })
      );

      it.effect("answers a 2026-framed initialize and ping with method not found", () =>
        Effect.gen(function* () {
          const http = yield* ConformanceHttp;
          const metadata = yield* defaultRequestMetadata;
          for (const method of ["initialize", "ping"]) {
            const message = JsonRpcMessage.make({ id: 2, method, params: withRequestMetadata({}, metadata) });
            const exchange = yield* http.post(message, routingHeaders(message));
            assertErrorCode(exchange, McpSchema.METHOD_NOT_FOUND_ERROR_CODE, { label: method });
          }
        })
      );

      it.effect("rejects a POST missing request metadata with 400", () =>
        Effect.gen(function* () {
          const http = yield* ConformanceHttp;
          const metadata = yield* defaultRequestMetadata;
          const withoutMeta = JsonRpcMessage.make({ id: 3, method: "tools/list", params: {} });
          const missingCapabilities = JsonRpcMessage.make({
            id: 4,
            method: "tools/list",
            params: {
              _meta: {
                [PROTOCOL_VERSION_META_KEY]: MCP_PROTOCOL_VERSION,
                [CLIENT_INFO_META_KEY]: metadata[CLIENT_INFO_META_KEY],
              },
            },
          });
          const missingVersion = JsonRpcMessage.make({
            id: 5,
            method: "tools/list",
            params: { _meta: { [CLIENT_CAPABILITIES_META_KEY]: {} } },
          });
          for (const message of [withoutMeta, missingCapabilities, missingVersion]) {
            const exchange = yield* http.post(message, routingHeaders(message));
            assert.strictEqual(exchange.status, 400, String(message.id));
            assert.deepStrictEqual(
              O.map(errorOf(exchange), (error) => error.code),
              O.some(McpSchema.INVALID_PARAMS_ERROR_CODE),
              String(message.id)
            );
          }
        })
      );

      it.effect("rejects an unsupported protocol version with -32022 and the supported list", () =>
        Effect.gen(function* () {
          const http = yield* ConformanceHttp;
          const metadata = yield* defaultRequestMetadata;
          const message = JsonRpcMessage.make({
            id: 6,
            method: "tools/list",
            params: withRequestMetadata({}, { ...metadata, [PROTOCOL_VERSION_META_KEY]: "2025-11-25" }),
          });
          const exchange = yield* http.post(message, {
            ...routingHeaders(message),
            [MCP_PROTOCOL_VERSION_HEADER]: "2025-11-25",
          });
          assert.strictEqual(exchange.status, 400);
          const error = errorOf(exchange);
          assert.deepStrictEqual(
            O.map(error, (value) => value.code),
            O.some(UNSUPPORTED_PROTOCOL_VERSION_ERROR_CODE)
          );
          const supported = O.flatMap(error, (value) =>
            P.hasProperty(value.data, "supported") && A.isArray(value.data.supported)
              ? O.some(value.data.supported)
              : O.none()
          );
          assert.deepStrictEqual(supported, O.some([MCP_PROTOCOL_VERSION]));
        })
      );

      it.effect("rejects a method header that does not match the request", () =>
        Effect.gen(function* () {
          const http = yield* ConformanceHttp;
          const metadata = yield* defaultRequestMetadata;
          const message = JsonRpcMessage.make({
            id: 7,
            method: "tools/list",
            params: withRequestMetadata({}, metadata),
          });
          const exchange = yield* http.post(message, {
            ...routingHeaders(JsonRpcMessage.make({ id: 7, method: "prompts/list", params: message.params })),
          });
          assertErrorCode(exchange, McpSchema.HEADER_MISMATCH_ERROR_CODE, { status: 400 });
        })
      );

      if (host.prompt !== undefined) {
        const prompt = host.prompt;
        it.effect("advertises prompt titles and serves prompts/get", () =>
          Effect.gen(function* () {
            const { rpc } = yield* connectHttp();
            const listed = yield* rpc["prompts/list"]({});
            const entry = A.findFirst(listed.prompts, (candidate) => candidate.name === prompt.name);
            assert.deepStrictEqual(
              O.map(entry, (candidate) => candidate.title),
              O.some(prompt.title)
            );
            const served = yield* rpc["prompts/get"]({ name: prompt.name, arguments: prompt.arguments ?? {} });
            assert.isAtLeast(served.messages.length, 1);
          })
        );
      }
    });

    describe("over newline-delimited stdio", () => {
      it.effect("sends server/discover then tools/call over stdio", () =>
        withStdioHost(host)((io) =>
          Effect.gen(function* () {
            const { discovery, rpc } = yield* connectStdio(io);
            assert.include(discovery.supportedVersions, MCP_PROTOCOL_VERSION);
            const result = yield* rpc["tools/call"]({ name: host.tool.name, arguments: host.tool.arguments });
            assert.notStrictEqual(result.isError, true);
          })
        )
      );

      it.effect("answers a legacy initialize with -32022 over stdio", () =>
        withStdioHost(host)((io) =>
          Effect.gen(function* () {
            yield* io.sendMessage(legacyInitialize(1));
            const response = yield* io.nextMessage;
            assert.strictEqual(response.id, 1);
            assert.strictEqual(response.error?.code, UNSUPPORTED_PROTOCOL_VERSION_ERROR_CODE);
          })
        )
      );

      it.effect("reconstructs a request whose bytes arrive in separate chunks", () =>
        withStdioHost(host)((io) =>
          Effect.gen(function* () {
            const frame = yield* encodeLineOrDie(
              JsonRpcMessage.make({
                id: 8,
                method: "server/discover",
                params: withRequestMetadata({}, io.metadata),
              })
            );
            const line = `${frame}\n`;
            const bytes = encoder.encode(line);
            const split = Math.floor(bytes.length / 2);
            yield* io.sendChunk(bytes.slice(0, split));
            yield* io.sendChunk(bytes.slice(split));
            const response = yield* io.nextMessage;
            assert.strictEqual(response.id, 8);
            assert.isDefined(response.result);
          })
        )
      );

      it.effect("emits one compact JSON-RPC message per line and processes requests independently", () =>
        withStdioHost(host)((io) =>
          Effect.gen(function* () {
            yield* io.sendMessage(
              JsonRpcMessage.make({ id: 9, method: "tools/list", params: withRequestMetadata({}, io.metadata) })
            );
            const first = yield* io.nextLine;
            assert.strictEqual((yield* decodeLineOrDie(first)).id, 9);
            assert.isFalse(first.includes("\n"));
            yield* io.sendMessage(
              JsonRpcMessage.make({
                id: 10,
                method: "tools/call",
                params: withRequestMetadata({ name: host.tool.name, arguments: host.tool.arguments }, io.metadata),
              })
            );
            const second = yield* io.nextMessage;
            assert.strictEqual(second.id, 10);
            assert.isDefined(second.result);
          })
        )
      );

      it.effect("shuts down when the client closes stdin", () =>
        withStdioHost(host)((io) =>
          Effect.gen(function* () {
            yield* io.close;
            const exit = yield* io.serverExit;
            assert.isTrue(Exit.isSuccess(exit) || (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)));
          })
        )
      );
    });
  });
};
