/**
 * LearnCustomEntities tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { annotateFourHints, FourHintAnnotations } from "@beep/mcp-kit";
import { MarkRange } from "@beep/nlp/Core/Pattern";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/LearnCustomEntities");
const LearnCustomEntitiesModeKit = LiteralKit(["append", "replace"]).annotate(
  $I.annote("LearnCustomEntitiesModeKit", {
    description: "LiteralKit backing schema for custom entity learning merge modes.",
  })
);
const LearnCustomEntitiesMode = LearnCustomEntitiesModeKit.pipe(
  $I.annoteSchema("LearnCustomEntitiesMode", {
    description: "How learned custom entities are merged into the current engine state.",
  }),
  SchemaUtils.withLiteralKitStatics(LearnCustomEntitiesModeKit)
);

class LearnCustomEntityDefinition extends S.Class<LearnCustomEntityDefinition>($I`LearnCustomEntityDefinition`)(
  {
    mark: S.optionalKey(MarkRange).annotateKey({
      description: "Optional [start, end] mark range over matched pattern tokens",
    }),
    name: S.String.check(S.isMinLength(1)).annotateKey({
      description: "Custom entity type label such as PERSON_NAME or MONEY_AMOUNT",
    }),
    patterns: S.NonEmptyArray(S.String).annotateKey({
      description: "Ordered bracket-string pattern elements such as [PROPN], [PROPN]",
    }),
  },
  $I.annote("LearnCustomEntityDefinition", {
    description: "One custom entity definition consisting of a name and bracket-string patterns.",
  })
) {}

class LearnCustomEntitiesParameters extends S.Class<LearnCustomEntitiesParameters>($I`LearnCustomEntitiesParameters`)(
  {
    entities: S.NonEmptyArray(LearnCustomEntityDefinition).annotateKey({
      description: "One or more custom entity definitions to learn",
    }),
    groupName: S.optionalKey(S.String.check(S.isMinLength(1))).annotateKey({
      description: "Logical group name for this custom entity set. Defaults to custom-entities.",
    }),
    mode: S.optionalKey(LearnCustomEntitiesMode).annotateKey({
      description: "append merges with existing learned entities; replace overwrites them.",
    }),
  },
  $I.annote("LearnCustomEntitiesParameters", {
    description: "Inputs required to learn custom bracket-string entity patterns into the wink engine.",
  })
) {}

class LearnCustomEntitiesSuccess extends S.Class<LearnCustomEntitiesSuccess>($I`LearnCustomEntitiesSuccess`)(
  {
    entityNames: S.Array(S.String),
    groupName: S.String,
    learnedEntityCount: S.Finite,
    mode: LearnCustomEntitiesMode,
    totalEntityCount: S.Finite,
  },
  $I.annote("LearnCustomEntitiesSuccess", {
    description: "Learning result summary for custom entity definitions.",
  })
) {}

/**
 * Defines the agent-facing tool contract for learning custom entity patterns
 * that augment built-in entity extraction.
 *
 * Use this tool before `ExtractEntities` when a domain needs bracket-token
 * patterns such as `[PROPN]`, `[CARDINAL]`, or `[$]` to identify custom labels.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { LearnCustomEntities } from "@beep/nlp-processing/Tools/LearnCustomEntities"
 *
 * const parameters = S.decodeUnknownSync(LearnCustomEntities.parametersSchema)({
 *   entities: [{ name: "PRODUCT_CODE", patterns: ["[PROPN]", "[CARDINAL]"] }],
 *   groupName: "support-entities",
 *   mode: "append"
 * })
 *
 * parameters.entities[0]?.name
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
// Destructive: `mode: "replace"` overwrites previously learned entities for a
// `groupName`, so the tool as a whole can perform a destructive update even
// though `mode: "append"` (the default) is additive. Not idempotent: repeated
// `append` calls duplicate patterns, and `replace` is only idempotent when the
// caller happens to submit the same entity set every time.
export const LearnCustomEntities = annotateFourHints(
  Tool.make("LearnCustomEntities", {
    description: "Learn custom entity patterns using bracket-string elements such as [PROPN], [CARDINAL], or [$].",
    failure: AiToolError,
    failureMode: "return",
    parameters: LearnCustomEntitiesParameters,
    success: S.toEncoded(LearnCustomEntitiesSuccess),
  }),
  FourHintAnnotations.make({ destructive: true, idempotent: false, openWorld: false, readOnly: false })
);
