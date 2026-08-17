/**
 * Relation Schema Factory (Stage 2)
 *
 * **Details**
 *
 * Creates Effect Schemas for relation extraction in the two-stage ODKE pipeline.
 * Stage 2: Extract relationships between entities identified in Stage 1.
 *
 * This schema constrains subject and object references to entity IDs from Stage 1,
 * eliminating identity hallucination and ensuring entity consistency.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/rdf";
import { SchemaUtils } from "@beep/schema";
import { MutableHashMap, SchemaGetter } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { EvidenceSpan as EvidenceSpanValue } from "../Domain/Model/Entity.ts";
import { EvidenceSpan } from "../Domain/Model/Entity.ts";
import type { PropertyDefinition } from "../Domain/Model/Ontology.ts";
import { dual2 } from "../Utils/Dual.ts";
import { buildLocalNameToIriMapSafe, expandLocalNameToIri, extractLocalNameFromIri } from "../Utils/Iri.ts";

/**
 * Coerce string array to IRI array.
 *
 * PropertyDefinition.id is typed as `string` from Schema parsing,
 * but the values are valid IRIs from ontology. This helper documents
 * the intentional type coercion from string to branded IRI type.
 *
 * @internal
 */
const asIriArray = A.map((value: string) => IRI.make(value));

/**
 * Helper: Creates a Union schema from a non-empty array of string literals
 *
 * @internal
 */
const unionFromStringArray = <T extends string>(values: ReadonlyArray<T>): S.Codec<T, T, never, never> =>
  S.Literals(values);

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
const localNameSchema = (propertyIris: ReadonlyArray<IRI>): S.Codec<string, string, never, never> => {
  // Build case-insensitive local name to IRI map for validation
  const { map: localNameMap } = buildLocalNameToIriMapSafe(propertyIris);
  const localNames = A.map(propertyIris, extractLocalNameFromIri);

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
      S.makeFilter((name) => MutableHashMap.has(localNameMap, Str.toLowerCase(name)), {
        message: `Predicate must be one of: ${A.join(A.take(localNames, 10), ", ")}${A.length(localNames) > 10 ? "..." : ""}`,
      })
    ),
    S.annotate({
      description: `Property name (one of: ${A.join(localNames, ", ")})`,
    })
  );
};

/**
 * Creates Effect Schema for relation extraction (Stage 2)
 *
 * **Details**
 *
 * This is the second stage of the two-stage ODKE pipeline:
 * 1. Use entities identified in Stage 1
 * 2. Extract relationships between them
 * 3. Constrain subject/object to Stage 1 entity IDs
 *
 * **Example** (Use makeRelationSchema)
 *
 * ```ts
 * import { PropertyDefinition } from "@effect-ontology/Model/Ontology"
 * import { makeRelationSchema } from "@effect-ontology/Schema/RelationFactory"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const properties = S.decodeUnknownOption(S.Array(PropertyDefinition))([
 *   {
 *     id: "https://schema.org/memberOf",
 *     label: "member of",
 *     rangeType: "object"
 *   }
 * ])
 * const decoded = O.flatMap(properties, (values) =>
 *   S.decodeUnknownOption(makeRelationSchema(["cristiano_ronaldo", "al_nassr"], values))({
 *     relations: [
 *       {
 *         subjectId: "cristiano_ronaldo",
 *         predicate: "memberOf",
 *         object: "al_nassr"
 *       }
 *     ]
 *   })
 * )
 * console.log(O.isSome(decoded)) // true
 * ```
 *
 * @param validEntityIds - Entity IDs from Stage 1 (constrains subjectId/object)
 * @param properties - Array of PropertyDefinition objects from ontology
 * @returns Relation schema for LLM structured output
 * @category constructors
 * @since 0.0.0
 */
