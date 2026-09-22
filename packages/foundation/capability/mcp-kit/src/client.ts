/**
 * `@beep/mcp-kit/client`, the kit-owned MCP `2026-07-28` client:
 * rc.117 exposes no public typed client group for the stateless revision
 * (its `server/discover` group is `@internal`), so the kit re-declares the
 * request RPCs an in-repo proof needs and owns the wire details the revision
 * adds on top of JSON-RPC: the `_meta` request keys
 * (`io.modelcontextprotocol/protocolVersion`, `.../clientCapabilities`,
 * `.../clientInfo`), the HTTP routing headers (`MCP-Protocol-Version`,
 * `Mcp-Method`, `Mcp-Name`), the `text/event-stream` unwrap, and the
 * newline-delimited JSON framing stdio hosts speak. Two `RpcClient.Protocol`
 * layers ({@link layerProtocolHttp}, {@link layerProtocolNdjson}) inject all
 * of that, so a caller drives `RpcClient.make(McpClientRpcs)` with plain
 * payloads; {@link connect} sends `server/discover` first, which is the
 * stateless replacement for `initialize`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $McpKitId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { Deferred, Effect, Layer, Stream } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as McpSchema from "effect/unstable/ai/McpSchema";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { Rpc, RpcClient, RpcGroup } from "effect/unstable/rpc";
import { MCP_PROTOCOL_VERSION, VERSION } from "./Version.ts";
import type * as Scope from "effect/Scope";
import type { HttpClientError } from "effect/unstable/http/HttpClientError";
import type * as RpcClientError from "effect/unstable/rpc/RpcClientError";
import type * as RpcMessage from "effect/unstable/rpc/RpcMessage";
import type * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";

const $I = $McpKitId.create("client");

/**
 * HTTP header carrying the protocol revision of a stateless request.
 *
 * **Example** (Name the version header)
 *
 * ```ts
 * import { MCP_PROTOCOL_VERSION_HEADER } from "@beep/mcp-kit/client"
 *
 * console.log(MCP_PROTOCOL_VERSION_HEADER)
 * // "MCP-Protocol-Version"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MCP_PROTOCOL_VERSION_HEADER = "MCP-Protocol-Version";

/**
 * HTTP header mirroring the JSON-RPC method of a stateless request.
 *
 * **Example** (Name the method header)
 *
 * ```ts
 * import { MCP_METHOD_HEADER } from "@beep/mcp-kit/client"
 *
 * console.log(MCP_METHOD_HEADER)
 * // "Mcp-Method"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MCP_METHOD_HEADER = "Mcp-Method";

/**
 * HTTP header mirroring the routing name of a stateless request: `params.name`
 * for `tools/call` and `prompts/get`, `params.uri` for `resources/read`.
 *
 * **Example** (Name the routing-name header)
 *
 * ```ts
 * import { MCP_NAME_HEADER } from "@beep/mcp-kit/client"
 *
 * console.log(MCP_NAME_HEADER)
 * // "Mcp-Name"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MCP_NAME_HEADER = "Mcp-Name";

/**
 * Request `_meta` key carrying the protocol revision (must equal the header).
 *
 * **Example** (Read the version claim from request metadata)
 *
 * ```ts
 * import { PROTOCOL_VERSION_META_KEY } from "@beep/mcp-kit/client"
 *
 * const meta = { [PROTOCOL_VERSION_META_KEY]: "2026-07-28" }
 * console.log(meta[PROTOCOL_VERSION_META_KEY])
 * // "2026-07-28"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";

/**
 * Request `_meta` key carrying the client capabilities object.
 *
 * **Example** (Name the capabilities key)
 *
 * ```ts
 * import { CLIENT_CAPABILITIES_META_KEY } from "@beep/mcp-kit/client"
 *
 * console.log(CLIENT_CAPABILITIES_META_KEY)
 * // "io.modelcontextprotocol/clientCapabilities"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CLIENT_CAPABILITIES_META_KEY = "io.modelcontextprotocol/clientCapabilities";

/**
 * Request `_meta` key carrying the client implementation info.
 *
 * **Example** (Name the client-info key)
 *
 * ```ts
 * import { CLIENT_INFO_META_KEY } from "@beep/mcp-kit/client"
 *
 * console.log(CLIENT_INFO_META_KEY)
 * // "io.modelcontextprotocol/clientInfo"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";

/**
 * JSON-RPC error code a host answers when the claimed protocol revision is
 * not one it serves (`data.supported` lists the revisions it does). rc.117
 * keeps the constant private; the stdio path also answers it to a legacy
 * `initialize`.
 *
 * **Example** (Recognize the unsupported-version code)
 *
 * ```ts
 * import { UNSUPPORTED_PROTOCOL_VERSION_ERROR_CODE } from "@beep/mcp-kit/client"
 *
 * console.log(UNSUPPORTED_PROTOCOL_VERSION_ERROR_CODE === -32022)
 * // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const UNSUPPORTED_PROTOCOL_VERSION_ERROR_CODE = -32022;

/**
 * Result `_meta` key under which a stateless server reports its implementation info.
 *
 * **Example** (Read server info from a result)
 *
 * ```ts
 * import { SERVER_INFO_META_KEY } from "@beep/mcp-kit/client"
 *
 * const meta = { [SERVER_INFO_META_KEY]: { name: "host", version: "1.0.0" } }
 * console.log(meta[SERVER_INFO_META_KEY].name)
 * // "host"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SERVER_INFO_META_KEY = "io.modelcontextprotocol/serverInfo";

type JsonObject = Readonly<Record<string, unknown>>;

const isJsonObject = (value: unknown): value is JsonObject => P.isObject(value) && !A.isArray(value);

type ImplementationInput = (typeof McpSchema.Implementation)["~type.make.in"];
type ClientCapabilitiesInput = (typeof McpSchema.ClientCapabilities)["~type.make.in"];

const defaultClientInfo: ImplementationInput = { name: "@beep/mcp-kit/client", version: VERSION };

/**
 * Identity a kit client presents on every request: protocol revision,
 * implementation info and capabilities. Every field has a default, so
 * `McpClientOptions.make({})` is a complete client.
 *
 * **Example** (Default client options)
 *
 * ```ts
 * import { McpClientOptions } from "@beep/mcp-kit/client"
 *
 * const options = McpClientOptions.make({})
 * console.log(options.protocolVersion)
 * // "2026-07-28"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpClientOptions extends S.Class<McpClientOptions>($I`McpClientOptions`)(
  {
    protocolVersion: S.String.pipe(
      SchemaUtils.withConstantDefault<string>(MCP_PROTOCOL_VERSION),
      S.annotateKey({ description: "Protocol revision claimed in the header and request metadata." })
    ),
    clientInfo: McpSchema.Implementation.pipe(
      SchemaUtils.withConstantDefault<ImplementationInput>(defaultClientInfo),
      S.annotateKey({ description: "Client implementation info sent in request metadata." })
    ),
    clientCapabilities: McpSchema.ClientCapabilities.pipe(
      SchemaUtils.withConstantDefault<ClientCapabilitiesInput>({}),
      S.annotateKey({ description: "Client capabilities sent in request metadata." })
    ),
  },
  $I.annote("McpClientOptions", {
    description: "Identity a kit MCP client presents on every stateless request.",
  })
) {}

/**
 * JSON-RPC error object as it appears on the wire.
 *
 * **Example** (Decode an error object)
 *
 * ```ts
 * import { JsonRpcError } from "@beep/mcp-kit/client"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownSync(JsonRpcError)({ code: -32601, message: "Method not found" })
 * console.log(error.code)
 * // -32601
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsonRpcError extends S.Class<JsonRpcError>($I`JsonRpcError`)(
  {
    code: S.Int,
    message: S.String,
    data: S.optionalKey(S.Unknown),
  },
  $I.annote("JsonRpcError", { description: "JSON-RPC error object." })
) {}

/**
 * JSON-RPC request id.
 *
 * **Example** (Decode a request id)
 *
 * ```ts
 * import { JsonRpcId } from "@beep/mcp-kit/client"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(JsonRpcId)(7))
 * // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JsonRpcId = S.Union([S.String, S.Finite]).pipe(
  $I.annoteSchema("JsonRpcId", { description: "JSON-RPC request id: a string or a finite number." })
);

/**
 * JSON-RPC request id value.
 *
 * @category models
 * @since 0.0.0
 */
