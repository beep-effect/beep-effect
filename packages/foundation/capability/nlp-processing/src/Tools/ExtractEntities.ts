/**
 * ExtractEntities tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import * as Tool from "effect/ai/Tool";
import * as S from "effect/Schema";
import { AiEntity, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/ExtractEntities");

class ExtractEntitiesParameters extends S.Opaque<ExtractEntitiesParameters, { readonly brand: unique symbol }>()(
  S.Struct({
    includeCustom: S.optionalKey(S.Boolean).annotateKey({
      default: true,
      description: "Include custom entities learned via LearnCustomEntities (default: true)",
    }),
    text: S.String.annotateKey({
      description: "The text to analyze for entities",
      examples: ["Email john@example.com by 2026-01-15. Budget is $1200 for New York."],
    }),
  }).pipe(
    $I.annoteSchema("ExtractEntitiesParameters", {
      description: "Inputs required to extract built-in and optional custom entities from text.",
    })
  )
) {}

class ExtractEntitiesSuccess extends S.Opaque<ExtractEntitiesSuccess, { readonly brand: unique symbol }>()(
  S.Struct({
    allEntities: S.Array(AiEntity).annotateKey({
      description: "Combined built-in and custom entity matches",
    }),
    allEntityCount: S.Natural,
    customEntities: S.Array(AiEntity).annotateKey({
      description: "Custom learned entity matches",
    }),
    customEntityCount: S.Natural,
    customEntityTypes: S.Array(S.String),
    entities: S.Array(AiEntity).annotateKey({
      description: "Built-in entity matches",
    }),
    entityCount: S.Natural,
    entityTypes: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ExtractEntitiesSuccess", {
      description: "Entity extraction result including built-in entities and optional learned custom entities.",
    })
  )
) {}

/**
 * Defines the agent-facing tool contract for extracting built-in and custom
 * named entities from text.
 *
 * **Details**
 *
 * Use this tool when a caller needs entity values, entity types, token
 * boundaries, and character offsets for dates, money, emails, URLs, or learned
 * custom patterns.
 *
 * **Example** (Decode ExtractEntities parameters)
 *
 * ```ts import.meta.vitest name="Decode ExtractEntities parameters"
 * import * as S from "effect/Schema"
 * import { ExtractEntities } from "@beep/nlp-processing/Tools/ExtractEntities"
 *
 * const parameters = S.decodeUnknownSync(ExtractEntities.parametersSchema)({
 *   includeCustom: true,
 *   text: "Email john@example.com before 2026-01-15."
 * })
 *
 * parameters.includeCustom
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const ExtractEntities = Tool.make("ExtractEntities", {
  description: "Extract named entities from text, including optional learned custom entities.",
  failure: AiToolError,
  failureMode: "return",
  parameters: ExtractEntitiesParameters,
  success: S.toEncoded(ExtractEntitiesSuccess),
});
