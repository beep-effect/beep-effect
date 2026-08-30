/**
 * Entity Schema Factory (Stage 1)
 *
 * **Details**
 *
 * Creates Effect Schemas for entity extraction in the two-stage ODKE pipeline.
 * Stage 1: Extract all named entities and map them to ontology classes.
 *
 * This schema ensures entity consistency by requiring unique IDs that will
 * be used in Stage 2 for relation extraction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { EvidenceSpan } from "../Domain/Model/Entity.ts";
import type { ClassDefinition, PropertyDefinition } from "../Domain/Model/Ontology.ts";
import { dual2 } from "../Utils/Dual.ts";
import { extractLocalNameFromIri, makeLocalNameSchema } from "../Utils/Iri.ts";

/**
 * Creates Effect Schema for entity extraction (Stage 1)
 *
 * **Details**
 *
 * This is the first stage of the two-stage ODKE pipeline:
 * 1. Extract all named entities from text
 * 2. Map them to ontology classes
 * 3. Assign unique IDs for Stage 2 linking
 *
 * **Example** (Use makeEntitySchema)
 *
 * ```ts
 * import { ClassDefinition, PropertyDefinition } from "@effect-ontology/Model/Ontology"
 * import { makeEntitySchema } from "@effect-ontology/Schema/EntityFactory"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const ontology = S.decodeUnknownOption(S.Struct({
 *   classes: S.Array(ClassDefinition),
 *   properties: S.Array(PropertyDefinition)
 * }))({
 *   classes: [{ id: "https://schema.org/Person", label: "Person" }],
 *   properties: [{
 *     id: "https://schema.org/age",
 *     label: "age",
 *     rangeType: "datatype"
 *   }]
 * })
 * const decoded = O.flatMap(ontology, ({ classes, properties }) =>
 *   S.decodeUnknownOption(makeEntitySchema(classes, properties))({
 *     entities: [
 *       {
 *         mention: "Cristiano Ronaldo",
 *         id: "cristiano_ronaldo",
 *         types: ["Person"],
 *         attributes: { age: 39 }
 *       }
 *     ]
 *   })
 * )
 * console.log(O.isSome(decoded)) // true
 * ```
 *
 * @param classes - Array of ClassDefinition objects from ontology context
 * @param datatypeProperties - Optional array of datatype properties to constrain attribute keys
 * @returns Entity schema for LLM structured output
 * @category constructors
 * @since 0.0.0
 */
export const makeEntitySchema = dual2(
  (classes: ReadonlyArray<ClassDefinition>, datatypeProperties: ReadonlyArray<PropertyDefinition>) => {
    // Extract class IRIs from ClassDefinition objects
    const classIris = A.map(classes, (classDefinition) => classDefinition.id);

    // Create local name schema for types array elements
    // LLM outputs local names (e.g., "Player") which are validated and later expanded to full IRIs
    const ClassLocalName = makeLocalNameSchema(classIris, "Type", "Class");

    // Determine available property names for description
    const availableProps = A.map(datatypeProperties, (property) => extractLocalNameFromIri(property.id));
    const propList = A.match(availableProps, {
      onEmpty: () => "",
      onNonEmpty: (properties) =>
        ` (allowed: ${A.join(A.take(properties, 10), ", ")}${A.length(properties) > 10 ? "..." : ""})`,
    });

    // Dynamic Attributes Schema
    // If properties are provided, build a specific Struct to enforce cardinality and valid keys
    const valueSchema = S.Union([S.String, S.Finite, S.Boolean]);
    const AttributesSchema: S.Codec<Record<string, unknown>, unknown> = A.match(datatypeProperties, {
      onEmpty: () =>
        S.Record(S.String, S.Union([valueSchema, S.Array(valueSchema)])).annotate({
          description: "Entity attributes as property-value pairs",
        }),
      onNonEmpty: (properties) =>
        S.Struct(
          R.fromEntries(
            A.map(properties, (property) => [
              extractLocalNameFromIri(property.id),
              (property.isFunctional ? valueSchema : S.Union([valueSchema, S.Array(valueSchema)])).pipe(
                S.OptionFromOptionalKey,
                SchemaUtils.withNoneDefault
              ),
            ])
          )
        ).annotate({
          title: "Attributes",
          description: `Entity attributes. Use these exact property names:${propList}`,
        }),
    });

    // Single entity schema matching Entity domain model
    const EntitySchema = S.Struct({
      id: S.String.pipe(
        S.check(
          S.isPattern(/^[a-z][a-z0-9_]*$/, {
            message: "Expected a snake_case entity identifier beginning with a lowercase letter",
          })
        ),
        S.annotate({
          description:
            "Snake_case unique identifier for this entity - use this exact ID when referring to this entity in relations (e.g., 'cristiano_ronaldo')",
        })
      ),
      mention: S.String.annotate({
        description:
          "Human-readable entity name found in text - use complete, canonical form (e.g., 'Cristiano Ronaldo' not 'Ronaldo')",
      }),
      types: S.Array(ClassLocalName).pipe(
        S.check(S.isNonEmpty()),
        S.annotate({
          description:
            "Array of class names (e.g., 'Player', 'Team') - use local names, not full URIs (at least one required)",
        })
      ),
      attributes: AttributesSchema.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
        description: `Entity attributes - use allowed property names${propList}`,
      }),
      mentions: S.Array(EvidenceSpan)
        .pipe(S.check(S.isNonEmpty()), S.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
        .annotate({
          description: "Text spans where this entity appears in source (include startChar/endChar offsets)",
        }),
    }).annotate({
      description: "A single entity with its types, attributes, and evidence spans",
    });

    // Full entity graph schema
    return S.Struct({
      entities: S.Array(EntitySchema).annotate({
        description: "Array of entities - extract all named entities from the text and assign unique IDs",
      }),
    }).annotate({
      identifier: "EntityGraph",
      title: "Entity Extraction (Stage 1)",
      description: `Extract all named entities from the text and map them to ontology classes.

CRITICAL RULES:
- Use complete, human-readable names for mentions (e.g., "Stanford University" not "Stanford")
- Assign unique snake_case IDs (e.g., "stanford_university")
- Reuse the exact same ID when referring to the same entity
- Use LOCAL NAMES for types (e.g., "Player", "Team") - NOT full URIs
- Map each entity to at least one ontology class from the allowed list
- Extract as many entities as possible
- Include character offsets in mentions array: startChar (0-indexed) and endChar (exclusive) for provenance`,
    });
  }
);

/**
 * Runtime schema returned by {@link makeEntitySchema} for Stage-1 entity extraction.
 *
 * @see {@link makeEntitySchema} for constructing the schema from ontology classes.
 * @category type-level
 * @since 0.0.0
 */
export type EntityGraphSchema = ReturnType<typeof makeEntitySchema>;

/**
 * Decoded entity graph produced by {@link makeEntitySchema}.
 *
 * @see {@link makeEntitySchema} for Stage-1 vs Stage-2 shape and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type EntityGraph = S.Schema.Type<EntityGraphSchema>;
