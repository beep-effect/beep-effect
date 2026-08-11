/**
 * Mention Schema Factory (Pre-Stage 1)
 *
 * Creates Effect Schemas for mention extraction before entity typing.
 * This enables entity-level semantic search for better class assignment.
 *
 * @module Schema/MentionFactory
 * @since 2.0.0
 */

import { Schema as S } from "effect"
import { SchemaUtils } from "@beep/schema";

/**
 * Schema for a single entity mention (without types)
 *
 * @since 2.0.0
 */
const MentionSchema = S.Struct({
  id: S.String.pipe(
    S.check(S.isPattern(/^[a-z][a-z0-9_]*$/)),
    S.annotate({
      description: "Snake_case unique identifier for this entity (e.g., 'cristiano_ronaldo')"
    })
  ),
  mention: S.String.annotate({
    description:
      "Human-readable entity name found in text - use complete, canonical form (e.g., 'Cristiano Ronaldo' not 'Ronaldo')"
  }),
  context: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
    description: "Brief context about this entity from the text (helps with type classification)"
  })
}).annotate({
  description: "A single entity mention extracted from text"
})

/**
 * Schema for mention extraction (entity detection without typing)
 *
 * @since 2.0.0
 */
export const MentionGraphSchema = S.Struct({
  mentions: S.Array(MentionSchema).annotate({
    description: "Array of entity mentions - extract all named entities from the text"
  })
}).annotate({
  identifier: "MentionGraph",
  title: "Entity Mention Extraction",
  description: `Extract all named entity mentions from the text WITHOUT assigning types.

CRITICAL RULES:
- Use complete, human-readable names for mentions (e.g., "Stanford University" not "Stanford")
- Assign unique snake_case IDs (e.g., "stanford_university")
- Reuse the exact same ID when referring to the same entity
- Include brief context about each entity to help with classification
- Extract as many entity mentions as possible`
})

/**
 * Type helpers
 *
 * @category type utilities
 * @since 2.0.0
 */
export type MentionGraphType = S.Schema.Type<typeof MentionGraphSchema>

export interface Mention {
  readonly id: string
  readonly mention: string
  readonly context?: string
}
