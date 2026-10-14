/**
 * Native AI agent configuration schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AiSyncId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, SlugChecks } from "@beep/schema";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, identity } from "effect/Function";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
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
import type * as AST from "effect/SchemaAST";

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
  SchemaUtils.withStatics(() => ({
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
 * import * as Effect from "effect/Effect";
 * import { NormalizedAgentInstructionDocument } from "@beep/ai-sync"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(NormalizedAgentInstructionDocument)("# Rules  ")
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
  })
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
 * Agent Skills `name`: 1-64 lowercase ASCII letters, digits, and single
 * hyphens, the grammar fixed by the Agent Skills specification.
 *
 * **Details**
 *
 * The specification also requires the name to match the skill's directory
 * name. That rule needs the directory, so the installer checks it; this schema
 * checks the text alone.
 *
 * **Example** (Accept a spec name and reject an uppercase one)
 *
 * ```ts
 * import { AgentSkillName } from "@beep/ai-sync"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AgentSkillName)("pdf-processing")) // true
 * console.log(S.is(AgentSkillName)("PDF-Processing")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AgentSkillName = S.NonEmptyString.check(
  SlugChecks,
  S.isMaxLength(64, { message: "Skill name must be at most 64 characters" })
).pipe(
  $I.annoteSchema("AgentSkillName", {
    description: "Agent Skills name: 1-64 lowercase ASCII letters, digits, and single hyphen separators.",
  })
);

/**
 * Runtime type for {@link AgentSkillName}.
 *
 * **Example** (Annotate a skill name)
 *
 * ```ts
 * import type { AgentSkillName } from "@beep/ai-sync"
 *
 * const name: AgentSkillName = "pdf-processing"
 * console.log(name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type AgentSkillName = typeof AgentSkillName.Type;

/**
 * Agent Skills `description`: non-blank, at most 1024 characters.
 *
 * **Example** (Reject a blank description)
 *
 * ```ts
 * import { AgentSkillDescription } from "@beep/ai-sync"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AgentSkillDescription)("Extract PDF text. Use when handling PDFs.")) // true
 * console.log(S.is(AgentSkillDescription)("   ")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AgentSkillDescription = S.String.check(
  S.isPattern(/\S/u, { message: "Skill description must not be blank" }),
  S.isMaxLength(1024, { message: "Skill description must be at most 1024 characters" })
).pipe(
  $I.annoteSchema("AgentSkillDescription", {
    description:
      "Agent Skills description: non-blank text of at most 1024 characters saying what the skill does and when to use it.",
  })
);

/**
 * Runtime type for {@link AgentSkillDescription}.
 *
 * **Example** (Annotate a description)
 *
 * ```ts
 * import type { AgentSkillDescription } from "@beep/ai-sync"
 *
 * const description: AgentSkillDescription = "Extract PDF text."
 * console.log(description)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type AgentSkillDescription = typeof AgentSkillDescription.Type;

/**
 * Agent Skills `compatibility`: environment requirements, 1-500 characters.
 *
 * **Example** (Bound the compatibility note)
 *
 * ```ts
 * import { AgentSkillCompatibility } from "@beep/ai-sync"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AgentSkillCompatibility)("Requires git, docker, and jq")) // true
 * console.log(S.is(AgentSkillCompatibility)("")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AgentSkillCompatibility = S.NonEmptyString.check(
  S.isMaxLength(500, { message: "Skill compatibility must be at most 500 characters" })
).pipe(
  $I.annoteSchema("AgentSkillCompatibility", {
    description: "Agent Skills compatibility note: environment requirements in 1-500 characters.",
  })
);

/**
 * Runtime type for {@link AgentSkillCompatibility}.
 *
 * **Example** (Annotate a compatibility note)
 *
 * ```ts
 * import type { AgentSkillCompatibility } from "@beep/ai-sync"
 *
 * const compatibility: AgentSkillCompatibility = "Requires git"
 * console.log(compatibility)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type AgentSkillCompatibility = typeof AgentSkillCompatibility.Type;

/**
 * Agent Skills `metadata`: the specification's only extension point, a map of
 * string keys to string values.
 *
 * **Details**
 *
 * Repo-specific fields such as `version` and `status` belong here. YAML turns
 * unquoted `1.0` into a number, so quote numeric-looking values.
 *
 * **Example** (Carry a version under metadata)
 *
 * ```ts
 * import { AgentSkillMetadata } from "@beep/ai-sync"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AgentSkillMetadata)({ version: "1.0", status: "active" })) // true
 * console.log(S.is(AgentSkillMetadata)({ version: 1 })) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AgentSkillMetadata = S.Record(S.String, S.String).pipe(
  $I.annoteSchema("AgentSkillMetadata", {
    description: "Agent Skills metadata map: string keys to string values for client- or repo-specific properties.",
  })
);

/**
 * Runtime type for {@link AgentSkillMetadata}.
 *
 * **Example** (Annotate a metadata map)
 *
 * ```ts
 * import type { AgentSkillMetadata } from "@beep/ai-sync"
 *
 * const metadata: AgentSkillMetadata = { version: "1.0" }
 * console.log(metadata.version)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type AgentSkillMetadata = typeof AgentSkillMetadata.Type;

/**
 * A frontmatter value that is either one space- or comma-separated string or a
 * YAML list of strings.
 *
 * **Details**
 *
 * The specification types `allowed-tools` as a space-separated string; Claude
 * Code also accepts a YAML list there and for `disallowed-tools`,
 * `arguments`, and `paths`.
 *
 * **Example** (Accept both spellings of a tool allowlist)
 *
 * ```ts
 * import { AgentSkillStringList } from "@beep/ai-sync"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AgentSkillStringList)("Bash(git:*) Read")) // true
 * console.log(S.is(AgentSkillStringList)(["Bash(git:*)", "Read"])) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AgentSkillStringList = S.Union([S.String, S.Array(S.String)]).pipe(
  $I.annoteSchema("AgentSkillStringList", {
    description: "One space- or comma-separated string, or a YAML list of strings.",
  })
);

/**
 * Runtime type for {@link AgentSkillStringList}.
 *
 * **Example** (Annotate a tool list)
 *
 * ```ts
 * import type { AgentSkillStringList } from "@beep/ai-sync"
 *
 * const tools: AgentSkillStringList = ["Read", "Grep"]
 * console.log(tools)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type AgentSkillStringList = typeof AgentSkillStringList.Type;

/**
 * Effort levels Claude Code accepts in a skill's `effort` key.
 *
 * **Example** (Check a level)
 *
 * ```ts
 * import { ClaudeCodeSkillEffort } from "@beep/ai-sync"
 *
 * console.log(ClaudeCodeSkillEffort.is.medium("medium")) // true
 * console.log(ClaudeCodeSkillEffort.literals.length) // 5
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaudeCodeSkillEffort = LiteralKit(["low", "medium", "high", "xhigh", "max"]).pipe(
  $I.annoteSchema("ClaudeCodeSkillEffort", {
    description: "Effort level a Claude Code skill may pin while it is active.",
  })
);

/**
 * Runtime type for {@link ClaudeCodeSkillEffort}.
 *
 * **Example** (Annotate an effort level)
 *
 * ```ts
 * import type { ClaudeCodeSkillEffort } from "@beep/ai-sync"
 *
 * const effort: ClaudeCodeSkillEffort = "medium"
 * console.log(effort)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type ClaudeCodeSkillEffort = typeof ClaudeCodeSkillEffort.Type;

/**
 * Shells Claude Code accepts for a skill's inline command blocks.
 *
 * **Example** (Check a shell)
 *
 * ```ts
 * import { ClaudeCodeSkillShell } from "@beep/ai-sync"
 *
 * console.log(ClaudeCodeSkillShell.is.bash("bash")) // true
 * console.log(ClaudeCodeSkillShell.is.powershell("zsh")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaudeCodeSkillShell = LiteralKit(["bash", "powershell"]).pipe(
  $I.annoteSchema("ClaudeCodeSkillShell", {
    description: "Shell a Claude Code skill runs its inline command blocks with.",
  })
);

/**
 * Runtime type for {@link ClaudeCodeSkillShell}.
 *
 * **Example** (Annotate a shell)
 *
 * ```ts
 * import type { ClaudeCodeSkillShell } from "@beep/ai-sync"
 *
 * const shell: ClaudeCodeSkillShell = "bash"
 * console.log(shell)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type ClaudeCodeSkillShell = typeof ClaudeCodeSkillShell.Type;

/**
 * `SKILL.md` frontmatter: the Agent Skills specification's fields plus the
 * keys Claude Code reads natively.
 *
 * **Details**
 *
 * Specification fields: `name`, `description`, `license`, `compatibility`,
 * `metadata`, and the experimental `allowed-tools`. Every other key here is a
 * Claude Code extension (`when_to_use`, `argument-hint`, `arguments`,
 * `disable-model-invocation`, `user-invocable`, `disallowed-tools`, `model`,
 * `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell`).
 * Decoding with {@link AgentSkillFrontmatterStrictParseOptions} rejects any
 * key outside that union, which is how `beep skills update` keeps repo extras
 * under `metadata`.
 *
 * **Gotchas**
 *
 * Claude.ai uploads and the Skills API accept only the specification fields;
 * a skill that relies on a Claude Code extension key is not portable there.
 *
 * **Example** (Make agent skill frontmatter)
 *
 * ```ts
 * import { AgentSkillFrontmatter } from "@beep/ai-sync"
 *
 * const frontmatter = AgentSkillFrontmatter.make({
 *   name: "effect-first-development",
 *   description: "Use Effect patterns",
 *   metadata: { version: "0.1.0" }
 * })
 * console.log(frontmatter.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class AgentSkillFrontmatter extends S.Class<AgentSkillFrontmatter>($I`AgentSkillFrontmatter`)(
  {
    name: AgentSkillName,
    description: AgentSkillDescription,
    license: S.optionalKey(S.String),
    compatibility: S.optionalKey(AgentSkillCompatibility),
    metadata: S.optionalKey(AgentSkillMetadata),
    "allowed-tools": S.optionalKey(AgentSkillStringList),
    when_to_use: S.optionalKey(S.String),
    "argument-hint": S.optionalKey(S.String),
    arguments: S.optionalKey(AgentSkillStringList),
    "disable-model-invocation": S.optionalKey(S.Boolean),
    "user-invocable": S.optionalKey(S.Boolean),
    "disallowed-tools": S.optionalKey(AgentSkillStringList),
    model: S.optionalKey(S.String),
    effort: S.optionalKey(ClaudeCodeSkillEffort),
    context: S.optionalKey(S.Literal("fork")),
    agent: S.optionalKey(S.String),
    background: S.optionalKey(S.Boolean),
    hooks: S.optionalKey(S.Record(S.String, S.Unknown)),
    paths: S.optionalKey(AgentSkillStringList),
    shell: S.optionalKey(ClaudeCodeSkillShell),
  },
  $I.annote("AgentSkillFrontmatter", {
    description:
      "SKILL.md frontmatter: the Agent Skills specification fields shared by Claude Code, Codex, Grok Build, and Junie, plus Claude Code's native extension keys.",
  })
) {
  static readonly normalize = (frontmatter: AgentSkillFrontmatter): AgentSkillFrontmatter =>
    AgentSkillFrontmatter.make({
      name: frontmatter.name,
      description: frontmatter.description,
    });
}

/**
 * Parse options behind {@link decodeAgentSkillFrontmatterStrict}: unknown keys
 * fail and every issue is reported.
 *
 * **Example** (Decode under the strict options by hand)
 *
 * ```ts
 * import { AgentSkillFrontmatter, AgentSkillFrontmatterStrictParseOptions } from "@beep/ai-sync"
 * import * as Effect from "effect/Effect"
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 *
 * const exit = Effect.runSyncExit(
 *   S.decodeUnknownEffect(AgentSkillFrontmatter)({ name: "yeet", description: "Ship", version: "1.0" }, AgentSkillFrontmatterStrictParseOptions)
 * )
 * console.log(Exit.isFailure(exit)) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const AgentSkillFrontmatterStrictParseOptions: AST.ParseOptions = {
  errors: "all",
  onExcessProperty: "error",
};

const decodeUnknownAgentSkillFrontmatter = S.decodeUnknownEffect(AgentSkillFrontmatter);

/**
 * Decode parsed YAML frontmatter into {@link AgentSkillFrontmatter}, ignoring
 * unknown keys.
 *
 * **Details**
 *
 * This is the lenient loading the Agent Skills client guide recommends: a key
 * the schema does not model is dropped, never an error. It takes the input
 * alone, so frontmatter that happens to carry a `ParseOptions`-shaped key such
 * as `errors` or `concurrency` is still data. Use
 * {@link decodeAgentSkillFrontmatterStrict} to validate authored skills.
 *
 * **Example** (Decode a minimal skill)
 *
 * ```ts
 * import { decodeAgentSkillFrontmatter } from "@beep/ai-sync"
 * import * as Effect from "effect/Effect"
 *
 * const frontmatter = Effect.runSync(decodeAgentSkillFrontmatter({ name: "pdf", description: "Read PDFs." }))
 * console.log(frontmatter.name) // "pdf"
 * ```
 *
 * @param input - The parsed frontmatter value.
 * @returns The decoded frontmatter, or the schema error.
 * @category codecs
 * @since 0.0.0
 */
