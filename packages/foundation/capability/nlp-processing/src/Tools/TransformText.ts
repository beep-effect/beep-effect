/**
 * TransformText tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/TransformText");
const TransformOperationKit = LiteralKit([
  "lowercase",
  "uppercase",
  "trim",
  "removeHtml",
  "removePunctuation",
  "removeExtraSpaces",
  "removeSpecialChars",
  "retainAlphaNums",
  "removeElisions",
]).annotate(
  $I.annote("TransformOperationKit", {
    description: "LiteralKit backing schema for text transformation operations.",
  })
);
const TransformOperation = TransformOperationKit.pipe(
  $I.annoteSchema("TransformOperation", {
    description: "Supported text transformation operation.",
  }),
  SchemaUtils.withLiteralKitStatics(TransformOperationKit)
);

class TransformTextParameters extends S.Class<TransformTextParameters>($I`TransformTextParameters`)(
  {
    /** Ordered list of transformations to apply */
    operations: S.Array(TransformOperation).annotateKey({
      description: "Ordered list of transformations to apply",
      examples: [["removeHtml", "lowercase", "trim"]],
    }),
    /** The text to transform */
    text: S.String.annotateKey({
      description: "The text to transform",
      examples: ["<b>Hello</b>  WORLD!! "],
    }),
  },
  $I.annote("TransformTextParameters", {
    description: "Inputs required to apply a sequence of text normalization operations.",
  })
) {}

class TransformTextSuccess extends S.Class<TransformTextSuccess>($I`TransformTextSuccess`)(
  {
    /** List of operations that were applied */
    operationsApplied: S.Array(S.String).annotateKey({
      description: "List of operations that were applied",
    }),
    /** The transformed text */
    result: S.String.annotateKey({
      description: "The transformed text",
    }),
  },
  $I.annote("TransformTextSuccess", {
    description: "Transformed text and the ordered operations that were applied.",
  })
) {}

/**
 * Defines the agent-facing tool contract for applying ordered text
 * normalization operations.
 *
 * **Details**
 *
 * Use this tool when a caller needs deterministic cleanup such as lowercasing,
 * trimming, whitespace normalization, punctuation removal, or stop-word
 * removal before another NLP operation.
 *
 * **Example** (Decode transform parameters)
 *
 * ```ts import.meta.vitest name="Decode transform parameters"
 * import * as S from "effect/Schema"
 * import { TransformText } from "@beep/nlp-processing/Tools/TransformText"
 *
 * const parameters = S.decodeUnknownSync(TransformText.parametersSchema)({
 *   operations: ["trim", "lowercase", "removeExtraSpaces"],
 *   text: "  Refund   POLICY  "
 * })
 *
 * parameters.operations
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const TransformText = Tool.make("TransformText", {
  description: "Apply text transformation operations in sequence for cleaning and normalization.",
  failure: AiToolError,
  failureMode: "return",
  parameters: TransformTextParameters,
  success: S.toEncoded(TransformTextSuccess),
});
