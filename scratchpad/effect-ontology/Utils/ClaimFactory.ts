/**
 * Claim Factory
 *
 * **Details**
 *
 * Converts Entity and Relation domain models to Claims for provenance tracking.
 * Claims capture individual extracted facts with source attribution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import type { GraphTerm, Literal, NamedNode, ObjectTerm, Quad, Subject } from "@beep/rdf";
import { IRI, makeNamedNode as makeCanonicalNamedNode } from "@beep/rdf";
import { RDF_NAMESPACE, RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_DOUBLE, XSD_INTEGER, XSD_NAMESPACE, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Str as BeepStr } from "@beep/utils";
import { Effect, Equal, Hash, MutableHashMap } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Entity, EvidenceSpan, GroundingDecision, Relation } from "../Domain/Model/Entity.ts";
import {
  EntityObservation,
  GroundingDecision as GroundingDecisionSchema,
  RelationObject,
  RelationObservation,
} from "../Domain/Model/Entity.ts";
import { CLAIMS } from "../Domain/Rdf/Constants.ts";
import { ClaimId } from "../Domain/Schema/KnowledgeModel.ts";
import { CreateClaimInput } from "../Service/Claim.ts";
import { dual2, dual3, dual4 } from "./Dual.ts";
import { buildIri, canonicalLiteral, canonicalQuad } from "./Rdf.ts";

const $I = $ScratchpadId.create("effect-ontology/Utils/ClaimFactory");

// =============================================================================
// Constants
// =============================================================================

const RDF_SUBJECT = makeCanonicalNamedNode(`${RDF_NAMESPACE}subject`);
const RDF_PREDICATE = makeCanonicalNamedNode(`${RDF_NAMESPACE}predicate`);
const RDF_OBJECT = makeCanonicalNamedNode(`${RDF_NAMESPACE}object`);
const XSD_DATE_TIME = makeCanonicalNamedNode(`${XSD_NAMESPACE}dateTime`);
const EXTRACTION_ARTIFACT = makeCanonicalNamedNode(`${CLAIMS.namespace}ExtractionArtifact`);
const SERIALIZED_EXTRACTION_ARTIFACT = makeCanonicalNamedNode(`${CLAIMS.namespace}serializedExtractionArtifact`);

const claimLiteral = (input: { readonly value: string; readonly datatype?: IRI | NamedNode }): Literal =>
  canonicalLiteral({
    value: input.value,
    datatype: O.some(input.datatype ?? XSD_STRING),
  });

const claimQuad = (input: {
  readonly subject: IRI | Subject;
  readonly predicate: IRI | NamedNode;
  readonly object: IRI | ObjectTerm;
  readonly graph: IRI | GraphTerm | undefined;
}): Quad =>
  canonicalQuad({
    subject: input.subject,
    predicate: input.predicate,
    object: input.object,
    graph: O.fromUndefinedOr(input.graph),
  });

const groundingConfidence = (
  decision: GroundingDecision,
  evidenceConfidence: O.Option<Confidence>,
  defaultConfidence: Confidence
): Confidence =>
  GroundingDecisionSchema.match(decision, {
    NotEvaluated: () => O.getOrElse(evidenceConfidence, () => defaultConfidence),
    Supported: ({ confidence }) => confidence,
    Rejected: ({ confidence }) => confidence,
  });

const preferredObservationEvidence = <
  TObservation extends {
    readonly evidence: ReadonlyArray<EvidenceSpan>;
    readonly grounding: GroundingDecision;
  },
>(
  observations: ReadonlyArray<TObservation>
) =>
  O.orElse(
    A.findFirst(observations, (observation) => GroundingDecisionSchema.guards.Supported(observation.grounding)),
    () => A.findFirst(observations, (observation) => GroundingDecisionSchema.guards.NotEvaluated(observation.grounding))
  ).pipe(O.flatMap((observation) => A.head(observation.evidence)));

// =============================================================================
// Types
// =============================================================================

/**
 * Options for claim creation
 *
 * **Example** (Construct claim factory options)
 *
 * ```ts
 * import { ClaimFactoryOptions } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const options = ClaimFactoryOptions.make({
 *   baseNamespace: "https://example.com/entity/",
 *   documentId: "document-1",
 *   ontologyId: "ontology-1"
 * })
 * console.log(options.defaultConfidence) // 0.85
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimFactoryOptions extends S.Class<ClaimFactoryOptions>($I`ClaimFactoryOptions`)(
  {
    baseNamespace: S.NonEmptyString.annotateKey({ description: "Base namespace used to construct entity IRIs." }),
    documentId: S.NonEmptyString.annotateKey({ description: "Source document identifier stored as the article ID." }),
    ontologyId: S.NonEmptyString.annotateKey({ description: "Ontology scope assigned to generated claims." }),
    defaultConfidence: Confidence.pipe(
      SchemaUtils.withKeyDefaults(Confidence.make(0.85)),
      S.annotateKey({ description: "Confidence used when source evidence has no score." })
    ),
  },
  $I.annote("ClaimFactoryOptions", {
    description: "Schema-defaulted namespace, provenance, and confidence policy for generated claims.",
  })
) {}

/**
 * Constructor input accepted by {@link ClaimFactoryOptions}.
 *
 * @see {@link ClaimFactoryOptions} for the runtime schema and default confidence.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimFactoryOptionsInput = (typeof ClaimFactoryOptions)["~type.make.in"];

class IriCollisionEntity extends S.Class<IriCollisionEntity>($I`IriCollisionEntity`)(
  {
    mention: S.NonEmptyString,
    types: S.Array(IRI),
    documentId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    chunkIndex: S.OptionFromOptionalKey(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("IriCollisionEntity", {
    description: "Entity details retained when multiple extracted entities map to the same IRI.",
  })
) {}

/**
 * IRI collision warning - two entities would produce the same IRI
 *
 * **Details**
 *
 * Captures details about colliding entities for debugging and reporting.
 * This happens when two entities have the same ID but different content.
 *
 * **Example** (Construct a collision warning)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { IriCollisionWarning } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const warning = IriCollisionWarning.make({
 *   entityId: "ada_lovelace",
 *   iri: IRI.make("https://example.com/entity/ada_lovelace"),
 *   entities: []
 * })
 * console.log(warning.entityId) // "ada_lovelace"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IriCollisionWarning extends S.Class<IriCollisionWarning>($I`IriCollisionWarning`)(
  {
    entityId: S.NonEmptyString.annotateKey({ description: "Entity identifier shared by colliding records." }),
    iri: IRI.annotateKey({ description: "IRI produced for the colliding entity identifier." }),
    entities: S.Array(IriCollisionEntity).annotateKey({
      description: "Entity records that produced the same IRI.",
    }),
  },
  $I.annote("IriCollisionWarning", {
    description: "Entity records that would silently collapse to the same generated IRI.",
  })
) {}

/**
 * Result of IRI collision detection
 *
 * **Example** (Construct an empty collision report)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { IriCollisionReport } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const report = IriCollisionReport.make({
 *   collisions: [],
 *   totalEntities: NonNegativeInt.make(0),
 *   uniqueEntities: NonNegativeInt.make(0)
 * })
 * console.log(report.hasCollisions) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IriCollisionReport extends S.Class<IriCollisionReport>($I`IriCollisionReport`)(
  {
    collisions: S.Array(IriCollisionWarning).annotateKey({ description: "Detected IRI collisions." }),
    totalEntities: NonNegativeInt.annotateKey({ description: "Entity count before deduplication." }),
    uniqueEntities: NonNegativeInt.annotateKey({ description: "Entity count after grouping by identifier." }),
  },
  $I.annote("IriCollisionReport", {
    description: "Collision inventory and entity counts for generated IRIs.",
  })
) {
  /**
   * Whether the report contains at least one collision.
   *
   * **Example** (Inspect an empty report)
   * ```ts
   * import { NonNegativeInt } from "@beep/schema"
   * import { IriCollisionReport } from "@effect-ontology/Utils/ClaimFactory"
   * const zero = NonNegativeInt.make(0)
   * console.log(IriCollisionReport.make({ collisions: [], totalEntities: zero, uniqueEntities: zero }).hasCollisions)
   * ```
   *
   * @returns `true` when at least one IRI collision was detected.
   */
  get hasCollisions(): boolean {
    return A.isReadonlyArrayNonEmpty(this.collisions);
  }
}

