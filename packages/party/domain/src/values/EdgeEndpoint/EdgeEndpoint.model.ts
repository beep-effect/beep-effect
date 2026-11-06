/**
 * Epistemic edge endpoint value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- Nominal party bindings instantiate shared epistemics factories with party ids and brands; importing another product slice would violate the boundary. No copied algorithms. Review by 2026-12-03 or on factory/API changes.
import { encodeEdgeEndpointKey as encodeKey, makeEdgeEndpoint } from "@beep/epistemics/EdgeEndpoint";
import { $PartyDomainId } from "@beep/identity/packages";
import * as PartyIds from "../../Ids.ts";

const bound = makeEdgeEndpoint({
  $I: $PartyDomainId.create("values/EdgeEndpoint/EdgeEndpoint.model"),
  ids: { candidateClaim: PartyIds.AssertionId, evidence: PartyIds.AssertionId },
});

/**
 * Opaque reference to a domain entity that is not itself an epistemic row.
 * Entity endpoints deliberately carry no foreign key: the referenced entity may
 * live in any slice, so the edge stores the caller's stable token verbatim.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { EdgeEntityRef } from "@beep/party-domain/EdgeEndpoint"
 * import * as S from "effect/Schema"
 * const accepts = S.is(EdgeEntityRef)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeEntityRef = bound.EdgeEntityRef;

/**
 * Runtime type for {@link EdgeEntityRef}.
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { EdgeObservationRef } from "@beep/party-domain/EdgeEndpoint"
 * import * as S from "effect/Schema"
 * const accepts = S.is(EdgeObservationRef)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeObservationRef = bound.EdgeObservationRef;

/**
 * Runtime type for {@link EdgeObservationRef}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeObservationRef = typeof EdgeObservationRef.Type;

/**
 * Bounded vocabulary of what a bitemporal epistemic edge may point at.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { EdgeEndpointKind } from "@beep/party-domain/EdgeEndpoint"
 * import * as S from "effect/Schema"
 * const accepts = S.is(EdgeEndpointKind)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeEndpointKind = bound.EdgeEndpointKind;

/**
 * Runtime type for {@link EdgeEndpointKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeEndpointKind = typeof EdgeEndpointKind.Type;

/**
 * One end of a bitemporal epistemic edge, discriminated on `kind`. Making the
 * endpoint a tagged union is what rejects arbitrary or dangling endpoint kinds
 * at the schema boundary: an unknown `kind` cannot decode, and each known kind
 * must carry exactly the reference its kind requires.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { EdgeEndpoint } from "@beep/party-domain/EdgeEndpoint"
 * import * as S from "effect/Schema"
 * const accepts = S.is(EdgeEndpoint)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeEndpoint = bound.EdgeEndpoint;

/**
 * Runtime type for {@link EdgeEndpoint}.
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { encodeEdgeEndpointKey } from "@beep/party-domain/EdgeEndpoint"
 * const binding = encodeEdgeEndpointKey
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeEdgeEndpointKey: (endpoint: EdgeEndpoint) => string = encodeKey;
