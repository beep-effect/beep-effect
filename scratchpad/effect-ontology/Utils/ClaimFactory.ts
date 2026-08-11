/**
 * Claim Factory
 *
 * Converts Entity and Relation domain models to Claims for provenance tracking.
 * Claims capture individual extracted facts with source attribution.
 *
 * @since 2.0.0
 * @module Utils/ClaimFactory
 */

import { Effect, Hash } from "effect";
import * as A from "effect/Array";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import type { Entity, Relation } from "../Domain/Model/Entity.ts";
import { CLAIMS, RDF, XSD } from "../Domain/Rdf/Constants.ts";
import type { IRI, RdfTerm } from "../Domain/Rdf/Types.ts";
import { Literal, Quad } from "../Domain/Rdf/Types.ts";
import type { ClaimRank } from "../Domain/Schema/KnowledgeModel.ts";
import { ClaimId } from "../Domain/Schema/KnowledgeModel.ts";
import type { CreateClaimInput } from "../Service/Claim.ts";
import { buildIri } from "./Rdf.ts";

// =============================================================================
// Constants
// =============================================================================

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

const claimLiteral = (input: { readonly value: string; readonly datatype?: IRI }): Literal =>
  Literal.make({
    value: input.value,
    language: O.none(),
    datatype: O.fromNullishOr(input.datatype),
  });

const claimQuad = (input: {
  readonly subject: IRI;
  readonly predicate: IRI;
  readonly object: RdfTerm;
  readonly graph: IRI | undefined;
}): Quad =>
  Quad.make({
    subject: input.subject,
    predicate: input.predicate,
    object: input.object,
    graph: O.fromNullishOr(input.graph),
  });

// =============================================================================
// Types
// =============================================================================

/**
 * Options for claim creation
 *
 * @since 2.0.0
 * @category Types
 */
export interface ClaimFactoryOptions {
  /** Base namespace for entity IRIs */
  readonly baseNamespace: string;
  /** Document ID (used as articleId in claims) */
  readonly documentId: string;
  /** Ontology ID for namespace scoping */
  readonly ontologyId: string;
  /** Default confidence score (0-1) */
  readonly defaultConfidence?: number;
  /** Default claim rank */
  readonly defaultRank?: ClaimRank;
}

