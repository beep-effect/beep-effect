/**
 * Schema-backed Claude Code MCP server transports.
 *
 * **Details**
 *
 * The decoded domain uses `Option` for absent wire keys while preserving
 * Claude Code's current transport shapes on the encoded side.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("claudecode/Mcp/Schema");

/**
 * OAuth metadata for current remote MCP transports.
 *
 * **Example** (Create mcp oauth)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const oauth = Mcp.McpOAuth.make({})
 * console.log(oauth.clientId._tag) // "None"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class McpOAuth extends S.Class<McpOAuth>($I`McpOAuth`)(
  {
    clientId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    callbackPort: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    authServerMetadataUrl: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    scopes: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("McpOAuth", {
    description: "OAuth client metadata for a remote MCP transport.",
  })
) {}

/**
 * Companion types for {@link McpOAuth}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace McpOAuth {
  /**
   * Runtime type represented by {@link McpOAuth}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = McpOAuth;

  /**
   * JSON representation accepted by {@link McpOAuth}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof McpOAuth.Encoded;
}

/**
 * Stdio MCP server configuration.
 *
 * **Example** (Create stdio mcp server)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const server = Mcp.StdioMcpServer.make({ command: "bunx" })
 * console.log(server.command) // "bunx"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class StdioMcpServer extends S.Class<StdioMcpServer>($I`StdioMcpServer`)(
  {
    type: S.OptionFromOptionalKey(S.Literal("stdio")).pipe(SchemaUtils.withNoneDefault),
    command: S.String,
    args: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    env: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(SchemaUtils.withNoneDefault),
    timeout: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    alwaysLoad: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("StdioMcpServer", {
    description: "Local child-process MCP transport.",
  })
) {}

/**
 * Companion types for {@link StdioMcpServer}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StdioMcpServer {
  /**
   * Runtime type represented by {@link StdioMcpServer}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = StdioMcpServer;

  /**
   * JSON representation accepted by {@link StdioMcpServer}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof StdioMcpServer.Encoded;
}

/**
 * Accepted HTTP transport discriminator.
 *
 * **Example** (Inspect http mcp transport)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * console.log(Mcp.HttpMcpTransport.is["streamable-http"]("streamable-http")) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const HttpMcpTransport = LiteralKit(["http", "streamable-http"]).pipe(
  $I.annoteSchema("HttpMcpTransport", {
    description: "Current HTTP MCP transport names accepted by Claude Code.",
  })
);

/**
 * Runtime type for {@link HttpMcpTransport}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HttpMcpTransport = typeof HttpMcpTransport.Type;

const remoteFields = {
  url: S.String,
  headers: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(SchemaUtils.withNoneDefault),
  headersHelper: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  timeout: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
  alwaysLoad: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
};

/**
 * Streamable HTTP MCP server configuration.
 *
 * **Example** (Create http mcp server)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const server = Mcp.HttpMcpServer.make({ type: "http", url: "https://example.test/mcp" })
 * console.log(server.type) // "http"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class HttpMcpServer extends S.Class<HttpMcpServer>($I`HttpMcpServer`)(
  {
    type: HttpMcpTransport,
    ...remoteFields,
    oauth: S.OptionFromOptionalKey(McpOAuth).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("HttpMcpServer", {
    description: "Remote streamable-HTTP MCP transport.",
  })
) {}

/**
 * Companion types for {@link HttpMcpServer}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HttpMcpServer {
  /**
   * Runtime type represented by {@link HttpMcpServer}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HttpMcpServer;

  /**
   * JSON representation accepted by {@link HttpMcpServer}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HttpMcpServer.Encoded;
}

/**
 * WebSocket MCP server configuration.
 *
 * **Example** (Create ws mcp server)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const server = Mcp.WsMcpServer.make({ type: "ws", url: "wss://example.test/mcp" })
 * console.log(server.type) // "ws"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class WsMcpServer extends S.Class<WsMcpServer>($I`WsMcpServer`)(
  {
    type: S.tag("ws"),
    ...remoteFields,
  },
  $I.annote("WsMcpServer", {
    description: "Remote WebSocket MCP transport.",
  })
) {}

/**
 * Companion types for {@link WsMcpServer}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WsMcpServer {
  /**
   * Runtime type represented by {@link WsMcpServer}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = WsMcpServer;

  /**
   * JSON representation accepted by {@link WsMcpServer}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WsMcpServer.Encoded;
}

/**
 * MCP server configuration accepted by Claude Code.
 *
 * **Example** (Inspect mcp server config)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Mcp } from "effect-claudecode"
 *
 * console.log(S.is(Mcp.McpServerConfig)({ command: "bunx" }))
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const McpServerConfig = S.Union([StdioMcpServer, HttpMcpServer, WsMcpServer]).pipe(
  $I.annoteSchema("McpServerConfig", {
    description: "Supported local and remote Claude Code MCP transports.",
  })
);

/**
 * Runtime type for {@link McpServerConfig}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type McpServerConfig = typeof McpServerConfig.Type;
