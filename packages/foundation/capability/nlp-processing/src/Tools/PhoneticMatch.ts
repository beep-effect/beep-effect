/**
 * PhoneticMatch tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { PosInt } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiPhoneticAlgorithm, AiPhoneticMatch, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/PhoneticMatch");

class PhoneticMatchParameters extends S.Class<PhoneticMatchParameters>($I`PhoneticMatchParameters`)(
  {
    algorithm: S.optionalKey(AiPhoneticAlgorithm).annotateKey({
      description: "Phonetic algorithm to apply (default: soundex)",
    }),
    minTokenLength: S.optionalKey(PosInt).annotateKey({
      description: "Ignore tokens shorter than this length before encoding (default: 2)",
    }),
    text1: S.String.annotateKey({
      description: "First text to compare phonetically",
      examples: ["Stephen Hawking"],
    }),
    text2: S.String.annotateKey({
      description: "Second text to compare phonetically",
      examples: ["Steven Hocking"],
    }),
  },
  $I.annote("PhoneticMatchParameters", {
    description: "Inputs required to compare two texts by phonetic overlap.",
  })
) {}

/**
 * Defines the agent-facing tool contract for comparing two texts by phonetic
 * encodings.
 *
 * **Details**
 *
 * Use this tool for fuzzy name or phrase matching where spelling differences
 * should still match similar-sounding tokens.
 *
 * **Example** (Decode soundex match parameters)
 *
 * ```ts import.meta.vitest name="Decode soundex match parameters"
 * import * as S from "effect/Schema"
 * import { PhoneticMatch } from "@beep/nlp-processing/Tools/PhoneticMatch"
 *
 * const parameters = S.decodeUnknownSync(PhoneticMatch.parametersSchema)({
 *   algorithm: "soundex",
 *   minTokenLength: 2,
 *   text1: "Stephen Hawking",
 *   text2: "Steven Hocking"
 * })
 *
 * parameters.algorithm
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const PhoneticMatch = Tool.make("PhoneticMatch", {
  description: "Compute phonetic overlap between two texts using Soundex or phonetization.",
  failure: AiToolError,
  failureMode: "return",
  parameters: PhoneticMatchParameters,
  success: S.toEncoded(AiPhoneticMatch),
});