/**
 * Claim data ready for persistence
 *
 * **Details**
 *
 * Extended version of CreateClaimInput with generated claimId
 *
 * **Example** (Construct persisted claim data)
 *
 * ```ts
 * import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan"
 * import { ClaimId } from "@effect-ontology/Schema/KnowledgeModel"
 * import { ClaimData } from "@effect-ontology/Utils/ClaimFactory"
 * import * as S from "effect/Schema"
 *
 * const data = ClaimData.make({
 *   claimId: ClaimId.make("claim-deadbeefcafe"),
 *   subjectIri: "https://example.com/ada",
 *   predicateIri: "https://schema.org/name",
 *   objectValue: "Ada Lovelace",
 *   objectType: "literal",
 *   articleId: "document-1",
 *   ontologyId: "people",
 *   confidence: Confidence.make(0.91)
 * })
 * console.log(data.claimId) // "claim-deadbeefcafe"
 * console.log(S.is(ClaimData)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimData extends S.Class<ClaimData>($I`ClaimData`)(
  {
    ...CreateClaimInput.fields,
    claimId: ClaimId.annotateKey({ description: "Generated claim identifier." }),
  },
  $I.annote("ClaimData", {
    description: "Validated claim creation payload paired with its generated identifier.",
  })
) {}

/**
 * Exact schema-backed payload persisted with one extracted document graph.
 *
 * **Details**
 *
 * The payload is embedded in the RDF artifact so claim persistence does not
 * need to reconstruct lossy domain values from presentation triples.
 *
 * **Example** (Inspect the durable extraction artifact schema)
 * ```ts
 * import * as S from "effect/Schema"
 * import { ClaimExtractionArtifact } from "@effect-ontology/Utils/ClaimFactory"
 *
 * console.log(S.is(ClaimExtractionArtifact)({ claims: [], entityObservations: [], relationObservations: [] }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimExtractionArtifact extends S.Class<ClaimExtractionArtifact>($I`ClaimExtractionArtifact`)(
  {
    claims: S.Array(ClaimData),
    entityObservations: S.Array(EntityObservation),
    relationObservations: S.Array(RelationObservation),
  },
  $I.annote("ClaimExtractionArtifact", {
    description: "Exact durable claims and grounding observations for one extracted document graph.",
  })
) {}

const ClaimExtractionArtifactJson = S.fromJsonString(ClaimExtractionArtifact).pipe(
  SchemaUtils.withEffectCodecStatics,
  $I.annoteSchema("ClaimExtractionArtifactJson", {
    description: "JSON-string wire codec for the exact durable extraction artifact embedded in RDF.",
  })
);

// =============================================================================
// IRI Collision Detection
// =============================================================================

/**
 * Detect IRI collisions in a batch of entities
 *
 * **Details**
 *
 * Finds entities that would produce the same IRI but have different content.
 * This detects cases where two distinct entities would silently merge because
 * they have the same ID (e.g., "john_smith" from two different documents).
 *
 * **Example** (Use detectIriCollisions)
 *
 * ```ts
 * import { detectIriCollisions } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const report = detectIriCollisions([], "https://example.org/")
 * console.log(report.hasCollisions) // false
 * ```
 *
 * @param entities - Iterable of Entity objects
 * @param baseNamespace - Base namespace for IRI construction
 * @returns IriCollisionReport with collision details
 * @category utilities
 * @since 0.0.0
 */
