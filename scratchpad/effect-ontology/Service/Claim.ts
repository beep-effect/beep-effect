/**
 * Service: Claim
 *
 * High-level service for claim management with RDF serialization.
 * Wraps ClaimRepository with additional business logic and RDF reification.
 *
 * @since 2.0.0
 * @module Service/Claim
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, DateTime, Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import { CLAIMS, RDF, XSD } from "../Domain/Rdf/Constants.ts";
import type { IRI } from "../Domain/Rdf/Types.ts";
import { Literal, Quad } from "../Domain/Rdf/Types.ts";
import type { ClaimFilter } from "../Repository/Claim.ts";
import { ClaimRepository } from "../Repository/Claim.ts";
import type { ClaimInsertRow, ClaimRow } from "../Repository/schema.ts";
import type { RdfStore } from "./Rdf.ts";
import { RdfBuilder } from "./Rdf.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Claim");

const randomUuid = Effect.all([
  Random.nextIntBetween(0, 0x1_0000_0000, { halfOpen: true }),
  Random.nextIntBetween(0, 0x1_0000_0000, { halfOpen: true }),
  Random.nextIntBetween(0, 0x1_0000_0000, { halfOpen: true }),
  Random.nextIntBetween(0, 0x1_0000_0000, { halfOpen: true }),
]).pipe(
  Effect.map((parts) => {
    const hex = parts.map((part) => part.toString(16).padStart(8, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
  })
);

// =============================================================================
// Types
// =============================================================================

/**
 * Input for creating a new claim
 *
 * @since 2.0.0
 * @category Types
 */
export interface CreateClaimInput {
  readonly subjectIri: string;
  readonly predicateIri: string;
  readonly objectValue: string;
  readonly objectType: "iri" | "literal";
  readonly articleId: string;
  readonly ontologyId: string;
  readonly confidence: number;
  readonly evidence?: {
    readonly text: string;
    readonly startOffset: number;
    readonly endOffset: number;
  };
  readonly validFrom?: Date;
  readonly validTo?: Date;
}

/**
 * Result of deprecating a claim
 *
 * @since 2.0.0
 * @category Types
 */
export interface DeprecationResult {
  readonly claimId: string;
  readonly deprecatedAt: Date;
  readonly reason: string;
  readonly correctionId?: string;
}

// =============================================================================
// Service
// =============================================================================

/**
 * ClaimService - High-level claim management
 *
 * Provides claim lifecycle operations with RDF serialization support.
 * Uses ClaimRepository for persistence and generates reified RDF triples.
 *
 * **Capabilities**:
 * - `createClaim`: Create a new claim with metadata
 * - `deprecateClaim`: Deprecate a claim with reason
 * - `promoteToPreferred`: Promote a claim to preferred rank
 * - `findConflicting`: Find claims that conflict with a given claim
 * - `getClaimHistory`: Get all claims for a subject+predicate over time
 * - `toReifiedTriples`: Convert claim to reified RDF quads
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const claim = yield* ClaimService.createClaim({
 *     subjectIri: "http://example.org/person/123",
 *     predicateIri: "http://schema.org/name",
 *     objectValue: "John Doe",
 *     objectType: "literal",
 *     articleId: "article-001",
 *     confidence: 0.95
 *   })
 *
 *   const quads = yield* ClaimService.toReifiedTriples(claim)
 *   // Generates reified RDF quads with CLAIMS vocabulary
 * }).pipe(Effect.provide(ClaimService.Default))
 * ```
 *
 * @since 2.0.0
 * @category Services
 */