export const decodeAgentSkillFrontmatter = (input: unknown): Effect.Effect<AgentSkillFrontmatter, S.SchemaError> =>
  decodeUnknownAgentSkillFrontmatter(input);

/**
 * Decode parsed YAML frontmatter into {@link AgentSkillFrontmatter} under
 * {@link AgentSkillFrontmatterStrictParseOptions}: unknown keys fail and every
 * issue is reported.
 *
 * **Example** (Reject a repo extra that is not under metadata)
 *
 * ```ts
 * import { decodeAgentSkillFrontmatterStrict } from "@beep/ai-sync"
 * import * as Effect from "effect/Effect"
 * import * as Exit from "effect/Exit"
 *
 * const exit = Effect.runSyncExit(decodeAgentSkillFrontmatterStrict({ name: "yeet", description: "Ship", version: "1.0" }))
 * console.log(Exit.isFailure(exit)) // true
 * ```
 *
 * @param input - The parsed frontmatter value.
 * @returns The decoded frontmatter, or the schema error listing every violation.
 * @category codecs
 * @since 0.0.0
 */
export const decodeAgentSkillFrontmatterStrict = (
  input: unknown
): Effect.Effect<AgentSkillFrontmatter, S.SchemaError> =>
  decodeUnknownAgentSkillFrontmatter(input, AgentSkillFrontmatterStrictParseOptions);

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
    arguments: S.Array(S.String).pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
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
    description: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    metadata: S.Record(S.String, S.Unknown).pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
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

/**
 * Generates non-empty instruction documents in their normalized form.
 *
 * **Example** (Generate normalized instructions)
 *
 * ```ts
 * import { NormalizedAgentInstructionDocumentArbitrary } from "@beep/ai-sync"
 * import * as Arbitrary from "effect/Arbitrary"
 * const samples = Arbitrary.sampleEffect(NormalizedAgentInstructionDocumentArbitrary)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const NormalizedAgentInstructionDocumentArbitrary = Arbitrary.schema(AgentInstructionDocument).pipe(
  Arbitrary.map(normalizeInstructionText),
  Arbitrary.filter(S.is(AgentInstructionDocument))
);