export const detectIriCollisions = dual2((entities: Iterable<Entity>, baseNamespace: string): IriCollisionReport => {
  const entityMap = MutableHashMap.empty<string, Array<Entity>>();
  let totalEntities = 0;

  // Group entities by ID
  for (const entity of entities) {
    totalEntities++;
    O.match(MutableHashMap.get(entityMap, entity.id), {
      onNone: () => MutableHashMap.set(entityMap, entity.id, [entity]),
      onSome: (existing) => MutableHashMap.set(entityMap, entity.id, A.append(existing, entity)),
    });
  }

  // Find collisions (IDs with more than one entity)
  const collisions: Array<IriCollisionWarning> = [];
  for (const [entityId, entityList] of entityMap) {
    if (entityList.length > 1) {
      // Check if they're actually different entities (different types/mentions)
      const isDifferent = A.some(entityList, (e, i) =>
        A.some(
          A.drop(entityList, i + 1),
          (other) => e.mention !== other.mention || A.join(e.types, ",") !== A.join(other.types, ",")
        )
      );

      if (isDifferent) {
        collisions.push({
          entityId,
          iri: buildIri(baseNamespace, entityId),
          entities: A.map(entityList, (e) => ({
            mention: e.mention,
            types: e.types,
            documentId: e.documentId,
            chunkIndex: e.chunkIndex,
          })),
        });
      }
    }
  }

  return IriCollisionReport.make({
    collisions,
    totalEntities: NonNegativeInt.make(totalEntities),
    uniqueEntities: NonNegativeInt.make(MutableHashMap.size(entityMap)),
  });
});

