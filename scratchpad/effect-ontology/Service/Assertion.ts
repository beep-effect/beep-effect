/**
 * Service: Assertion
 *
 * **Details**
 *
 * High-level service for managing curated assertions derived from claims.
 * Assertions represent accepted facts in the knowledge base after curation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import type { Quad } from "@beep/rdf";
import { IRI, makeNamedNode as makeCanonicalNamedNode } from "@beep/rdf";
import { PROV_NAMESPACE } from "@beep/rdf/Vocab/Prov";
import { RDF_NAMESPACE, RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_DOUBLE, XSD_NAMESPACE } from "@beep/rdf/Vocab/Xsd";
import { Clock, Context, DateTime, Effect, HashMap, Layer, Order, Random, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ErrorMessage } from "../Domain/Error/Base.ts";
import { ContentHash } from "../Domain/Identity.ts";
import { CLAIMS } from "../Domain/Rdf/Constants.ts";
import { AssertionId, AssertionStatus } from "../Domain/Schema/KnowledgeModel.ts";
import { ClaimRepository } from "../Repository/Claim.ts";
import { Claims, type ClaimRow } from "../Repository/schema.ts";
import { sha256 } from "../Utils/Hash.ts";
import { canonicalLiteral, canonicalQuad } from "../Utils/Rdf.ts";
import { RdfBuilder } from "./Rdf.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Assertion");
const RDF_SUBJECT = makeCanonicalNamedNode(`${RDF_NAMESPACE}subject`);
const RDF_PREDICATE = makeCanonicalNamedNode(`${RDF_NAMESPACE}predicate`);
const RDF_OBJECT = makeCanonicalNamedNode(`${RDF_NAMESPACE}object`);
const PROV_GENERATED_AT_TIME = makeCanonicalNamedNode(`${PROV_NAMESPACE}generatedAtTime`);
const XSD_DATE_TIME = makeCanonicalNamedNode(`${XSD_NAMESPACE}dateTime`);

const AssertionDecision = LiteralKit(["accept", "synthesize", "manual"]).pipe(
  $I.annoteSchema("AssertionDecision", {
    description: "Curation decision used to create an assertion.",
  })
);

const AssertionObjectType = LiteralKit(["iri", "literal"]).pipe(
  $I.annoteSchema("AssertionObjectType", {
    description: "IRI or literal RDF assertion-object representation.",
  })
);

const AssertionOverride = S.Class<AssertionOverride>($I`AssertionOverride`)(
  {
    subject: S.String.pipe(S.optionalKey),
    predicate: S.String.pipe(S.optionalKey),
    object: S.String.pipe(S.optionalKey),
    objectType: AssertionObjectType.pipe(S.optionalKey),
  },
  $I.annote("AssertionOverride", {
    description: "Optional replacement values used by synthesized and manual assertions.",
  })
);

interface AssertionOverride {
  readonly subject?: string;
  readonly predicate?: string;
  readonly object?: string;
  readonly objectType?: "iri" | "literal";
}

// =============================================================================
// Types
// =============================================================================

/**
 * Input for creating an assertion from claims
 *
 * **Example** (Accept claims into an assertion)
 *
 * ```ts
 * import { CreateAssertionInput } from "@effect-ontology/Service/Assertion"
 *
 * const input = CreateAssertionInput.make({
 *   ontologyId: "core",
 *   claimIds: ["claim-ada-founded"],
 *   decision: "accept"
 * })
 * console.log(input.decision) // "accept"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateAssertionInput extends S.Class<CreateAssertionInput>($I`CreateAssertionInput`)(
  {
    ontologyId: S.NonEmptyString.annotateKey({ description: "Ontology scope shared by every source claim." }),
    claimIds: S.NonEmptyArray(S.NonEmptyString).annotateKey({
      description: "One or more claim identifiers from which the assertion is derived.",
    }),
    decision: AssertionDecision.annotateKey({ description: "Curation decision used to create the assertion." }),
    curatedBy: S.NonEmptyString.pipe(S.optionalKey).annotateKey({
      description: "Optional curator identity.",
    }),
    override: AssertionOverride.pipe(S.optionalKey).annotateKey({
      description: "Optional RDF triple replacements for synthesized or manual assertions.",
    }),
    confidence: Confidence.pipe(S.optionalKey).annotateKey({
      description: "Optional confidence override in the unit interval.",
    }),
  },
  $I.annote("CreateAssertionInput", {
    description: "Validated source claims, decision, curator, overrides, and confidence for assertion creation.",
  })
) {}

/**
 * Filter for querying assertions
 *
 * **Example** (Filter accepted assertions)
 *
 * ```ts
 * import { AssertionFilter } from "@effect-ontology/Service/Assertion"
 *
 * const filter = AssertionFilter.make({
 *   subjectIri: "https://example.org/Ada",
 *   status: "accepted",
 *   limit: 20
 * })
 * console.log(filter.limit) // 20
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class AssertionFilter extends S.Class<AssertionFilter>($I`AssertionFilter`)(
  {
    subjectIri: S.String.pipe(S.optionalKey),
    predicateIri: S.String.pipe(S.optionalKey),
    status: AssertionStatus.pipe(S.optionalKey),
    curatedBy: S.String.pipe(S.optionalKey),
    limit: S.Natural.pipe(S.optionalKey),
    offset: S.Natural.pipe(S.optionalKey),
  },
  $I.annote("AssertionFilter", {
    description: "Optional subject, predicate, status, curator, limit, and offset for assertion queries.",
  })
) {}

/**
 * Assertion with full provenance information
 *
 * **Example** (Attach source claims)
 *
 * ```ts
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { AssertionRow, AssertionWithProvenance } from "@effect-ontology/Service/Assertion"
 *
 * const result = AssertionWithProvenance.make({
 *   assertion: AssertionRow.make({
 *     id: "assertion-1",
 *     ontologyId: "core",
 *     subjectIri: "https://example.org/Ada",
 *     predicateIri: "https://example.org/name",
 *     objectValue: "Ada",
 *     objectType: "literal",
 *     status: "accepted",
 *     assertedAt: new Date(0),
 *     derivedFrom: ["claim-1"],
 *     curatedBy: null,
 *     confidence: UnitInterval.make(0.9),
 *     validFrom: null,
 *     validTo: null,
 *     rejectedAt: null,
 *     rejectionReason: null
 *   }),
 *   sourceClaims: []
 * })
 * console.log(result.sourceClaims.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssertionWithProvenance extends S.Class<AssertionWithProvenance>($I`AssertionWithProvenance`)(
  {
    assertion: S.suspend((): typeof AssertionRow => AssertionRow),
    sourceClaims: S.Array(Claims).pipe(S.mutable),
  },
  $I.annote("AssertionWithProvenance", {
    description: "Curated assertion paired with the complete set of source claim rows.",
  })
) {}

/**
 * Internal assertion row type (matches what we store)
 *
 * **Example** (Read assertion identity)
 *
 * ```ts
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { AssertionRow } from "@effect-ontology/Service/Assertion"
 *
 * const row = AssertionRow.make({
 *   id: "assertion-1",
 *   ontologyId: "core",
 *   subjectIri: "https://example.org/Ada",
 *   predicateIri: "https://example.org/founded",
 *   objectValue: "https://example.org/Acme",
 *   objectType: "iri",
 *   status: "accepted",
 *   assertedAt: new Date("2026-01-01T00:00:00.000Z"),
 *   derivedFrom: ["claim-ada-founded"],
 *   curatedBy: null,
 *   confidence: UnitInterval.make(0.9),
 *   validFrom: null,
 *   validTo: null,
 *   rejectedAt: null,
 *   rejectionReason: null
 * })
 * console.log(row.id) // "assertion-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AssertionRow extends S.Class<AssertionRow>($I`AssertionRow`)(
  {
    id: S.NonEmptyString,
    ontologyId: S.NonEmptyString,
    subjectIri: S.NonEmptyString,
    predicateIri: S.NonEmptyString,
    objectValue: S.String,
    objectType: AssertionObjectType,
    status: AssertionStatus,
    assertedAt: S.Date,
    derivedFrom: S.NonEmptyArray(S.NonEmptyString),
    curatedBy: S.NullOr(S.NonEmptyString),
    confidence: Confidence,
    validFrom: S.NullOr(S.Date),
    validTo: S.NullOr(S.Date),
    rejectedAt: S.NullOr(S.Date),
    rejectionReason: S.NullOr(S.NonEmptyString),
  },
  $I.annote("AssertionRow", {
    description: "Stored assertion triple, lifecycle status, provenance, curator, confidence, and validity window.",
  })
) {}

/**
 *  Typed failure for assertion lifecycle operations.
 *
 * **Example** (Construct an assertion error)
 *
 * ```ts
 * import { AssertionError } from "@effect-ontology/Service/Assertion"
 *
 * const error = AssertionError.make({
 *   operation: "create",
 *   message: "Source claims belong to different ontologies"
 * })
 * console.log(error._tag) // "AssertionError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AssertionError extends S.TaggedError<AssertionError>($I`AssertionError`)(
  "AssertionError",
  {
    operation: S.Literals(["create", "reject"]).annotateKey({
      description: "Assertion lifecycle operation that failed.",
    }),
    message: ErrorMessage.annotateKey({
      description: "Human-readable assertion failure diagnostic.",
    }),
  },
  $I.annote("AssertionError", {
    description: "Typed failure for assertion lifecycle operations.",
  })
) {
  static readonly is = S.is(this);
}

// =============================================================================
// Vocabulary Constants for Assertions
// =============================================================================

/**
 * Assertion vocabulary IRIs
 * Extends CLAIMS vocabulary with assertion-specific terms
 */
