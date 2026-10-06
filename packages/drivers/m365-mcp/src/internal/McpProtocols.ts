/**
 * MCP protocol versions both Microsoft 365 hosts answer.
 *
 * @internal
 * @since 0.1.0
 */
import * as McpProtocol from "effect/ai/McpProtocol";
import type * as Arr from "effect/Array";

/**
 * The stateless `2026-07-28` protocol first, then the handshake-era versions
 * Claude Code and Claude Desktop open with (`initialize`).
 *
 * @internal
 */
export const m365McpProtocols: Arr.NonEmptyReadonlyArray<McpProtocol.ProtocolAdapter> = [
  McpProtocol.v2026_07_28,
  McpProtocol.v2025_11_25,
  McpProtocol.v2025_06_18,
  McpProtocol.v2025_03_26,
  McpProtocol.v2024_11_05,
];