/**
 * Check for IRI collisions and return Effect with warning
 *
 * **Details**
 *
 * Effect-native version that logs warnings for collisions but continues.
 * Use this in pipelines where you want to track collisions without failing.
 *
 * **Example** (Create an empty collision check)
 *
 * ```ts
 * import { checkIriCollisions } from "@effect-ontology/Utils/ClaimFactory"
 * import { Effect } from "effect"
 *
 * const entities = Effect.runSync(checkIriCollisions([], "https://example.com/entity/"))
 * console.log(entities.length) // 0
 * ```
 *
 * @param entities - Array of Entity objects
 * @param baseNamespace - Base namespace for IRI construction
 * @returns Effect that yields the entities with logged warnings
 * @category utilities
 * @since 0.0.0
 */
export const checkIriCollisions = dual2(
  Effect.fn("checkIriCollisions")(function* (
    entities: ReadonlyArray<Entity>,
    baseNamespace: string
  ): Effect.fn.Return<ReadonlyArray<Entity>> {
    const report = detectIriCollisions(entities, baseNamespace);

    if (report.hasCollisions) {
      for (const collision of report.collisions) {
        const mentions = A.join(
          A.map(collision.entities, (entity) => `"${entity.mention}"`),
          ", "
        );
        yield* Effect.logWarning(
          `IRI collision detected for entity '${collision.entityId}': ${collision.entities.length} distinct entities would merge into ${collision.iri}. Mentions: ${mentions}`
        );
      }
    }

    return entities;
  })
);

// =============================================================================
// Claim ID Generation
// =============================================================================

/**
 * Generate a deterministic ClaimId from claim content
 *
 * **Details**
 *
 * Uses content hash to ensure same fact produces same ID (idempotent).
 *
 * **Example** (Generate a stable claim identifier)
 *
 * ```ts
 * import { generateClaimId } from "@effect-ontology/Utils/ClaimFactory"
 *
 * console.log(generateClaimId("https://example.com/ada", "https://schema.org/name", "Ada", "document-1"))
 * ```
 *
 * @param subjectIri - Subject IRI
 * @param predicateIri - Predicate IRI
 * @param objectValue - Object value
 * @param articleId - Source document ID
 * @returns Deterministic ClaimId
 * @category utilities
 * @since 0.0.0
 */
export const generateClaimId = dual4(
  (subjectIri: string, predicateIri: string, objectValue: string, articleId: string): ClaimId => {
    // Create deterministic hash from claim content
    const contentKey = `${subjectIri}|${predicateIri}|${objectValue}|${articleId}`;
    const hash = Math.abs(Hash.string(contentKey)).toString(16).padStart(12, "0");
    return ClaimId.make(`claim-${hash}`);
  }
);

// =============================================================================
// Entity to Claims
// =============================================================================

/**
 * Convert Entity to Claims
 *
 * **Details**
 *
 * Generates claims for:
 * - Each rdf:type assertion
 * - Each attribute (property-value pair)
 *
 * **Example** (Use entityToClaims)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Entity } from "@effect-ontology/Model/Entity"
 * import { entityToClaims } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const entity = S.decodeUnknownOption(Entity)({
 *   id: "cristiano_ronaldo",
 *   mention: "Cristiano Ronaldo",
 *   types: ["https://schema.org/Person", "https://schema.org/Athlete"],
 *   attributes: { "https://schema.org/birthDate": "1985-02-05" }
 * })
 *
 * const claims = O.map(entity, (value) => entityToClaims(value, {
 *   baseNamespace: "https://example.org/",
 *   documentId: "doc-123",
 *   ontologyId: "football"
 * }))
 * console.log(claims)
 * ```
 *
 * @param entity - Entity domain object
 * @param options - Claim factory options
 * @returns Array of ClaimData ready for persistence
 * @category utilities
 * @since 0.0.0
 */
