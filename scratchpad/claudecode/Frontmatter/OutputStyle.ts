/**
 * Schemas for Claude Code output-style markdown frontmatter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("claudecode/Frontmatter/OutputStyle");

/**
 * Runtime model for the YAML frontmatter of a Claude Code output-style file.
 *
 * Output styles influence response phrasing. All supported wire keys are
 * optional and decode to `Option`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const program = Effect.gen(function* () {
 *   const style = yield* S.decodeUnknownEffect(Frontmatter.OutputStyleFrontmatter)({ name: "terse" })
 *   console.log(O.getOrNull(style.name)) // "terse"
 * })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OutputStyleFrontmatter extends S.Class<OutputStyleFrontmatter>($I`OutputStyleFrontmatter`)(
  {
    name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    description: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    "keep-coding-instructions": S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    "force-for-plugin": S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("OutputStyleFrontmatter", {
    description: "Runtime model for the YAML frontmatter of a Claude Code output-style file.",
  })
) {}

/**
 * Encoded input accepted at the Claude Code output-style frontmatter boundary.
 *
 * @example
 * ```ts
 * import type { Frontmatter } from "effect-claudecode"
 *
 * const input: Frontmatter.OutputStyleFrontmatter.Encoded = {
 *   name: "terse",
 *   "keep-coding-instructions": true
 * }
 * console.log(input.name)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export declare namespace OutputStyleFrontmatter {
  /**
   * Runtime type represented by {@link OutputStyleFrontmatter}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = OutputStyleFrontmatter;

  /**
   * JSON representation accepted by {@link OutputStyleFrontmatter}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof OutputStyleFrontmatter.Encoded;
}
