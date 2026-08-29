/**
 * Tokenize tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { annotateFourHints, readOnlyToolHints } from "@beep/mcp-kit";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiToken, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/Tokenize");

class TokenizeParameters extends S.Class<TokenizeParameters>($I`TokenizeParameters`)(
  {
    text: S.String.annotateKey({
      description: "The text to tokenize",
      examples: ["The quick brown fox jumps over the lazy dog."],
    }),
  },
  $I.annote("TokenizeParameters", {
    description: "Text input used to produce annotated linguistic tokens.",
  })
) {}

class TokenizeSuccess extends S.Class<TokenizeSuccess>($I`TokenizeSuccess`)(
  {
    tokenCount: S.Finite,
    tokens: S.Array(AiToken),
  },
  $I.annote("TokenizeSuccess", {
    description: "Annotated token stream and total token count for an input text.",
  })
) {}

/**
 * Defines the agent-facing tool contract for tokenizing text into annotated
 * linguistic tokens.
 *
 * Use this tool when a caller needs token text, lemmas, stems, part-of-speech
 * tags, stop-word flags, punctuation flags, and character offsets for each
 * token in a document.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Tokenize } from "@beep/nlp-processing/Tools/Tokenize"
 *
 * const parameters = S.decodeUnknownSync(Tokenize.parametersSchema)({
 *   text: "The quick brown fox jumps."
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const Tokenize = annotateFourHints(
  Tool.make("Tokenize", {
  description: "Tokenize text into linguistic tokens with part-of-speech tags, lemmas, and character positions.",
  failure: AiToolError,
  failureMode: "return",
  parameters: TokenizeParameters,
  success: S.toEncoded(TokenizeSuccess),
  }),
  readOnlyToolHints
);