export const entityToClaims = dual2((entity: Entity, options: ClaimFactoryOptionsInput): ReadonlyArray<ClaimData> => {
  if (GroundingDecisionSchema.guards.Rejected(entity.grounding)) {
    return [];
  }
  const claims: Array<ClaimData> = [];
  const { baseNamespace, defaultConfidence, documentId, ontologyId } = ClaimFactoryOptions.make(options);

  // Build subject IRI
  const subjectIri = buildIri(baseNamespace, entity.id);

  // Get evidence from entity mentions (first mention if available)
  const firstMention = O.orElse(preferredObservationEvidence(entity.observations), () => A.head(entity.mentions));
  const evidence = O.map(firstMention, (mention) => ({
    text: mention.quote,
    startOffset: mention.startChar,
    endOffset: mention.endChar,
  }));

  // Confidence from first mention or default
  const confidence = groundingConfidence(
    entity.grounding,
    O.flatMap(firstMention, (mention) => mention.confidence),
    defaultConfidence
  );

  // 1. Create claims for each rdf:type
  for (const typeIri of entity.types) {
    const claimId = generateClaimId(subjectIri, RDF_TYPE.value, typeIri, documentId);

    claims.push({
      claimId,
      subjectIri,
      predicateIri: RDF_TYPE.value,
      objectValue: typeIri,
      objectType: "iri",
      articleId: documentId,
      ontologyId,
      confidence,
      ...(O.isSome(evidence) ? { evidence: evidence.value } : {}),
    });
  }

  // 2. Create claims for each attribute
  for (const [predicateIri, value] of R.toEntries(entity.attributes)) {
    const objectValue = P.isNumber(value)
      ? BeepStr.fromNumber(value)
      : P.isBoolean(value)
        ? Bool.match(value, { onFalse: () => "false", onTrue: () => "true" })
        : value;
    const objectType = P.isString(value) && Str.startsWith("http")(value) ? "iri" : "literal";

    const claimId = generateClaimId(subjectIri, predicateIri, objectValue, documentId);

    claims.push({
      claimId,
      subjectIri,
      predicateIri,
      objectValue,
      objectType,
      articleId: documentId,
      ontologyId,
      confidence,
      ...(O.isSome(evidence) ? { evidence: evidence.value } : {}),
    });
  }

  return claims;
});

// =============================================================================
// Relation to Claim
// =============================================================================

/**
 * Convert Relation to Claim
 *
 * **Details**
 *
 * Generates a single claim for the relationship.
 *
 * **Example** (Use relationToClaim)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Relation } from "@effect-ontology/Model/Entity"
 * import { relationToClaim } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const relation = S.decodeUnknownOption(Relation)({
 *   subjectId: "cristiano_ronaldo",
 *   predicate: "https://schema.org/memberOf",
 *   object: { _tag: "EntityReference", value: "al_nassr_fc" }
 * })
 *
 * const claim = O.map(relation, (value) => relationToClaim(value, {
 *   baseNamespace: "https://example.org/",
 *   documentId: "doc-123",
 *   ontologyId: "football"
 * }))
 * console.log(claim)
 * ```
 *
 * @param relation - Relation domain object
 * @param options - Claim factory options
 * @returns ClaimData ready for persistence
 * @category utilities
 * @since 0.0.0
 */
export const relationToClaim = dual2((relation: Relation, options: ClaimFactoryOptionsInput): ClaimData => {
  const { baseNamespace, defaultConfidence, documentId, ontologyId } = ClaimFactoryOptions.make(options);

  // Build subject IRI
  const subjectIri = buildIri(baseNamespace, relation.subjectId);

  // Build object value (entity reference or literal)
  const [objectValue, objectType] = RelationObject.match(relation.object, {
    EntityReference: ({ value }): readonly [string, "iri" | "literal"] => [buildIri(baseNamespace, value), "iri"],
    Text: ({ value }): readonly [string, "iri" | "literal"] => [value, "literal"],
    Number: ({ value }): readonly [string, "iri" | "literal"] => [BeepStr.fromNumber(value), "literal"],
    Boolean: ({ value }): readonly [string, "iri" | "literal"] => [
      Bool.match(value, { onFalse: () => "false", onTrue: () => "true" }),
      "literal",
    ],
  });

  // Get evidence from relation
  const firstEvidence = O.orElse(preferredObservationEvidence(relation.observations), () => relation.evidence);
  const evidence = O.map(firstEvidence, (span) => ({
    text: span.quote,
    startOffset: span.startChar,
    endOffset: span.endChar,
  }));

  const confidence = groundingConfidence(
    relation.grounding,
    O.flatMap(firstEvidence, (span) => span.confidence),
    defaultConfidence
  );

  const claimId = generateClaimId(subjectIri, relation.predicate, objectValue, documentId);

  return {
    claimId,
    subjectIri,
    predicateIri: relation.predicate,
    objectValue,
    objectType,
    articleId: documentId,
    ontologyId,
    confidence,
    ...(O.isSome(evidence) ? { evidence: evidence.value } : {}),
  };
});

