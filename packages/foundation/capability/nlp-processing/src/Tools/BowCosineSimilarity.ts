/**
 * BowCosineSimilarity tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { SimilarityMethod } from "@beep/nlp/Core/Similarity";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/BowCosineSimilarity");

class BowCosineSimilarityParameters extends S.Class<BowCosineSimilarityParameters>($I`BowCosineSimilarityParameters`)(
  {
    text1: S.String.annotateKey({
      description: "First text to compare",
      examples: ["Cats are wonderful pets."],
    }),
    text2: S.String.annotateKey({
      description: "Second text to compare",
      examples: ["Felines make great companions."],
    }),
  },
  $I.annote("BowCosineSimilarityParameters", {
    description: "Inputs required to compute bag-of-words cosine similarity between two texts.",
  })
) {}

class BowCosineSimilaritySuccess extends S.Class<BowCosineSimilaritySuccess>($I`BowCosineSimilaritySuccess`)(
  {
    method: S.Literal(SimilarityMethod.Enum["bow.cosine"]).annotateKey({
      description: "The similarity method used",
    }),
    score: UnitInterval.annotateKey({
      description: "Similarity score from 0 (unrelated) to 1 (identical)",
    }),
  },
  $I.annote("BowCosineSimilaritySuccess", {
    description: "Bag-of-words cosine similarity score for two text inputs.",
  })
) {}

/**
 * Defines the agent-facing tool contract for comparing two texts by
 * bag-of-words cosine similarity.
 *
 * **Details**
 *
 * Use this tool when exact lexical overlap matters more than corpus-weighted
 * BM25 similarity, such as duplicate detection or keyword-overlap checks.
 *
 * **Example** (Decode parameters schema)
 *
 * ```ts import.meta.vitest name="Decode parameters schema"
 * import * as S from "effect/Schema"
 * import { BowCosineSimilarity } from "@beep/nlp-processing/Tools/BowCosineSimilarity"
 *
 * const parameters = S.decodeUnknownSync(BowCosineSimilarity.parametersSchema)({
 *   text1: "shipping refund policy",
 *   text2: "refund and shipping rules"
 * })
 *
 * parameters.text2
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const BowCosineSimilarity = Tool.make("BowCosineSimilarity", {
  description:
    "Compute cosine similarity using bag-of-words term frequencies. Returns a score from 0 (unrelated) to 1 (identical token distribution).",
  failure: AiToolError,
  failureMode: "return",
  parameters: BowCosineSimilarityParameters,
  success: S.toEncoded(BowCosineSimilaritySuccess),
});
