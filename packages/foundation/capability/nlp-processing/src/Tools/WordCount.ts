/**
 * WordCount tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { Tool } from "effect/ai";
import * as S from "effect/Schema";
import { AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/WordCount");

class WordCountParameters extends S.Opaque<WordCountParameters, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.annotateKey({
      description: "The text to count words and characters in",
      examples: ["Hello brave new world."],
    }),
  }).pipe(
    $I.annoteSchema("WordCountParameters", {
      description: "Text input used to count word-like tokens and characters.",
    })
  )
) {}

class WordCountSuccess extends S.Opaque<WordCountSuccess, { readonly brand: unique symbol }>()(
  S.Struct({
    characterCount: S.Natural,
    wordCount: S.Natural,
  }).pipe(
    $I.annoteSchema("WordCountSuccess", {
      description: "Count word-like tokens and characters in text.",
    })
  )
) {}

/**
 * Defines the agent-facing tool contract for counting word-like tokens and
 * characters in text.
 *
 * **Details**
 *
 * Use this tool for sizing, routing, or budgeting decisions that depend on the
 * approximate word and character volume of an input.
 *
 * **Example** (Decode WordCount parameters)
 *
 * ```ts import.meta.vitest name="Decode WordCount parameters"
 * import * as S from "effect/Schema"
 * import { WordCount } from "@beep/nlp-processing/Tools/WordCount"
 *
 * const parameters = S.decodeUnknownSync(WordCount.parametersSchema)({
 *   text: "Hello brave new world."
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const WordCount = Tool.make("WordCount", {
  description: "Count word-like tokens and characters in text.",
  failure: AiToolError,
  failureMode: "return",
  parameters: WordCountParameters,
  success: S.toEncoded(WordCountSuccess),
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);
