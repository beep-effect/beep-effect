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

import type { IRI } from "@beep/rdf";
import { SchemaUtils } from "@beep/schema";
import { MutableHashMap, SchemaGetter } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { EvidenceSpan } from "../Domain/Model/Entity.ts";
import type { ClassDefinition, PropertyDefinition } from "../Domain/Model/Ontology.ts";
import { dual2 } from "../Utils/Dual.ts";
import { buildLocalNameToIriMapSafe, expandLocalNameToIri, extractLocalNameFromIri } from "../Utils/Iri.ts";
import { EmptyVocabularyError } from "./Errors.ts";

// Re-export for convenience
export { EmptyVocabularyError };

/**
 * Helper: Creates a local name schema with case-insensitive validation
 *
 * Accepts local names (e.g., "Player", "Team") and validates them against
 * the allowed class IRIs. LLM outputs local names which are later expanded
 * to full IRIs post-extraction.
 *
 * This approach:
 * 1. Reduces token usage by 60-70% (local names vs full URIs)
 * 2. Provides enum-like constraints to prevent hallucinated classes
 * 3. Handles case mismatches gracefully
 *
 * @internal
 */
const localNameSchema = (
  classIris: ReadonlyArray<IRI>,
  errorType: "classes" | "properties"
): S.Codec<string, string, never, never> => {
  if (A.isReadonlyArrayEmpty(classIris)) {
    throw EmptyVocabularyError.make({
      message: `Cannot create schema with zero ${errorType} IRIs`,
      type: errorType,
    });
  }

  // Build case-insensitive local name to IRI map for validation
  const { map: localNameMap } = buildLocalNameToIriMapSafe(classIris);
  const localNames = classIris.map(extractLocalNameFromIri);

  // Schema that validates local names (case-insensitive) and normalizes to canonical form
  return S.String.pipe(
    S.decodeTo(S.String, {
      decode: SchemaGetter.transform((canonical) => canonical),
      encode: SchemaGetter.transform((input) => {
        // Try to find matching IRI and extract its canonical local name
        const matchedIri = expandLocalNameToIri(input, localNameMap);
        return O.match(matchedIri, {
          onNone: () => input,
          onSome: extractLocalNameFromIri,
        });
      }),
    }),
    S.check(
      S.makeFilter((name) => MutableHashMap.has(localNameMap, name.toLowerCase()), {
        message: `Type must be one of: ${localNames.slice(0, 10).join(", ")}${localNames.length > 10 ? "..." : ""}`,
      })
    ),
    S.annotate({
      description: `Class name (one of: ${localNames.join(", ")})`,
    })
  );
};

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
    const classIris = classes.map((c) => c.id);

    // Create local name schema for types array elements
    // LLM outputs local names (e.g., "Player") which are validated and later expanded to full IRIs
    const ClassLocalName = localNameSchema(classIris, "classes");

    // Determine available property names for description
    const availableProps = datatypeProperties?.map((p) => extractLocalNameFromIri(p.id)) || [];
    const propList =
      availableProps.length > 0
        ? ` (allowed: ${availableProps.slice(0, 10).join(", ")}${availableProps.length > 10 ? "..." : ""})`
        : "";

    // Dynamic Attributes Schema
    // If properties are provided, build a specific Struct to enforce cardinality and valid keys
    let AttributesSchema: S.Codec<Record<string, unknown>, unknown, never, never>;

    if (P.isNotUndefined(datatypeProperties) && datatypeProperties.length > 0) {
      const fields: Record<string, S.Codec<unknown, unknown, never, never>> = {};

      // Build case-insensitive local name map for key normalization
      // const propMap = buildLocalNameToIriMap(datatypeProperties.map((p) => p.id))

      for (const prop of datatypeProperties) {
        const localName = extractLocalNameFromIri(prop.id);

        // Value schema: String, Number, or Boolean
        const valueSchema = S.Union([S.String, S.Finite, S.Boolean]);

        // If functional, use single value. If not functional (or unspecified), allow arrays.
        // Note: We use S.optional for all fields as entities only have a subset of attributes
        fields[localName] = (prop.isFunctional ? valueSchema : S.Union([valueSchema, S.Array(valueSchema)])).pipe(
          S.OptionFromOptionalKey,
          SchemaUtils.withNoneDefault
        );
      }

      AttributesSchema = S.Struct(fields).pipe(
        // We want to handle case-insensitive keys if possible, but Struct expects exact keys.
        // LLMs are usually good with the specified keys.
        // To be safe, we can leave it strict or just allow excess (but we want to guide them).
        // For now, strict Struct with local names is best for token efficiency and enforcement.
        S.annotate({
          title: "Attributes",
          description: `Entity attributes. Use these exact property names:${propList}`,
        })
      );
    } else {
      // Fallback if no properties provided (permissive mode)
      AttributesSchema = S.Record(
        S.String,
        S.Union([S.String, S.Finite, S.Boolean, S.Array(S.Union([S.String, S.Finite, S.Boolean]))])
      ).annotate({
        description: "Entity attributes as property-value pairs",
      });
    }

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
 * Type helpers
 *
 * **Example** (Reference the entity graph schema factory result)
 *
 * ```ts
 * import { makeEntitySchema, type EntityGraphSchema } from "@effect-ontology/Schema/EntityFactory"
 *
 * const entityGraphSchemaFactory: typeof makeEntitySchema = makeEntitySchema
 * const describeEntityGraphSchema = (_schema: EntityGraphSchema): string => "entity graph schema"
 *
 * console.log(entityGraphSchemaFactory.length, describeEntityGraphSchema.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EntityGraphSchema = ReturnType<typeof makeEntitySchema>;

/**
 * Describes the entity graph type data exposed by this module.
 *
 * **Example** (Reference EntityGraphType fields)
 *
 * ```ts
 * import type { EntityGraphType } from "@effect-ontology/Schema/EntityFactory"
 *
 * const entityGraphTypeFields: ReadonlyArray<keyof EntityGraphType> = ["entities"]
 *
 * console.log(entityGraphTypeFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EntityGraphType = S.Schema.Type<EntityGraphSchema>;
