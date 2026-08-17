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
import type { GraphTerm, Literal, NamedNode, ObjectTerm, Quad, Subject } from "@beep/rdf";
import { IRI, makeNamedNode as makeCanonicalNamedNode, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf";
import { RDF_NAMESPACE, RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_DOUBLE, XSD_INTEGER, XSD_NAMESPACE, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { Effect, Hash, MutableHashMap } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type { Entity, Relation } from "../Domain/Model/Entity.ts";
import { RelationObject } from "../Domain/Model/Entity.ts";
import { CLAIMS } from "../Domain/Rdf/Constants.ts";
import type { ClaimRank } from "../Domain/Schema/KnowledgeModel.ts";
import { ClaimId } from "../Domain/Schema/KnowledgeModel.ts";
import type { CreateClaimInput } from "../Service/Claim.ts";
import { dual2, dual3, dual4 } from "./Dual.ts";
import { buildIri } from "./Rdf.ts";

// =============================================================================
// Constants
// =============================================================================

const RDF_SUBJECT = makeCanonicalNamedNode(`${RDF_NAMESPACE}subject`);
const RDF_PREDICATE = makeCanonicalNamedNode(`${RDF_NAMESPACE}predicate`);
const RDF_OBJECT = makeCanonicalNamedNode(`${RDF_NAMESPACE}object`);
const XSD_DATE_TIME = makeCanonicalNamedNode(`${XSD_NAMESPACE}dateTime`);

const canonicalNamedNode = (value: IRI | NamedNode): NamedNode => (P.isString(value) ? makeNamedNode(value) : value);

const claimLiteral = (input: { readonly value: string; readonly datatype?: IRI | NamedNode }): Literal =>
  makeLiteral(input.value, canonicalNamedNode(input.datatype ?? XSD_STRING).value);

const claimQuad = (input: {
  readonly subject: IRI | Subject;
  readonly predicate: IRI | NamedNode;
  readonly object: IRI | ObjectTerm;
  readonly graph: IRI | GraphTerm | undefined;
}): Quad => {
  const subject = P.isString(input.subject) ? makeNamedNode(input.subject) : input.subject;
  const predicate = canonicalNamedNode(input.predicate);
  const object = P.isString(input.object) ? makeNamedNode(input.object) : input.object;
  const graph = P.isString(input.graph) ? makeNamedNode(input.graph) : input.graph;
  return P.isUndefined(graph) ? makeQuad(subject, predicate, object) : makeQuad(subject, predicate, { object, graph });
};

// =============================================================================
// Types
// =============================================================================

/**
 * Options for claim creation
 *
 * **Example** (Reference ClaimFactoryOptions fields)
 *
 * ```ts
 * import type { ClaimFactoryOptions } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const claimFactoryOptionsFields: ReadonlyArray<keyof ClaimFactoryOptions> = ["baseNamespace", "documentId", "ontologyId"]
 *
 * console.log(claimFactoryOptionsFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ClaimFactoryOptions {
  /** Base namespace for entity IRIs */
  readonly baseNamespace: string;
  /** Document ID (used as articleId in claims) */
  readonly documentId: string;
  /** Ontology ID for namespace scoping */
  readonly ontologyId: string;
  /** Default confidence score (0-1) */
  readonly defaultConfidence?: Confidence;
  /** Default claim rank */
  readonly defaultRank?: ClaimRank;
}

/**
 * IRI collision warning - two entities would produce the same IRI
 *
 * **Details**
 *
 * Captures details about colliding entities for debugging and reporting.
 * This happens when two entities have the same ID but different content.
 *
 * **Example** (Reference IriCollisionWarning fields)
 *
 * ```ts
 * import type { IriCollisionWarning } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const iriCollisionWarningFields: ReadonlyArray<keyof IriCollisionWarning> = ["entityId", "iri", "entities"]
 *
 * console.log(iriCollisionWarningFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface IriCollisionWarning {
  /** The entity ID that collides */
  readonly entityId: string;
  /** The IRI that would be produced */
  readonly iri: string;
  /** All entities with this ID (first is kept, others are duplicates) */
  readonly entities: ReadonlyArray<{
    readonly mention: string;
    readonly types: ReadonlyArray<string>;
    readonly documentId?: string;
    readonly chunkIndex?: number;
  }>;
}

/**
 * Result of IRI collision detection
 *
 * **Example** (Reference IriCollisionReport fields)
 *
 * ```ts
 * import type { IriCollisionReport } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const iriCollisionReportFields: ReadonlyArray<keyof IriCollisionReport> = ["hasCollisions", "collisions", "totalEntities"]
 *
 * console.log(iriCollisionReportFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface IriCollisionReport {
  /** Whether any collisions were detected */
  readonly hasCollisions: boolean;
  /** List of collision warnings */
  readonly collisions: ReadonlyArray<IriCollisionWarning>;
  /** Total entity count before deduplication */
  readonly totalEntities: number;
  /** Unique entity count after deduplication */
  readonly uniqueEntities: number;
}