export type JsonRpcId = typeof JsonRpcId.Type;

/**
 * One JSON-RPC message (request, notification, result or error response).
 * `jsonrpc` defaults to `"2.0"`, so `JsonRpcMessage.make({ id, method, params })`
 * frames a request and `make({ method })` a notification.
 *
 * **Example** (Frame a request)
 *
 * ```ts
 * import { JsonRpcMessage } from "@beep/mcp-kit/client"
 *
 * const message = JsonRpcMessage.make({ id: 1, method: "server/discover", params: {} })
 * console.log(message.jsonrpc)
 * // "2.0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsonRpcMessage extends S.Class<JsonRpcMessage>($I`JsonRpcMessage`)(
  {
    jsonrpc: S.Literal("2.0").pipe(SchemaUtils.withConstantDefault<"2.0">("2.0")),
    id: JsonRpcId.pipe(S.NullOr, S.optionalKey),
    method: S.optionalKey(S.String),
    params: S.optionalKey(S.Unknown),
    result: S.optionalKey(S.Unknown),
    error: S.optionalKey(JsonRpcError),
  },
  $I.annote("JsonRpcMessage", { description: "One JSON-RPC 2.0 message." })
) {}

/**
 * Codec between one JSON-RPC message and its compact wire line.
 *
 * **Example** (Encode a request line)
 *
 * ```ts
 * import { JsonRpcMessage, JsonRpcMessageFromLine } from "@beep/mcp-kit/client"
 * import * as S from "effect/Schema"
 *
 * const line = S.encodeSync(JsonRpcMessageFromLine)(JsonRpcMessage.make({ method: "ping" }))
 * console.log(line)
 * // {"jsonrpc":"2.0","method":"ping"}
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JsonRpcMessageFromLine = S.fromJsonString(JsonRpcMessage);

/**
 * `server/discover` result: the stateless replacement for `initialize`.
 *
 * **Example** (Read the advertised revisions)
 *
 * ```ts
 * import { McpDiscoverResult } from "@beep/mcp-kit/client"
 *
 * const result = McpDiscoverResult.make({ supportedVersions: ["2026-07-28"], capabilities: {} })
 * console.log(result.supportedVersions)
 * // ["2026-07-28"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpDiscoverResult extends S.Class<McpDiscoverResult>($I`McpDiscoverResult`)(
  {
    supportedVersions: S.Array(S.String),
    capabilities: McpSchema.ServerCapabilities,
    instructions: S.optionalKey(S.String),
    _meta: S.optionalKey(S.Record(S.String, S.Unknown)),
  },
  $I.annote("McpDiscoverResult", { description: "Result of the stateless server/discover request." })
) {
  /**
   * Server implementation info, when the server reported it under
   * {@link SERVER_INFO_META_KEY}.
   */
  get serverInfo(): O.Option<McpSchema.Implementation> {
    return O.filter(O.fromNullishOr(this._meta?.[SERVER_INFO_META_KEY]), isImplementation);
  }
}