// =============================================================================
// Batch Conversions
// =============================================================================

/**
 * Convert multiple entities to claims
 *
 * **Example** (Convert an empty entity collection)
 *
 * ```ts
 * import { entitiesToClaims } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const claims = entitiesToClaims([], {
 *   baseNamespace: "https://example.com/entity/",
 *   documentId: "document-1",
 *   ontologyId: "ontology-1"
 * })
 * console.log(claims.length) // 0
 * ```
 *
 * @param entities - Iterable of Entity objects
 * @param options - Claim factory options
 * @returns Array of ClaimData
 * @category utilities
 * @since 0.0.0
 */
export const entitiesToClaims = dual2(
  (entities: Iterable<Entity>, options: ClaimFactoryOptionsInput): ReadonlyArray<ClaimData> => {
    const claims: Array<ClaimData> = [];

    for (const entity of entities) {
      const entityClaims = entityToClaims(entity, options);
      for (const claim of entityClaims) {
        claims.push(claim);
      }
    }

    return claims;
  }
);

/**
 * Convert multiple relations to claims
 *
 * **Example** (Convert an empty relation collection)
 *
 * ```ts
 * import { relationsToClaims } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const claims = relationsToClaims([], {
 *   baseNamespace: "https://example.com/entity/",
 *   documentId: "document-1",
 *   ontologyId: "ontology-1"
 * })
 * console.log(claims.length) // 0
 * ```
 *
 * @param relations - Iterable of Relation objects
 * @param options - Claim factory options
 * @returns Array of ClaimData
 * @category utilities
 * @since 0.0.0
 */
export const relationsToClaims = dual2(
  (relations: Iterable<Relation>, options: ClaimFactoryOptionsInput): ReadonlyArray<ClaimData> => {
    const claims: Array<ClaimData> = [];

    for (const relation of relations) {
      if (!GroundingDecisionSchema.guards.Rejected(relation.grounding)) {
        claims.push(relationToClaim(relation, options));
      }
    }

    return claims;
  }
);

/**
 * Convert a KnowledgeGraph (entities + relations) to claims
 *
 * **Example** (Convert an empty graph)
 *
 * ```ts
 * import { knowledgeGraphToClaims } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const claims = knowledgeGraphToClaims([], [], {
 *   baseNamespace: "https://example.com/entity/",
 *   documentId: "document-1",
 *   ontologyId: "ontology-1"
 * })
 * console.log(claims.length) // 0
 * ```
 *
 * @param entities - Iterable of Entity objects
 * @param relations - Iterable of Relation objects
 * @param options - Claim factory options
 * @returns Array of ClaimData for all entities and relations
 * @category utilities
 * @since 0.0.0
 */
export const knowledgeGraphToClaims = dual3(
  (
    entities: Iterable<Entity>,
    relations: Iterable<Relation>,
    options: ClaimFactoryOptionsInput
  ): ReadonlyArray<ClaimData> => [...entitiesToClaims(entities, options), ...relationsToClaims(relations, options)]
);

// =============================================================================
// Claim to RDF Quads (Pure, no DB required)
// =============================================================================

/**
 * Convert a ClaimData to reified RDF quads
 *
 * **Details**
 *
 * Pure function that generates RDF quads without requiring database persistence.
 * Uses the CLAIMS vocabulary for reification.
 *
 * **Example** (Reify one claim)
 *
 * ```ts
 * import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan"
 * import { ClaimId } from "@effect-ontology/Schema/KnowledgeModel"
 * import { claimDataToQuads } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const quads = claimDataToQuads({
 *   claimId: ClaimId.make("claim-abc123def456"),
 *   subjectIri: "https://example.com/ada",
 *   predicateIri: "https://schema.org/name",
 *   objectValue: "Ada",
 *   objectType: "literal",
 *   articleId: "document-1",
 *   ontologyId: "ontology-1",
 *   confidence: Confidence.make(1)
 * }, undefined, undefined)
 * console.log(quads.length > 0) // true
 * ```
 *
 * @param claim - ClaimData to convert
 * @param graphUri - Optional named graph URI
 * @param extractedAt - Extraction timestamp (ISO string)
 * @returns Array of Quad objects
 * @category schemas
 * @since 0.0.0
 */
