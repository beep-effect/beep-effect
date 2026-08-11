/**
 * Service: Assertion
 *
 * High-level service for managing curated assertions derived from claims.
 * Assertions represent accepted facts in the knowledge base after curation.
 *
 * @since 2.0.0
 * @module Service/Assertion
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Data, DateTime, Effect, HashMap, Layer, Option, Ref } from "effect";
import * as Clock from "effect/Clock";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import { CLAIMS, PROV, RDF, XSD } from "../Domain/Rdf/Constants.ts";
import type { IRI } from "../Domain/Rdf/Types.ts";
import { Literal, Quad } from "../Domain/Rdf/Types.ts";
import type { AssertionId, AssertionStatus } from "../Domain/Schema/KnowledgeModel.ts";
import { ClaimRepository } from "../Repository/Claim.ts";
import type { ClaimRow } from "../Repository/schema.ts";
import { RdfBuilder } from "./Rdf.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Assertion");

// =============================================================================
// Types
// =============================================================================

/**
 * Input for creating an assertion from claims
 *
 * @since 2.0.0
 * @category Types
 */
export interface CreateAssertionInput {
  /** Claim IDs this assertion is derived from */
  readonly claimIds: ReadonlyArray<string>;
  /** How the assertion was created */
  readonly decision: "accept" | "synthesize" | "manual";
  /** Who curated this assertion */
  readonly curatedBy?: string;
  /** Override the triple values (for synthesize/manual) */
  readonly override?: {
    readonly subject?: string;
    readonly predicate?: string;
    readonly object?: string;
    readonly objectType?: "iri" | "literal";
  };
  /** Confidence score (0-1), defaults to average of source claims */
  readonly confidence?: number;
}

/**
 * Filter for querying assertions
 *
 * @since 2.0.0
 * @category Types
 */
