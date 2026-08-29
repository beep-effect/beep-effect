/**
 * Schemas for Claude Code `SKILL.md` frontmatter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

import { HooksSection } from "../Settings/HooksSection.ts";

const $I = $ScratchpadId.create("claudecode/Frontmatter/Skill");

/**
 * A Claude Code field that accepts either one string or a string array.
 *
 * **Example** (Inspect string or string array)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Frontmatter } from "effect-claudecode"
 *
 * console.log(S.is(Frontmatter.StringOrStringArray)(["Read", "Write"])) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StringOrStringArray = S.Union([S.String, S.Array(S.String)]).pipe(
  $I.annoteSchema("StringOrStringArray", {
    description: "A Claude Code field that accepts either one string or a string array.",
  })
);

/**
 * Type for {@link StringOrStringArray}. {@inheritDoc StringOrStringArray}
 *
 * @category models
 * @since 0.0.0
 */
export type StringOrStringArray = typeof StringOrStringArray.Type;

/**
 * Reasoning-effort levels accepted by skill, command, and subagent frontmatter.
 *
 * **Example** (Inspect effort level)
 *
 * ```ts
 * import { Frontmatter } from "effect-claudecode"
 *
 * console.log(Frontmatter.EffortLevel.is.xhigh("xhigh")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EffortLevel = LiteralKit(["low", "medium", "high", "xhigh", "max"]).pipe(
  $I.annoteSchema("EffortLevel", {
    description: "Reasoning-effort levels accepted by skill, command, and subagent frontmatter.",
  })
);

/**
 * Type for {@link EffortLevel}. {@inheritDoc EffortLevel}
 *
 * @category models
 * @since 0.0.0
 */
export type EffortLevel = typeof EffortLevel.Type;

/**
 * Shell names accepted by skill and legacy command frontmatter.
 *
 * **Example** (Inspect frontmatter shell)
 *
 * ```ts
 * import { Frontmatter } from "effect-claudecode"
 *
 * console.log(Frontmatter.FrontmatterShell.is.bash("bash")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FrontmatterShell = LiteralKit(["bash", "powershell"]).pipe(
  $I.annoteSchema("FrontmatterShell", {
    description: "Shell names accepted by skill and legacy command frontmatter.",
  })
);

/**
 * Type for {@link FrontmatterShell}. {@inheritDoc FrontmatterShell}
 *
 * @category models
 * @since 0.0.0
 */
export type FrontmatterShell = typeof FrontmatterShell.Type;

/**
 * Runtime model for the YAML frontmatter of a Claude Code `SKILL.md` file.
 *
 * Optional wire keys decode to `Option`, keeping absence explicit inside the
 * harness while preserving Claude Code's original optional-key encoding.
 *
 * **Example** (Run SkillFrontmatter)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const program = Effect.gen(function* () {
 *   const skill = yield* S.decodeUnknownEffect(Frontmatter.SkillFrontmatter)({ name: "review" })
 *   console.log(O.getOrNull(skill.name)) // "review"
 * })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillFrontmatter extends S.Class<SkillFrontmatter>($I`SkillFrontmatter`)(
  {
    name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    description: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    when_to_use: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    license: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    metadata: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(SchemaUtils.withNoneDefault),
    compatibility: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    "disable-model-invocation": S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    "user-invocable": S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    context: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    agent: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    model: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    effort: S.OptionFromOptionalKey(EffortLevel).pipe(SchemaUtils.withNoneDefault),
    arguments: S.OptionFromOptionalKey(StringOrStringArray).pipe(SchemaUtils.withNoneDefault),
    "allowed-tools": S.OptionFromOptionalKey(StringOrStringArray).pipe(SchemaUtils.withNoneDefault),
    "disallowed-tools": S.OptionFromOptionalKey(StringOrStringArray).pipe(SchemaUtils.withNoneDefault),
    "argument-hint": S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    paths: S.OptionFromOptionalKey(StringOrStringArray).pipe(SchemaUtils.withNoneDefault),
    shell: S.OptionFromOptionalKey(FrontmatterShell).pipe(SchemaUtils.withNoneDefault),
    hooks: S.OptionFromOptionalKey(HooksSection).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SkillFrontmatter", {
    description: "Runtime model for the YAML frontmatter of a Claude Code SKILL.md file.",
  })
) {}

/**
 * Encoded input accepted at the Claude Code skill-frontmatter boundary.
 *
 * @category dtos
 * @since 0.0.0
 */
export declare namespace SkillFrontmatter {
  /**
   * Runtime type represented by {@link SkillFrontmatter}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = SkillFrontmatter;

  /**
   * JSON representation accepted by {@link SkillFrontmatter}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SkillFrontmatter.Encoded;
}
