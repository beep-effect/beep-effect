/**
 * Schemas for Claude Code `SKILL.md` frontmatter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

import { HooksSection } from "../Settings/HooksSection.ts";
import { Effect } from "effect";

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
 * Decoded value produced by {@link StringOrStringArray}.
 *
 * @see {@link StringOrStringArray} for the runtime schema and decoding behavior.
 * @category type-level
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
 * @see {@link Settings.EffortLevel} for the persisted settings closed set (`max` is frontmatter-only).
 * @category schemas
 * @since 0.0.0
 */
export const EffortLevel = LiteralKit(["low", "medium", "high", "xhigh", "max"]).pipe(
  $I.annoteSchema("EffortLevel", {
    description: "Reasoning-effort levels accepted by skill, command, and subagent frontmatter.",
  })
);

/**
 * Decoded value produced by {@link EffortLevel}.
 *
 * @see {@link EffortLevel} for the runtime schema and decoding behavior.
 * @category type-level
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
 * Decoded value produced by {@link FrontmatterShell}.
 *
 * @see {@link FrontmatterShell} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type FrontmatterShell = typeof FrontmatterShell.Type;

/**
 * Runtime model for the YAML frontmatter of a Claude Code `SKILL.md` file.
 *
 * **Details**
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
 * const skill = Effect.runSync(
 *   S.decodeUnknownEffect(Frontmatter.SkillFrontmatter)({ name: "review" })
 * )
 * console.log(O.getOrNull(skill.name)) // "review"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillFrontmatter extends S.Class<SkillFrontmatter>($I`SkillFrontmatter`)(
  {
    name: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    description: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    when_to_use: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    license: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    metadata: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(S.withConstructorDefault(Effect.succeedNone)),
    compatibility: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    "disable-model-invocation": S.OptionFromOptionalKey(S.Boolean).pipe(S.withConstructorDefault(Effect.succeedNone)),
    "user-invocable": S.OptionFromOptionalKey(S.Boolean).pipe(S.withConstructorDefault(Effect.succeedNone)),
    context: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    agent: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    model: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    effort: S.OptionFromOptionalKey(EffortLevel).pipe(S.withConstructorDefault(Effect.succeedNone)),
    arguments: S.OptionFromOptionalKey(StringOrStringArray).pipe(S.withConstructorDefault(Effect.succeedNone)),
    "allowed-tools": S.OptionFromOptionalKey(StringOrStringArray).pipe(S.withConstructorDefault(Effect.succeedNone)),
    "disallowed-tools": S.OptionFromOptionalKey(StringOrStringArray).pipe(S.withConstructorDefault(Effect.succeedNone)),
    "argument-hint": S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    paths: S.OptionFromOptionalKey(StringOrStringArray).pipe(S.withConstructorDefault(Effect.succeedNone)),
    shell: S.OptionFromOptionalKey(FrontmatterShell).pipe(S.withConstructorDefault(Effect.succeedNone)),
    hooks: S.OptionFromOptionalKey(HooksSection).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("SkillFrontmatter", {
    description: "Runtime model for the YAML frontmatter of a Claude Code SKILL.md file.",
  })
) {}

/**
 * Encoded input accepted at the Claude Code skill-frontmatter boundary.
 *
 * **Example** (Describe encoded skill frontmatter)
 *
 * ```ts
 * import type { Frontmatter } from "effect-claudecode"
 *
 * const input: Frontmatter.SkillFrontmatter.Encoded = {
 *   name: "review",
 *   "allowed-tools": ["Read", "Bash"]
 * }
 * console.log(input.name)
 * ```
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
