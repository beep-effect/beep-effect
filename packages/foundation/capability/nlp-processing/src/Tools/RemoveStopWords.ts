/**
 * RemoveStopWords tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import * as Tool from "effect/ai/Tool";
import * as S from "effect/Schema";
import { AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/RemoveStopWords");

class RemoveStopWordsParameters extends S.Opaque<RemoveStopWordsParameters, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.annotateKey({
      description: "The text to filter stop words from",
      examples: ["the quick brown fox jumps over the lazy dog"],
    }),
  }).pipe(
    $I.annoteSchema("RemoveStopWordsParameters", {
      description: "Text input used to drop stop words and keep meaningful word tokens.",
    })
  )
) {}

class RemoveStopWordsSuccess extends S.Opaque<RemoveStopWordsSuccess, { readonly brand: unique symbol }>()(
  S.Struct({
    count: S.Natural,
    removedCount: S.Natural,
    tokens: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("RemoveStopWordsSuccess", {
      description: "Remove stop words from text, returning the remaining word tokens.",
    })
  )
) {}

/**
 * Defines the agent-facing tool contract for removing stop words from text and
 * returning the remaining word tokens.
 *
 * **Details**
 *
 * Use this tool when a caller needs content-bearing tokens for keyword
 * extraction, matching, or compact feature generation.
 *
 * **Example** (Decode parameters schema)
 *
 * ```ts import.meta.vitest name="Decode parameters schema"
 * import * as S from "effect/Schema"
 * import { RemoveStopWords } from "@beep/nlp-processing/Tools/RemoveStopWords"
 *
 * const parameters = S.decodeUnknownSync(RemoveStopWords.parametersSchema)({
 *   text: "the quick brown fox"
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const RemoveStopWords = Tool.make("RemoveStopWords", {
  description: "Remove stop words from text, returning the remaining word tokens.",
  failure: AiToolError,
  failureMode: "return",
  parameters: RemoveStopWordsParameters,
  success: S.toEncoded(RemoveStopWordsSuccess),
});
