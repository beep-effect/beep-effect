/**
 * Edge-version endpoint projection behavior.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EdgeEndpoint, EdgeEndpointKind } from "@beep/epistemic-domain/values";
import { O } from "@beep/utils";
import type { EdgeEntityRef, EdgeObservationRef } from "@beep/epistemic-domain/values";
import type * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import type { EdgeVersion } from "./EdgeVersion.model.ts";

/**
 * The source half of the flattened endpoint quadruple carried by an
 * {@link EdgeVersion} row.
 *
 * **Example** (Source columns type shape)
 *
 * ```ts
 * import type { EdgeVersionSourceColumns } from "@beep/epistemic-domain"
 * import * as O from "effect/Option"
 *
 * const columns: EdgeVersionSourceColumns = {
 *   sourceClaimId: O.none(),
 *   sourceEntityRef: O.none(),
 *   sourceEvidenceId: O.none(),
 *   sourceKind: "observation",
 *   sourceObservationRef: O.none()
 * }
 * console.log(columns.sourceKind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeVersionSourceColumns = {
  readonly sourceClaimId: O.Option<Epistemic.CandidateClaimId>;
  readonly sourceEntityRef: O.Option<EdgeEntityRef>;
  readonly sourceEvidenceId: O.Option<Epistemic.EvidenceId>;
  readonly sourceKind: EdgeEndpointKind;
  readonly sourceObservationRef: O.Option<EdgeObservationRef>;
};

/**
 * The target half of the flattened endpoint quadruple carried by an
 * {@link EdgeVersion} row.
 *
 * **Example** (Target columns type shape)
 *
 * ```ts
 * import type { EdgeVersionTargetColumns } from "@beep/epistemic-domain"
 * import * as O from "effect/Option"
 *
 * const columns: EdgeVersionTargetColumns = {
 *   targetClaimId: O.none(),
 *   targetEntityRef: O.none(),
 *   targetEvidenceId: O.none(),
 *   targetKind: "observation",
 *   targetObservationRef: O.none()
 * }
 * console.log(columns.targetKind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeVersionTargetColumns = {
  readonly targetClaimId: O.Option<Epistemic.CandidateClaimId>;
  readonly targetEntityRef: O.Option<EdgeEntityRef>;
  readonly targetEvidenceId: O.Option<Epistemic.EvidenceId>;
  readonly targetKind: EdgeEndpointKind;
  readonly targetObservationRef: O.Option<EdgeObservationRef>;
};

/**
 * Project an endpoint onto the source column quadruple: the column matching the
 * endpoint kind is populated and the other three are `Option.none`, which is
 * exactly the shape the database CHECK constraint enforces.
 *
 * **Example** (Flatten claim source endpoint)
 *
 * ```ts
 * import { EdgeEndpoint, flattenEdgeSource } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const columns = flattenEdgeSource(S.decodeUnknownSync(EdgeEndpoint)({ kind: "claim", claimId: 1 }))
 * console.log(columns.sourceKind)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const flattenEdgeSource = (endpoint: EdgeEndpoint): EdgeVersionSourceColumns =>
  EdgeEndpoint.match(endpoint, {
    claim: (value) => ({
      sourceClaimId: O.some(value.claimId),
      sourceEntityRef: O.none(),
      sourceEvidenceId: O.none(),
      sourceKind: EdgeEndpointKind.Enum.claim,
      sourceObservationRef: O.none(),
    }),
    evidence: (value) => ({
      sourceClaimId: O.none(),
      sourceEntityRef: O.none(),
      sourceEvidenceId: O.some(value.evidenceId),
      sourceKind: EdgeEndpointKind.Enum.evidence,
      sourceObservationRef: O.none(),
    }),
    entity: (value) => ({
      sourceClaimId: O.none(),
      sourceEntityRef: O.some(value.entityRef),
      sourceEvidenceId: O.none(),
      sourceKind: EdgeEndpointKind.Enum.entity,
      sourceObservationRef: O.none(),
    }),
    observation: (value) => ({
      sourceClaimId: O.none(),
      sourceEntityRef: O.none(),
      sourceEvidenceId: O.none(),
      sourceKind: EdgeEndpointKind.Enum.observation,
      sourceObservationRef: O.some(value.observationRef),
    }),
  });

/**
 * Project an endpoint onto the target column quadruple.
 *
 * **Example** (Flatten evidence target endpoint)
 *
 * ```ts
 * import { EdgeEndpoint, flattenEdgeTarget } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const columns = flattenEdgeTarget(S.decodeUnknownSync(EdgeEndpoint)({ kind: "evidence", evidenceId: 2 }))
 * console.log(columns.targetKind)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const flattenEdgeTarget = (endpoint: EdgeEndpoint): EdgeVersionTargetColumns =>
  EdgeEndpoint.match(endpoint, {
    claim: (value) => ({
      targetClaimId: O.some(value.claimId),
      targetEntityRef: O.none(),
      targetEvidenceId: O.none(),
      targetKind: EdgeEndpointKind.Enum.claim,
      targetObservationRef: O.none(),
    }),
    evidence: (value) => ({
      targetClaimId: O.none(),
      targetEntityRef: O.none(),
      targetEvidenceId: O.some(value.evidenceId),
      targetKind: EdgeEndpointKind.Enum.evidence,
      targetObservationRef: O.none(),
    }),
    entity: (value) => ({
      targetClaimId: O.none(),
      targetEntityRef: O.some(value.entityRef),
      targetEvidenceId: O.none(),
      targetKind: EdgeEndpointKind.Enum.entity,
      targetObservationRef: O.none(),
    }),
    observation: (value) => ({
      targetClaimId: O.none(),
      targetEntityRef: O.none(),
      targetEvidenceId: O.none(),
      targetKind: EdgeEndpointKind.Enum.observation,
      targetObservationRef: O.some(value.observationRef),
    }),
  });

/**
 * Rebuild the source endpoint from a stored column quadruple. The result is
 * `Option.none` exactly when the row's kind and reference columns disagree, so a
 * row that somehow escaped the CHECK constraint surfaces as absence rather than
 * as a fabricated endpoint.
 *
 * **Example** (Round-trip source endpoint)
 *
 * ```ts
 * import { EdgeEndpoint, flattenEdgeSource, unflattenEdgeSource } from "@beep/epistemic-domain"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const endpoint = S.decodeUnknownSync(EdgeEndpoint)({ kind: "claim", claimId: 1 })
 * console.log(O.isSome(unflattenEdgeSource(flattenEdgeSource(endpoint))))
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const unflattenEdgeSource = (columns: EdgeVersionSourceColumns): O.Option<EdgeEndpoint> =>
  EdgeEndpointKind.$match(columns.sourceKind, {
    claim: () => O.map(columns.sourceClaimId, (claimId) => EdgeEndpoint.cases.claim.make({ claimId })),
    evidence: () => O.map(columns.sourceEvidenceId, (evidenceId) => EdgeEndpoint.cases.evidence.make({ evidenceId })),
    entity: () => O.map(columns.sourceEntityRef, (entityRef) => EdgeEndpoint.cases.entity.make({ entityRef })),
    observation: () =>
      O.map(columns.sourceObservationRef, (observationRef) => EdgeEndpoint.cases.observation.make({ observationRef })),
  });

/**
 * Rebuild the target endpoint from a stored column quadruple.
 *
 * **Example** (Round-trip target endpoint)
 *
 * ```ts
 * import { EdgeEndpoint, flattenEdgeTarget, unflattenEdgeTarget } from "@beep/epistemic-domain"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const endpoint = S.decodeUnknownSync(EdgeEndpoint)({ kind: "evidence", evidenceId: 2 })
 * console.log(O.isSome(unflattenEdgeTarget(flattenEdgeTarget(endpoint))))
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const unflattenEdgeTarget = (columns: EdgeVersionTargetColumns): O.Option<EdgeEndpoint> =>
  EdgeEndpointKind.$match(columns.targetKind, {
    claim: () => O.map(columns.targetClaimId, (claimId) => EdgeEndpoint.cases.claim.make({ claimId })),
    evidence: () => O.map(columns.targetEvidenceId, (evidenceId) => EdgeEndpoint.cases.evidence.make({ evidenceId })),
    entity: () => O.map(columns.targetEntityRef, (entityRef) => EdgeEndpoint.cases.entity.make({ entityRef })),
    observation: () =>
      O.map(columns.targetObservationRef, (observationRef) => EdgeEndpoint.cases.observation.make({ observationRef })),
  });
