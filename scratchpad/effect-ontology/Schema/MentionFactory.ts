/**
 * Mention Schema Factory (Pre-Stage 1)
 *
 * **Details**
 *
 * Creates Effect Schemas for mention extraction before entity typing.
 * This enables entity-level semantic search for better class assignment.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

/**
 * Schema for a single entity mention (without types)
 *
 * @since 0.0.0
 */
const MentionSchema = S.Struct({
  id: S.String.pipe(
    S.check(
      S.isPattern(/^[a-z][a-z0-9_]*$/, {
        message: "Expected a snake_case mention identifier beginning with a lowercase letter",
      })
    ),
    S.annotate({
      description: "Snake_case unique identifier for this entity (e.g., 'cristiano_ronaldo')",
    })
  ),
  mention: S.String.annotate({
    description:
      "Human-readable entity name found in text - use complete, canonical form (e.g., 'Cristiano Ronaldo' not 'Ronaldo')",
  }),
  context: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
    description: "Brief context about this entity from the text (helps with type classification)",
  }),
}).annotate({
  description: "A single entity mention extracted from text",
});

/**
 * Schema for mention extraction (entity detection without typing)
 *
 * **Example** (Validate mention graph schema)
 *
 * ```ts
 * import { MentionGraph } from "@effect-ontology/Schema/MentionFactory"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MentionGraph)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MentionGraph = S.Struct({
  mentions: S.Array(MentionSchema).annotate({
    description: "Array of entity mentions - extract all named entities from the text",
  }),
}).annotate({
  identifier: "MentionGraph",
  title: "Entity Mention Extraction",
  description: `Extract all named entity mentions from the text WITHOUT assigning types.

CRITICAL RULES:
- Use complete, human-readable names for mentions (e.g., "Stanford University" not "Stanford")
- Assign unique snake_case IDs (e.g., "stanford_university")
- Reuse the exact same ID when referring to the same entity
- Include brief context about each entity to help with classification
- Extract as many entity mentions as possible`,
});

/**
 * Type helpers
 *
 * **Example** (Decode MentionGraph)
 *
 * ```ts
 * import { MentionGraph } from "@effect-ontology/Schema/MentionFactory"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeMentionGraph = (_value: MentionGraph): string => "valid mention graph"
 *
 * console.log(O.map(S.decodeUnknownOption(MentionGraph)({}), summarizeMentionGraph))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MentionGraph = typeof MentionGraph.Type;

/**
 * Describes the mention data exposed by this module.
 *
 * **Example** (Reference Mention fields)
 *
 * ```ts
 * import type { Mention } from "@effect-ontology/Schema/MentionFactory"
 *
 * const mentionFields: ReadonlyArray<keyof Mention> = ["id", "mention", "context"]
 *
 * console.log(mentionFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface Mention {
  readonly id: string;
  readonly mention: string;
  readonly context?: string;
}
