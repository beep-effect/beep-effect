/**
 * Schemas for Claude Code subagent markdown frontmatter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

import { HooksSection } from "../Settings/HooksSection.ts";
import { PermissionMode } from "../Settings/Schema.ts";
import { EffortLevel, StringOrStringArray } from "./Skill.ts";

const $I = $ScratchpadId.create("claudecode/Frontmatter/Subagent");

const InlineMcpServerReference = S.Union([S.String, S.Record(S.String, S.Unknown)]).pipe(
  $I.annoteSchema("InlineMcpServerReference", {
    description: "An MCP server name or inline MCP server configuration embedded in subagent frontmatter.",
  })
);

/**
 * Display colors accepted by Claude Code subagent frontmatter.
 *
 * **Example** (Inspect subagent color)
 *
 * ```ts
 * import { Frontmatter } from "effect-claudecode"
 *
 * console.log(Frontmatter.SubagentColor.is.cyan("cyan")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SubagentColor = LiteralKit(["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"]).pipe(
  $I.annoteSchema("SubagentColor", {
    description: "Display colors accepted by Claude Code subagent frontmatter.",
  })
);

/**
 * Decoded value produced by {@link SubagentColor}.
 *
 * @see {@link SubagentColor} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type SubagentColor = typeof SubagentColor.Type;

/**
 * Runtime model for the YAML frontmatter of a Claude Code subagent file.
 *
 * `name` and `description` remain required by the wire contract. Every
 * optional key decodes to `Option`.
 *
 * **Example** (Run SubagentFrontmatter)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const agent = Effect.runSync(
 *   S.decodeUnknownEffect(Frontmatter.SubagentFrontmatter)({
 *     name: "reviewer",
 *     description: "Reviews changes",
 *     model: "sonnet"
 *   })
 * )
 * console.log(O.getOrNull(agent.model)) // "sonnet"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SubagentFrontmatter extends S.Class<SubagentFrontmatter>($I`SubagentFrontmatter`)(
  {
    name: S.String,
    description: S.String,
    model: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    effort: S.OptionFromOptionalKey(EffortLevel).pipe(SchemaUtils.withNoneDefault),
    maxTurns: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    initialPrompt: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    tools: S.OptionFromOptionalKey(StringOrStringArray).pipe(SchemaUtils.withNoneDefault),
    disallowedTools: S.OptionFromOptionalKey(StringOrStringArray).pipe(SchemaUtils.withNoneDefault),
    isolation: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    color: S.OptionFromOptionalKey(SubagentColor).pipe(SchemaUtils.withNoneDefault),
    skills: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    mcpServers: S.OptionFromOptionalKey(InlineMcpServerReference.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    memory: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    background: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    permissionMode: S.OptionFromOptionalKey(PermissionMode).pipe(SchemaUtils.withNoneDefault),
    hooks: S.OptionFromOptionalKey(HooksSection).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SubagentFrontmatter", {
    description: "Runtime model for the YAML frontmatter of a Claude Code subagent file.",
  })
) {}

/**
 * Encoded input accepted at the Claude Code subagent-frontmatter boundary.
 *
 * **Example** (Describe encoded subagent frontmatter)
 *
 * ```ts
 * import type { Frontmatter } from "effect-claudecode"
 *
 * const input: Frontmatter.SubagentFrontmatter.Encoded = {
 *   name: "reviewer",
 *   description: "Reviews changes",
 *   model: "sonnet"
 * }
 * console.log(input.name)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export declare namespace SubagentFrontmatter {
  /**
   * Runtime type represented by {@link SubagentFrontmatter}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = SubagentFrontmatter;

  /**
   * JSON representation accepted by {@link SubagentFrontmatter}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SubagentFrontmatter.Encoded;
}
