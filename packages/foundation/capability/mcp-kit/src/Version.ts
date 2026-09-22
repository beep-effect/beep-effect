/**
 * Kit pins: the `@beep/mcp-kit` package version and the one MCP protocol
 * revision every host built on the kit serves.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as McpProtocol from "effect/unstable/ai/McpProtocol";
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
 * Protocol list for a kit host: the stateless `2026-07-28` adapter alone.
 *
 * **Details**
 *
 * Hosts pass this to `McpServer.layerStdio` / `McpServer.layerHttp` instead
 * of spelling the adapter list themselves, so no host carries its own
 * literal and no host mixes a session-era adapter into the list.
 *
 * **Example** (Pin a stdio host)
 *
 * ```ts
 * import { statelessMcpProtocols } from "@beep/mcp-kit/Version"
 * import * as McpServer from "effect/unstable/ai/McpServer"
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