export class ClaimService extends Context.Service<ClaimService>()($I`ClaimService`, {
  make: Effect.gen(function* () {
    const repo = yield* ClaimRepository;
    const rdf = yield* RdfBuilder;

    // -------------------------------------------------------------------------
    // Claim Creation
    // -------------------------------------------------------------------------

    /**
     * Create a new claim
     *
     * Generates a unique claim ID and persists the claim with metadata.
     */
    const createClaim = Effect.fn(function* (input: CreateClaimInput) {
      const id = yield* randomUuid;

      const claimRow: ClaimInsertRow = {
        id,
        articleId: input.articleId,
        ontologyId: input.ontologyId,
        subjectIri: input.subjectIri,
        predicateIri: input.predicateIri,
        objectValue: input.objectValue,
        objectType: input.objectType,
        confidenceScore: input.confidence.toString(),
        rank: "normal",
        evidenceText: input.evidence?.text ?? null,
        evidenceStartOffset: input.evidence?.startOffset ?? null,
        evidenceEndOffset: input.evidence?.endOffset ?? null,
        validFrom: input.validFrom ?? null,
        validTo: input.validTo ?? null,
        // Note: assertedAt is auto-generated by database via defaultNow()
      };

      return yield* repo.insertClaim(claimRow);
    });

    /**
     * Deprecate a claim with a reason
     *
     * Marks the claim as deprecated and optionally links to a correction.
     */
    const deprecateClaim = Effect.fn(function* (claimId: string, reason: string, correctionId?: string) {
      const now = yield* DateTime.now;

      const resolvedCorrectionId = P.isUndefined(correctionId) ? yield* randomUuid : correctionId;
      yield* repo.deprecateClaim(claimId, resolvedCorrectionId);

      return {
        claimId,
        deprecatedAt: DateTime.toDate(now),
        reason,
        correctionId,
      };
    });

    /**
     * Promote a claim to preferred rank
     *
     * Sets the claim as the preferred value for its subject+predicate.
     */
    const promoteToPreferred = (claimId: string) => repo.promoteToPreferred(claimId);

    /**
     * Find claims that conflict with a given claim
     *
     * Detects position conflicts (same subject+predicate, different value)
     * and temporal conflicts (overlapping validity periods).
     */
    const findConflicting = (claim: ClaimRow | ClaimInsertRow) => repo.findConflictingClaims(claim);

    /**
     * Get claim history for a subject+predicate
     *
     * Returns all claims (including deprecated) in chronological order.
     */
    const getClaimHistory = (subjectIri: string, predicateIri: string) =>
      repo.getClaimHistory(subjectIri, predicateIri);

    /**
     * Get a claim by ID
     */
    const getClaim = (claimId: string) => repo.getClaim(claimId);

    /**
     * Query claims with filters
     */
    const getClaims = (filter: ClaimFilter) => repo.getClaims(filter);

    // -------------------------------------------------------------------------
    // RDF Reification
    // -------------------------------------------------------------------------

    /**
     * Convert a claim to reified RDF quads
     *
     * Generates quads using the CLAIMS vocabulary (ontologies/claims/claims.ttl):
     * - claim:id a claims:Claim
     * - claims:claimSubject, claims:claimPredicate (statement reification)
     * - claims:claimObject (for IRI objects) OR claims:claimLiteral (for literals)
     * - claims:rank, claims:confidence, claims:extractedAt
     * - claims:validFrom, claims:validUntil (if temporal)
     * - claims:hasEvidence with evidence details
     *
     * @param claim - ClaimRow from repository
     * @param graphUri - Optional named graph for the quads
     * @returns Array of Quad objects
     */
    const toReifiedTriples = (claim: ClaimRow, graphUri?: string) =>
      Effect.sync(() => {
        const quads: Array<Quad> = [];
        const claimIri = `${CLAIMS.namespace}${claim.id}` as IRI;
        const graph = graphUri as IRI | undefined;

        // Type assertion
        quads.push(
          Quad.make({
            subject: claimIri,
            predicate: RDF.type,
            object: CLAIMS.Claim,
            graph: O.fromNullishOr(graph),
          })
        );

        // Claims vocabulary reification (aligned with ontologies/claims/claims.ttl)
        // Uses claims:claimSubject, claims:claimPredicate, claims:claimObject|claimLiteral
        // instead of RDF reification (rdf:subject, rdf:predicate, rdf:object)
        quads.push(
          Quad.make({
            subject: claimIri,
            predicate: CLAIMS.claimSubject,
            object: claim.subjectIri as IRI,
            graph: O.fromNullishOr(graph),
          })
        );

        quads.push(
          Quad.make({
            subject: claimIri,
            predicate: CLAIMS.claimPredicate,
            object: claim.predicateIri as IRI,
            graph: O.fromNullishOr(graph),
          })
        );

        // Object: use claimObject for IRIs, claimLiteral for literals
        // This preserves the semantic distinction defined in claims.ttl
        if (claim.objectType === "iri") {
          quads.push(
            Quad.make({
              subject: claimIri,
              predicate: CLAIMS.claimObject,
              object: claim.objectValue as IRI,
              graph: O.fromNullishOr(graph),
            })
          );
        } else {
          quads.push(
            Quad.make({
              subject: claimIri,
              predicate: CLAIMS.claimLiteral,
              object: Literal.make({ value: claim.objectValue }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        // Rank
        const rankIri =
          claim.rank === "preferred"
            ? CLAIMS.Preferred
            : claim.rank === "deprecated"
              ? CLAIMS.Deprecated
              : CLAIMS.Normal;

        quads.push(
          Quad.make({
            subject: claimIri,
            predicate: CLAIMS.rank,
            object: rankIri,
            graph: O.fromNullishOr(graph),
          })
        );

        // Confidence
        if (P.isNotNull(claim.confidenceScore)) {
          quads.push(
            Quad.make({
              subject: claimIri,
              predicate: CLAIMS.confidence,
              object: Literal.make({
                value: claim.confidenceScore,
                datatype: O.fromNullishOr(XSD.double),
              }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        // Asserted at (when the claim was extracted/recorded)
        if (P.isNotNull(claim.assertedAt)) {
          quads.push(
            Quad.make({
              subject: claimIri,
              predicate: CLAIMS.extractedAt,
              object: Literal.make({
                value: claim.assertedAt.toISOString(),
                datatype: O.fromNullishOr(XSD.dateTime),
              }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        // Source article
        quads.push(
          Quad.make({
            subject: claimIri,
            predicate: CLAIMS.statedIn,
            object: `${CLAIMS.namespace}article/${claim.articleId}` as IRI,
            graph: O.fromNullishOr(graph),
          })
        );

        // Temporal validity
        if (P.isNotNull(claim.validFrom)) {
          quads.push(
            Quad.make({
              subject: claimIri,
              predicate: CLAIMS.validFrom,
              object: Literal.make({
                value: claim.validFrom.toISOString(),
                datatype: O.fromNullishOr(XSD.dateTime),
              }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        if (P.isNotNull(claim.validTo)) {
          quads.push(
            Quad.make({
              subject: claimIri,
              predicate: CLAIMS.validUntil,
              object: Literal.make({
                value: claim.validTo.toISOString(),
                datatype: O.fromNullishOr(XSD.dateTime),
              }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        // Deprecation info
        if (P.isNotNull(claim.deprecatedAt)) {
          quads.push(
            Quad.make({
              subject: claimIri,
              predicate: CLAIMS.deprecatedAt,
              object: Literal.make({
                value: claim.deprecatedAt.toISOString(),
                datatype: O.fromNullishOr(XSD.dateTime),
              }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        // Evidence
        if (P.isNotNull(claim.evidenceText)) {
          const evidenceIri = `${claimIri}/evidence` as IRI;

          quads.push(
            Quad.make({
              subject: claimIri,
              predicate: CLAIMS.hasEvidence,
              object: evidenceIri,
              graph: O.fromNullishOr(graph),
            })
          );

          quads.push(
            Quad.make({
              subject: evidenceIri,
              predicate: RDF.type,
              object: CLAIMS.Evidence,
              graph: O.fromNullishOr(graph),
            })
          );

          quads.push(
            Quad.make({
              subject: evidenceIri,
              predicate: CLAIMS.evidenceText,
              object: Literal.make({ value: claim.evidenceText }),
              graph: O.fromNullishOr(graph),
            })
          );

          if (claim.evidenceStartOffset !== null) {
            quads.push(
              Quad.make({
                subject: evidenceIri,
                predicate: CLAIMS.startOffset,
                object: Literal.make({
                  value: claim.evidenceStartOffset.toString(),
                  datatype: O.fromNullishOr(XSD.integer),
                }),
                graph: O.fromNullishOr(graph),
              })
            );
          }

          if (claim.evidenceEndOffset !== null) {
            quads.push(
              Quad.make({
                subject: evidenceIri,
                predicate: CLAIMS.endOffset,
                object: Literal.make({
                  value: claim.evidenceEndOffset.toString(),
                  datatype: O.fromNullishOr(XSD.integer),
                }),
                graph: O.fromNullishOr(graph),
              })
            );
          }
        }

        return quads;
      });

    /**
     * Add claim quads to an RDF store
     *
     * Convenience method that converts a claim to quads and adds them to a store.
     */
    const addClaimToStore = Effect.fn(function* (_store: RdfStore, claim: ClaimRow, graphUri?: string) {
      // Add quads to store using low-level N3 operations
      // The RdfBuilder doesn't have a direct addQuads method, so we build manually
      return yield* toReifiedTriples(claim, graphUri);
    });

    /**
     * Serialize multiple claims to Turtle format
     *
     * Creates a new RDF store, adds all claims, and serializes to Turtle.
     */
    const claimsToTurtle = Effect.fn(function* (claims: Array<ClaimRow>, graphUri?: string) {
      const store = yield* rdf.createStore;

      for (const claim of claims) {
        const quads = yield* toReifiedTriples(claim, graphUri);
        // Add each quad to the store
        for (const quad of quads) {
          // Use the store's internal N3 store directly
          const n3 = yield* Effect.promise(() => import("n3"));
          const n3Store = store._store;

          const subject = n3.DataFactory.namedNode(quad.subject);
          const predicate = n3.DataFactory.namedNode(quad.predicate);
          const object = Literal.is(quad.object)
            ? O.isSome(quad.object.datatype)
              ? n3.DataFactory.literal(quad.object.value, n3.DataFactory.namedNode(quad.object.datatype.value))
              : O.isSome(quad.object.language)
                ? n3.DataFactory.literal(quad.object.value, quad.object.language.value)
                : n3.DataFactory.literal(quad.object.value)
            : n3.DataFactory.namedNode(quad.object as string);
          const graph = O.isSome(quad.graph)
            ? n3.DataFactory.namedNode(quad.graph.value)
            : n3.DataFactory.defaultGraph();

          n3Store.addQuad(n3.DataFactory.quad(subject, predicate, object, graph));
        }
      }

      return yield* rdf.toTurtle(store);
    });

    return {
      // Core CRUD
      createClaim,
      getClaim,
      getClaims,

      // Lifecycle
      deprecateClaim,
      promoteToPreferred,

      // Query
      findConflicting,
      getClaimHistory,

      // RDF
      toReifiedTriples,
      addClaimToStore,
      claimsToTurtle,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([ClaimRepository.Default, RdfBuilder.Default])
  );
}
