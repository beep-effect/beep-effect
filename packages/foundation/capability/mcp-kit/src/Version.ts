/**
 * Kit pins: the `@beep/mcp-kit` package version, the stateless MCP protocol
 * revision the kit targets, and the two protocol lists a kit host chooses from.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as McpProtocol from "effect/ai/McpProtocol";
import type * as Arr from "effect/Array";

/**
 * Current `@beep/mcp-kit` package version.
 *
 * **Example** (Log package version)
 *
 * ```ts
 * import { VERSION } from "@beep/mcp-kit/Version"
 *
 * console.log(VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * The MCP protocol revision the kit targets: the stateless `2026-07-28`
 * revision (`server/discover`, no `initialize`, no session id).
 *
 * **Example** (Read the protocol pin)
 *
 * ```ts
 * import { MCP_PROTOCOL_VERSION } from "@beep/mcp-kit/Version"
 *
 * console.log(MCP_PROTOCOL_VERSION)
 * // "2026-07-28"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MCP_PROTOCOL_VERSION = McpProtocol.v2026_07_28.protocolVersion;

/**
 * Protocol list for a kit host only stateless clients reach: the stateless
 * `2026-07-28` adapter alone.
 *
 * **Details**
 *
 * Hosts pass this to `McpServer.layerStdio` / `McpServer.layerHttp` instead
 * of spelling the adapter list themselves, so no host carries its own
 * literal and no host mixes a session-era adapter into the list by accident.
 *
 * **Gotchas**
 *
 * A host on this list answers a classic `initialize` with `-32022` and never
 * starts under a handshake client such as Claude Desktop. A host such a
 * client launches passes {@link handshakeMcpProtocols} instead.
 *
 * **Example** (Pin a stdio host)
 *
 * ```ts
 * import { statelessMcpProtocols } from "@beep/mcp-kit/Version"
 * import * as McpServer from "effect/ai/McpServer"
 *
 * const layer = McpServer.layerStdio({ name: "example", version: "0.0.0", protocols: statelessMcpProtocols })
 * console.log(statelessMcpProtocols.length)
 * // 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const statelessMcpProtocols: Arr.NonEmptyReadonlyArray<McpProtocol.ProtocolAdapter> = [McpProtocol.v2026_07_28];

/**
 * Protocol list for a kit host a handshake client launches: the stateless
 * `2026-07-28` adapter first, then every handshake-era adapter.
 *
 * **Details**
 *
 * Use this for any host that Claude Desktop, or another client that opens
 * with a classic `initialize` request, starts. The stateless adapter comes
 * first, so it stays the default for clients that send no handshake:
 * `server/discover` and metadata-carrying tool calls work exactly as they do
 * under {@link statelessMcpProtocols}, which stays the list for hosts only
 * stateless clients reach.
 *
 * **Gotchas**
 *
 * Claude Desktop opens every server with `initialize` (it offered
 * `2025-11-25` on 2026-10-06). A host that lists only the stateless adapter
 * answers "initialize is not supported by the configured MCP protocols" and
 * never starts. Do not narrow a host from this list to the stateless one
 * without proving the result against a real Claude Desktop install.
 *
 * **Example** (Pin a stdio host that Claude Desktop launches)
 *
 * ```ts
 * import { handshakeMcpProtocols } from "@beep/mcp-kit/Version"
 * import * as McpServer from "effect/ai/McpServer"
 *
 * const layer = McpServer.layerStdio({ name: "example", version: "0.0.0", protocols: handshakeMcpProtocols })
 * console.log(handshakeMcpProtocols.map((protocol) => protocol.protocolVersion))
 * // ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const handshakeMcpProtocols: Arr.NonEmptyReadonlyArray<McpProtocol.ProtocolAdapter> = [
  McpProtocol.v2026_07_28,
  McpProtocol.v2025_11_25,
  McpProtocol.v2025_06_18,
  McpProtocol.v2025_03_26,
  McpProtocol.v2024_11_05,
];
