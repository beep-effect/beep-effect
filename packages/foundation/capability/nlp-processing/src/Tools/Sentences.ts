/**
 * Sentences tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { annotateFourHints, readOnlyToolHints } from "@beep/mcp-kit";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiSentence, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/Sentences");

class SentencesParameters extends S.Class<SentencesParameters>($I`SentencesParameters`)(
  {
    text: S.String.annotateKey({
      description: "The text to split into sentences",
      examples: ["Hello world. How are you? I am fine."],
    }),
  },
  $I.annote("SentencesParameters", {
    description: "Text input used to split content into sentence segments.",
  })
) {}

class SentencesSuccess extends S.Class<SentencesSuccess>($I`SentencesSuccess`)(
  {
    sentenceCount: S.Finite,
    sentences: S.Array(AiSentence),
  },
  $I.annote("SentencesSuccess", {
    description: "Sentence segmentation result and the total number of detected sentences.",
  })
) {}

/**
 * Defines the agent-facing tool contract for splitting text into sentence
 * records with offsets and token counts.
 *
 * Use this tool before chunking, summarization, or citation workflows that need
 * stable sentence boundaries rather than raw token streams.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Sentences } from "@beep/nlp-processing/Tools/Sentences"
 *
 * const parameters = S.decodeUnknownSync(Sentences.parametersSchema)({
 *   text: "Hello world. How are you?"
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const Sentences = annotateFourHints(
  Tool.make("Sentences", {
  description: "Split text into sentences with token counts and character positions.",
  failure: AiToolError,
  failureMode: "return",
  parameters: SentencesParameters,
  success: S.toEncoded(SentencesSuccess),
  }),
  readOnlyToolHints
);