export const claimDataToQuads = dual3(
  (claim: ClaimData, graphUri: string | undefined, extractedAt: string | undefined): ReadonlyArray<Quad> => {
    const quads: Array<Quad> = [];
    const claimIri = IRI.fromUnknown(`${CLAIMS.namespace}${claim.claimId}`);
    const graph = P.isUndefined(graphUri) ? undefined : IRI.fromUnknown(graphUri);

    // Type assertion: claim:id a claims:Claim
    quads.push(
      claimQuad({
        subject: claimIri,
        predicate: RDF_TYPE,
        object: CLAIMS.Claim,
        graph,
      })
    );

    // RDF reification: rdf:subject
    quads.push(
      claimQuad({
        subject: claimIri,
        predicate: RDF_SUBJECT,
        object: IRI.fromUnknown(claim.subjectIri),
        graph,
      })
    );

    // RDF reification: rdf:predicate
    quads.push(
      claimQuad({
        subject: claimIri,
        predicate: RDF_PREDICATE,
        object: IRI.fromUnknown(claim.predicateIri),
        graph,
      })
    );

    // RDF reification: rdf:object (IRI or Literal)
    const objectTerm =
      claim.objectType === "iri" ? IRI.fromUnknown(claim.objectValue) : claimLiteral({ value: claim.objectValue });

    quads.push(
      claimQuad({
        subject: claimIri,
        predicate: RDF_OBJECT,
        object: objectTerm,
        graph,
      })
    );

    // Rank (default: Normal)
    quads.push(
      claimQuad({
        subject: claimIri,
        predicate: CLAIMS.rank,
        object: CLAIMS.Normal,
        graph,
      })
    );

    // Confidence
    quads.push(
      claimQuad({
        subject: claimIri,
        predicate: CLAIMS.confidence,
        object: claimLiteral({
          value: BeepStr.fromNumber(claim.confidence),
          datatype: XSD_DOUBLE,
        }),
        graph,
      })
    );

    // Extracted at
    if (P.isNotUndefined(extractedAt)) {
      quads.push(
        claimQuad({
          subject: claimIri,
          predicate: CLAIMS.extractedAt,
          object: claimLiteral({
            value: extractedAt,
            datatype: XSD_DATE_TIME,
          }),
          graph,
        })
      );
    }

    // Source article
    quads.push(
      claimQuad({
        subject: claimIri,
        predicate: CLAIMS.statedIn,
        object: IRI.fromUnknown(`${CLAIMS.namespace}article/${claim.articleId}`),
        graph,
      })
    );

    // Evidence
    if (P.isNotUndefined(claim.evidence)) {
      const evidenceIri = IRI.fromUnknown(`${claimIri}/evidence`);

      quads.push(
        claimQuad({
          subject: claimIri,
          predicate: CLAIMS.hasEvidence,
          object: evidenceIri,
          graph,
        })
      );

      quads.push(
        claimQuad({
          subject: evidenceIri,
          predicate: RDF_TYPE,
          object: CLAIMS.Evidence,
          graph,
        })
      );

      quads.push(
        claimQuad({
          subject: evidenceIri,
          predicate: CLAIMS.evidenceText,
          object: claimLiteral({ value: claim.evidence.text }),
          graph,
        })
      );

      quads.push(
        claimQuad({
          subject: evidenceIri,
          predicate: CLAIMS.startOffset,
          object: claimLiteral({
            value: BeepStr.fromNumber(claim.evidence.startOffset),
            datatype: XSD_INTEGER,
          }),
          graph,
        })
      );

      quads.push(
        claimQuad({
          subject: evidenceIri,
          predicate: CLAIMS.endOffset,
          object: claimLiteral({
            value: BeepStr.fromNumber(claim.evidence.endOffset),
            datatype: XSD_INTEGER,
          }),
          graph,
        })
      );
    }

    return quads;
  }
);

