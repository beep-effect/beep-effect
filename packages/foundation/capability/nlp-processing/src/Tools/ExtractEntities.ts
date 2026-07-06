/**
 * ExtractEntities tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiEntity, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/ExtractEntities");

class ExtractEntitiesParameters extends S.Class<ExtractEntitiesParameters>($I`ExtractEntitiesParameters`)(
  {
    includeCustom: S.optionalKey(S.Boolean).annotateKey({
      default: true,
      description: "Include custom entities learned via LearnCustomEntities (default: true)",
    }),
    text: S.String.annotateKey({
      description: "The text to analyze for entities",
      examples: ["Email john@example.com by 2026-01-15. Budget is $1200 for New York."],
    }),
  },
  $I.annote("ExtractEntitiesParameters", {
    description: "Inputs required to extract built-in and optional custom entities from text.",
  })
) {}

class ExtractEntitiesSuccess extends S.Class<ExtractEntitiesSuccess>($I`ExtractEntitiesSuccess`)(
  {
    allEntities: S.Array(AiEntity).annotateKey({
      description: "Combined built-in and custom entity matches",
    }),
    allEntityCount: NonNegativeInt,
    customEntities: S.Array(AiEntity).annotateKey({
      description: "Custom learned entity matches",
    }),
    customEntityCount: NonNegativeInt,
    customEntityTypes: S.Array(S.String),
    entities: S.Array(AiEntity).annotateKey({
      description: "Built-in entity matches",
    }),
    entityCount: NonNegativeInt,
    entityTypes: S.Array(S.String),
  },
  $I.annote("ExtractEntitiesSuccess", {
    description: "Entity extraction result including built-in entities and optional learned custom entities.",
  })
) {}

/**
 * Defines the agent-facing tool contract for extracting built-in and custom
 * named entities from text.
 *
 * Use this tool when a caller needs entity values, entity types, token
 * boundaries, and character offsets for dates, money, emails, URLs, or learned
 * custom patterns.
 *
 * @example
 * ```ts
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