const McpErrorSchema = McpSchema.McpError;
const isImplementation = S.is(McpSchema.Implementation);

/**
 * `server/discover` request.
 *
 * **Example** (Read the request tag)
 *
 * ```ts
 * import { ServerDiscover } from "@beep/mcp-kit/client"
 *
 * console.log(ServerDiscover._tag)
 * // "server/discover"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ServerDiscover extends Rpc.make("server/discover", {
  success: McpDiscoverResult,
  error: McpErrorSchema,
}) {}

/**
 * `tools/list` request.
 *
 * **Example** (Read the request tag)
 *
 * ```ts
 * import { ToolsList } from "@beep/mcp-kit/client"
 *
 * console.log(ToolsList._tag)
 * // "tools/list"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ToolsList extends Rpc.make("tools/list", {
  payload: { cursor: S.optionalKey(S.String) },
  success: McpSchema.ListToolsResult,
  error: McpErrorSchema,
}) {}

/**
 * `tools/call` request.
 *
 * **Example** (Read the request tag)
 *
 * ```ts
 * import { ToolsCall } from "@beep/mcp-kit/client"
 *
 * console.log(ToolsCall._tag)
 * // "tools/call"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ToolsCall extends Rpc.make("tools/call", {
  payload: { name: S.String, arguments: S.optionalKey(S.Record(S.String, S.Unknown)) },
  success: McpSchema.CallToolResult,
  error: McpErrorSchema,
}) {}

/**
 * `prompts/list` request.
 *
 * **Example** (Read the request tag)
 *
 * ```ts
 * import { PromptsList } from "@beep/mcp-kit/client"
 *
 * console.log(PromptsList._tag)
 * // "prompts/list"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PromptsList extends Rpc.make("prompts/list", {
  payload: { cursor: S.optionalKey(S.String) },
  success: McpSchema.ListPromptsResult,
  error: McpErrorSchema,
}) {}

/**
 * `prompts/get` request.
 *
 * **Example** (Read the request tag)
 *
 * ```ts
 * import { PromptsGet } from "@beep/mcp-kit/client"
 *
 * console.log(PromptsGet._tag)
 * // "prompts/get"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PromptsGet extends Rpc.make("prompts/get", {
  payload: { name: S.String, arguments: S.optionalKey(S.Record(S.String, S.String)) },
  success: McpSchema.GetPromptResult,
  error: McpErrorSchema,
}) {}

/**
 * `resources/read` request.
 *
 * **Example** (Read the request tag)
 *
 * ```ts
 * import { ResourcesRead } from "@beep/mcp-kit/client"
 *
 * console.log(ResourcesRead._tag)
 * // "resources/read"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ResourcesRead extends Rpc.make("resources/read", {
  payload: { uri: S.String },
  success: McpSchema.ReadResourceResult,
  error: McpErrorSchema,
}) {}

/**
 * The kit-owned `2026-07-28` client request group: discover, list and call
 * tools, list and get prompts, read resources. Drive it with
 * `RpcClient.make(McpClientRpcs)` under one of the protocol layers below.
 *
 * **Example** (Build a client)
 *
 * ```ts
 * import { McpClientRpcs } from "@beep/mcp-kit/client"
 * import { RpcClient } from "effect/unstable/rpc"
 *
 * const client = RpcClient.make(McpClientRpcs)
 * console.log(typeof client)
 * // "object"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class McpClientRpcs extends RpcGroup.make(
  ServerDiscover,
  ToolsList,
  ToolsCall,
  PromptsList,
  PromptsGet,
  ResourcesRead
) {}

const encodeClientCapabilities = S.encodeSync(McpSchema.ClientCapabilities);
const encodeImplementation = S.encodeSync(McpSchema.Implementation);

/**
 * The `_meta` object a request must carry for `options`.
 *
 * **Example** (Build request metadata)
 *
 * ```ts
 * import { McpClientOptions, requestMetadata } from "@beep/mcp-kit/client"
 *
 * const metadata = requestMetadata(McpClientOptions.make({}))
 * console.log(metadata["io.modelcontextprotocol/protocolVersion"])
 * // "2026-07-28"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const requestMetadata = (options: McpClientOptions): JsonObject => ({
  [PROTOCOL_VERSION_META_KEY]: options.protocolVersion,
  [CLIENT_CAPABILITIES_META_KEY]: encodeClientCapabilities(options.clientCapabilities),
  [CLIENT_INFO_META_KEY]: encodeImplementation(options.clientInfo),
});

/**
 * Merges request metadata under `params._meta`; keys the caller already set
 * win, so a test can deliberately override or drop one.
 *
 * **Example** (Attach metadata to call parameters)
 *
 * ```ts
 * import { withRequestMetadata } from "@beep/mcp-kit/client"
 *
 * const params = withRequestMetadata({ name: "echo" }, { "io.modelcontextprotocol/protocolVersion": "2026-07-28" })
 * console.log(Object.keys(params))
 * // ["name", "_meta"]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const withRequestMetadata: {
  (metadata: JsonObject): (params: unknown) => JsonObject;
  (params: unknown, metadata: JsonObject): JsonObject;
} = dual(2, (params: unknown, metadata: JsonObject): JsonObject => {
  const base = isJsonObject(params) ? params : {};
  const existing = isJsonObject(base._meta) ? base._meta : {};
  return { ...base, _meta: { ...metadata, ...existing } };
});

/**
 * The routing name a stateless request mirrors into `Mcp-Name`: `params.name`
 * for `tools/call` and `prompts/get`, `params.uri` for `resources/read`,
 * `None` for every other method.
 *
 * **Example** (Routing name of a tool call)
 *
 * ```ts
 * import { JsonRpcMessage, routingName } from "@beep/mcp-kit/client"
 *
 * console.log(routingName(JsonRpcMessage.make({ id: 1, method: "tools/call", params: { name: "echo" } })))
 * // { _id: "Option", _tag: "Some", value: "echo" }
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const routingName = (message: JsonRpcMessage): O.Option<string> => {
  const key =
    message.method === "tools/call" || message.method === "prompts/get"
      ? "name"
      : message.method === "resources/read"
        ? "uri"
        : undefined;
  return key === undefined || !isJsonObject(message.params)
    ? O.none()
    : O.filter(O.fromNullishOr(message.params[key]), P.isString);
};

const claimedProtocolVersion = (message: JsonRpcMessage): string =>
  O.getOrElse(
    isJsonObject(message.params) && isJsonObject(message.params._meta)
      ? O.filter(O.fromNullishOr(message.params._meta[PROTOCOL_VERSION_META_KEY]), P.isString)
      : O.none<string>(),
    () => MCP_PROTOCOL_VERSION
  );

/**
 * The HTTP headers a stateless request carries besides content negotiation:
 * the protocol version (taken from the frame's `_meta` claim so header and
 * metadata always agree), the method mirror, and the routing name when the
 * method has one.
 *
 * **Example** (Headers for a tool call)
 *
 * ```ts
 * import { JsonRpcMessage, routingHeaders } from "@beep/mcp-kit/client"
 *
 * console.log(routingHeaders(JsonRpcMessage.make({ id: 1, method: "tools/call", params: { name: "echo" } })))
 * // { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call", "Mcp-Name": "echo" }
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const routingHeaders = (message: JsonRpcMessage): Readonly<Record<string, string>> => ({
  [MCP_PROTOCOL_VERSION_HEADER]: claimedProtocolVersion(message),
  ...(message.method === undefined ? {} : { [MCP_METHOD_HEADER]: message.method }),
  ...O.match(routingName(message), {
    onNone: () => ({}),
    onSome: (name) => ({ [MCP_NAME_HEADER]: name }),
  }),
});

/**
 * Splits a `text/event-stream` body into its `data:` payloads. Events are
 * delimited by a blank line and may spread one payload over several `data:`
 * fields, which join with a newline; CRLF and CR endings are normalised and
 * at most one leading space is dropped from each field.
 *
 * **Example** (Parse two events)
 *
 * ```ts
 * import { parseServerSentEvents } from "@beep/mcp-kit/client"
 *
 * console.log(parseServerSentEvents("data: {\"a\":1}\n\ndata: {\"b\":2}\n\n"))
 * // ["{\"a\":1}", "{\"b\":2}"]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const parseServerSentEvents = (text: string): ReadonlyArray<string> =>
  A.filter(
    A.map(Str.split("\n\n")(Str.replaceAll(/\r\n?/g, "\n")(text)), (event) =>
      A.join(
        A.map(A.filter(Str.split("\n")(event), Str.startsWith("data:")), (line) =>
          Str.replace(/^ /, "")(Str.slice(5)(line))
        ),
        "\n"
      )
    ),
    Str.isNonEmpty
  );

const decodeJsonRpcMessages = S.decodeUnknownEffect(S.Array(JsonRpcMessage));
const decodeJsonText: (text: string) => Effect.Effect<unknown, S.SchemaError> = S.decodeEffect(UnknownFromJsonString);
const decodeMessageLine = S.decodeEffect(JsonRpcMessageFromLine);
const encodeMessageLine = S.encodeSync(JsonRpcMessageFromLine);
const encodeJsonRpcError = S.encodeSync(JsonRpcError);

/**
 * Decodes the JSON-RPC messages of an HTTP body: a JSON object or array, or
 * the `data:` payloads of an event stream. An empty body (a `202` for a
 * notification) decodes to no messages.
 *
 * **Example** (Decode a JSON body)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeHttpMessages } from "@beep/mcp-kit/client"
 *
 * const messages = Effect.runSync(decodeHttpMessages("{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}", "application/json"))
 * console.log(messages.length)
 * // 1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const decodeHttpMessages: {
  (contentType: string): (body: string) => Effect.Effect<ReadonlyArray<JsonRpcMessage>, S.SchemaError>;
  (body: string, contentType: string): Effect.Effect<ReadonlyArray<JsonRpcMessage>, S.SchemaError>;
} = dual(
  2,
  (body: string, contentType: string): Effect.Effect<ReadonlyArray<JsonRpcMessage>, S.SchemaError> =>
    Str.isEmpty(Str.trim(body))
      ? Effect.succeed([])
      : Effect.flatMap(
          Str.startsWith("text/event-stream")(contentType)
            ? Effect.forEach(parseServerSentEvents(body), decodeJsonText)
            : Effect.map(decodeJsonText(body), (parsed) => (A.isArray(parsed) ? parsed : [parsed])),
          decodeJsonRpcMessages
        )
);

/**
 * One HTTP exchange with a stateless host: the status and every JSON-RPC
 * message the body carried (after the event-stream unwrap).
 *
 * **Example** (Build an exchange record)
 *
 * ```ts
 * import { McpHttpExchange } from "@beep/mcp-kit/client"
 *
 * const exchange = McpHttpExchange.make({ status: 202, messages: [] })
 * console.log(exchange.messages.length)
 * // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpHttpExchange extends S.Class<McpHttpExchange>($I`McpHttpExchange`)(
  {
    status: S.Int,
    messages: S.Array(JsonRpcMessage),
  },
  $I.annote("McpHttpExchange", { description: "Status and decoded messages of one MCP HTTP exchange." })
) {}

/**
 * POSTs one JSON-RPC frame to `url` with the given extra headers, accepting
 * both `application/json` and `text/event-stream`, and decodes whatever the
 * host answered regardless of status. This is the raw primitive the
 * conformance runner and the `_meta` guard tests drive; the RPC protocol
 * layer builds on it.
 *
 * **Example** (Post a hand-built frame)
 *
 * ```ts
 * import { JsonRpcMessage, postJsonRpc, routingHeaders } from "@beep/mcp-kit/client"
 * import * as Effect from "effect/Effect"
 * import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
 *
 * const frame = JsonRpcMessage.make({ id: 1, method: "server/discover", params: {} })
 * const program = Effect.gen(function* () {
 *   const exchange = yield* postJsonRpc("http://localhost/mcp", frame, routingHeaders(frame))
 *   return { status: exchange.status, messages: exchange.messages.length }
 * }).pipe(Effect.provide(FetchHttpClient.layer))
 * console.log(typeof program)
 * // "object"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const postJsonRpc = Effect.fn("McpKit.client.postJsonRpc")(function* (
  url: string,
  body: unknown,
  headers: Readonly<Record<string, string>>
) {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client.execute(
    HttpClientRequest.post(url).pipe(
      HttpClientRequest.setHeaders({
        ...headers,
        // Content negotiation is not caller-tunable: the streamable HTTP
        // transport answers 406 unless the client accepts both media types
        // (any response may upgrade to an SSE stream) and 415 without JSON.
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      }),
      HttpClientRequest.bodyJsonUnsafe(body)
    )
  );
  const text = yield* response.text;
  const messages = yield* decodeHttpMessages(text, response.headers["content-type"] ?? "").pipe(Effect.orDie);
  return McpHttpExchange.make({ status: response.status, messages });
});

const requestKey = (id: string | number): string => `${typeof id}:${id}`;

const isResponse = (message: JsonRpcMessage): message is JsonRpcMessage & { readonly id: string | number } =>
  message.method === undefined && (P.isString(message.id) || P.isNumber(message.id));

const responseExit = (
  requestId: string | number,
  response: O.Option<JsonRpcMessage>,
  missing: string
): RpcMessage.ResponseExitEncoded => ({
  _tag: "Exit",
  requestId,
  exit: O.match(response, {
    onNone: () => ({ _tag: "Failure", cause: [{ _tag: "Die", defect: missing }] }),
    onSome: (message) =>
      message.error === undefined
        ? { _tag: "Success", value: message.result }
        : { _tag: "Failure", cause: [{ _tag: "Fail", error: encodeJsonRpcError(message.error) }] },
  }),
});

const codecFor = S.toCodecJson as RpcSerialization.CodecFor;

/**
 * Options of {@link layerProtocolHttp}: the endpoint URL, the client identity
 * (defaults to `McpClientOptions.make({})`), and extra headers sent on every
 * POST (for example `origin` or `authorization`).
 *
 * **Example** (Options for a local endpoint)
 *
 * ```ts
 * import { McpHttpProtocolOptions } from "@beep/mcp-kit/client"
 *
 * const options = McpHttpProtocolOptions.make({ url: "http://localhost/mcp" })
 * console.log(options.url)
 * // "http://localhost/mcp"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpHttpProtocolOptions extends S.Class<McpHttpProtocolOptions>($I`McpHttpProtocolOptions`)(
  {
    url: S.String.annotateKey({ description: "Streamable HTTP endpoint the requests are posted to." }),
    client: S.optionalKey(McpClientOptions).annotateKey({
      description: "Identity presented on every request; defaults to McpClientOptions.make({}).",
    }),
    headers: S.optionalKey(S.Record(S.String, S.String)).annotateKey({
      description: "Extra headers on every POST, for example origin or authorization.",
    }),
  },
  $I.annote("McpHttpProtocolOptions", { description: "Options of the streamable HTTP client protocol layer." })
) {}

/**
 * `RpcClient.Protocol` over streamable HTTP for a stateless host: every
 * request is one POST carrying the `_meta` keys and routing headers, and the
 * response body (JSON or event stream) is decoded to the request's exit.
 *
 * **Example** (HTTP client layer)
 *
 * ```ts
 * import { layerProtocolHttp, McpHttpProtocolOptions } from "@beep/mcp-kit/client"
 * import * as Layer from "effect/Layer"
 *
 * const protocol = layerProtocolHttp(McpHttpProtocolOptions.make({ url: "http://localhost/mcp" }))
 * console.log(Layer.isLayer(protocol))
 * // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerProtocolHttp = (
  options: McpHttpProtocolOptions
): Layer.Layer<RpcClient.Protocol, never, HttpClient.HttpClient> =>
  Layer.effect(RpcClient.Protocol)(
    Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient;
      const metadata = requestMetadata(options.client ?? McpClientOptions.make({}));
      const post = (message: JsonRpcMessage) =>
        // Routing mirrors always describe the frame being sent: caller headers
        // (origin, authorization) go first so they can never shadow them.
        postJsonRpc(options.url, message, { ...options.headers, ...routingHeaders(message) }).pipe(
          Effect.provideService(HttpClient.HttpClient, httpClient)
        );
      return yield* RpcClient.Protocol.make((writeResponse) =>
        Effect.succeed({
          send: (clientId, message) =>
            Match.value(message).pipe(
              Match.tag("Request", (request) =>
                post(
                  JsonRpcMessage.make({
                    id: request.id,
                    method: request.tag,
                    params: withRequestMetadata(request.payload, metadata),
                  })
                ).pipe(
                  Effect.flatMap((exchange) =>
                    writeResponse(
                      clientId,
                      responseExit(
                        request.id,
                        A.findFirst(
                          exchange.messages,
                          (candidate) => isResponse(candidate) && candidate.id === request.id
                        ),
                        `MCP HTTP ${exchange.status}: no response for request ${String(request.id)}`
                      )
                    )
                  ),
                  Effect.orDie
                )
              ),
              Match.tag("Interrupt", (interrupt) =>
                post(
                  JsonRpcMessage.make({
                    method: "notifications/cancelled",
                    params: withRequestMetadata({ requestId: interrupt.requestId }, metadata),
                  })
                ).pipe(Effect.ignore)
              ),
              Match.orElse(() => Effect.void)
            ),
          supportsAck: false,
          supportsTransferables: false,
          codecFor,
        })
      );
    })
  );

/**
 * Newline-delimited JSON transport: one JSON-RPC message per line in each
 * direction, which is what a stdio host speaks.
 *
 * **Example** (Describe an in-memory transport)
 *
 * ```ts
 * import type { McpNdjsonTransport } from "@beep/mcp-kit/client"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 *
 * const transport: McpNdjsonTransport = { write: () => Effect.void, lines: Stream.empty }
 * console.log(typeof transport.write)
 * // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface McpNdjsonTransport {
  /**
   * Identity presented on every request; defaults to `McpClientOptions.make({})`.
   */
  readonly client?: McpClientOptions | undefined;
  /**
   * Lines the host emits, already split and without newlines.
   */
  readonly lines: Stream.Stream<string>;
  /**
   * Writes one line (without its trailing newline) toward the host.
   */
  readonly write: (line: string) => Effect.Effect<void>;
}

