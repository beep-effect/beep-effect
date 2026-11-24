/**
 * Epistemic edge endpoint schema factory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import type { IdCodec, SchemaIdentity } from "../Factory/index.ts";

/**
 * Build the edge endpoint vocabulary over caller-supplied claim and evidence id
 * schemas.
 *
 * **Details**
 *
 * Returns `EdgeEntityRef`, `EdgeObservationRef`, `EdgeEndpointKind` and the
 * `EdgeEndpoint` tagged union discriminated on `kind`. Every schema is
 * annotated with the caller's `$I`, so each binding owns its schema
 * identifiers. Encode a bound endpoint with {@link encodeEdgeEndpointKey}.
 *
 * **Example** (Bind endpoints to local branded ids)
 *
 * ```ts
 * import { encodeEdgeEndpointKey, makeEdgeEndpoint } from "@beep/epistemics/EdgeEndpoint"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const ClaimId = S.String.pipe(S.brand("ClaimId"))
 * const EvidenceId = S.String.pipe(S.brand("EvidenceId"))
 * const { EdgeEndpoint } = makeEdgeEndpoint({
 *   $I: $ScratchpadId.create("party/EdgeEndpoint"),
 *   ids: { candidateClaim: ClaimId, evidence: EvidenceId }
 * })
 *
 * const endpoint = S.decodeUnknownSync(EdgeEndpoint)({ kind: "evidence", evidenceId: "e-1" })
 * console.log(encodeEdgeEndpointKey(endpoint)) // "evidence:e-1"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeEdgeEndpoint = <CandidateClaimId extends IdCodec, EvidenceId extends IdCodec>(config: {
  readonly $I: SchemaIdentity;
  readonly ids: { readonly candidateClaim: CandidateClaimId; readonly evidence: EvidenceId };
}) => {
  const { $I, ids } = config;

  const EdgeEntityRef = S.NonEmptyString.pipe(
    S.brand("EdgeEntityRef"),
    $I.annoteSchema("EdgeEntityRef", {
      description: "Opaque non-empty reference to a domain entity used as an epistemic edge endpoint.",
    })
  );

  const EdgeObservationRef = S.NonEmptyString.pipe(
    S.brand("EdgeObservationRef"),
    $I.annoteSchema("EdgeObservationRef", {
      description: "Opaque non-empty reference to an observation used as an epistemic edge endpoint.",
    })
  );

  const EdgeEndpointKindBase = LiteralKit(["claim", "evidence", "entity", "observation"]);

  const EdgeEndpointKind = EdgeEndpointKindBase.pipe(
    $I.annoteSchema("EdgeEndpointKind", {
      description: "Bounded vocabulary of what a bitemporal epistemic edge may point at.",
    }),
    SchemaUtils.withLiteralKitStatics(EdgeEndpointKindBase)
  );

  const EdgeEndpointBase = EdgeEndpointKindBase.toTaggedUnion("kind")({
    claim: {
      claimId: ids.candidateClaim.annotateKey({ description: "Candidate claim this endpoint points at." }),
    },
    evidence: {
      evidenceId: ids.evidence.annotateKey({ description: "Evidence row this endpoint points at." }),
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

  const EdgeEndpoint = EdgeEndpointBase.pipe(
    $I.annoteSchema("EdgeEndpoint", {
      description: "One end of a bitemporal epistemic edge, discriminated on endpoint kind.",
    }),
    SchemaUtils.withStatics(edgeEndpointStatics)
  );

  return { EdgeEntityRef, EdgeObservationRef, EdgeEndpointKind, EdgeEndpoint };
};

const $I = $EpistemicsId.create("EdgeEndpoint/EdgeEndpoint.model");

const EndpointIdValue = S.Union([S.String, S.Finite]);

const EdgeEndpointShapeBase = LiteralKit(["claim", "evidence", "entity", "observation"]).toTaggedUnion("kind")({
  claim: { claimId: EndpointIdValue },
  evidence: { evidenceId: EndpointIdValue },
  entity: { entityRef: S.String },
  observation: { observationRef: S.String },
});

/**
 * **Example** (Check an evidence endpoint shape)
 *
 * ```ts
 * import { EdgeEndpointShape } from "@beep/epistemics/EdgeEndpoint"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EdgeEndpointShape)({ kind: "evidence", evidenceId: 7 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeEndpointShape = EdgeEndpointShapeBase.pipe(
  $I.annoteSchema("EdgeEndpointShape", {
    description: "Structural view of any bound edge endpoint: string or number ids and plain string references.",
  }),
  SchemaUtils.withStatics(() => ({ match: EdgeEndpointShapeBase.match }))
);

/**
 * **Example** (Type an evidence endpoint)
 *
 * ```ts
 * import type { EdgeEndpointShape } from "@beep/epistemics/EdgeEndpoint"
 *
 * const endpoint: EdgeEndpointShape = { kind: "evidence", evidenceId: 7 }
 * console.log(endpoint.kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeEndpointShape = typeof EdgeEndpointShape.Type;

/**
 * Stable textual key for one endpoint: its kind and reference joined by `:`.
 *
 * **Details**
 *
 * Id values are rendered with template interpolation, so string and number ids
 * both encode verbatim. The logical edge identity digest builds on this key.
 *
 * **Example** (Encode a claim endpoint key)
 *
 * ```ts
 * import { encodeEdgeEndpointKey } from "@beep/epistemics/EdgeEndpoint"
 *
 * console.log(encodeEdgeEndpointKey({ kind: "claim", claimId: 1 })) // "claim:1"
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeEdgeEndpointKey = (endpoint: EdgeEndpointShape): string =>
  EdgeEndpointShape.match(endpoint, {
    claim: (value) => `claim:${value.claimId}`,
    evidence: (value) => `evidence:${value.evidenceId}`,
    entity: (value) => `entity:${value.entityRef}`,
    observation: (value) => `observation:${value.observationRef}`,
  });
