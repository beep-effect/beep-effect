/**
 * ChunkBySentences tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { NonNegativeInt, PosInt } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiSentenceChunk, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/ChunkBySentences");

class ChunkBySentencesParameters extends S.Class<ChunkBySentencesParameters>($I`ChunkBySentencesParameters`)(
  {
    maxChunkChars: PosInt.annotateKey({
      description:
        "Target maximum number of characters per chunk. If a single sentence exceeds this, it is returned as its own chunk.",
      examples: [PosInt.make(500), PosInt.make(1200), PosInt.make(2000)],
    }),
    text: S.String.annotateKey({
      description: "The text to chunk",
      examples: ["First sentence. Second sentence. Third sentence. Fourth sentence."],
    }),
  },
  $I.annote("ChunkBySentencesParameters", {
    description: "Inputs required to split text into sentence-aligned chunks.",
  })
) {}

class ChunkBySentencesSuccess extends S.Class<ChunkBySentencesSuccess>($I`ChunkBySentencesSuccess`)(
  {
    chunkCount: NonNegativeInt,
    chunks: S.Array(AiSentenceChunk),
    originalSentenceCount: NonNegativeInt,
  },
  $I.annote("ChunkBySentencesSuccess", {
    description: "Sentence-aligned text chunks and their source sentence counts.",
  })
) {}

/**
 * Defines the agent-facing tool contract for splitting text into chunks that
 * preserve sentence boundaries.
 *
 * **Details**
 *
 * Use this tool for retrieval, summarization, or prompt-packing workflows that
 * need bounded chunks without cutting through detected sentences.
 *
 * **Example** (Decode parameters schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ChunkBySentences } from "@beep/nlp-processing/Tools/ChunkBySentences"
 *
 * const parameters = S.decodeUnknownSync(ChunkBySentences.parametersSchema)({
 *   maxChunkChars: 1200,
 *   text: "First sentence. Second sentence. Third sentence."
 * })
 *
 * parameters.maxChunkChars
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const ChunkBySentences = Tool.make("ChunkBySentences", {
  description: "Split text into sentence-aligned chunks, targeting a maximum character size per chunk.",
  failure: AiToolError,
  failureMode: "return",
  parameters: ChunkBySentencesParameters,
  success: S.toEncoded(ChunkBySentencesSuccess),
});
