/**
 * BagOfWords tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiNGram, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/BagOfWords");

class BagOfWordsParameters extends S.Class<BagOfWordsParameters>($I`BagOfWordsParameters`)(
  {
    text: S.String.annotateKey({
      description: "The text to compute a bag-of-words term-frequency table from",
      examples: ["the cat sat on the mat"],
    }),
  },
  $I.annote("BagOfWordsParameters", {
    description: "Text input used to compute a bag-of-words term-frequency table.",
  })
) {}

class BagOfWordsSuccess extends S.Class<BagOfWordsSuccess>($I`BagOfWordsSuccess`)(
  {
    terms: S.Array(AiNGram),
    totalTerms: NonNegativeInt,
    uniqueTerms: NonNegativeInt,
  },
  $I.annote("BagOfWordsSuccess", {
    description: "Bag-of-words term-frequency table with total and unique term counts.",
  })
) {}

/**
 * Defines the agent-facing tool contract for computing a bag-of-words
 * term-frequency table from text.
 *
 * **Details**
 *
 * Use this tool when a caller needs normalized term counts for matching,
 * feature generation, or lightweight relevance scoring.
 *
 * **Example** (Decode parameters schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BagOfWords } from "@beep/nlp-processing/Tools/BagOfWords"
 *
 * const parameters = S.decodeUnknownSync(BagOfWords.parametersSchema)({
 *   text: "the cat sat on the mat"
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const BagOfWords = Tool.make("BagOfWords", {
  description: "Compute a bag-of-words term-frequency table from text.",
  failure: AiToolError,
  failureMode: "return",
  parameters: BagOfWordsParameters,
  success: S.toEncoded(BagOfWordsSuccess),
});