export const makeRelationSchema = dual2(
  (validEntityIds: ReadonlyArray<string>, properties: ReadonlyArray<PropertyDefinition>) => {
    // Create entity ID union - constrains subjectId and object (when entity reference)
    const EntityIdUnion = unionFromStringArray(validEntityIds);

    // Group properties by rangeType for predicate-discriminated schemas
    const objectProperties = A.filter(properties, (property) => property.rangeType === "object");
    const datatypeProperties = A.filter(properties, (property) => property.rangeType === "datatype");

    // Create local name schemas for each property type
    // LLM outputs local names (e.g., "playsFor") which are expanded to full IRIs post-extraction
    const ObjectPropertyUnion = A.match(objectProperties, {
      onEmpty: O.none,
      onNonEmpty: (values) => O.some(localNameSchema(asIriArray(A.map(values, (value) => value.id)))),
    });
    const DatatypePropertyUnion = A.match(datatypeProperties, {
      onEmpty: O.none,
      onNonEmpty: (values) => O.some(localNameSchema(asIriArray(A.map(values, (value) => value.id)))),
    });

    // Create relation schemas discriminated by rangeType
    type RelationOutput = {
      readonly subjectId: string;
      readonly predicate: string;
      readonly object: string | number | boolean;
      readonly evidence: O.Option<EvidenceSpanValue>;
    };

    const relationSchemas: Array<S.Codec<RelationOutput, unknown, never, never>> = A.getSomes([
      O.map(ObjectPropertyUnion, (predicate) =>
        S.Struct({
          subjectId: EntityIdUnion.annotate({
            description: "Subject entity ID - MUST be one of the entity IDs identified in Stage 1",
          }),
          predicate: predicate.annotate({
            description: "Object property name (e.g., 'playsFor') - use local name, not full URI",
          }),
          object: EntityIdUnion.annotate({
            description: "Object entity ID from Stage 1 - MUST be one of the identified entities",
          }),
          evidence: EvidenceSpan.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
            description: "Text span where this relation was expressed (include startChar/endChar offsets)",
          }),
        }).annotate({
          description: "Object property relation - links two entities",
        })
      ),
      O.map(DatatypePropertyUnion, (predicate) =>
        S.Struct({
          subjectId: EntityIdUnion.annotate({
            description: "Subject entity ID - MUST be one of the entity IDs identified in Stage 1",
          }),
          predicate: predicate.annotate({
            description: "Datatype property name (e.g., 'hasAge') - use local name, not full URI",
          }),
          object: S.Union([
            S.String.annotate({
              description: "Literal string value (for datatype properties)",
            }),
            S.Finite.annotate({
              description: "Literal number value (for numeric datatype properties)",
            }),
            S.Boolean.annotate({
              description: "Literal boolean value (for boolean datatype properties)",
            }),
          ]).annotate({
            description: "Literal value - string, number, or boolean (NOT entity ID)",
          }),
          evidence: EvidenceSpan.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
            description: "Text span where this relation was expressed (include startChar/endChar offsets)",
          }),
        }).annotate({
          description: "Datatype property relation - has literal value",
        })
      ),
    ]);

    // An empty member list is the schema-level representation of an impossible
    // relation. Callers may still produce the valid empty relation graph.
    const RelationSchema = S.Union(relationSchemas);

    // Extract property local names for the description
    const objectPropertyNames = A.map(objectProperties, (property) => extractLocalNameFromIri(property.id));
    const datatypePropertyNames = A.map(datatypeProperties, (property) => extractLocalNameFromIri(property.id));
    const allPropertyNames = A.appendAll(objectPropertyNames, datatypePropertyNames);

    // Full relation graph schema
    return S.Struct({
      relations: S.Array(RelationSchema).annotate({
        description: "Array of relations - extract relationships between the entities identified in Stage 1",
      }),
    }).annotate({
      identifier: "RelationGraph",
      title: "Relation Extraction (Stage 2)",
      description: `Extract relationships between entities identified in Stage 1.

CRITICAL RULES:
- Subject MUST be one of the entity IDs from Stage 1: ${A.join(A.take(validEntityIds, 5), ", ")}${
        A.length(validEntityIds) > 5 ? "..." : ""
      }
- Object can be either:
  - An entity ID from Stage 1 (for relationships between entities)
  - A literal string/number/boolean (for datatype properties)
- Use the exact entity IDs from Stage 1 - do not create new IDs
- Use LOCAL NAMES for predicates (e.g., '${A.join(A.take(allPropertyNames, 3), "', '")}') - NOT full URIs
- Predicate MUST be one of the allowed property names
- Include evidence with character offsets: text quote, startChar (0-indexed), endChar (exclusive)
- Extract as many relations as possible`,
    });
  }
);

/**
 * Type helpers
 *
 * **Example** (Reference the relation graph schema factory result)
 *
 * ```ts
 * import { makeRelationSchema, type RelationGraphSchema } from "@effect-ontology/Schema/RelationFactory"
 *
 * const relationGraphSchemaFactory: typeof makeRelationSchema = makeRelationSchema
 * const describeRelationGraphSchema = (_schema: RelationGraphSchema): string => "relation graph schema"
 *
 * console.log(relationGraphSchemaFactory.length, describeRelationGraphSchema.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RelationGraphSchema = ReturnType<typeof makeRelationSchema>;

/**
 * Describes the relation graph type data exposed by this module.
 *
 * **Example** (Reference RelationGraph fields)
 *
 * ```ts
 * import type { RelationGraph } from "@effect-ontology/Schema/RelationFactory"
 *
 * const relationGraphFields: ReadonlyArray<keyof RelationGraph> = ["relations"]
 *
 * console.log(relationGraphFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RelationGraph = S.Schema.Type<RelationGraphSchema>;
