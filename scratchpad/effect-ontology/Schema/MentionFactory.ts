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

import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Schema/MentionFactory");

/**
 * Entity mention captured before ontology typing.
 *
 * **Example** (Construct a mention)
 *
 * ```ts
 * import { Mention } from "@effect-ontology/Schema/MentionFactory"
 *
 * const mention = Mention.make({ id: "ada_lovelace", mention: "Ada Lovelace" })
 * console.log(mention.id) // "ada_lovelace"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Mention extends S.Class<Mention>($I`Mention`)(
  {
    id: S.String.pipe(
      S.check(
        S.isPattern(/^[a-z][a-z0-9_]*$/, {
          message: "Expected a snake_case mention identifier beginning with a lowercase letter",
        })
      ),
      S.annotateKey({
        description: "Snake_case unique identifier for this entity (e.g., 'cristiano_ronaldo').",
      })
    ),
    mention: S.String.annotateKey({
      description:
        "Human-readable entity name found in text; use the complete canonical form rather than an abbreviation.",
    }),
    context: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({
      description: "Brief source context used to disambiguate the mention.",
    }),
  },
  $I.annote("Mention", {
    description: "Schema-backed entity mention captured before ontology typing.",
  })
) {}

/**
 * Schema for mention extraction (entity detection without typing)
 *
 * **Example** (Decode a mention graph)
 *
 * ```ts
 * import { Mention, MentionGraph } from "@effect-ontology/Schema/MentionFactory"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(MentionGraph)({
 *   mentions: [Mention.make({ id: "ada_lovelace", mention: "Ada Lovelace" })]
 * })
 * console.log(O.map(decoded, (graph) => graph.mentions[0]?.id))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MentionGraph = S.Struct({
  mentions: S.Array(Mention).annotate({
    description: "Array of entity mentions - extract all named entities from the text",
  }),
})
  .annotate({
    identifier: "MentionGraph",
    title: "Entity Mention Extraction",
    description: `Extract all named entity mentions from the text WITHOUT assigning types.

CRITICAL RULES:
- Use complete, human-readable names for mentions (e.g., "Stanford University" not "Stanford")
- Assign unique snake_case IDs (e.g., "stanford_university")
- Reuse the exact same ID when referring to the same entity
- Include brief context about each entity to help with classification
- Extract as many entity mentions as possible`,
  })
  .pipe(
    $I.annoteSchema("MentionGraph", {
      description: "Pre-stage-1 mention graph of snake_case entity mentions extracted before ontology typing.",
    })
  );

/**
 * Decoded mention graph produced by {@link MentionGraph}.
 *
 * @see {@link MentionGraph} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type MentionGraph = typeof MentionGraph.Type;
