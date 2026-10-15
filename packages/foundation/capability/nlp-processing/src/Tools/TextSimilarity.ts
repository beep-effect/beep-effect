/**
 * TextSimilarity tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { SimilarityMethod } from "@beep/nlp/Core/Similarity";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as Tool from "effect/ai/Tool";
import * as S from "effect/Schema";
import { AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/TextSimilarity");

class TextSimilarityParameters extends S.Opaque<TextSimilarityParameters, { readonly brand: unique symbol }>()(
  S.Struct({
    text1: S.String.annotateKey({
      description: "First text to compare",
      examples: ["Cats are wonderful pets."],
    }),
    text2: S.String.annotateKey({
      description: "Second text to compare",
      examples: ["Felines make great companions."],
    }),
  }).pipe(
    $I.annoteSchema("TextSimilarityParameters", {
      description: "Inputs required to compute cosine similarity between two texts.",
    })
  )
) {}

class TextSimilaritySuccess extends S.Opaque<TextSimilaritySuccess, { readonly brand: unique symbol }>()(
  S.Struct({
    method: S.Literal(SimilarityMethod.Enum["vector.cosine"]).annotateKey({
      description: "The similarity method used",
    }),
    score: UnitInterval.annotateKey({
      description: "Similarity score from 0 (unrelated) to 1 (identical)",
    }),
  }).pipe(
    $I.annoteSchema("TextSimilaritySuccess", {
      description: "Cosine similarity score for two text inputs.",
    })
  )
) {}

/**
 * Defines the agent-facing tool contract for comparing two texts with BM25
 * vectorization and cosine similarity.
 *
 * **Details**
 *
 * Use this tool when the caller needs a normalized semantic-ish similarity
 * score for two standalone texts without creating a persistent corpus.
 *
 * **Example** (Decode similarity parameters)
 *
 * ```ts import.meta.vitest name="Decode similarity parameters"
 * import * as S from "effect/Schema"
 * import { TextSimilarity } from "@beep/nlp-processing/Tools/TextSimilarity"
 *
 * const parameters = S.decodeUnknownSync(TextSimilarity.parametersSchema)({
 *   text1: "Cats are wonderful pets.",
 *   text2: "Felines make great companions."
 * })
 *
 * parameters.text1
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const TextSimilarity = Tool.make("TextSimilarity", {
  description:
    "Compute similarity between two texts using BM25 vectorization and cosine similarity. Returns a score from 0 (unrelated) to 1 (identical).",
  failure: AiToolError,
  failureMode: "return",
  parameters: TextSimilarityParameters,
  success: S.toEncoded(TextSimilaritySuccess),
});
