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
 * **Details**
 *
 * Output styles influence response phrasing. All supported wire keys are
 * optional and decode to `Option`.
 *
 * **Example** (Decode an output style)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const style = Effect.runSync(
 *   S.decodeUnknownEffect(Frontmatter.OutputStyleFrontmatter)({ name: "terse" })
 * )
 * console.log(O.getOrNull(style.name)) // "terse"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OutputStyleFrontmatter_ extends S.Class<OutputStyleFrontmatter_>($I`OutputStyleFrontmatter`)(
  {
    name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    description: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    keepCodingInstructions: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    forceForPlugin: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("OutputStyleFrontmatter", {
    description: "Runtime model for the YAML frontmatter of a Claude Code output-style file.",
  })
) {}

/**
 * Codec for output-style frontmatter with kebab-case YAML keys and camelCase runtime fields.
 *
 * **Example** (Decode coding instructions)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const style = Effect.runSync(
 *   S.decodeUnknownEffect(Frontmatter.OutputStyleFrontmatter)({ "keep-coding-instructions": true })
 * )
 * console.log(O.isSome(style.keepCodingInstructions)) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const OutputStyleFrontmatter = OutputStyleFrontmatter_.pipe(
  S.encodeKeys({
    keepCodingInstructions: "keep-coding-instructions",
    forceForPlugin: "force-for-plugin",
  }),
  $I.annoteSchema("OutputStyleFrontmatter", {
    description: "Codec for the YAML frontmatter of a Claude Code output-style file.",
  })
);

/**
 * Decoded camelCase output-style value produced by {@link OutputStyleFrontmatter}.
 *
 * @see {@link OutputStyleFrontmatter} for the YAML wire-key codec.
 * @category type-level
 * @since 0.0.0
 */
export type OutputStyleFrontmatter = typeof OutputStyleFrontmatter.Type;
/**
 * Encoded input accepted at the Claude Code output-style frontmatter boundary.
 *
 * **Example** (Describe an encoded output style)
 *
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
