/**
 * Relation Schema Factory (Stage 2)
 *
 * Creates Effect Schemas for relation extraction in the two-stage ODKE pipeline.
 * Stage 2: Extract relationships between entities identified in Stage 1.
 *
 * This schema constrains subject and object references to entity IDs from Stage 1,
 * eliminating identity hallucination and ensuring entity consistency.
 *
 * @module Schema/RelationFactory
 * @since 2.0.0
 */

import { Array as A, MutableHashMap, Option as O, Schema as S, SchemaGetter } from "effect"
import type { PropertyDefinition } from "../Domain/Model/Ontology.ts"
import type { IRI } from "../Domain/Rdf/Types.ts"
import { buildLocalNameToIriMapSafe, expandLocalNameToIri, extractLocalNameFromIri } from "../Utils/Iri.ts"
import { EmptyVocabularyError } from "./Errors.ts"
import { SchemaUtils } from "@beep/schema";

// Re-export for convenience
export { EmptyVocabularyError }

/**
 * Coerce string array to IRI array.
 *
 * PropertyDefinition.id is typed as `string` from Schema parsing,
 * but the values are valid IRIs from ontology. This helper documents
 * the intentional type coercion from string to branded IRI type.
 *
 * @internal
 */
const asIriArray = (ids: ReadonlyArray<string>): ReadonlyArray<IRI> => ids as ReadonlyArray<IRI>

/**
 * Helper: Creates a Union schema from a non-empty array of string literals
 *
 * @internal
 */
const unionFromStringArray = <T extends string>(
  values: ReadonlyArray<T>,
  errorType: "classes" | "properties"
): S.Schema<T> => {
  if (A.isReadonlyArrayEmpty(values)) {
    throw EmptyVocabularyError.make({
      message: `Cannot create schema with zero ${errorType} IRIs`,
      type: errorType
    })
  }

  // Create individual Literal schemas for each IRI
  return S.Literals(values)
}

/**
 * Helper: Creates a local name schema with case-insensitive validation
 *
 * Accepts local names (e.g., "playsFor", "hasTeam") and validates them against
 * the allowed property IRIs. LLM outputs local names which are later expanded
 * to full IRIs post-extraction.
 *
 * This approach:
 * 1. Reduces token usage by 60-70% (local names vs full URIs)
 * 2. Provides enum-like constraints to prevent hallucinated properties
 * 3. Handles case mismatches gracefully
 *
 * @internal
 */
const localNameSchema = (
  propertyIris: ReadonlyArray<IRI>,
  errorType: "classes" | "properties"
): S.Schema<string> => {
  if (A.isReadonlyArrayEmpty(propertyIris)) {
    throw EmptyVocabularyError.make({
      message: `Cannot create schema with zero ${errorType} IRIs`,
      type: errorType
    })
  }

  // Build case-insensitive local name to IRI map for validation
  const { map: localNameMap } = buildLocalNameToIriMapSafe(propertyIris)
  const localNames = propertyIris.map(extractLocalNameFromIri)

  // Schema that validates local names (case-insensitive) and normalizes to canonical form
  return S.String.pipe(
    S.decodeTo(S.String, {
      decode: SchemaGetter.transform((canonical) => canonical),
      encode: SchemaGetter.transform((input) => {
        // Try to find matching IRI and extract its canonical local name
        const matchedIri = expandLocalNameToIri(input, localNameMap)
        return O.match(matchedIri, {
          onNone: () => input,
          onSome: extractLocalNameFromIri
        })
      })
    }),
    S.check(S.makeFilter(
      (name) => MutableHashMap.has(localNameMap, name.toLowerCase()),
      {
        message: `Predicate must be one of: ${localNames.slice(0, 10).join(", ")}${localNames.length > 10 ? "..." : ""}`
      }
    )),
    S.annotate({
      description: `Property name (one of: ${localNames.join(", ")})`
    })
  )
}