/**
 * Splits a byte stream into UTF-8 lines, the inverse of the host's compact
 * one-message-per-line framing; bytes of one message may arrive in several
 * chunks.
 *
 * **Example** (Split chunked bytes)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 * import { decodeLines } from "@beep/mcp-kit/client"
 *
 * const encoder = new TextEncoder()
 * const lines = decodeLines(Stream.make(encoder.encode("{\"a\":"), encoder.encode("1}\n")))
 * console.log(Effect.runSync(Stream.runCollect(lines)))
 * // ["{\"a\":1}"]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const decodeLines = <E, R>(bytes: Stream.Stream<Uint8Array, E, R>): Stream.Stream<string, E, R> =>
  bytes.pipe(Stream.decodeText(), Stream.splitLines);

/**
 * `RpcClient.Protocol` over newline-delimited JSON: each request is written
 * as one line carrying the `_meta` keys, and responses are matched back by
 * id from the host's lines. Server notifications on the stream are dropped.
 *
 * **Example** (NDJSON client layer over queues)
 *
 * ```ts
 * import { layerProtocolNdjson } from "@beep/mcp-kit/client"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const protocol = layerProtocolNdjson({ write: () => Effect.void, lines: Stream.empty })
 * console.log(Layer.isLayer(protocol))
 * // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerProtocolNdjson = (transport: McpNdjsonTransport): Layer.Layer<RpcClient.Protocol> =>
  Layer.effect(RpcClient.Protocol)(
    Effect.gen(function* () {
      const metadata = requestMetadata(transport.client ?? McpClientOptions.make({}));
      const pending = MutableHashMap.empty<string, Deferred.Deferred<JsonRpcMessage>>();
      const route = Effect.fnUntraced(function* (line: string) {
        if (Str.isEmpty(Str.trim(line))) {
          return;
        }
        const message = yield* Effect.option(decodeMessageLine(line));
        if (O.isNone(message) || !isResponse(message.value)) {
          return;
        }
        const key = requestKey(message.value.id);
        const waiter = MutableHashMap.get(pending, key);
        if (O.isSome(waiter)) {
          MutableHashMap.remove(pending, key);
          yield* Deferred.succeed(waiter.value, message.value);
        }
      });
      yield* transport.lines.pipe(Stream.runForEach(route), Effect.forkScoped);
      const writeMessage = (message: JsonRpcMessage) => transport.write(encodeMessageLine(message));
      return yield* RpcClient.Protocol.make((writeResponse) =>
        Effect.succeed({
          send: (clientId, message) =>
            Match.value(message).pipe(
              Match.tag("Request", (request) => {
                const key = requestKey(request.id);
                return Effect.gen(function* () {
                  const waiter = yield* Deferred.make<JsonRpcMessage>();
                  MutableHashMap.set(pending, key, waiter);
                  yield* writeMessage(
                    JsonRpcMessage.make({
                      id: request.id,
                      method: request.tag,
                      params: withRequestMetadata(request.payload, metadata),
                    })
                  );
                  const response = yield* Deferred.await(waiter);
                  yield* writeResponse(clientId, responseExit(request.id, O.some(response), ""));
                }).pipe(
                  // The waiter never outlives its send: a late response, an
                  // interrupt, or a transport failure all release the entry.
                  Effect.ensuring(Effect.sync(() => MutableHashMap.remove(pending, key)))
                );
              }),
              Match.tag("Interrupt", (interrupt) => {
                // Release the waiter first so the interrupted call settles even
                // if the host never acknowledges the cancellation.
                const key = requestKey(interrupt.requestId);
                const waiter = MutableHashMap.get(pending, key);
                MutableHashMap.remove(pending, key);
                return Effect.andThen(
                  O.match(waiter, { onNone: () => Effect.void, onSome: Deferred.interrupt }),
                  writeMessage(
                    JsonRpcMessage.make({
                      method: "notifications/cancelled",
                      params: withRequestMetadata({ requestId: interrupt.requestId }, metadata),
                    })
                  )
                );
              }),
              Match.orElse(() => Effect.void)
            ),
          supportsAck: false,
          supportsTransferables: false,
          codecFor,
        })
      );
    })
  );

/**
 * Typed request client over {@link McpClientRpcs}.
 *
 * **Example** (Type a connection's client)
 *
 * ```ts
 * import type { McpRpcClient } from "@beep/mcp-kit/client"
 *
 * const describe = (client: McpRpcClient) => typeof client["tools/call"]
 * console.log(typeof describe)
 * // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type McpRpcClient = RpcClient.RpcClient<RpcGroup.Rpcs<typeof McpClientRpcs>, RpcClientError.RpcClientError>;

/**
 * A connected kit client: the typed RPC client plus the `server/discover`
 * result that opened the conversation.
 *
 * **Example** (Type a connection)
 *
 * ```ts
 * import type { McpClientConnection } from "@beep/mcp-kit/client"
 *
 * const versions = (connection: McpClientConnection) => connection.discovery.supportedVersions
 * console.log(typeof versions)
 * // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface McpClientConnection {
  /**
   * What the host advertised in reply to `server/discover`.
   */
  readonly discovery: McpDiscoverResult;
  /**
   * Typed request client over {@link McpClientRpcs}.
   */
  readonly rpc: McpRpcClient;
}

