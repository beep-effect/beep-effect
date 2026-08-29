/**
 * V1 source map and support matrix for AI sync.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as O from "@beep/utils/Option";
import {
  AiSyncSchemaCell,
  AiSyncSourceId,
  AiSyncSourceMetadata,
  AiSyncSourceUrl,
  AiSyncTransformEvidence,
  AiSyncVersionPin,
} from "./models.ts";

const makeSourceId = (value: string) => AiSyncSourceId.make(value);
const makeSourceUrl = (value: string) => AiSyncSourceUrl.make(value);
const someSourceId = (value: string) => O.some(makeSourceId(value));
const someVersionPin = (value: string) => O.some(AiSyncVersionPin.make(value));

/**
 * Tier-1 sources fetched by the generator and strict drift checker.
 *
 * **Example** (Log tier-one sources length)
 *
 * ```ts
 * import { TIER_ONE_SOURCES } from "@beep/ai-sync"
 * console.log(TIER_ONE_SOURCES.length)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TIER_ONE_SOURCES = [
  AiSyncSourceMetadata.make({
    id: makeSourceId("codex-config"),
    agent: "codex",
    domain: "config",
    tier: "tier_1",
    url: makeSourceUrl("https://raw.githubusercontent.com/openai/codex/rust-v0.133.0/codex-rs/core/config.schema.json"),
    versionPin: someVersionPin("rust-v0.133.0"),
    isOfficial: true,
    driftMechanism: "version_and_hash",
  }),
  AiSyncSourceMetadata.make({
    id: makeSourceId("codex-hooks"),
    agent: "codex",
    domain: "hooks",
    tier: "tier_1",
    url: makeSourceUrl(
      "https://raw.githubusercontent.com/openai/codex/rust-v0.133.0/codex-rs/hooks/schema/generated/session-start.command.input.schema.json"
    ),
    versionPin: someVersionPin("rust-v0.133.0"),
    isOfficial: true,
    driftMechanism: "version_and_hash",
  }),
  AiSyncSourceMetadata.make({
    id: makeSourceId("mcp-schema"),
    agent: "mcp",
    domain: "protocol",
    tier: "tier_1",
    url: makeSourceUrl(
      "https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/2025-11-25/schema.json"
    ),
    versionPin: someVersionPin("2025-11-25"),
    isOfficial: true,
    driftMechanism: "version_and_hash",
  }),
  AiSyncSourceMetadata.make({
    id: makeSourceId("acp-schema"),
    agent: "acp",
    domain: "protocol",
    tier: "tier_1",
    url: makeSourceUrl(
      "https://raw.githubusercontent.com/agentclientprotocol/agent-client-protocol/v0.13.3/schema/schema.json"
    ),
    versionPin: someVersionPin("v0.13.3"),
    isOfficial: true,
    driftMechanism: "version_and_hash",
  }),
  AiSyncSourceMetadata.make({
    id: makeSourceId("claude-code-settings"),
    agent: "claude-code",
    domain: "settings",
    tier: "tier_1",
    url: makeSourceUrl("https://json.schemastore.org/claude-code-settings.json"),
    isOfficial: false,
    driftMechanism: "hash",
  }),
  AiSyncSourceMetadata.make({
    id: makeSourceId("claude-code-plugin-manifest"),
    agent: "claude-code",
    domain: "plugin-manifest",
    tier: "tier_1",
    url: makeSourceUrl("https://json.schemastore.org/claude-code-plugin-manifest.json"),
    isOfficial: false,
    driftMechanism: "hash",
  }),
  AiSyncSourceMetadata.make({
    id: makeSourceId("claude-code-marketplace"),
    agent: "claude-code",
    domain: "marketplace",
    tier: "tier_1",
    url: makeSourceUrl("https://json.schemastore.org/claude-code-marketplace.json"),
    isOfficial: false,
    driftMechanism: "hash",
  }),
  AiSyncSourceMetadata.make({
    id: makeSourceId("rulesync-config"),
    agent: "rulesync",
    domain: "unified-config",
    tier: "tier_1",
    url: makeSourceUrl("https://github.com/dyoshikawa/rulesync/releases/latest/download/config-schema.json"),
    isOfficial: false,
    driftMechanism: "hash",
  }),
  AiSyncSourceMetadata.make({
    id: makeSourceId("rulesync-mcp"),
    agent: "rulesync",
    domain: "mcp-servers",
    tier: "tier_1",
    url: makeSourceUrl("https://github.com/dyoshikawa/rulesync/releases/latest/download/mcp-schema.json"),
    isOfficial: false,
    driftMechanism: "hash",
  }),
] as const;

/**
 * Complete V1 schema support matrix.
 *
 * **Example** (Detect unknown schema cells)
 *
 * ```ts
 * import { V1_SCHEMA_COVERAGE } from "@beep/ai-sync"
 * console.log(V1_SCHEMA_COVERAGE.some((cell) => cell.status === "unknown_schema"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const V1_SCHEMA_COVERAGE = [
  AiSyncSchemaCell.make({
    agent: "claude-code",
    domain: "skills",
    status: "supported",
    rationale: "Official skills docs and Agent Skills frontmatter define the portable file shape.",
  }),
  AiSyncSchemaCell.make({
    agent: "claude-code",
    domain: "rules",
    status: "supported",
    rationale: "Memory and instruction docs define markdown instruction surfaces.",
  }),
  AiSyncSchemaCell.make({
    agent: "claude-code",
    domain: "commands",
    status: "supported",
    rationale: "Command docs and public command frontmatter references cover the metadata shape.",
  }),
  AiSyncSchemaCell.make({
    agent: "claude-code",
    domain: "hooks",
    status: "supported",
    sourceId: someSourceId("claude-code-settings"),
    rationale: "Settings SchemaStore mirror covers hook placement; docs explain event semantics.",
  }),
  AiSyncSchemaCell.make({
    agent: "claude-code",
    domain: "plugins",
    status: "supported",
    sourceId: someSourceId("claude-code-plugin-manifest"),
    rationale: "SchemaStore plugin manifest and marketplace schemas are pinned by content hash.",
  }),
  AiSyncSchemaCell.make({
    agent: "claude-code",
    domain: "mcp-servers",
    status: "supported",
    rationale: "Claude-style .mcp.json shape is modeled directly.",
  }),
  AiSyncSchemaCell.make({
    agent: "codex",
    domain: "skills",
    status: "supported",
    sourceId: someSourceId("codex-config"),
    rationale: "Codex config schema and skills docs cover repo skill settings.",
  }),
  AiSyncSchemaCell.make({
    agent: "codex",
    domain: "rules",
    status: "supported",
    rationale: "AGENTS.md is markdown and has no required fields.",
  }),
  AiSyncSchemaCell.make({
    agent: "codex",
    domain: "commands",
    status: "na",
    rationale: "Codex has built-in slash commands but no V1 repo-committed command-file surface.",
  }),
  AiSyncSchemaCell.make({
    agent: "codex",
    domain: "hooks",
    status: "supported",
    sourceId: someSourceId("codex-hooks"),
    rationale: "Codex publishes generated hook schemas at the pinned release.",
  }),
  AiSyncSchemaCell.make({
    agent: "codex",
    domain: "plugins",
    status: "supported",
    sourceId: someSourceId("codex-config"),
    rationale: "Codex plugin configuration is represented through the config schema and docs.",
  }),
  AiSyncSchemaCell.make({
    agent: "codex",
    domain: "mcp-servers",
    status: "supported",
    sourceId: someSourceId("codex-config"),
    rationale: "Codex TOML mcp_servers entries are modeled and transformable to Claude-style JSON.",
  }),
  AiSyncSchemaCell.make({
    agent: "grok-build",
    domain: "skills",
    status: "supported",
    rationale: "Official Grok Build docs document skills and Claude-compatible skill packages.",
  }),
  AiSyncSchemaCell.make({
    agent: "grok-build",
    domain: "rules",
    status: "supported",
    rationale: "Grok Build documents AGENTS.md compatibility.",
  }),
  AiSyncSchemaCell.make({
    agent: "grok-build",
    domain: "commands",
    status: "supported",
    rationale: "Official modes and commands docs document the command concept.",
  }),
  AiSyncSchemaCell.make({
    agent: "grok-build",
    domain: "hooks",
    status: "unknown_schema",
    rationale: "Docs confirm hooks, but native event payload schemas are not public.",
  }),
  AiSyncSchemaCell.make({
    agent: "grok-build",
    domain: "plugins",
    status: "unknown_schema",
    rationale: "Docs confirm plugins, but the native manifest schema is not public.",
  }),
  AiSyncSchemaCell.make({
    agent: "grok-build",
    domain: "mcp-servers",
    status: "unknown_schema",
    rationale: "Claude-compatible MCP is documented; Grok-native MCP shape remains undocumented.",
  }),
  AiSyncSchemaCell.make({
    agent: "jetbrains-ai-assistant",
    domain: "skills",
    status: "na",
    rationale: "No documented repo-committed AI Assistant skill package concept.",
  }),
  AiSyncSchemaCell.make({
    agent: "jetbrains-ai-assistant",
    domain: "rules",
    status: "supported",
    rationale: "Project rules are committed markdown under .aiassistant/rules/*.md.",
  }),
  AiSyncSchemaCell.make({
    agent: "jetbrains-ai-assistant",
    domain: "commands",
    status: "supported",
    rationale: "Prompt-library command metadata is documented but IDE-centered.",
  }),
  AiSyncSchemaCell.make({
    agent: "jetbrains-ai-assistant",
    domain: "hooks",
    status: "na",
    rationale: "No documented AI Assistant hook system.",
  }),
  AiSyncSchemaCell.make({
    agent: "jetbrains-ai-assistant",
    domain: "plugins",
    status: "na",
    rationale: "IDE plugin extension is not a repo-committed agent plugin manifest surface for V1.",
  }),
  AiSyncSchemaCell.make({
    agent: "jetbrains-ai-assistant",
    domain: "mcp-servers",
    status: "supported",
    rationale: "IDE MCP JSON examples define a user-operable configuration shape.",
  }),
  AiSyncSchemaCell.make({
    agent: "junie",
    domain: "skills",
    status: "supported",
    rationale: "Junie Agent Skills docs define the skill shape.",
  }),
  AiSyncSchemaCell.make({
    agent: "junie",
    domain: "rules",
    status: "supported",
    rationale: "Junie guidelines and AGENTS docs define markdown instructions.",
  }),
  AiSyncSchemaCell.make({
    agent: "junie",
    domain: "commands",
    status: "supported",
    rationale: "Junie custom slash command docs define command metadata.",
  }),
  AiSyncSchemaCell.make({
    agent: "junie",
    domain: "hooks",
    status: "na",
    rationale: "No documented Junie hook system for V1.",
  }),
  AiSyncSchemaCell.make({
    agent: "junie",
    domain: "plugins",
    status: "na",
    rationale: "Junie itself is a plugin; V1 has no repo-committed Junie plugin manifest surface.",
  }),
  AiSyncSchemaCell.make({
    agent: "junie",
    domain: "mcp-servers",
    status: "supported",
    rationale: "Junie MCP docs define project MCP JSON configuration.",
  }),
] as const;

/**
 * P4 transform evidence ledger.
 *
 * **Example** (List transform evidence statuses)
 *
 * ```ts
 * import { V1_TRANSFORM_EVIDENCE } from "@beep/ai-sync"
 * console.log(V1_TRANSFORM_EVIDENCE.map((entry) => entry.status))
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export const V1_TRANSFORM_EVIDENCE = [
  AiSyncTransformEvidence.make({
    id: "codex-mcp-to-claude-mcp",
    status: "lossless",
    sourceAgent: "codex",
    targetAgent: "claude-code",
    domain: "mcp-servers",
    rationale: "Both shapes preserve command, args, env, url, headers, and timeout metadata.",
  }),
  AiSyncTransformEvidence.make({
    id: "claude-mcp-to-codex-mcp",
    status: "lossy",
    sourceAgent: "claude-code",
    targetAgent: "codex",
    domain: "mcp-servers",
    rationale:
      "Codex-compatible fields are preserved, but Claude transport type metadata is inferred rather than stored.",
  }),
  AiSyncTransformEvidence.make({
    id: "claude-mcp-to-junie-mcp",
    status: "lossless",
    sourceAgent: "claude-code",
    targetAgent: "junie",
    domain: "mcp-servers",
    rationale: "The modeled Junie project MCP JSON accepts the same server map shape.",
  }),
  AiSyncTransformEvidence.make({
    id: "junie-mcp-to-claude-mcp",
    status: "lossless",
    sourceAgent: "junie",
    targetAgent: "claude-code",
    domain: "mcp-servers",
    rationale: "The modeled V1 Junie project MCP JSON and Claude-style MCP JSON use the same server map shape.",
  }),
  AiSyncTransformEvidence.make({
    id: "agents-md-rules",
    status: "lossy",
    sourceAgent: "codex",
    targetAgent: "grok-build",
    domain: "rules",
    rationale: "Markdown instruction text is portable, but agent-specific lookup and precedence are not round-tripped.",
  }),
  AiSyncTransformEvidence.make({
    id: "skill-frontmatter",
    status: "lossy",
    sourceAgent: "claude-code",
    targetAgent: "junie",
    domain: "skills",
    rationale:
      "Common name and description fields round-trip; agent-specific resources and activation semantics remain native.",
  }),
  AiSyncTransformEvidence.make({
    id: "unknown-grok-native-mcp",
    status: "declined",
    sourceAgent: "grok-build",
    targetAgent: "codex",
    domain: "mcp-servers",
    rationale: "Grok-native MCP is unknown_schema, so V1 refuses transforms.",
  }),
] as const;
