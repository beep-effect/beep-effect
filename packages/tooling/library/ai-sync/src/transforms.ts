/**
 * V1 cross-agent transforms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as O from "@beep/utils/Option";
import { pipe } from "effect";
import * as R from "effect/Record";
import {
  AgentInstructionDocument,
  AgentSkillFrontmatter,
  ClaudeMcpJson,
  CodexConfig,
  CodexMcpServer,
  McpJsonServer,
} from "./schemas.ts";

const codexServerToMcpJsonServer = (server: {
  readonly command?: string | undefined;
  readonly args?: ReadonlyArray<string> | undefined;
  readonly env?: Readonly<Record<string, string>> | undefined;
  readonly url?: string | undefined;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly timeout_ms?: number | undefined;
}): McpJsonServer =>
  McpJsonServer.make({
    type: server.url === undefined ? "stdio" : "http",
    ...O.getSomesStruct({
      command: O.fromUndefinedOr(server.command),
      args: O.fromUndefinedOr(server.args),
      env: O.fromUndefinedOr(server.env),
      url: O.fromUndefinedOr(server.url),
      headers: O.fromUndefinedOr(server.headers),
      timeout_ms: O.fromUndefinedOr(server.timeout_ms),
    }),
  });

const mcpJsonServerToCodexServer = (server: McpJsonServer): CodexMcpServer =>
  CodexMcpServer.make(
    O.getSomesStruct({
      command: O.fromUndefinedOr(server.command),
      args: O.fromUndefinedOr(server.args),
      env: O.fromUndefinedOr(server.env),
      url: O.fromUndefinedOr(server.url),
      headers: O.fromUndefinedOr(server.headers),
      timeout_ms: O.fromUndefinedOr(server.timeout_ms),
    })
  );

/**
 * Transform Codex TOML MCP server config into Claude-style `.mcp.json`.
 *
 * @param config - Codex configuration containing optional MCP servers.
 * @returns Claude-style MCP JSON preserving Codex-compatible server fields.
 * @example
 * ```ts
 * import { CodexConfig, codexMcpServersToClaudeMcpJson } from "@beep/ai-sync"
 * const config = CodexConfig.make({
 *   mcp_servers: { local: { command: "node", args: ["server.js"] } }
 * })
 * console.log(codexMcpServersToClaudeMcpJson(config).mcpServers.local.command)
 * ```
 * @category interop
 * @since 0.0.0
 */
export const codexMcpServersToClaudeMcpJson = (config: CodexConfig): ClaudeMcpJson =>
  ClaudeMcpJson.make({
    mcpServers: pipe(config.mcp_servers ?? {}, R.map(codexServerToMcpJsonServer)),
  });

/**
 * Transform Claude-style `.mcp.json` into the Codex TOML MCP server block.
 *
 * @param config - Claude-style MCP JSON server map.
 * @returns Codex configuration containing the compatible MCP server block.
 * @example
 * ```ts
 * import { ClaudeMcpJson, claudeMcpJsonToCodexConfig } from "@beep/ai-sync"
 * const config = ClaudeMcpJson.make({ mcpServers: {} })
 * console.log(claudeMcpJsonToCodexConfig(config).mcp_servers)
 * ```
 * @category interop
 * @since 0.0.0
 */
export const claudeMcpJsonToCodexConfig = (config: ClaudeMcpJson): CodexConfig =>
  CodexConfig.make({
    mcp_servers: pipe(config.mcpServers, R.map(mcpJsonServerToCodexServer)),
  });

/**
 * Transform Claude-style `.mcp.json` into the modeled Junie project MCP shape.
 *
 * @param config - Claude-style MCP JSON server map.
 * @returns Modeled Junie MCP JSON using the same V1 server map shape.
 * @example
 * ```ts
 * import { ClaudeMcpJson, claudeMcpJsonToJunieMcpJson } from "@beep/ai-sync"
 * const config = ClaudeMcpJson.make({ mcpServers: {} })
 * console.log(claudeMcpJsonToJunieMcpJson(config).mcpServers)
 * ```
 * @category interop
 * @since 0.0.0
 */
export const claudeMcpJsonToJunieMcpJson = (config: ClaudeMcpJson): ClaudeMcpJson => config;

/**
 * Transform the modeled Junie project MCP shape into Claude-style `.mcp.json`.
 *
 * @param config - Modeled Junie MCP JSON server map.
 * @returns Claude-style MCP JSON using the same V1 server map shape.
 * @example
 * ```ts
 * import { ClaudeMcpJson, junieMcpJsonToClaudeMcpJson } from "@beep/ai-sync"
 * const config = ClaudeMcpJson.make({ mcpServers: {} })
 * console.log(junieMcpJsonToClaudeMcpJson(config).mcpServers)
 * ```
 * @category interop
 * @since 0.0.0
 */
export const junieMcpJsonToClaudeMcpJson = (config: ClaudeMcpJson): ClaudeMcpJson => config;

/**
 * Normalize markdown instruction documents for compatible rule surfaces.
 *
 * @param content - Markdown instruction document content.
 * @returns Normalized markdown with trailing whitespace removed.
 * @example
 * ```ts
 * import { normalizeInstructionDocument } from "@beep/ai-sync"
 * console.log(normalizeInstructionDocument("# Rules"))
 * ```
 * @category normalization
 * @since 0.0.0
 */
export const normalizeInstructionDocument = AgentInstructionDocument.normalize;

/**
 * Keep only the shared Agent Skills frontmatter fields modeled in V1.
 *
 * @param frontmatter - Skill frontmatter from a compatible Agent Skills file.
 * @returns Frontmatter limited to the V1 shared fields.
 * @example
 * ```ts
 * import { AgentSkillFrontmatter, normalizeAgentSkillFrontmatter } from "@beep/ai-sync"
 * const skill = AgentSkillFrontmatter.make({ name: "review", description: "Review code" })
 * console.log(normalizeAgentSkillFrontmatter(skill).name)
 * ```
 * @category normalization
 * @since 0.0.0
 */
export const normalizeAgentSkillFrontmatter = AgentSkillFrontmatter.normalize;
