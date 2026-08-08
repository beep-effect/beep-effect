/**
 * Stem tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/Stem");

class StemParameters extends S.Class<StemParameters>($I`StemParameters`)(
  {
    text: S.String.annotateKey({
      description: "The text whose word tokens should be reduced to stems",
      examples: ["running runners ran"],
    }),
  },
  $I.annote("StemParameters", {
    description: "Text input used to reduce word tokens to their stems.",
  })
) {}

class StemSuccess extends S.Class<StemSuccess>($I`StemSuccess`)(
  {
    count: NonNegativeInt,
    stems: S.Array(S.String),
  },
  $I.annote("StemSuccess", {
    description: "Reduce word tokens to their stems.",
  })
) {}

/**
 * Defines the agent-facing tool contract for reducing word tokens to their
 * stems.
 *
 * **Details**
 *
 * Use this tool when a caller needs normalized stem forms for matching,
 * deduplication, or lightweight indexing.
 *
 * **Example** (Decode Stem parametersSchema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Stem } from "@beep/nlp-processing/Tools/Stem"
 *
 * const parameters = S.decodeUnknownSync(Stem.parametersSchema)({
 *   text: "running runners ran"
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const Stem = Tool.make("Stem", {
  description: "Reduce word tokens to their stems.",
  failure: AiToolError,
  failureMode: "return",
  parameters: StemParameters,
  success: S.toEncoded(StemSuccess),
});
