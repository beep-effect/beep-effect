/**
 * Epistemic edge endpoint value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as S from "effect/Schema";

const $I = $EpistemicDomainId.create("values/EdgeEndpoint/EdgeEndpoint.model");

/**
 * Opaque reference to a domain entity that is not itself an epistemic row.
 * Entity endpoints deliberately carry no foreign key: the referenced entity may
 * live in any slice, so the edge stores the caller's stable token verbatim.
 *
 * **Example** (Make entity reference)
 *
 * ```ts
 * import { EdgeEntityRef } from "@beep/epistemic-domain"
 *
 * console.log(EdgeEntityRef.make("workspace:matter-1"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeEntityRef = S.NonEmptyString.pipe(
  S.brand("EdgeEntityRef"),
  $I.annoteSchema("EdgeEntityRef", {
    description: "Opaque non-empty reference to a domain entity used as an epistemic edge endpoint.",
  })
);

/**
 * Runtime type for {@link EdgeEntityRef}.
 *
 * **Example** (Type entity reference value)
 *
 * ```ts
 * import { EdgeEntityRef } from "@beep/epistemic-domain"
 * import type { EdgeEntityRef as EdgeEntityRefValue } from "@beep/epistemic-domain"
 *
 * const ref: EdgeEntityRefValue = EdgeEntityRef.make("workspace:matter-1")
 * console.log(ref)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeEntityRef = typeof EdgeEntityRef.Type;

/**
 * Opaque reference to an observation that is not itself an epistemic row, kept
 * distinct from {@link EdgeEntityRef} so the two reference namespaces can never
 * be substituted for one another.
 *
 * **Example** (Make observation reference)
 *
 * ```ts
 * import { EdgeObservationRef } from "@beep/epistemic-domain"
 *
 * console.log(EdgeObservationRef.make("observation:run-1:step-3"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeObservationRef = S.NonEmptyString.pipe(
  S.brand("EdgeObservationRef"),
  $I.annoteSchema("EdgeObservationRef", {
    description: "Opaque non-empty reference to an observation used as an epistemic edge endpoint.",
  })
);

/**
 * Runtime type for {@link EdgeObservationRef}.
 *
 * **Example** (Type observation reference value)
 *
 * ```ts
 * import { EdgeObservationRef } from "@beep/epistemic-domain"
 * import type { EdgeObservationRef as EdgeObservationRefValue } from "@beep/epistemic-domain"
 *
 * const ref: EdgeObservationRefValue = EdgeObservationRef.make("observation:run-1:step-3")
 * console.log(ref)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeObservationRef = typeof EdgeObservationRef.Type;

const EdgeEndpointKindBase = LiteralKit(["claim", "evidence", "entity", "observation"]);

/**
 * Bounded vocabulary of what a bitemporal epistemic edge may point at.
 *
 * **Example** (Decode endpoint kind)
 *
 * ```ts
 * import { EdgeEndpointKind } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(EdgeEndpointKind)("evidence")
 * console.log(kind)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeEndpointKind = EdgeEndpointKindBase.pipe(
  $I.annoteSchema("EdgeEndpointKind", {
    description: "Bounded vocabulary of what a bitemporal epistemic edge may point at.",
  }),
  SchemaUtils.withLiteralKitStatics(EdgeEndpointKindBase)
);

/**
 * Runtime type for {@link EdgeEndpointKind}.
 *
 * **Example** (Satisfy endpoint kind type)
 *
 * ```ts
 * import type { EdgeEndpointKind } from "@beep/epistemic-domain"
 *
 * const kind = "claim" satisfies EdgeEndpointKind
 * console.log(kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeEndpointKind = typeof EdgeEndpointKind.Type;

const EdgeEndpointBase = EdgeEndpointKindBase.toTaggedUnion("kind")({
  claim: {
    claimId: Epistemic.CandidateClaimId.annotateKey({ description: "Candidate claim this endpoint points at." }),
  },
  evidence: {
    evidenceId: Epistemic.EvidenceId.annotateKey({ description: "Evidence row this endpoint points at." }),
  },
  entity: {
    entityRef: EdgeEntityRef.annotateKey({ description: "Opaque domain entity reference this endpoint points at." }),
  },
  observation: {
    observationRef: EdgeObservationRef.annotateKey({
      description: "Opaque observation reference this endpoint points at.",
    }),
  },
});

const edgeEndpointStatics = () => ({
  cases: EdgeEndpointBase.cases,
  discriminants: EdgeEndpointBase.discriminants,
  guards: EdgeEndpointBase.guards,
  isAnyOf: EdgeEndpointBase.isAnyOf,
  match: EdgeEndpointBase.match,
});

/**
 * One end of a bitemporal epistemic edge, discriminated on `kind`. Making the
 * endpoint a tagged union is what rejects arbitrary or dangling endpoint kinds
 * at the schema boundary: an unknown `kind` cannot decode, and each known kind
 * must carry exactly the reference its kind requires.
 *
 * **Example** (Decode claim endpoint)
 *
 * ```ts
 * import { EdgeEndpoint } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const endpoint = S.decodeUnknownSync(EdgeEndpoint)({ kind: "claim", claimId: 42 })
 * console.log(endpoint.kind)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeEndpoint = EdgeEndpointBase.pipe(
  $I.annoteSchema("EdgeEndpoint", {
    description: "One end of a bitemporal epistemic edge, discriminated on endpoint kind.",
  }),
  SchemaUtils.withStatics(edgeEndpointStatics)
);

/**
 * Runtime type for {@link EdgeEndpoint}.
 *
 * **Example** (Type entity endpoint)
 *
 * ```ts
 * import type { EdgeEndpoint } from "@beep/epistemic-domain"
 * import { EdgeEntityRef } from "@beep/epistemic-domain"
 *
 * const endpoint: EdgeEndpoint = { kind: "entity", entityRef: EdgeEntityRef.make("workspace:matter-1") }
 * console.log(endpoint.kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeEndpoint = typeof EdgeEndpoint.Type;

/**
 * Total canonical `kind:ref` rendering of an endpoint, used as a digest
 * component by the logical-edge identity. The kind prefix is what keeps a claim
 * and an entity that happen to share a reference token in different partitions.
 *
 * **Example** (Encode claim endpoint key)
 *
 * ```ts
 * import { encodeEdgeEndpointKey, EdgeEndpoint } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const endpoint = S.decodeUnknownSync(EdgeEndpoint)({ kind: "claim", claimId: 42 })
 * console.log(encodeEdgeEndpointKey(endpoint)) // "claim:42"
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeEdgeEndpointKey = (endpoint: EdgeEndpoint): string =>
  EdgeEndpoint.match(endpoint, {
    claim: (value) => `claim:${value.claimId}`,
    evidence: (value) => `evidence:${value.evidenceId}`,
    entity: (value) => `entity:${value.entityRef}`,
    observation: (value) => `observation:${value.observationRef}`,
  });
