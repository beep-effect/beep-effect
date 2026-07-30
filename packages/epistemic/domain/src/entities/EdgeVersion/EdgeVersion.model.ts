/**
 * Bitemporal epistemic edge version entity model.
 *
 * One row is one immutable assertion of one logical edge over one valid-time
 * interval, recorded over one transaction-time interval. Both axes are half-open
 * (`[validFrom, validTo)`, `[recordedAt, expiredAt)`) BIGINT epoch millis with an
 * absent upper bound modelled as `Option.none` — there are no magic sentinel
 * dates and no persisted `isLatest` flag, because "latest" is a question you ask
 * the axes, not a fact you store.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Derived from Graphiti (https://github.com/getzep/graphiti), v0.29.2,
 * commit ff7e29ccd127d8d9721b5cbb2163a6407ef915fe.
 * Copyright 2024, 2025 Zep Software, Inc. Licensed under the Apache License,
 * Version 2.0. See THIRD_PARTY_NOTICES.md.
 *
 * Modified: reimplemented in Effect/TypeScript over Postgres; no upstream
 * source was copied. Two half-open BIGINT-millis interval pairs with Option open
 * ends replace the donor's nullable valid_at/invalid_at/expired_at datetimes, and
 * lineage is a supersedes_id self-FK rather than a caller-held edge list.
 */

