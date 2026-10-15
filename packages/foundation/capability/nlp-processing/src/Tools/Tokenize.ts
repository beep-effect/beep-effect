/**
 * Tokenize tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import * as Tool from "effect/ai/Tool";
import * as S from "effect/Schema";
import { AiToken, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/Tokenize");

class TokenizeParameters extends S.Opaque<TokenizeParameters, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.annotateKey({
      description: "The text to tokenize",
      examples: ["The quick brown fox jumps over the lazy dog."],
    }),
  }).pipe(
    $I.annoteSchema("TokenizeParameters", {
      description: "Text input used to produce annotated linguistic tokens.",
    })
  )
) {}

class TokenizeSuccess extends S.Opaque<TokenizeSuccess, { readonly brand: unique symbol }>()(
  S.Struct({
    tokenCount: S.Natural,
    tokens: S.Array(AiToken),
  }).pipe(
    $I.annoteSchema("TokenizeSuccess", {
      description: "Annotated token stream and total token count for an input text.",
    })
  )
) {}

/**
 * Defines the agent-facing tool contract for tokenizing text into annotated
 * linguistic tokens.
 *
 * **Details**
 *
 * Use this tool when a caller needs token text, lemmas, stems, part-of-speech
 * tags, stop-word flags, punctuation flags, and character offsets for each
 * token in a document.
 *
 * **Example** (Decode tokenize parameters)
 *
 * ```ts import.meta.vitest name="Decode tokenize parameters"
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
export const Tokenize = Tool.make("Tokenize", {
  description: "Tokenize text into linguistic tokens with part-of-speech tags, lemmas, and character positions.",
  failure: AiToolError,
  failureMode: "return",
  parameters: TokenizeParameters,
  success: S.toEncoded(TokenizeSuccess),
});
