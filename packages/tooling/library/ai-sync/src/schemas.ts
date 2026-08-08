/**
 * Native AI agent configuration schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AiSyncId } from "@beep/identity/packages";
import { SchemaUtils, UnknownRecord } from "@beep/schema";
import { flow, identity, SchemaTransformation } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  ClaudeMcpJson,
  ClaudeSettings,
  CodexConfig,
  CodexMcpServer,
  CodexSkillEntry,
  CodexSkills,
  McpJsonServer,
} from "./_generated/schemas.gen.ts";
import { AiSyncAgentId, AiSyncDomainId } from "./models.ts";

const $I = $AiSyncId.create("schemas");

const normalizeInstructionText = flow(Str.split("\n"), A.map(Str.trimEnd), A.join("\n"), Str.trim);

/**
 * Agent instruction markdown document.
 *
 * **Example** (Decode agent instruction document)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AgentInstructionDocument } from "@beep/ai-sync"
 *
 * const document = S.decodeUnknownSync(AgentInstructionDocument)("# Rules")
 * console.log(document.startsWith("#"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AgentInstructionDocument = S.NonEmptyString.pipe(
  $I.annoteSchema("AgentInstructionDocument", {
    description: "Non-empty markdown instructions read by agents such as Codex, Claude Code, Grok Build, and Junie.",
  }),
  SchemaUtils.withStatics((schema) => ({
    decodeEffect: S.decodeUnknownEffect(schema),
    is: S.is(schema),
    normalize: normalizeInstructionText,
  }))
);

/**
 * Runtime type for {@link AgentInstructionDocument}.
 *
 * **Example** (Annotate instruction document type)
 *
 * ```ts
 * import type { AgentInstructionDocument } from "@beep/ai-sync"
 * const document: AgentInstructionDocument = "# Instructions"
 * console.log(document)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type AgentInstructionDocument = typeof AgentInstructionDocument.Type;

/**
 * Normalized agent instruction markdown document.
 *
 * **Example** (Decode normalized document with Effect)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { NormalizedAgentInstructionDocument } from "@beep/ai-sync"
 *
 * const program = NormalizedAgentInstructionDocument.decodeEffect("# Rules  ")
 * Effect.runPromise(program).then((document) => console.log(document))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NormalizedAgentInstructionDocument = S.String.pipe(
  S.decodeTo(
    AgentInstructionDocument,
    SchemaTransformation.transform({
      decode: normalizeInstructionText,
      encode: identity,
    })
  ),
  $I.annoteSchema("NormalizedAgentInstructionDocument", {
    description: "Markdown instruction document normalized by trimming trailing line whitespace and outer whitespace.",
    toArbitrary: () => (fc) => fc.constant("# Rules"),
  }),
  SchemaUtils.withStatics((schema) => ({
    decodeEffect: S.decodeUnknownEffect(schema),
    is: S.is(schema),
  }))
);

/**
 * Runtime type for {@link NormalizedAgentInstructionDocument}.
 *
 * **Example** (Annotate normalized document type)
 *
 * ```ts
 * import type { NormalizedAgentInstructionDocument } from "@beep/ai-sync"
 *
 * const document: NormalizedAgentInstructionDocument = "# Instructions"
 * console.log(document)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type NormalizedAgentInstructionDocument = typeof NormalizedAgentInstructionDocument.Type;

/**
 * Generic agent skill frontmatter shared by compatible agents.
 *
 * **Example** (Make agent skill frontmatter)
 *
 * ```ts
 * import { AgentSkillFrontmatter } from "@beep/ai-sync"
 *
 * const frontmatter = AgentSkillFrontmatter.make({
 *   name: "effect-first-development",
 *   description: "Use Effect patterns"
 * })
 * console.log(frontmatter.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class AgentSkillFrontmatter extends S.Class<AgentSkillFrontmatter>($I`AgentSkillFrontmatter`)(
  {
    name: S.String,
    description: S.String,
  },
  $I.annote("AgentSkillFrontmatter", {
    description: "Common skill frontmatter fields shared by Claude Code, Codex, Grok Build, and Junie skill packages.",
  })
) {
  static readonly normalize = (frontmatter: AgentSkillFrontmatter): AgentSkillFrontmatter =>
    AgentSkillFrontmatter.make({
      name: frontmatter.name,
      description: frontmatter.description,
    });
}

/**
 * Unknown native schema marker for documented-but-undisclosed surfaces.
 *
 * **Example** (Make unknown native schema cell)
 *
 * ```ts
 * import { UnknownNativeSchemaCell } from "@beep/ai-sync"
 * const cell = UnknownNativeSchemaCell.make({
 *   agent: "grok-build",
 *   domain: "hooks",
 *   reason: "Native hook payload schema is not public."
 * })
 * console.log(cell.reason)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class UnknownNativeSchemaCell extends S.Class<UnknownNativeSchemaCell>($I`UnknownNativeSchemaCell`)(
  {
    agent: AiSyncAgentId,
    domain: AiSyncDomainId,
    reason: S.String,
  },
  $I.annote("UnknownNativeSchemaCell", {
    description: "Explicit marker for an undocumented native surface that V1 must not model by guesswork.",
  })
) {}

/**
 * Documentation-backed generic command metadata.
 *
 * **Example** (Make agent command metadata)
 *
 * ```ts
 * import { AgentCommandMetadata } from "@beep/ai-sync"
 * const command = AgentCommandMetadata.make({ name: "review", description: "Review the repo" })
 * console.log(command.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class AgentCommandMetadata extends S.Class<AgentCommandMetadata>($I`AgentCommandMetadata`)(
  {
    name: S.String,
    description: S.String,
    arguments: S.Array(S.String).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("AgentCommandMetadata", {
    description: "Portable metadata for agents with documented custom command concepts.",
  })
) {}

/**
 * Generic package/plugin manifest metadata used only where a native schema is known.
 *
 * **Example** (Make plugin manifest metadata)
 *
 * ```ts
 * import { AgentPluginManifestMetadata } from "@beep/ai-sync"
 * const manifest = AgentPluginManifestMetadata.make({ name: "example", version: "0.0.0" })
 * console.log(manifest.version)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class AgentPluginManifestMetadata extends S.Class<AgentPluginManifestMetadata>($I`AgentPluginManifestMetadata`)(
  {
    name: S.String,
    version: S.String,
    description: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    metadata: UnknownRecord.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("AgentPluginManifestMetadata", {
    description: "Plugin manifest metadata for documented plugin surfaces.",
  })
) {}

/**
 * Generated Codex config schema, Claude-style MCP JSON, and settings schemas.
 *
 * @category schemas
 * @since 0.0.0
 */
export { ClaudeMcpJson, ClaudeSettings, CodexConfig, CodexMcpServer, CodexSkillEntry, CodexSkills, McpJsonServer };
