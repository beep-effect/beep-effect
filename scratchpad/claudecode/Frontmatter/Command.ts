/**
 * Schemas for legacy Claude Code slash-command markdown frontmatter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

import { HooksSection } from "../Settings/HooksSection.ts";
import { EffortLevel, FrontmatterShell, StringOrStringArray } from "./Skill.ts";
import { Effect } from "effect";

const $I = $ScratchpadId.create("claudecode/Frontmatter/Command");

/**
 * Runtime model for the YAML frontmatter of a legacy slash-command file.
 *
 * **Details**
 *
 * Claude Code merged custom commands into skills, but files under `commands/`
 * still accept the same optional metadata and tool-policy keys. Every optional
 * wire key decodes to `Option`.
 *
 * **Example** (Decode command metadata)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const command = Effect.runSync(
 *   S.decodeUnknownEffect(Frontmatter.CommandFrontmatter)({
 *     description: "Review staged changes",
 *     model: "sonnet"
 *   })
 * )
 * console.log(O.getOrNull(command.model)) // "sonnet"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommandFrontmatter_ extends S.Class<CommandFrontmatter_>($I`CommandFrontmatter`)(
  {
    name: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    description: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    when_to_use: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    arguments: S.OptionFromOptionalKey(StringOrStringArray).pipe(S.withConstructorDefault(Effect.succeedNone)),
    argumentHint: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    allowedTools: S.OptionFromOptionalKey(StringOrStringArray).pipe(S.withConstructorDefault(Effect.succeedNone)),
    disallowedTools: S.OptionFromOptionalKey(StringOrStringArray).pipe(S.withConstructorDefault(Effect.succeedNone)),
    disableModelInvocation: S.OptionFromOptionalKey(S.Boolean).pipe(S.withConstructorDefault(Effect.succeedNone)),
    userInvocable: S.OptionFromOptionalKey(S.Boolean).pipe(S.withConstructorDefault(Effect.succeedNone)),
    context: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    agent: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    hooks: S.OptionFromOptionalKey(HooksSection).pipe(S.withConstructorDefault(Effect.succeedNone)),
    effort: S.OptionFromOptionalKey(EffortLevel).pipe(S.withConstructorDefault(Effect.succeedNone)),
    paths: S.OptionFromOptionalKey(StringOrStringArray).pipe(S.withConstructorDefault(Effect.succeedNone)),
    shell: S.OptionFromOptionalKey(FrontmatterShell).pipe(S.withConstructorDefault(Effect.succeedNone)),
    model: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("CommandFrontmatter", {
    description: "Runtime model for the YAML frontmatter of a legacy Claude Code slash-command file.",
  })
) {}

/**
 * Codec for slash-command frontmatter with kebab-case YAML keys and camelCase runtime fields.
 *
 * **Example** (Decode allowed tools)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const command = Effect.runSync(
 *   S.decodeUnknownEffect(Frontmatter.CommandFrontmatter)({ "allowed-tools": ["Bash"] })
 * )
 * console.log(O.isSome(command.allowedTools)) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const CommandFrontmatter = CommandFrontmatter_.pipe(
  S.encodeKeys({
    argumentHint: "argument-hint",
    allowedTools: "allowed-tools",
    disallowedTools: "disallowed-tools",
    disableModelInvocation: "disable-model-invocation",
    userInvocable: "user-invocable",
  }),
  $I.annoteSchema("CommandFrontmatter", {
    description: "Codec for the YAML frontmatter of a legacy Claude Code slash-command file.",
  })
);

/**
 * Decoded camelCase command-frontmatter value produced by {@link CommandFrontmatter}.
 *
 * @see {@link CommandFrontmatter} for the YAML wire-key codec.
 * @category type-level
 * @since 0.0.0
 */
export type CommandFrontmatter = typeof CommandFrontmatter.Type;
/**
 * Encoded input accepted at the Claude Code command-frontmatter boundary.
 *
 * **Example** (Describe encoded command metadata)
 *
 * ```ts
 * import type { Frontmatter } from "effect-claudecode"
 *
 * const input: Frontmatter.CommandFrontmatter.Encoded = {
 *   description: "Review staged changes",
 *   "allowed-tools": ["Read", "Bash"]
 * }
 * console.log(input.description)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export declare namespace CommandFrontmatter {
  /**
   * Runtime type represented by {@link CommandFrontmatter}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = CommandFrontmatter;

  /**
   * JSON representation accepted by {@link CommandFrontmatter}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CommandFrontmatter.Encoded;
}