/**
 * Builds the typed client under the ambient `RpcClient.Protocol` and sends
 * `server/discover` first — the stateless revision's opening message, in
 * place of `initialize`.
 *
 * **Gotchas**
 *
 * The returned `rpc` client is only as alive as the `RpcClient.Protocol` it
 * was built under. Keep the protocol layer's scope open for as long as you
 * hold the connection (`Layer.build` in a scope you control), as below.
 *
 * **Example** (Connect over HTTP and call a tool)
 *
 * ```ts
 * import { connect, layerProtocolHttp, McpHttpProtocolOptions } from "@beep/mcp-kit/client"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
 *
 * // The protocol layer is built into the ambient scope, never `Effect.provide`d
 * // around `connect` alone: the layer owns the response router, so a scope
 * // that closes with `connect` would drop every later call's response.
 * const program = Effect.scoped(
 *   Effect.gen(function* () {
 *     const protocol = yield* Layer.build(
 *       layerProtocolHttp(McpHttpProtocolOptions.make({ url: "http://localhost/mcp" })).pipe(
 *         Layer.provide(FetchHttpClient.layer)
 *       )
 *     )
 *     const { discovery, rpc } = yield* connect.pipe(Effect.provideContext(protocol))
 *     const result = yield* rpc["tools/call"]({ name: "echo", arguments: { text: "hi" } })
 *     return { versions: discovery.supportedVersions, isError: result.isError }
 *   })
 * )
 * console.log(typeof program)
 * // "object"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const connect: Effect.Effect<
  McpClientConnection,
  McpSchema.McpError | RpcClientError.RpcClientError,
  RpcClient.Protocol | Scope.Scope
> = Effect.gen(function* () {
  const rpc = yield* RpcClient.make(McpClientRpcs);
  const discovery = yield* rpc["server/discover"]();
  return { rpc, discovery };
});

/**
 * Error type of the HTTP primitive, re-exported for callers that map it.
 *
 * **Example** (Type an HTTP failure handler)
 *
 * ```ts
 * import type { McpHttpError } from "@beep/mcp-kit/client"
 *
 * const describe = (error: McpHttpError) => error._tag
 * console.log(typeof describe)
 * // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type McpHttpError = HttpClientError;