/**
 * Convert multiple ClaimData to RDF quads
 *
 * **Example** (Convert no claims)
 *
 * ```ts
 * import { claimsDataToQuads } from "@effect-ontology/Utils/ClaimFactory"
 *
 * console.log(claimsDataToQuads([], undefined, undefined).length) // 0
 * ```
 *
 * @param claims - Array of ClaimData
 * @param graphUri - Optional named graph URI
 * @param extractedAt - Extraction timestamp (ISO string)
 * @returns Array of all quads for all claims
 * @category utilities
 * @since 0.0.0
 */
export const claimsDataToQuads = dual3(
  (
    claims: ReadonlyArray<ClaimData>,
    graphUri: string | undefined,
    extractedAt: string | undefined
  ): ReadonlyArray<Quad> => {
    const allQuads: Array<Quad> = [];

    for (const claim of claims) {
      const quads = claimDataToQuads(claim, graphUri, extractedAt);
      for (const quad of quads) {
        allQuads.push(quad);
      }
    }

    return allQuads;
  }
);

/**
 * Encode the exact extraction artifact as schema-owned RDF payload quads.
 *
 * **Example** (Encode an empty artifact)
 * ```ts
 * import { ClaimExtractionArtifact, claimExtractionArtifactToQuads } from "@effect-ontology/Utils/ClaimFactory"
 * import { Effect } from "effect"
 *
 * const quads = Effect.runSync(
 *   claimExtractionArtifactToQuads(
 *     ClaimExtractionArtifact.make({ claims: [], entityObservations: [], relationObservations: [] }),
 *     "urn:example:graph"
 *   )
 * )
 * console.log(quads.length) // 2
 * ```
 *
 * @see {@link claimExtractionArtifactFromQuads} for decoding the embedded payload.
 * @category codecs
 * @since 0.0.0
 */
export const claimExtractionArtifactToQuads = dual2(
  Effect.fn("ClaimFactory.claimExtractionArtifactToQuads")(function* (
    artifact: ClaimExtractionArtifact,
    graphUri: string
  ) {
    const payload = yield* ClaimExtractionArtifactJson.encodeEffect(artifact);
    const graph = IRI.fromUnknown(graphUri);
    const artifactIri = IRI.fromUnknown(`${graphUri}:extraction-artifact`);
    return [
      claimQuad({
        subject: artifactIri,
        predicate: RDF_TYPE,
        object: EXTRACTION_ARTIFACT,
        graph,
      }),
      claimQuad({
        subject: artifactIri,
        predicate: SERIALIZED_EXTRACTION_ARTIFACT,
        object: claimLiteral({ value: payload }),
        graph,
      }),
    ];
  })
);

/**
 * Decode an exact extraction artifact embedded by {@link claimExtractionArtifactToQuads}.
 *
 * **Details**
 *
 * Absence is represented with `Option` for compatibility with legacy RDF
 * artifacts. Once an artifact marker exists, a missing or malformed payload is
 * a schema failure rather than an empty extraction.
 *
 * **Example** (Decode a legacy graph without an embedded artifact)
 * ```ts
 * import { claimExtractionArtifactFromQuads } from "@effect-ontology/Utils/ClaimFactory"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const decoded = Effect.runSync(claimExtractionArtifactFromQuads([]))
 * console.log(O.isNone(decoded)) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const claimExtractionArtifactFromQuads = Effect.fn("ClaimFactory.claimExtractionArtifactFromQuads")(function* (
  input: Iterable<Quad>
) {
  const quads = A.fromIterable(input);
  const artifactSubject = A.findFirst(
    quads,
    (quad) =>
      Equal.equals(quad.predicate.value, RDF_TYPE.value) &&
      Equal.equals(quad.object.termType, "NamedNode") &&
      Equal.equals(quad.object.value, EXTRACTION_ARTIFACT.value)
  ).pipe(O.map((quad) => quad.subject.value));

  if (O.isNone(artifactSubject)) return O.none<ClaimExtractionArtifact>();

  const payload = A.findFirst(
    quads,
    (quad) =>
      Equal.equals(quad.subject.value, artifactSubject.value) &&
      Equal.equals(quad.predicate.value, SERIALIZED_EXTRACTION_ARTIFACT.value) &&
      Equal.equals(quad.object.termType, "Literal")
  ).pipe(
    O.map((quad) => quad.object.value),
    O.getOrElse(() => "")
  );

  return O.some(yield* ClaimExtractionArtifactJson.decodeEffect(payload));
});