/**
 * Claim data ready for persistence
 *
 * **Details**
 *
 * Extended version of CreateClaimInput with generated claimId
 *
 * **Example** (Reference ClaimData fields)
 *
 * ```ts
 * import type { ClaimData } from "@effect-ontology/Utils/ClaimFactory"
 *
 * const claimDataFields: ReadonlyArray<keyof ClaimData> = ["claimId"]
 *
 * console.log(claimDataFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ClaimData extends CreateClaimInput {
  /** Generated claim ID */
  readonly claimId: ClaimId;
}

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
 * const report = detectIriCollisions([], "http://example.org/")
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
            ...(O.isSome(e.documentId) ? { documentId: e.documentId.value } : {}),
            ...(O.isSome(e.chunkIndex) ? { chunkIndex: e.chunkIndex.value } : {}),
          })),
        });
      }
    }
  }

  return {
    hasCollisions: collisions.length > 0,
    collisions,
    totalEntities,
    uniqueEntities: MutableHashMap.size(entityMap),
  };
});

/**
 * Check for IRI collisions and return Effect with warning
 *
 * **Details**
 *
 * Effect-native version that logs warnings for collisions but continues.
 * Use this in pipelines where you want to track collisions without failing.
 *
 * **Example** (Inspect check iri collisions)
 *
 * ```ts
 * import { checkIriCollisions } from "@effect-ontology/Utils/ClaimFactory"
 *
 * console.log(checkIriCollisions)
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
 * **Example** (Inspect generate claim id)
 *
 * ```ts
 * import { generateClaimId } from "@effect-ontology/Utils/ClaimFactory"
 *
 * console.log(generateClaimId)
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
 *   baseNamespace: "http://example.org/",
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
export const entityToClaims = dual2((entity: Entity, options: ClaimFactoryOptions): ReadonlyArray<ClaimData> => {
  const claims: Array<ClaimData> = [];
  const { baseNamespace, defaultConfidence = Confidence.make(0.85), documentId, ontologyId } = options;

  // Build subject IRI
  const subjectIri = buildIri(baseNamespace, entity.id);

  // Get evidence from entity mentions (first mention if available)
  const firstMention = A.head(entity.mentions);
  const evidence = O.map(firstMention, (mention) => ({
    text: mention.quote,
    startOffset: mention.startChar,
    endOffset: mention.endChar,
  }));

  // Confidence from first mention or default
  const confidence = O.getOrElse(
    O.flatMap(firstMention, (mention) => mention.confidence),
    () => defaultConfidence
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
    const objectValue = String(value);
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
 *   baseNamespace: "http://example.org/",
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
export const relationToClaim = dual2((relation: Relation, options: ClaimFactoryOptions): ClaimData => {
  const { baseNamespace, defaultConfidence = Confidence.make(0.85), documentId, ontologyId } = options;

  // Build subject IRI
  const subjectIri = buildIri(baseNamespace, relation.subjectId);

  // Build object value (entity reference or literal)
  const [objectValue, objectType] = RelationObject.match(relation.object, {
    EntityReference: ({ value }): readonly [string, "iri" | "literal"] => [buildIri(baseNamespace, value), "iri"],
    Text: ({ value }): readonly [string, "iri" | "literal"] => [value, "literal"],
    Number: ({ value }): readonly [string, "iri" | "literal"] => [String(value), "literal"],
    Boolean: ({ value }): readonly [string, "iri" | "literal"] => [String(value), "literal"],
  });

  // Get evidence from relation
  const evidence = O.map(relation.evidence, (span) => ({
    text: span.quote,
    startOffset: span.startChar,
    endOffset: span.endChar,
  }));

  const confidence = O.getOrElse(
    O.flatMap(relation.evidence, (span) => span.confidence),
    () => defaultConfidence
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
 * **Example** (Inspect entities to claims)
 *
 * ```ts
 * import { entitiesToClaims } from "@effect-ontology/Utils/ClaimFactory"
 *
 * console.log(entitiesToClaims)
 * ```
 *
 * @param entities - Iterable of Entity objects
 * @param options - Claim factory options
 * @returns Array of ClaimData
 * @category utilities
 * @since 0.0.0
 */
export const entitiesToClaims = dual2(
  (entities: Iterable<Entity>, options: ClaimFactoryOptions): ReadonlyArray<ClaimData> => {
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
 * **Example** (Inspect relations to claims)
 *
 * ```ts
 * import { relationsToClaims } from "@effect-ontology/Utils/ClaimFactory"
 *
 * console.log(relationsToClaims)
 * ```
 *
 * @param relations - Iterable of Relation objects
 * @param options - Claim factory options
 * @returns Array of ClaimData
 * @category utilities
 * @since 0.0.0
 */
export const relationsToClaims = dual2(
  (relations: Iterable<Relation>, options: ClaimFactoryOptions): ReadonlyArray<ClaimData> => {
    const claims: Array<ClaimData> = [];

    for (const relation of relations) {
      claims.push(relationToClaim(relation, options));
    }

    return claims;
  }
);

/**
 * Convert a KnowledgeGraph (entities + relations) to claims
 *
 * **Example** (Inspect knowledge graph to claims)
 *
 * ```ts
 * import { knowledgeGraphToClaims } from "@effect-ontology/Utils/ClaimFactory"
 *
 * console.log(knowledgeGraphToClaims)
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
    options: ClaimFactoryOptions
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
 * **Example** (Inspect claim data to quads)
 *
 * ```ts
 * import { claimDataToQuads } from "@effect-ontology/Utils/ClaimFactory"
 *
 * console.log(claimDataToQuads)
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
          value: String(claim.confidence),
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
            value: String(claim.evidence.startOffset),
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
            value: String(claim.evidence.endOffset),
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
 * **Example** (Inspect claims data to quads)
 *
 * ```ts
 * import { claimsDataToQuads } from "@effect-ontology/Utils/ClaimFactory"
 *
 * console.log(claimsDataToQuads)
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
