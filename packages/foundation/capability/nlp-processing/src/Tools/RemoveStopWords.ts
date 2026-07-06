/**
 * RemoveStopWords tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/RemoveStopWords");

class RemoveStopWordsParameters extends S.Class<RemoveStopWordsParameters>($I`RemoveStopWordsParameters`)(
  {
    text: S.String.annotateKey({
      description: "The text to filter stop words from",
      examples: ["the quick brown fox jumps over the lazy dog"],
    }),
  },
  $I.annote("RemoveStopWordsParameters", {
    description: "Text input used to drop stop words and keep meaningful word tokens.",
  })
) {}

class RemoveStopWordsSuccess extends S.Class<RemoveStopWordsSuccess>($I`RemoveStopWordsSuccess`)(
  {
    count: NonNegativeInt,
    removedCount: NonNegativeInt,
    tokens: S.Array(S.String),
  },
  $I.annote("RemoveStopWordsSuccess", {
    description: "Remove stop words from text, returning the remaining word tokens.",
  })
) {}

/**
 * Defines the agent-facing tool contract for removing stop words from text and
 * returning the remaining word tokens.
 *
 * Use this tool when a caller needs content-bearing tokens for keyword
 * extraction, matching, or compact feature generation.
 *
 * @example
 * ```ts
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