const ASSERTIONS = {
  namespace: "https://effect-ontology.dev/assertions#",
  Assertion: IRI.fromUnknown("https://effect-ontology.dev/assertions#Assertion"),
  assertedAt: IRI.fromUnknown("https://effect-ontology.dev/assertions#assertedAt"),
  curatedBy: IRI.fromUnknown("https://effect-ontology.dev/assertions#curatedBy"),
  derivedFromClaim: IRI.fromUnknown("https://effect-ontology.dev/assertions#derivedFromClaim"),
  decision: IRI.fromUnknown("https://effect-ontology.dev/assertions#decision"),
  Status: IRI.fromUnknown("https://effect-ontology.dev/assertions#Status"),
  Accepted: IRI.fromUnknown("https://effect-ontology.dev/assertions#Accepted"),
  Rejected: IRI.fromUnknown("https://effect-ontology.dev/assertions#Rejected"),
  Pending: IRI.fromUnknown("https://effect-ontology.dev/assertions#Pending"),
  rejectedAt: IRI.fromUnknown("https://effect-ontology.dev/assertions#rejectedAt"),
  rejectionReason: IRI.fromUnknown("https://effect-ontology.dev/assertions#rejectionReason"),
};

// =============================================================================
// Service
// =============================================================================

/**
 * AssertionService - Curated fact management
 *
 * **Details**
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
 * **Example** (Create an assertion from accepted claims)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { AssertionService } from "@effect-ontology/Service/Assertion"
 *
 * const program = Effect.gen(function* () {
 *   const assertions = yield* AssertionService
 *   return yield* assertions.createAssertion({
 *     ontologyId: "core",
 *     claimIds: ["claim-ada-founded"],
 *     decision: "accept"
 *   })
 * }).pipe(Effect.provide(AssertionService.Default))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
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
        const claim = yield* claimRepo.getClaim(claimId, input.ontologyId);
        if (O.isSome(claim)) {
          sourceClaims.push(claim.value);
        }
      }
      if (sourceClaims.length === 0) {
        return yield* AssertionError.make({
          operation: "create",
          message: "No valid claims found for assertion",
        });
      }
      const baseClaim = sourceClaims[0];
      const subjectIri = input.override?.subject ?? baseClaim.subjectIri;
      const predicateIri = input.override?.predicate ?? baseClaim.predicateIri;
      const objectValue = input.override?.object ?? baseClaim.objectValue;
      const objectType = input.override?.objectType ?? (baseClaim.objectType === "iri" ? "iri" : "literal");
      const meanConfidence =
        sourceClaims.reduce((sum, c) => sum + parseFloat(c.confidenceScore ?? "0.5"), 0) / sourceClaims.length;
      const avgConfidence =
        input.confidence ??
        (yield* Confidence.decodeEffect(meanConfidence).pipe(
          Effect.mapError(() =>
            AssertionError.make({
              operation: "create",
              message: "Source claims contain an invalid confidence score",
            })
          )
        ));
      const randomSuffix = Math.abs(yield* Random.nextInt)
        .toString(36)
        .slice(0, 6);
      const uniqueSuffix = `${(yield* Clock.currentTimeMillis).toString(36)}${randomSuffix}`;
      const hash = yield* sha256(uniqueSuffix).pipe(
        Effect.mapError(() =>
          AssertionError.make({
            operation: "create",
            message: "Failed to compute the assertion identifier",
          })
        )
      );
      const id = AssertionId.fromContentHash(ContentHash.make(hash));
      const assertionRow = AssertionRow.make({
        id,
        ontologyId: input.ontologyId,
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
      });
      yield* Ref.update(assertionsRef, (assertions) => HashMap.set(assertions, id, assertionRow));
      return assertionRow;
    });

    /**
     * Get an assertion by ID with full provenance
     */
    const getAssertion = Effect.fn("getAssertion")(function* (id: string) {
      const assertions = yield* Ref.get(assertionsRef);
      const assertion = AssertionId.is(id) ? HashMap.get(assertions, id) : O.none();
      if (O.isNone(assertion)) {
        return O.none<AssertionWithProvenance>();
      }
      const sourceClaims: Array<ClaimRow> = [];
      for (const claimId of assertion.value.derivedFrom) {
        const claim = yield* claimRepo.getClaim(claimId, assertion.value.ontologyId);
        if (O.isSome(claim)) {
          sourceClaims.push(claim.value);
        }
      }
      return O.some(AssertionWithProvenance.make({ assertion: assertion.value, sourceClaims }));
    });

    /**
     * Query assertions with filters
     */
    const query = Effect.fn("query")(function* (filter: AssertionFilter) {
      const assertions = yield* Ref.get(assertionsRef);
      let results = A.fromIterable(HashMap.values(assertions));
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
      results = A.sort(
        results,
        Order.mapInput(Order.flip(Order.Number), (assertion: AssertionRow) => assertion.assertedAt.getTime())
      );
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
      const assertion = AssertionId.is(assertionId) ? HashMap.get(assertions, assertionId) : O.none();
      if (O.isNone(assertion)) {
        return [];
      }
      const claims: Array<ClaimRow> = [];
      for (const claimId of assertion.value.derivedFrom) {
        const claim = yield* claimRepo.getClaim(claimId, assertion.value.ontologyId);
        if (O.isSome(claim)) {
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
      const assertion = AssertionId.is(assertionId) ? HashMap.get(assertions, assertionId) : O.none();
      if (O.isNone(assertion)) {
        return yield* AssertionError.make({
          operation: "reject",
          message: `Assertion not found: ${assertionId}`,
        });
      }
      const updated = AssertionRow.make({
        ...assertion.value,
        status: "rejected",
        rejectedAt: DateTime.toDate(now),
        rejectionReason: reason,
      });
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
    const count = Effect.fn("Assertion.count")(function* (filter: AssertionFilter) {
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
 *
 * **Example** (Provide the live assertion layer)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { AssertionService, AssertionServiceLive } from "@effect-ontology/Service/Assertion"
 *
 * const program = Effect.gen(function* () {
 *   const assertions = yield* AssertionService
 *   return yield* assertions.query({ status: "accepted", limit: 10 })
 * }).pipe(Effect.provide(AssertionServiceLive))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const AssertionServiceLive = AssertionService.Default.pipe(
  Layer.provide(ClaimRepository.Default),
  Layer.provide(RdfBuilder.Default)
);