import {
  EdgeEndpoint,
  EdgeEndpointKind,
  EdgeEntityRef,
  EdgeEvidenceScope,
  EdgeMatterScope,
  EdgeObservationRef,
  EdgeQualifiers,
  EdgeRelation,
  LogicalEdgeKey,
} from "@beep/epistemic-domain/values";
import { $EpistemicDomainId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { PosInt } from "@beep/schema/Int";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { O } from "@beep/utils";
import * as S from "effect/Schema";

const $I = $EpistemicDomainId.create("entities/EdgeVersion/EdgeVersion.model");

/**
 * One immutable version of one logical epistemic edge.
 *
 * The organization scope is the inherited `orgId` — there is no separate
 * `org_scope` column; the digest's org component is the stringified `orgId`.
 * Endpoints are stored flattened into a per-kind column quadruple per side so the
 * database can express "the reference column matching the kind is the only one
 * populated" as a CHECK constraint and point real foreign keys at the claim and
 * evidence tables.
 *
 * @example
 * ```ts
 * import { EdgeVersion } from "@beep/epistemic-domain"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const version = S.decodeUnknownSync(EdgeVersion)({
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: Epistemic.EdgeVersionId.entityType,
 *   evidenceScope: null,
 *   expiredAt: null,
 *   fact: { note: "cited in the office action" },
 *   id: 1,
 *   logicalKey: "abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe",
 *   matterScope: null,
 *   orgId: 1,
 *   qualifiers: { statute: "35 USC 103" },
 *   recordedAt: 1_000,
 *   relation: "supports",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   sourceClaimId: 1,
 *   sourceEntityRef: null,
 *   sourceEvidenceId: null,
 *   sourceKind: "claim",
 *   sourceObservationRef: null,
 *   supersedesId: null,
 *   targetClaimId: null,
 *   targetEntityRef: null,
 *   targetEvidenceId: 2,
 *   targetKind: "evidence",
 *   targetObservationRef: null,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   validFrom: 1_000,
 *   validTo: null,
 *   version: 1
 * })
 *
 * console.log(version.relation)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class EdgeVersion extends BaseEntity.Class<EdgeVersion>($I`EdgeVersion`)(
  Epistemic.EdgeVersionId,
  {
    fields: {
      evidenceScope: EdgeEvidenceScope.pipe(S.OptionFromNullOr).annotateKey({
        description: "Optional evidence-set scope the edge was asserted under.",
      }),
      expiredAt: EntitySchema.DateTimeFromMillis.pipe(S.OptionFromNullOr).annotateKey({
        description: "Exclusive transaction-time upper bound; absent while the row is the current record.",
      }),
      fact: UnknownRecord.annotateKey({ description: "Immutable payload asserted by this edge version." }),
      logicalKey: LogicalEdgeKey.annotateKey({
        description: "Digest of the logical edge identity every version of this edge shares.",
      }),
      matterScope: EdgeMatterScope.pipe(S.OptionFromNullOr).annotateKey({
        description: "Optional matter scope the edge was asserted under.",
      }),
      qualifiers: EdgeQualifiers.annotateKey({ description: "Further string qualifiers partitioning the edge." }),
      recordedAt: EntitySchema.DateTimeFromMillis.annotateKey({
        description: "Inclusive transaction-time lower bound: when this row became known.",
      }),
      relation: EdgeRelation.annotateKey({ description: "Relation the source endpoint bears to the target." }),
      sourceClaimId: Epistemic.CandidateClaimId.pipe(S.OptionFromNullOr).annotateKey({
        description: "Source claim reference, populated only when the source kind is claim.",
      }),
      sourceEntityRef: EdgeEntityRef.pipe(S.OptionFromNullOr).annotateKey({
        description: "Source entity reference, populated only when the source kind is entity.",
      }),
      sourceEvidenceId: Epistemic.EvidenceId.pipe(S.OptionFromNullOr).annotateKey({
        description: "Source evidence reference, populated only when the source kind is evidence.",
      }),
      sourceKind: EdgeEndpointKind.annotateKey({ description: "Which reference column carries the source." }),
      sourceObservationRef: EdgeObservationRef.pipe(S.OptionFromNullOr).annotateKey({
        description: "Source observation reference, populated only when the source kind is observation.",
      }),
      supersedesId: Epistemic.EdgeVersionId.pipe(S.OptionFromNullOr).annotateKey({
        description: "Version this row replaced; absent for the first version and for late out-of-order arrivals.",
      }),
      targetClaimId: Epistemic.CandidateClaimId.pipe(S.OptionFromNullOr).annotateKey({
        description: "Target claim reference, populated only when the target kind is claim.",
      }),
      targetEntityRef: EdgeEntityRef.pipe(S.OptionFromNullOr).annotateKey({
        description: "Target entity reference, populated only when the target kind is entity.",
      }),
      targetEvidenceId: Epistemic.EvidenceId.pipe(S.OptionFromNullOr).annotateKey({
        description: "Target evidence reference, populated only when the target kind is evidence.",
      }),
      targetKind: EdgeEndpointKind.annotateKey({ description: "Which reference column carries the target." }),
      targetObservationRef: EdgeObservationRef.pipe(S.OptionFromNullOr).annotateKey({
        description: "Target observation reference, populated only when the target kind is observation.",
      }),
      validFrom: EntitySchema.DateTimeFromMillis.annotateKey({
        description: "Inclusive valid-time lower bound: when the fact started being true.",
      }),
      validTo: EntitySchema.DateTimeFromMillis.pipe(S.OptionFromNullOr).annotateKey({
        description: "Exclusive valid-time upper bound; absent while the fact is still held true.",
      }),
      version: PosInt.annotateKey({ description: "Monotonic version number within the logical edge." }),
    },
    persisted: {
      evidenceScope: EntitySchema.persist.text({
        columnName: "evidence_scope",
      }),
      expiredAt: EntitySchema.persist.timestampMillis({
        columnName: "expired_at",
      }),
      fact: EntitySchema.persist.jsonb({
        columnName: "fact",
      }),
      logicalKey: EntitySchema.persist.text({
        columnName: "logical_key",
      }),
      matterScope: EntitySchema.persist.text({
        columnName: "matter_scope",
      }),
      qualifiers: EntitySchema.persist.jsonb({
        columnName: "qualifiers",
      }),
      recordedAt: EntitySchema.persist.timestampMillis({
        columnName: "recorded_at",
      }),
      relation: EntitySchema.persist.literal({
        columnName: "relation",
      }),
      sourceClaimId: EntitySchema.persist.entityId({
        columnName: "source_claim_id",
      }),
      sourceEntityRef: EntitySchema.persist.text({
        columnName: "source_entity_ref",
      }),
      sourceEvidenceId: EntitySchema.persist.entityId({
        columnName: "source_evidence_id",
      }),
      sourceKind: EntitySchema.persist.literal({
        columnName: "source_kind",
      }),
      sourceObservationRef: EntitySchema.persist.text({
        columnName: "source_observation_ref",
      }),
      supersedesId: EntitySchema.persist.entityId({
        columnName: "supersedes_id",
      }),
      targetClaimId: EntitySchema.persist.entityId({
        columnName: "target_claim_id",
      }),
      targetEntityRef: EntitySchema.persist.text({
        columnName: "target_entity_ref",
      }),
      targetEvidenceId: EntitySchema.persist.entityId({
        columnName: "target_evidence_id",
      }),
      targetKind: EntitySchema.persist.literal({
        columnName: "target_kind",
      }),
      targetObservationRef: EntitySchema.persist.text({
        columnName: "target_observation_ref",
      }),
      validFrom: EntitySchema.persist.timestampMillis({
        columnName: "valid_from",
      }),
      validTo: EntitySchema.persist.timestampMillis({
        columnName: "valid_to",
      }),
      version: EntitySchema.persist.int({
        columnName: "version",
      }),
    },
  },
  $I.annote("EdgeVersion", {
    description: "One immutable bitemporal version of one logical epistemic edge.",
  })
) {}

/**
 * The source half of the flattened endpoint quadruple carried by an
 * {@link EdgeVersion} row.
 *
 * @example
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
export type EdgeVersionSourceColumns = Pick<
  EdgeVersion,
  "sourceClaimId" | "sourceEntityRef" | "sourceEvidenceId" | "sourceKind" | "sourceObservationRef"
>;

/**
 * The target half of the flattened endpoint quadruple carried by an
 * {@link EdgeVersion} row.
 *
 * @example
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
export type EdgeVersionTargetColumns = Pick<
  EdgeVersion,
  "targetClaimId" | "targetEntityRef" | "targetEvidenceId" | "targetKind" | "targetObservationRef"
>;

/**
 * Project an endpoint onto the source column quadruple: the column matching the
 * endpoint kind is populated and the other three are `Option.none`, which is
 * exactly the shape the database CHECK constraint enforces.
 *
 * @example
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
 * @example
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
 * @example
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
 * @example
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