/**
 * IRI collision warning - two entities would produce the same IRI
 *
 * Captures details about colliding entities for debugging and reporting.
 * This happens when two entities have the same ID but different content.
 *
 * @since 2.0.0
 * @category Types
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
 * @since 2.0.0
 * @category Types
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
 * Extended version of CreateClaimInput with generated claimId
 *
 * @since 2.0.0
 * @category Types
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
 * Finds entities that would produce the same IRI but have different content.
 * This detects cases where two distinct entities would silently merge because
 * they have the same ID (e.g., "john_smith" from two different documents).
 *
 * @param entities - Iterable of Entity objects
 * @param baseNamespace - Base namespace for IRI construction
 * @returns IriCollisionReport with collision details
 *
 * @example
 * ```typescript
 * const report = detectIriCollisions(entities, "http://example.org/")
 * if (report.hasCollisions) {
 *   console.warn(`Found ${report.collisions.length} IRI collisions`)
 *   for (const collision of report.collisions) {
 *     console.warn(`  ${collision.entityId}: ${collision.entities.length} entities`)
 *   }
 * }
 * ```
 *
 * @since 2.0.0
 * @category Validation
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const detectIriCollisions = (entities: Iterable<Entity>, baseNamespace: string): IriCollisionReport => {
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
};

/**
 * Check for IRI collisions and return Effect with warning
 *
 * Effect-native version that logs warnings for collisions but continues.
 * Use this in pipelines where you want to track collisions without failing.
 *
 * @param entities - Array of Entity objects
 * @param baseNamespace - Base namespace for IRI construction
 * @returns Effect that yields the entities with logged warnings
 *
 * @since 2.0.0
 * @category Validation
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const checkIriCollisions = (
  entities: ReadonlyArray<Entity>,
  baseNamespace: string
): Effect.Effect<ReadonlyArray<Entity>> =>
  Effect.gen(function* () {
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
  });

// =============================================================================
// Claim ID Generation
// =============================================================================

/**
 * Generate a deterministic ClaimId from claim content
 *
 * Uses content hash to ensure same fact produces same ID (idempotent).
 *
 * @param subjectIri - Subject IRI
 * @param predicateIri - Predicate IRI
 * @param objectValue - Object value
 * @param articleId - Source document ID
 * @returns Deterministic ClaimId
 *
 * @since 2.0.0
 * @category Constructors
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const generateClaimId = (
  subjectIri: string,
  predicateIri: string,
  objectValue: string,
  articleId: string
): ClaimId => {
  // Create deterministic hash from claim content
  const contentKey = `${subjectIri}|${predicateIri}|${objectValue}|${articleId}`;
  const hash = Math.abs(Hash.string(contentKey)).toString(16).padStart(12, "0");
  return ClaimId.make(`claim-${hash}`);
};

// =============================================================================
// Entity to Claims
// =============================================================================

/**
 * Convert Entity to Claims
 *
 * Generates claims for:
 * - Each rdf:type assertion
 * - Each attribute (property-value pair)
 *
 * @param entity - Entity domain object
 * @param options - Claim factory options
 * @returns Array of ClaimData ready for persistence
 *
 * @example
 * ```typescript
 * const entity = new Entity({
 *   id: "cristiano_ronaldo",
 *   mention: "Cristiano Ronaldo",
 *   types: ["http://schema.org/Person", "http://schema.org/Athlete"],
 *   attributes: { "http://schema.org/birthDate": "1985-02-05" }
 * })
 *
 * const claims = entityToClaims(entity, {
 *   baseNamespace: "http://example.org/",
 *   documentId: "doc-123"
 * })
 * // => [
 * //   { claimId: "claim-...", subjectIri: "http://example.org/cristiano_ronaldo",
 * //     predicateIri: "rdf:type", objectValue: "http://schema.org/Person", ... },
 * //   { claimId: "claim-...", subjectIri: "http://example.org/cristiano_ronaldo",
 * //     predicateIri: "rdf:type", objectValue: "http://schema.org/Athlete", ... },
 * //   { claimId: "claim-...", subjectIri: "http://example.org/cristiano_ronaldo",
 * //     predicateIri: "http://schema.org/birthDate", objectValue: "1985-02-05", ... }
 * // ]
 * ```
 *
 * @since 2.0.0
 * @category Transformations
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const entityToClaims = (entity: Entity, options: ClaimFactoryOptions): ReadonlyArray<ClaimData> => {
  const claims: Array<ClaimData> = [];
  const { baseNamespace, defaultConfidence = 0.85, documentId, ontologyId } = options;

  // Build subject IRI
  const subjectIri = buildIri(baseNamespace, entity.id);

  // Get evidence from entity mentions (first mention if available)
  const firstMention = A.head(entity.mentions);
  const evidence = O.map(firstMention, (mention) => ({
    text: mention.text,
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
    const claimId = generateClaimId(subjectIri, RDF_TYPE, typeIri, documentId);

    claims.push({
      claimId,
      subjectIri,
      predicateIri: RDF_TYPE,
      objectValue: typeIri,
      objectType: "iri",
      articleId: documentId,
      ontologyId,
      confidence,
      ...(O.isSome(evidence) ? { evidence: evidence.value } : {}),
    });
  }

  // 2. Create claims for each attribute
  for (const [predicateIri, value] of Object.entries(entity.attributes)) {
    const objectValue = String(value);
    const objectType = typeof value === "string" && value.startsWith("http") ? "iri" : "literal";

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
};

// =============================================================================
// Relation to Claim
// =============================================================================

/**
 * Convert Relation to Claim
 *
 * Generates a single claim for the relationship.
 *
 * @param relation - Relation domain object
 * @param options - Claim factory options
 * @returns ClaimData ready for persistence
 *
 * @example
 * ```typescript
 * const relation = new Relation({
 *   subjectId: "cristiano_ronaldo",
 *   predicate: "http://schema.org/memberOf",
 *   object: "al_nassr_fc"
 * })
 *
 * const claim = relationToClaim(relation, {
 *   baseNamespace: "http://example.org/",
 *   documentId: "doc-123"
 * })
 * // => { claimId: "claim-...", subjectIri: "http://example.org/cristiano_ronaldo",
 * //      predicateIri: "http://schema.org/memberOf",
 * //      objectValue: "http://example.org/al_nassr_fc", objectType: "iri", ... }
 * ```
 *
 * @since 2.0.0
 * @category Transformations
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const relationToClaim = (relation: Relation, options: ClaimFactoryOptions): ClaimData => {
  const { baseNamespace, defaultConfidence = 0.85, documentId, ontologyId } = options;

  // Build subject IRI
  const subjectIri = buildIri(baseNamespace, relation.subjectId);

  // Build object value (entity reference or literal)
  const [objectValue, objectType] = Match.value(relation.object).pipe(
    Match.tagsExhaustive({
      EntityReference: ({ value }) => [buildIri(baseNamespace, value), "iri"] as const,
      Text: ({ value }) => [value, "literal"] as const,
      Number: ({ value }) => [String(value), "literal"] as const,
      Boolean: ({ value }) => [String(value), "literal"] as const,
    })
  );

  // Get evidence from relation
  const evidence = O.map(relation.evidence, (span) => ({
    text: span.text,
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
};

// =============================================================================
// Batch Conversions
// =============================================================================

/**
 * Convert multiple entities to claims
 *
 * @param entities - Iterable of Entity objects
 * @param options - Claim factory options
 * @returns Array of ClaimData
 *
 * @since 2.0.0
 * @category Transformations
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const entitiesToClaims = (
  entities: Iterable<Entity>,
  options: ClaimFactoryOptions
): ReadonlyArray<ClaimData> => {
  const claims: Array<ClaimData> = [];

  for (const entity of entities) {
    const entityClaims = entityToClaims(entity, options);
    for (const claim of entityClaims) {
      claims.push(claim);
    }
  }

  return claims;
};

/**
 * Convert multiple relations to claims
 *
 * @param relations - Iterable of Relation objects
 * @param options - Claim factory options
 * @returns Array of ClaimData
 *
 * @since 2.0.0
 * @category Transformations
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const relationsToClaims = (
  relations: Iterable<Relation>,
  options: ClaimFactoryOptions
): ReadonlyArray<ClaimData> => {
  const claims: Array<ClaimData> = [];

  for (const relation of relations) {
    claims.push(relationToClaim(relation, options));
  }

  return claims;
};

/**
 * Convert a KnowledgeGraph (entities + relations) to claims
 *
 * @param entities - Iterable of Entity objects
 * @param relations - Iterable of Relation objects
 * @param options - Claim factory options
 * @returns Array of ClaimData for all entities and relations
 *
 * @since 2.0.0
 * @category Transformations
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const knowledgeGraphToClaims = (
  entities: Iterable<Entity>,
  relations: Iterable<Relation>,
  options: ClaimFactoryOptions
): ReadonlyArray<ClaimData> => [...entitiesToClaims(entities, options), ...relationsToClaims(relations, options)];

// =============================================================================
// Claim to RDF Quads (Pure, no DB required)
// =============================================================================

/**
 * Convert a ClaimData to reified RDF quads
 *
 * Pure function that generates RDF quads without requiring database persistence.
 * Uses the CLAIMS vocabulary for reification.
 *
 * @param claim - ClaimData to convert
 * @param graphUri - Optional named graph URI
 * @param extractedAt - Extraction timestamp (ISO string)
 * @returns Array of Quad objects
 *
 * @since 2.0.0
 * @category RDF
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const claimDataToQuads = (claim: ClaimData, graphUri?: string, extractedAt?: string): ReadonlyArray<Quad> => {
  const quads: Array<Quad> = [];
  const claimIri = `${CLAIMS.namespace}${claim.claimId}` as IRI;
  const graph = graphUri as IRI | undefined;

  // Type assertion: claim:id a claims:Claim
  quads.push(
    claimQuad({
      subject: claimIri,
      predicate: RDF.type,
      object: CLAIMS.Claim,
      graph,
    })
  );

  // RDF reification: rdf:subject
  quads.push(
    claimQuad({
      subject: claimIri,
      predicate: RDF.subject,
      object: claim.subjectIri as IRI,
      graph,
    })
  );

  // RDF reification: rdf:predicate
  quads.push(
    claimQuad({
      subject: claimIri,
      predicate: RDF.predicate,
      object: claim.predicateIri as IRI,
      graph,
    })
  );

  // RDF reification: rdf:object (IRI or Literal)
  const objectTerm =
    claim.objectType === "iri" ? (claim.objectValue as IRI) : claimLiteral({ value: claim.objectValue });

  quads.push(
    claimQuad({
      subject: claimIri,
      predicate: RDF.object,
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
        datatype: XSD.double,
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
          datatype: XSD.dateTime,
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
      object: `${CLAIMS.namespace}article/${claim.articleId}` as IRI,
      graph,
    })
  );

  // Evidence
  if (P.isNotUndefined(claim.evidence)) {
    const evidenceIri = `${claimIri}/evidence` as IRI;

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
        predicate: RDF.type,
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
          datatype: XSD.integer,
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
          datatype: XSD.integer,
        }),
        graph,
      })
    );
  }

  return quads;
};

/**
 * Convert multiple ClaimData to RDF quads
 *
 * @param claims - Array of ClaimData
 * @param graphUri - Optional named graph URI
 * @param extractedAt - Extraction timestamp (ISO string)
 * @returns Array of all quads for all claims
 *
 * @since 2.0.0
 * @category RDF
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const claimsDataToQuads = (
  claims: ReadonlyArray<ClaimData>,
  graphUri?: string,
  extractedAt?: string
): ReadonlyArray<Quad> => {
  const allQuads: Array<Quad> = [];

  for (const claim of claims) {
    const quads = claimDataToQuads(claim, graphUri, extractedAt);
    for (const quad of quads) {
      allQuads.push(quad);
    }
  }

  return allQuads;
};