export interface AssertionFilter {
  readonly subjectIri?: string;
  readonly predicateIri?: string;
  readonly status?: AssertionStatus;
  readonly curatedBy?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Assertion with full provenance information
 *
 * @since 2.0.0
 * @category Types
 */
export interface AssertionWithProvenance {
  readonly assertion: AssertionRow;
  readonly sourceClaims: Array<ClaimRow>;
}

/**
 * Internal assertion row type (matches what we store)
 *
 * @since 2.0.0
 * @category Types
 */
export interface AssertionRow {
  readonly id: string;
  readonly subjectIri: string;
  readonly predicateIri: string;
  readonly objectValue: string;
  readonly objectType: "iri" | "literal";
  readonly status: AssertionStatus;
  readonly assertedAt: Date;
  readonly derivedFrom: ReadonlyArray<string>;
  readonly curatedBy: string | null;
  readonly confidence: number;
  readonly validFrom: Date | null;
  readonly validTo: Date | null;
  readonly rejectedAt: Date | null;
  readonly rejectionReason: string | null;
}

/** Typed failure for assertion lifecycle operations. */
export class AssertionError extends Data.TaggedError("AssertionError")<{
  readonly operation: "create" | "reject";
  readonly message: string;
}> {}

// =============================================================================
// Vocabulary Constants for Assertions
// =============================================================================

/**
 * Assertion vocabulary IRIs
 * Extends CLAIMS vocabulary with assertion-specific terms
 */
const ASSERTIONS = {
  namespace: "http://effect-ontology.dev/assertions#",
  Assertion: "http://effect-ontology.dev/assertions#Assertion" as IRI,
  assertedAt: "http://effect-ontology.dev/assertions#assertedAt" as IRI,
  curatedBy: "http://effect-ontology.dev/assertions#curatedBy" as IRI,
  derivedFromClaim: "http://effect-ontology.dev/assertions#derivedFromClaim" as IRI,
  decision: "http://effect-ontology.dev/assertions#decision" as IRI,
  Status: "http://effect-ontology.dev/assertions#Status" as IRI,
  Accepted: "http://effect-ontology.dev/assertions#Accepted" as IRI,
  Rejected: "http://effect-ontology.dev/assertions#Rejected" as IRI,
  Pending: "http://effect-ontology.dev/assertions#Pending" as IRI,
  rejectedAt: "http://effect-ontology.dev/assertions#rejectedAt" as IRI,
  rejectionReason: "http://effect-ontology.dev/assertions#rejectionReason" as IRI,
} as const;

// =============================================================================
// Service
// =============================================================================

/**
 * AssertionService - Curated fact management
 *
 * Provides assertion lifecycle operations for curating claims into accepted facts.
 * Assertions are the canonical facts in the knowledge base after human or automated curation.
 *
 * **Capabilities**:
 * - `createAssertion`: Create assertion from one or more claims
 * - `getAssertion`: Get assertion by ID with provenance
 * - `query`: Query assertions with filters
 * - `getSupportingClaims`: Get claims that support an assertion
 * - `reject`: Soft-delete an assertion with reason
 * - `toTriples`: Convert assertion to RDF quads
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   // Accept a claim as fact
 *   const assertion = yield* AssertionService.createAssertion({
 *     claimIds: ["claim-abc123def456"],
 *     decision: "accept"
 *   })
 *
 *   // Convert to RDF
 *   const quads = yield* AssertionService.toTriples(assertion)
 * }).pipe(Effect.provide(AssertionService.Default))
 * ```
 *
 * @since 2.0.0
 * @category Services
 */
export class AssertionService extends Context.Service<AssertionService>()($I`AssertionService`, {
  make: Effect.gen(function* () {
    const claimRepo = yield* ClaimRepository;

    // In-memory store for assertions (can be replaced with DB repository later)
    const assertionsRef = yield* Ref.make(HashMap.empty<AssertionId, AssertionRow>());

    // -------------------------------------------------------------------------
    // Assertion Creation
    // -------------------------------------------------------------------------

    /**
     * Create an assertion from one or more claims
     *
     * For "accept" decision: Uses the first claim's triple values
     * For "synthesize"/"manual": Uses override values or first claim's values
     */
    const createAssertion = Effect.fn("createAssertion")(function* (input: CreateAssertionInput) {
      const now = yield* DateTime.now;
      const sourceClaims: Array<ClaimRow> = [];
      for (const claimId of input.claimIds) {
        const claim = yield* claimRepo.getClaim(claimId);
        if (Option.isSome(claim)) {
          sourceClaims.push(claim.value);
        }
      }
      if (sourceClaims.length === 0) {
        return yield* new AssertionError({
          operation: "create",
          message: "No valid claims found for assertion",
        });
      }
      const baseClaim = sourceClaims[0];
      const subjectIri = input.override?.subject ?? baseClaim.subjectIri;
      const predicateIri = input.override?.predicate ?? baseClaim.predicateIri;
      const objectValue = input.override?.object ?? baseClaim.objectValue;
      const objectType = input.override?.objectType ?? (baseClaim.objectType as "iri" | "literal") ?? "literal";
      const avgConfidence =
        input.confidence ??
        sourceClaims.reduce((sum, c) => sum + parseFloat(c.confidenceScore ?? "0.5"), 0) / sourceClaims.length;
      const randomSuffix = Math.abs(yield* Random.nextInt)
        .toString(36)
        .slice(0, 6);
      const uniqueSuffix = `${(yield* Clock.currentTimeMillis).toString(36)}${randomSuffix}`;
      const id = `assertion-${uniqueSuffix}` as AssertionId;
      const assertionRow: AssertionRow = {
        id,
        subjectIri,
        predicateIri,
        objectValue,
        objectType,
        status: "accepted",
        assertedAt: DateTime.toDate(now),
        derivedFrom: input.claimIds,
        curatedBy: input.curatedBy ?? null,
        confidence: avgConfidence,
        validFrom: baseClaim.validFrom ?? null,
        validTo: baseClaim.validTo ?? null,
        rejectedAt: null,
        rejectionReason: null,
      };
      yield* Ref.update(assertionsRef, HashMap.set(id, assertionRow));
      return assertionRow;
    });

    /**
     * Get an assertion by ID with full provenance
     */
    const getAssertion = Effect.fn("getAssertion")(function* (id: string) {
      const assertions = yield* Ref.get(assertionsRef);
      const assertion = HashMap.get(assertions, id as AssertionId);
      if (Option.isNone(assertion)) {
        return Option.none<AssertionWithProvenance>();
      }
      const sourceClaims: Array<ClaimRow> = [];
      for (const claimId of assertion.value.derivedFrom) {
        const claim = yield* claimRepo.getClaim(claimId);
        if (Option.isSome(claim)) {
          sourceClaims.push(claim.value);
        }
      }
      return Option.some({
        assertion: assertion.value,
        sourceClaims,
      });
    });

    /**
     * Query assertions with filters
     */
    const query = Effect.fn("query")(function* (filter: AssertionFilter) {
      const assertions = yield* Ref.get(assertionsRef);
      let results = Array.from(HashMap.values(assertions));
      if (P.isNotUndefined(filter.subjectIri)) {
        results = results.filter((a) => a.subjectIri === filter.subjectIri);
      }
      if (P.isNotUndefined(filter.predicateIri)) {
        results = results.filter((a) => a.predicateIri === filter.predicateIri);
      }
      if (P.isNotUndefined(filter.status)) {
        results = results.filter((a) => a.status === filter.status);
      }
      if (P.isNotUndefined(filter.curatedBy)) {
        results = results.filter((a) => a.curatedBy === filter.curatedBy);
      }
      results.sort((a, b) => b.assertedAt.getTime() - a.assertedAt.getTime());
      if (P.isNotUndefined(filter.offset)) {
        results = results.slice(filter.offset);
      }
      if (P.isNotUndefined(filter.limit)) {
        results = results.slice(0, filter.limit);
      }
      return results;
    });

    /**
     * Get claims that support an assertion
     */
    const getSupportingClaims = Effect.fn("getSupportingClaims")(function* (assertionId: string) {
      const assertions = yield* Ref.get(assertionsRef);
      const assertion = HashMap.get(assertions, assertionId as AssertionId);
      if (Option.isNone(assertion)) {
        return [];
      }
      const claims: Array<ClaimRow> = [];
      for (const claimId of assertion.value.derivedFrom) {
        const claim = yield* claimRepo.getClaim(claimId);
        if (Option.isSome(claim)) {
          claims.push(claim.value);
        }
      }
      return claims;
    });

    /**
     * Reject an assertion with reason
     *
     * Soft-deletes the assertion by marking it as rejected.
     */
    const reject = Effect.fn("reject")(function* (assertionId: string, reason: string) {
      const now = yield* DateTime.now;
      const assertions = yield* Ref.get(assertionsRef);
      const assertion = HashMap.get(assertions, assertionId as AssertionId);
      if (Option.isNone(assertion)) {
        return yield* new AssertionError({
          operation: "reject",
          message: `Assertion not found: ${assertionId}`,
        });
      }
      const updated: AssertionRow = {
        ...assertion.value,
        status: "rejected",
        rejectedAt: DateTime.toDate(now),
        rejectionReason: reason,
      };
      yield* Ref.update(assertionsRef, HashMap.set(assertionId as AssertionId, updated));
    });

    // -------------------------------------------------------------------------
    // RDF Serialization
    // -------------------------------------------------------------------------

    /**
     * Convert an assertion to RDF quads
     *
     * Generates quads for:
     * - The assertion itself as a reified statement
     * - Provenance links to source claims
     * - Status, confidence, and curation metadata
     */
    const toTriples = (assertion: AssertionRow, graphUri?: string) =>
      Effect.sync(() => {
        const quads: Array<Quad> = [];
        const assertionIri = `${ASSERTIONS.namespace}${assertion.id}` as IRI;
        const graph = graphUri as IRI | undefined;

        // Type assertion
        quads.push(
          Quad.make({
            subject: assertionIri,
            predicate: RDF.type,
            object: ASSERTIONS.Assertion,
            graph: O.fromNullishOr(graph),
          })
        );

        // RDF reification (the actual triple being asserted)
        quads.push(
          Quad.make({
            subject: assertionIri,
            predicate: RDF.subject,
            object: assertion.subjectIri as IRI,
            graph: O.fromNullishOr(graph),
          })
        );

        quads.push(
          Quad.make({
            subject: assertionIri,
            predicate: RDF.predicate,
            object: assertion.predicateIri as IRI,
            graph: O.fromNullishOr(graph),
          })
        );

        const objectTerm =
          assertion.objectType === "iri"
            ? (assertion.objectValue as IRI)
            : Literal.make({ value: assertion.objectValue });

        quads.push(
          Quad.make({
            subject: assertionIri,
            predicate: RDF.object,
            object: objectTerm,
            graph: O.fromNullishOr(graph),
          })
        );

        // Status
        const statusIri =
          assertion.status === "accepted"
            ? ASSERTIONS.Accepted
            : assertion.status === "rejected"
              ? ASSERTIONS.Rejected
              : ASSERTIONS.Pending;

        quads.push(
          Quad.make({
            subject: assertionIri,
            predicate: CLAIMS.claimStatus,
            object: statusIri,
            graph: O.fromNullishOr(graph),
          })
        );

        // Confidence
        quads.push(
          Quad.make({
            subject: assertionIri,
            predicate: CLAIMS.confidence,
            object: Literal.make({
              value: assertion.confidence.toString(),
              datatype: O.fromNullishOr(XSD.double),
            }),
            graph: O.fromNullishOr(graph),
          })
        );

        // Asserted at
        quads.push(
          Quad.make({
            subject: assertionIri,
            predicate: ASSERTIONS.assertedAt,
            object: Literal.make({
              value: assertion.assertedAt.toISOString(),
              datatype: O.fromNullishOr(XSD.dateTime),
            }),
            graph: O.fromNullishOr(graph),
          })
        );

        // Curated by
        if (P.isNotNull(assertion.curatedBy)) {
          quads.push(
            Quad.make({
              subject: assertionIri,
              predicate: ASSERTIONS.curatedBy,
              object: Literal.make({ value: assertion.curatedBy }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        // Derived from claims (provenance)
        for (const claimId of assertion.derivedFrom) {
          quads.push(
            Quad.make({
              subject: assertionIri,
              predicate: ASSERTIONS.derivedFromClaim,
              object: `${CLAIMS.namespace}${claimId}` as IRI,
              graph: O.fromNullishOr(graph),
            })
          );
        }

        // PROV-O provenance
        quads.push(
          Quad.make({
            subject: assertionIri,
            predicate: PROV.generatedAtTime,
            object: Literal.make({
              value: assertion.assertedAt.toISOString(),
              datatype: O.fromNullishOr(XSD.dateTime),
            }),
            graph: O.fromNullishOr(graph),
          })
        );

        // Temporal validity
        if (P.isNotNull(assertion.validFrom)) {
          quads.push(
            Quad.make({
              subject: assertionIri,
              predicate: CLAIMS.validFrom,
              object: Literal.make({
                value: assertion.validFrom.toISOString(),
                datatype: O.fromNullishOr(XSD.dateTime),
              }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        if (P.isNotNull(assertion.validTo)) {
          quads.push(
            Quad.make({
              subject: assertionIri,
              predicate: CLAIMS.validUntil,
              object: Literal.make({
                value: assertion.validTo.toISOString(),
                datatype: O.fromNullishOr(XSD.dateTime),
              }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        // Rejection info
        if (P.isNotNull(assertion.rejectedAt)) {
          quads.push(
            Quad.make({
              subject: assertionIri,
              predicate: ASSERTIONS.rejectedAt,
              object: Literal.make({
                value: assertion.rejectedAt.toISOString(),
                datatype: O.fromNullishOr(XSD.dateTime),
              }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        if (P.isNotNull(assertion.rejectionReason)) {
          quads.push(
            Quad.make({
              subject: assertionIri,
              predicate: ASSERTIONS.rejectionReason,
              object: Literal.make({ value: assertion.rejectionReason }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        return quads;
      });

    /**
     * Get count of assertions matching filter
     */
    const count = Effect.fn(function* (filter: AssertionFilter) {
      const results = yield* query(filter);
      return results.length;
    });

    return {
      createAssertion,
      getAssertion,
      query,
      getSupportingClaims,
      reject,
      toTriples,
      count,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}

/**
 * Default layer for production use.
 * Includes ClaimRepository and RdfBuilder dependencies.
 */
export const AssertionServiceLive = AssertionService.Default.pipe(
  Layer.provide(ClaimRepository.Default),
  Layer.provide(RdfBuilder.Default)
);
