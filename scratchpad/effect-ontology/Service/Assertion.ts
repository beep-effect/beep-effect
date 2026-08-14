/**
 * Service: Assertion
 *
 * High-level service for managing curated assertions derived from claims.
 * Assertions represent accepted facts in the knowledge base after curation.
 *
 * @since 2.0.0
 * @module Service/Assertion
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import type { GraphTerm, Literal, NamedNode, ObjectTerm, Quad, Subject } from "@beep/rdf";
import { IRI, makeNamedNode as makeCanonicalNamedNode, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf";
import { PROV_NAMESPACE } from "@beep/rdf/Vocab/Prov";
import { RDF_NAMESPACE, RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_DOUBLE, XSD_NAMESPACE, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { Context, Data, DateTime, Effect, HashMap, Layer, Option, Ref } from "effect";
import * as Clock from "effect/Clock";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import * as S from "effect/Schema";
import { ContentHash } from "../Domain/Identity.ts";
import { CLAIMS } from "../Domain/Rdf/Constants.ts";
import type { AssertionStatus } from "../Domain/Schema/KnowledgeModel.ts";
import { AssertionId } from "../Domain/Schema/KnowledgeModel.ts";
import { ClaimRepository } from "../Repository/Claim.ts";
import type { ClaimRow } from "../Repository/schema.ts";
import { sha256 } from "../Utils/Hash.ts";
import { RdfBuilder } from "./Rdf.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Assertion");
const RDF_SUBJECT = makeCanonicalNamedNode(`${RDF_NAMESPACE}subject`);
const RDF_PREDICATE = makeCanonicalNamedNode(`${RDF_NAMESPACE}predicate`);
const RDF_OBJECT = makeCanonicalNamedNode(`${RDF_NAMESPACE}object`);
const PROV_GENERATED_AT_TIME = makeCanonicalNamedNode(`${PROV_NAMESPACE}generatedAtTime`);
const XSD_DATE_TIME = makeCanonicalNamedNode(`${XSD_NAMESPACE}dateTime`);

const canonicalNamedNode = (value: IRI | NamedNode): NamedNode => (P.isString(value) ? makeNamedNode(value) : value);

const canonicalLiteral = (input: {
  readonly value: string;
  readonly datatype?: O.Option<IRI | NamedNode>;
}): Literal => {
  const datatype = O.getOrElse(input.datatype ?? O.none(), () => XSD_STRING);
  return makeLiteral(input.value, canonicalNamedNode(datatype).value);
};

const canonicalQuad = (input: {
  readonly subject: IRI | Subject;
  readonly predicate: IRI | NamedNode;
  readonly object: IRI | ObjectTerm;
  readonly graph: O.Option<IRI | GraphTerm>;
}): Quad => {
  const subject = P.isString(input.subject) ? makeNamedNode(input.subject) : input.subject;
  const predicate = canonicalNamedNode(input.predicate);
  const object = P.isString(input.object) ? makeNamedNode(input.object) : input.object;
  const graph = O.map(input.graph, (value) => (P.isString(value) ? makeNamedNode(value) : value));
  return O.isSome(graph)
    ? makeQuad(subject, predicate, { object, graph: graph.value })
    : makeQuad(subject, predicate, object);
};

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
  readonly confidence?: Confidence;
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
  readonly confidence: Confidence;
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
  Assertion: IRI.fromUnknown("http://effect-ontology.dev/assertions#Assertion"),
  assertedAt: IRI.fromUnknown("http://effect-ontology.dev/assertions#assertedAt"),
  curatedBy: IRI.fromUnknown("http://effect-ontology.dev/assertions#curatedBy"),
  derivedFromClaim: IRI.fromUnknown("http://effect-ontology.dev/assertions#derivedFromClaim"),
  decision: IRI.fromUnknown("http://effect-ontology.dev/assertions#decision"),
  Status: IRI.fromUnknown("http://effect-ontology.dev/assertions#Status"),
  Accepted: IRI.fromUnknown("http://effect-ontology.dev/assertions#Accepted"),
  Rejected: IRI.fromUnknown("http://effect-ontology.dev/assertions#Rejected"),
  Pending: IRI.fromUnknown("http://effect-ontology.dev/assertions#Pending"),
  rejectedAt: IRI.fromUnknown("http://effect-ontology.dev/assertions#rejectedAt"),
  rejectionReason: IRI.fromUnknown("http://effect-ontology.dev/assertions#rejectionReason"),
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
      const meanConfidence =
        sourceClaims.reduce((sum, c) => sum + parseFloat(c.confidenceScore ?? "0.5"), 0) / sourceClaims.length;
      const avgConfidence =
        input.confidence ??
        (yield* S.decodeEffect(Confidence)(meanConfidence).pipe(
          Effect.mapError(
            () =>
              new AssertionError({
                operation: "create",
                message: "Source claims contain an invalid confidence score",
              })
          )
        ));
      const randomSuffix = Math.abs(yield* Random.nextInt)
        .toString(36)
        .slice(0, 6);
      const uniqueSuffix = `${(yield* Clock.currentTimeMillis).toString(36)}${randomSuffix}`;
      const id = AssertionId.fromContentHash(ContentHash.make(yield* sha256(uniqueSuffix)));
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
      const assertion = AssertionId.is(id) ? HashMap.get(assertions, id) : Option.none();
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
      const assertion = AssertionId.is(assertionId) ? HashMap.get(assertions, assertionId) : Option.none();
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
      const assertion = AssertionId.is(assertionId) ? HashMap.get(assertions, assertionId) : Option.none();
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
      yield* Ref.update(assertionsRef, HashMap.set(AssertionId.fromUnknown(assertion.value.id), updated));
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
        const assertionIri = IRI.fromUnknown(`${ASSERTIONS.namespace}${assertion.id}`);
        const graph = P.isUndefined(graphUri) ? undefined : IRI.fromUnknown(graphUri);

        // Type assertion
        quads.push(
          canonicalQuad({
            subject: assertionIri,
            predicate: RDF_TYPE,
            object: ASSERTIONS.Assertion,
            graph: O.fromNullishOr(graph),
          })
        );

        // RDF reification (the actual triple being asserted)
        quads.push(
          canonicalQuad({
            subject: assertionIri,
            predicate: RDF_SUBJECT,
            object: IRI.fromUnknown(assertion.subjectIri),
            graph: O.fromNullishOr(graph),
          })
        );

        quads.push(
          canonicalQuad({
            subject: assertionIri,
            predicate: RDF_PREDICATE,
            object: IRI.fromUnknown(assertion.predicateIri),
            graph: O.fromNullishOr(graph),
          })
        );

        const objectTerm =
          assertion.objectType === "iri"
            ? IRI.fromUnknown(assertion.objectValue)
            : canonicalLiteral({ value: assertion.objectValue });

        quads.push(
          canonicalQuad({
            subject: assertionIri,
            predicate: RDF_OBJECT,
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
          canonicalQuad({
            subject: assertionIri,
            predicate: CLAIMS.claimStatus,
            object: statusIri,
            graph: O.fromNullishOr(graph),
          })
        );

        // Confidence
        quads.push(
          canonicalQuad({
            subject: assertionIri,
            predicate: CLAIMS.confidence,
            object: canonicalLiteral({
              value: assertion.confidence.toString(),
              datatype: O.fromNullishOr(XSD_DOUBLE),
            }),
            graph: O.fromNullishOr(graph),
          })
        );

        // Asserted at
        quads.push(
          canonicalQuad({
            subject: assertionIri,
            predicate: ASSERTIONS.assertedAt,
            object: canonicalLiteral({
              value: assertion.assertedAt.toISOString(),
              datatype: O.fromNullishOr(XSD_DATE_TIME),
            }),
            graph: O.fromNullishOr(graph),
          })
        );

        // Curated by
        if (P.isNotNull(assertion.curatedBy)) {
          quads.push(
            canonicalQuad({
              subject: assertionIri,
              predicate: ASSERTIONS.curatedBy,
              object: canonicalLiteral({ value: assertion.curatedBy }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        // Derived from claims (provenance)
        for (const claimId of assertion.derivedFrom) {
          quads.push(
            canonicalQuad({
              subject: assertionIri,
              predicate: ASSERTIONS.derivedFromClaim,
              object: IRI.fromUnknown(`${CLAIMS.namespace}${claimId}`),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        // PROV-O provenance
        quads.push(
          canonicalQuad({
            subject: assertionIri,
            predicate: PROV_GENERATED_AT_TIME,
            object: canonicalLiteral({
              value: assertion.assertedAt.toISOString(),
              datatype: O.fromNullishOr(XSD_DATE_TIME),
            }),
            graph: O.fromNullishOr(graph),
          })
        );

        // Temporal validity
        if (P.isNotNull(assertion.validFrom)) {
          quads.push(
            canonicalQuad({
              subject: assertionIri,
              predicate: CLAIMS.validFrom,
              object: canonicalLiteral({
                value: assertion.validFrom.toISOString(),
                datatype: O.fromNullishOr(XSD_DATE_TIME),
              }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        if (P.isNotNull(assertion.validTo)) {
          quads.push(
            canonicalQuad({
              subject: assertionIri,
              predicate: CLAIMS.validUntil,
              object: canonicalLiteral({
                value: assertion.validTo.toISOString(),
                datatype: O.fromNullishOr(XSD_DATE_TIME),
              }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        // Rejection info
        if (P.isNotNull(assertion.rejectedAt)) {
          quads.push(
            canonicalQuad({
              subject: assertionIri,
              predicate: ASSERTIONS.rejectedAt,
              object: canonicalLiteral({
                value: assertion.rejectedAt.toISOString(),
                datatype: O.fromNullishOr(XSD_DATE_TIME),
              }),
              graph: O.fromNullishOr(graph),
            })
          );
        }

        if (P.isNotNull(assertion.rejectionReason)) {
          quads.push(
            canonicalQuad({
              subject: assertionIri,
              predicate: ASSERTIONS.rejectionReason,
              object: canonicalLiteral({ value: assertion.rejectionReason }),
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
