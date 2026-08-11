/**
 * Schemas for legacy Claude Code slash-command markdown frontmatter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

import { HooksSection } from "../Settings/HooksSection.ts";
import { EffortLevel, FrontmatterShell, StringOrStringArray } from "./Skill.ts";

const $I = $ScratchpadId.create("claudecode/Frontmatter/Command");

/**
 * Runtime model for the YAML frontmatter of a legacy slash-command file.
 *
 * Claude Code merged custom commands into skills, but files under `commands/`
 * still accept the same optional metadata and tool-policy keys. Every optional
 * wire key decodes to `Option`.
 *
 * **Example** (Run CommandFrontmatter)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const program = Effect.gen(function* () {
 *   const command = yield* S.decodeUnknownEffect(Frontmatter.CommandFrontmatter)({
 *     description: "Review staged changes",
 *     model: "sonnet"
 *   })
 *   console.log(O.getOrNull(command.model)) // "sonnet"
 * })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommandFrontmatter extends S.Class<CommandFrontmatter>($I`CommandFrontmatter`)(
  {
    name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    description: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    when_to_use: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    arguments: S.OptionFromOptionalKey(StringOrStringArray).pipe(SchemaUtils.withNoneDefault),
    "argument-hint": S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    "allowed-tools": S.OptionFromOptionalKey(StringOrStringArray).pipe(SchemaUtils.withNoneDefault),
    "disallowed-tools": S.OptionFromOptionalKey(StringOrStringArray).pipe(SchemaUtils.withNoneDefault),
    "disable-model-invocation": S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    "user-invocable": S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    context: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    agent: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hooks: S.OptionFromOptionalKey(HooksSection).pipe(SchemaUtils.withNoneDefault),
    effort: S.OptionFromOptionalKey(EffortLevel).pipe(SchemaUtils.withNoneDefault),
    paths: S.OptionFromOptionalKey(StringOrStringArray).pipe(SchemaUtils.withNoneDefault),
    shell: S.OptionFromOptionalKey(FrontmatterShell).pipe(SchemaUtils.withNoneDefault),
    model: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CommandFrontmatter", {
    description: "Runtime model for the YAML frontmatter of a legacy Claude Code slash-command file.",
  })
) {}

/**
 * Encoded input accepted at the Claude Code command-frontmatter boundary.
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
