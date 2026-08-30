/**
 * MCP module hub — schemas and loader for `.mcp.json` files.
 *
 * **Details**
 *
 * Users import this as a namespace:
 * `import { Mcp } from 'effect-claudecode'` and access members as
 * `Mcp.McpServerConfig`, `Mcp.McpJsonFile`, `Mcp.loadJson`, etc.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// ---------------------------------------------------------------------------
// Server schemas
// ---------------------------------------------------------------------------

/**
 * Re-exports the supported MCP transport schemas.
 *
 * @category protocols
 * @since 0.0.0
 */
export {
  HttpMcpServer,
  HttpMcpTransport,
  McpOAuth,
  McpServerConfig,
  StdioMcpServer,
  WsMcpServer,
} from "./Mcp/Schema.ts";

// ---------------------------------------------------------------------------
// .mcp.json file schema + loader
// ---------------------------------------------------------------------------

/**
 * Re-exports MCP configuration loader options.
 *
 * @category configuration
 * @since 0.0.0
 */
/**
 * Re-exports MCP file schemas, paths, composition, serialization, and loaders.
 *
 * @category decoding
 * @since 0.0.0
 */
export {
  ClaudeJsonFile,
  ClaudeJsonProject,
  EffectiveMcpLoadOptions,
  loadClaudeJson,
  loadEffective,
  loadJson,
  loadManagedMcp,
  ManagedMcpLoadOptions,
  McpJsonFile,
  managedMcpJsonPaths,
  mergeMcpJsonFiles,
  projectMcpJsonPath,
  toClaudeCodeJson,
  userClaudeJsonPath,
} from "./Mcp/JsonFile.ts";
