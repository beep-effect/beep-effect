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
import { PosInt } from "@beep/schema/Int";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as S from "effect/Schema";

const $I = $EpistemicDomainId.create("entities/EdgeVersion/EdgeVersion.model");
const EdgeVersionEntity = ProductEntity.make(Epistemic.EdgeVersionId);

/**
 * One immutable version of one logical epistemic edge.
 *
 * **Details**
 *
 * The organization scope is the inherited `orgId` — there is no separate
 * `org_scope` column; the digest's org component is the stringified `orgId`.
 * Endpoints are stored flattened into a per-kind column quadruple per side so the
 * database can express "the reference column matching the kind is the only one
 * populated" as a CHECK constraint and point real foreign keys at the claim and
 * evidence tables.
 *
 * **Example** (Decode full EdgeVersion row)
 *
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
export class EdgeVersion extends EdgeVersionEntity.Entity<EdgeVersion>(EdgeVersionEntity.tableName)(
  {
    evidenceScope: EdgeEvidenceScope.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Optional evidence-set scope the edge was asserted under." })
      .pipe(EdgeVersionEntity.pg.text(), EdgeVersionEntity.pg.columnName("evidence_scope")),
    expiredAt: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Exclusive transaction-time upper bound; absent while the row is the current record.",
      })
      .pipe(EdgeVersionEntity.pg.bigint("number"), EdgeVersionEntity.pg.columnName("expired_at")),
    fact: UnknownRecord.annotateKey({
      description: "Immutable payload asserted by this edge version.",
    }).pipe(EdgeVersionEntity.pg.jsonb()),
    logicalKey: LogicalEdgeKey.annotateKey({
      description: "Digest of the logical edge identity every version of this edge shares.",
    }).pipe(EdgeVersionEntity.pg.text(), EdgeVersionEntity.pg.columnName("logical_key")),
    matterScope: EdgeMatterScope.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Optional matter scope the edge was asserted under." })
      .pipe(EdgeVersionEntity.pg.text(), EdgeVersionEntity.pg.columnName("matter_scope")),
    qualifiers: EdgeQualifiers.annotateKey({
      description: "Further string qualifiers partitioning the edge.",
    }).pipe(EdgeVersionEntity.pg.jsonb()),
    recordedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Inclusive transaction-time lower bound: when this row became known.",
    }).pipe(EdgeVersionEntity.pg.bigint("number"), EdgeVersionEntity.pg.columnName("recorded_at")),
    relation: EdgeRelation.annotateKey({
      description: "Relation the source endpoint bears to the target.",
    }).pipe(EdgeVersionEntity.pg.text()),
    sourceClaimId: Epistemic.CandidateClaimId.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Source claim reference, populated only when the source kind is claim." })
      .pipe(EdgeVersionEntity.pg.integer(), EdgeVersionEntity.pg.columnName("source_claim_id")),
    sourceEntityRef: EdgeEntityRef.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Source entity reference, populated only when the source kind is entity." })
      .pipe(EdgeVersionEntity.pg.text(), EdgeVersionEntity.pg.columnName("source_entity_ref")),
    sourceEvidenceId: Epistemic.EvidenceId.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Source evidence reference, populated only when the source kind is evidence." })
      .pipe(EdgeVersionEntity.pg.integer(), EdgeVersionEntity.pg.columnName("source_evidence_id")),
    sourceKind: EdgeEndpointKind.annotateKey({
      description: "Which reference column carries the source.",
    }).pipe(EdgeVersionEntity.pg.text(), EdgeVersionEntity.pg.columnName("source_kind")),
    sourceObservationRef: EdgeObservationRef.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Source observation reference, populated only when the source kind is observation." })
      .pipe(EdgeVersionEntity.pg.text(), EdgeVersionEntity.pg.columnName("source_observation_ref")),
    supersedesId: Epistemic.EdgeVersionId.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Version this row replaced; absent for the first version and for late out-of-order arrivals.",
      })
      .pipe(EdgeVersionEntity.pg.integer(), EdgeVersionEntity.pg.columnName("supersedes_id")),
    targetClaimId: Epistemic.CandidateClaimId.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Target claim reference, populated only when the target kind is claim." })
      .pipe(EdgeVersionEntity.pg.integer(), EdgeVersionEntity.pg.columnName("target_claim_id")),
    targetEntityRef: EdgeEntityRef.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Target entity reference, populated only when the target kind is entity." })
      .pipe(EdgeVersionEntity.pg.text(), EdgeVersionEntity.pg.columnName("target_entity_ref")),
    targetEvidenceId: Epistemic.EvidenceId.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Target evidence reference, populated only when the target kind is evidence." })
      .pipe(EdgeVersionEntity.pg.integer(), EdgeVersionEntity.pg.columnName("target_evidence_id")),
    targetKind: EdgeEndpointKind.annotateKey({
      description: "Which reference column carries the target.",
    }).pipe(EdgeVersionEntity.pg.text(), EdgeVersionEntity.pg.columnName("target_kind")),
    targetObservationRef: EdgeObservationRef.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Target observation reference, populated only when the target kind is observation." })
      .pipe(EdgeVersionEntity.pg.text(), EdgeVersionEntity.pg.columnName("target_observation_ref")),
    validFrom: S.DateTimeUtcFromMillis.annotateKey({
      description: "Inclusive valid-time lower bound: when the fact started being true.",
    }).pipe(EdgeVersionEntity.pg.bigint("number"), EdgeVersionEntity.pg.columnName("valid_from")),
    validTo: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Exclusive valid-time upper bound; absent while the fact is still held true." })
      .pipe(EdgeVersionEntity.pg.bigint("number"), EdgeVersionEntity.pg.columnName("valid_to")),
    version: PosInt.annotateKey({
      description: "Monotonic version number within the logical edge.",
    }).pipe(EdgeVersionEntity.pg.integer()),
    ...EdgeVersionEntity.identityFields,
  },
  $I.annote("EdgeVersion", {
    description: "One immutable bitemporal version of one logical epistemic edge.",
  }),
  EdgeVersionEntity.entityExtras
) {}