/**
 * Creates Effect Schema for relation extraction (Stage 2)
 *
 * This is the second stage of the two-stage ODKE pipeline:
 * 1. Use entities identified in Stage 1
 * 2. Extract relationships between them
 * 3. Constrain subject/object to Stage 1 entity IDs
 *
 * @param validEntityIds - Entity IDs from Stage 1 (constrains subjectId/object)
 * @param properties - Array of PropertyDefinition objects from ontology
 * @returns Relation schema for LLM structured output
 *
 * @example
 * ```typescript
 * const schema = makeRelationSchema(
 *   ["cristiano_ronaldo", "al_nassr"], // From Stage 1
 *   [new PropertyDefinition({ id: "http://schema.org/memberOf", ... })]
 * )
 *
 * // Valid output:
 * {
 *   relations: [
 *     {
 *       subjectId: "cristiano_ronaldo",
 *       predicate: "http://schema.org/memberOf",
 *       object: "al_nassr"
 *     }
 *   ]
 * }
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const makeRelationSchema = (
  validEntityIds: ReadonlyArray<string>,
  properties: ReadonlyArray<PropertyDefinition>
) => {
  if (A.isReadonlyArrayEmpty(validEntityIds)) {
    throw EmptyVocabularyError.make({
      message: "Cannot create relation schema with zero entity IDs from Stage 1",
      type: "classes"
    })
  }

  // Create entity ID union - constrains subjectId and object (when entity reference)
  const EntityIdUnion = unionFromStringArray(validEntityIds, "classes")

  // Group properties by rangeType for predicate-discriminated schemas
  const objectProperties = properties.filter((p) => p.rangeType === "object")
  const datatypeProperties = properties.filter((p) => p.rangeType === "datatype")

  // Create local name schemas for each property type
  // LLM outputs local names (e.g., "playsFor") which are expanded to full IRIs post-extraction
  const ObjectPropertyUnion = objectProperties.length > 0
    ? localNameSchema(asIriArray(objectProperties.map((p) => p.id)), "properties")
    : null
  const DatatypePropertyUnion = datatypeProperties.length > 0
    ? localNameSchema(asIriArray(datatypeProperties.map((p) => p.id)), "properties")
    : null

  // Evidence span schema for provenance tracking
  const EvidenceSpan = S.Struct({
    text: S.String.annotate({
      description: "Exact text span expressing this relation"
    }),
    startChar: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      S.annotate({
        description: "Character offset start (0-indexed)"
      })
    ),
    endChar: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      S.annotate({
        description: "Character offset end (exclusive)"
      })
    ),
    confidence: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
      description: "Extraction confidence (0-1)"
    })
  }).annotate({
    description: "Character-level text evidence for provenance"
  })

  // Create relation schemas discriminated by rangeType
  const relationSchemas: Array<S.Schema<any>> = []

  // Object property relation schema: object must be entity ID only
  if (ObjectPropertyUnion) {
    relationSchemas.push(
      S.Struct({
        subjectId: EntityIdUnion.annotate({
          description: "Subject entity ID - MUST be one of the entity IDs identified in Stage 1"
        }),
        predicate: ObjectPropertyUnion.annotate({
          description: "Object property name (e.g., 'playsFor') - use local name, not full URI"
        }),
        object: EntityIdUnion.annotate({
          description: "Object entity ID from Stage 1 - MUST be one of the identified entities"
        }),
        evidence: EvidenceSpan.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
          description: "Text span where this relation was expressed (include startChar/endChar offsets)"
        })
      }).annotate({
        description: "Object property relation - links two entities"
      })
    )
  }

  // Datatype property relation schema: object must be literal only (NOT entity ID)
  if (DatatypePropertyUnion) {
    relationSchemas.push(
      S.Struct({
        subjectId: EntityIdUnion.annotate({
          description: "Subject entity ID - MUST be one of the entity IDs identified in Stage 1"
        }),
        predicate: DatatypePropertyUnion.annotate({
          description: "Datatype property name (e.g., 'hasAge') - use local name, not full URI"
        }),
        object: S.Union([
          S.String.annotate({
            description: "Literal string value (for datatype properties)"
          }),
          S.Number.annotate({
            description: "Literal number value (for numeric datatype properties)"
          }),
          S.Boolean.annotate({
            description: "Literal boolean value (for boolean datatype properties)"
          })
        ]).annotate({
          description: "Literal value - string, number, or boolean (NOT entity ID)"
        }),
        evidence: EvidenceSpan.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
          description: "Text span where this relation was expressed (include startChar/endChar offsets)"
        })
      }).annotate({
        description: "Datatype property relation - has literal value"
      })
    )
  }

  // Create union of relation schemas (discriminated by predicate rangeType)
  // If only one type exists, use that schema directly
  const RelationSchema = relationSchemas.length === 1
    ? relationSchemas[0]!
    : relationSchemas.length === 2
    ? S.Union([relationSchemas[0]!, relationSchemas[1]!])
    : (() => {
      throw EmptyVocabularyError.make({
        message: "Cannot create relation schema with zero properties",
        type: "properties"
      })
    })()

  // Extract property local names for the description
  const objectPropertyNames = objectProperties.map((p) => extractLocalNameFromIri(p.id))
  const datatypePropertyNames = datatypeProperties.map((p) => extractLocalNameFromIri(p.id))
  const allPropertyNames = [...objectPropertyNames, ...datatypePropertyNames]

  // Full relation graph schema
  return S.Struct({
    relations: S.Array(RelationSchema).annotate({
      description: "Array of relations - extract relationships between the entities identified in Stage 1"
    })
  }).annotate({
    identifier: "RelationGraph",
    title: "Relation Extraction (Stage 2)",
    description: `Extract relationships between entities identified in Stage 1.

CRITICAL RULES:
- Subject MUST be one of the entity IDs from Stage 1: ${validEntityIds.slice(0, 5).join(", ")}${
      validEntityIds.length > 5 ? "..." : ""
    }
- Object can be either:
  - An entity ID from Stage 1 (for relationships between entities)
  - A literal string/number/boolean (for datatype properties)
- Use the exact entity IDs from Stage 1 - do not create new IDs
- Use LOCAL NAMES for predicates (e.g., '${allPropertyNames.slice(0, 3).join("', '")}') - NOT full URIs
- Predicate MUST be one of the allowed property names
- Include evidence with character offsets: text quote, startChar (0-indexed), endChar (exclusive)
- Extract as many relations as possible`
  })
}

/**
 * Type helpers
 *
 * @category type utilities
 * @since 2.0.0
 */
export type RelationGraphSchema = ReturnType<typeof makeRelationSchema>

export type RelationGraphType = S.Schema.Type<RelationGraphSchema>
