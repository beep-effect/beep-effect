/**
 * Schema-first AI agent configuration schemas, source metadata, drift checks,
 * and validated transforms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Current package version.
 *
 * **Example** (Compare VERSION constant)
 *
 * ```ts
 * import { VERSION } from "@beep/ai-sync"
 *
 * console.log(VERSION === "0.0.0")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Drift-check helpers.
 *
 * **Example** (Check generated artifacts)
 *
 * ```ts
 * import * as NodeServices from "@effect/platform-node/NodeServices"
 * import { Effect } from "effect"
 * import { checkGeneratedArtifacts } from "@beep/ai-sync"
 *
 * const program = checkGeneratedArtifacts().pipe(
 *   Effect.map((report) => report.mode),
 *   Effect.provide(NodeServices.layer)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./drift.ts";
/**
 * Public data models for source metadata, support status, drift reports, and
 * transform evidence.
 *
 * **Example** (Access agent ID enum)
 *
 * ```ts
 * import { AiSyncAgentId } from "@beep/ai-sync"
 * console.log(AiSyncAgentId.Enum.codex)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./models.ts";
/**
 * Native agent configuration schemas.
 *
 * **Example** (Create Codex MCP config)
 *
 * ```ts
 * import { CodexConfig } from "@beep/ai-sync"
 *
 * const config = CodexConfig.make({
 *   mcp_servers: { local: { command: "node" } }
 * })
 * console.log(config.mcp_servers?.local?.command)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./schemas.ts";
/**
 * Source-map constants and V1 support matrix.
 *
 * **Example** (Inspect schema coverage)
 *
 * ```ts
 * import { V1_SCHEMA_COVERAGE } from "@beep/ai-sync"
 * console.log(V1_SCHEMA_COVERAGE.length)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * from "./source-map.ts";
/**
 * Cross-agent transforms whose semantics are proven for V1.
 *
 * **Example** (Convert Codex MCP servers)
 *
 * ```ts
 * import { CodexConfig, codexMcpServersToClaudeMcpJson } from "@beep/ai-sync"
 *
 * const config = CodexConfig.make({
 *   mcp_servers: { local: { command: "node" } }
 * })
 * const mcpJson = codexMcpServersToClaudeMcpJson(config)
 * console.log(mcpJson.mcpServers.local?.command)
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export * from "./transforms.ts";
/**
 * Repo-local validation helpers.
 *
 * **Example** (Validate repository config)
 *
 * ```ts
 * import * as NodeServices from "@effect/platform-node/NodeServices"
 * import { Effect } from "effect"
 * import { validateRepoConfig } from "@beep/ai-sync"
 *
 * const program = validateRepoConfig({
 *   repoRoot: "/workspace/repo",
 *   config: ".codex/config.toml"
 * }).pipe(
 *   Effect.map((result) => result.schemaId),
 *   Effect.provide(NodeServices.layer)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export * from "./validation.ts";
