import { CandidateClaim as CandidateClaimModel } from "@beep/epistemic-domain/entities/CandidateClaim";
import { ClaimDisposition as ClaimDispositionModel } from "@beep/epistemic-domain/entities/ClaimDisposition";
import { EdgeVersion as EdgeVersionModel } from "@beep/epistemic-domain/entities/EdgeVersion";
import { Evidence as EvidenceModel } from "@beep/epistemic-domain/entities/Evidence";
import { UsageRecord as UsageRecordModel } from "@beep/epistemic-domain/entities/UsageRecord";
import { DbSchema, Entities } from "@beep/epistemic-tables";
import * as CandidateClaim from "@beep/epistemic-tables/entities/CandidateClaim";
import * as ClaimDisposition from "@beep/epistemic-tables/entities/ClaimDisposition";
import * as EdgeVersion from "@beep/epistemic-tables/entities/EdgeVersion";
import * as Evidence from "@beep/epistemic-tables/entities/Evidence";
import * as UsageRecord from "@beep/epistemic-tables/entities/UsageRecord";
import { baseEntityFixtureInput, fcRuns, systemPrincipal } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const UsageRecordArbitrary = S.toArbitrary(UsageRecordModel);
const UsageRecordEquivalence = S.toEquivalence(UsageRecordModel);

const usageRecordInput = (id: number) => ({
  ...baseEntityFixtureInput("EpistemicUsageRecord", id),
  activityId: 7,
  actor: systemPrincipal,
  costUsdApproxMicros: null,
  credentialReference: null,
  inputTokens: 12,
  latencyMillis: null,
  metadata: { trace: "fixture" },
  model: "fixture-model",
  outputTokens: 34,
  provider: "fixture",
  totalTokens: 46,
  unitCount: null,
});

const candidateClaimInput = (id: number) => ({
  ...baseEntityFixtureInput("EpistemicCandidateClaim", id),
  fixtureKey: "claim:patentability",
  lifecycle: "candidate",
  snapshot: { text: "The application describes a processor." },
});

const evidenceInput = (id: number) => ({
  ...baseEntityFixtureInput("EpistemicEvidence", id),
  artifactFixtureKey: "artifact:oa-1",
  span: {
    confidence: 0.92,
    endChar: 57,
    quote: "a processor configured to receive sensor data",
    startChar: 12,
  },
  spanFixtureKey: "span:oa-1:12-57",
});

// Exactly the decode input documented on EdgeVersion.model.ts: both temporal
// axes arrive as epoch millis and every open bound as null.
const edgeVersionInput = (id: number) => ({
  ...baseEntityFixtureInput("EpistemicEdgeVersion", id),
  evidenceScope: null,
  expiredAt: null,
  fact: { note: "cited in the office action" },
  logicalKey: "abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe",
  matterScope: null,
  qualifiers: { statute: "35 USC 103" },
  recordedAt: 1_000,
  relation: "supports",
  sourceClaimId: 1,
  sourceEntityRef: null,
  sourceEvidenceId: null,
  sourceKind: "claim",
  sourceObservationRef: null,
  supersedesId: null,
  targetClaimId: null,
  targetEntityRef: null,
  targetEvidenceId: 2,
  targetKind: "evidence",
  targetObservationRef: null,
  validFrom: 1_000,
  validTo: null,
  version: 1,
});

const claimDispositionInput = (id: number) => ({
  ...baseEntityFixtureInput("EpistemicClaimDisposition", id),
  claimId: 3,
  reason: "Expected at least 1 value(s) for evidence.",
  resolvedAt: 1_000,
  resolvedBy: systemPrincipal,
  status: "rejected",
  violations: [
    {
      focusNode: "https://beep.dev/epistemic/claim/patentability",
      message: "Expected at least 1 value(s) for evidence.",
      path: "https://beep.dev/epistemic/hasEvidenceQuote",
      severity: "violation",
    },
  ],
});

const baseEntityColumnNames = {
  createdAt: "created_at",
  createdByPrincipal: "created_by_principal",
  entityType: "entity_type",
  id: "id",
  orgId: "org_id",
  publicId: "public_id",
  rowVersion: "row_version",
  schemaVersion: "schema_version",
  source: "source",
  updatedAt: "updated_at",
  updatedByPrincipal: "updated_by_principal",
};

describe("EpistemicTables", () => {
  it("materializes UsageRecord metadata without executing a live database", () => {
    const config = getTableConfig(UsageRecord.Table);

    expect(UsageRecord.Table.definition.tableName).toBe("epistemic_usage_record");
    expect(UsageRecord.Table.definition.entityId.entityType).toBe("EpistemicUsageRecord");
    expect(UsageRecord.Table.entitySchema).toBe(UsageRecordModel);
    expect(config.name).toBe("epistemic_usage_record");

    const columns = getColumns(UsageRecord.Table);
    expect(columns.id.name).toBe("id");
    expect(columns.id.primary).toBe(true);
    expect(columns.id.columnType).toBe("PgSerial");
    expect(columns.entityType.name).toBe("entity_type");
    expect(columns.publicId.name).toBe("public_id");
    expect(columns.publicId.columnType).toBe("PgText");
    expect(columns.activityId.name).toBe("activity_id");
    expect(columns.activityId.columnType).toBe("PgInteger");
    expect(columns.activityId.notNull).toBe(false);
    expect(columns.actor.columnType).toBe("PgJsonb");
    expect(columns.metadata.columnType).toBe("PgJsonb");
    expect(columns.model.columnType).toBe("PgText");
    expect(columns.provider.columnType).toBe("PgText");
    expect(columns.costUsdApproxMicros.name).toBe("cost_usd_approx_micros");
    expect(columns.costUsdApproxMicros.notNull).toBe(false);
  });

  it("projects CandidateClaim onto the migrated column set", () => {
    expect(CandidateClaim.Table.definition.tableName).toBe("epistemic_candidate_claim");
    expect(CandidateClaim.Table.definition.entityId.entityType).toBe("EpistemicCandidateClaim");
    expect(CandidateClaim.Table.entitySchema).toBe(CandidateClaimModel);
    expect(getTableConfig(CandidateClaim.Table).name).toBe("epistemic_candidate_claim");

    const columns = getColumns(CandidateClaim.Table);
    expect(R.map(columns, (column) => column.name)).toStrictEqual({
      ...baseEntityColumnNames,
      fixtureKey: "fixture_key",
      lifecycle: "lifecycle",
      snapshot: "snapshot",
    });
    expect(columns.id.columnType).toBe("PgSerial");
    expect(columns.id.primary).toBe(true);
    expect(columns.fixtureKey.columnType).toBe("PgText");
    expect(columns.lifecycle.columnType).toBe("PgText");
    expect(columns.snapshot.columnType).toBe("PgJsonb");
    expect(columns.snapshot.notNull).toBe(true);
  });

  it("projects Evidence onto the migrated column set", () => {
    expect(Evidence.Table.definition.tableName).toBe("epistemic_evidence");
    expect(Evidence.Table.definition.entityId.entityType).toBe("EpistemicEvidence");
    expect(Evidence.Table.entitySchema).toBe(EvidenceModel);
    expect(getTableConfig(Evidence.Table).name).toBe("epistemic_evidence");

    const columns = getColumns(Evidence.Table);
    expect(R.map(columns, (column) => column.name)).toStrictEqual({
      ...baseEntityColumnNames,
      artifactFixtureKey: "artifact_fixture_key",
      span: "span",
      spanFixtureKey: "span_fixture_key",
    });
    expect(columns.artifactFixtureKey.columnType).toBe("PgText");
    expect(columns.spanFixtureKey.columnType).toBe("PgText");
    // The span is JSONB precisely so the fractional confidence survives: there
    // is no float storage kind to project it onto.
    expect(columns.span.columnType).toBe("PgJsonb");
  });

  it("projects EdgeVersion onto the migrated bitemporal column set", () => {
    expect(EdgeVersion.Table.definition.tableName).toBe("epistemic_edge_version");
    expect(EdgeVersion.Table.definition.entityId.entityType).toBe("EpistemicEdgeVersion");
    expect(EdgeVersion.Table.entitySchema).toBe(EdgeVersionModel);
    expect(getTableConfig(EdgeVersion.Table).name).toBe("epistemic_edge_version");

    const columns = getColumns(EdgeVersion.Table);
    expect(R.map(columns, (column) => column.name)).toStrictEqual({
      ...baseEntityColumnNames,
      evidenceScope: "evidence_scope",
      expiredAt: "expired_at",
      fact: "fact",
      logicalKey: "logical_key",
      matterScope: "matter_scope",
      qualifiers: "qualifiers",
      recordedAt: "recorded_at",
      relation: "relation",
      sourceClaimId: "source_claim_id",
      sourceEntityRef: "source_entity_ref",
      sourceEvidenceId: "source_evidence_id",
      sourceKind: "source_kind",
      sourceObservationRef: "source_observation_ref",
      supersedesId: "supersedes_id",
      targetClaimId: "target_claim_id",
      targetEntityRef: "target_entity_ref",
      targetEvidenceId: "target_evidence_id",
      targetKind: "target_kind",
      targetObservationRef: "target_observation_ref",
      validFrom: "valid_from",
      validTo: "valid_to",
      version: "version",
    });

    // Both axes are BIGINT epoch millis, and only the lower bound of each is
    // required — an absent upper bound is a nullable column, never a sentinel.
    expect(columns.validFrom.columnType).toBe("PgBigInt53");
    expect(columns.validFrom.notNull).toBe(true);
    expect(columns.validTo.columnType).toBe("PgBigInt53");
    expect(columns.validTo.notNull).toBe(false);
    expect(columns.recordedAt.columnType).toBe("PgBigInt53");
    expect(columns.recordedAt.notNull).toBe(true);
    expect(columns.expiredAt.columnType).toBe("PgBigInt53");
    expect(columns.expiredAt.notNull).toBe(false);

    expect(columns.logicalKey.columnType).toBe("PgText");
    expect(columns.logicalKey.notNull).toBe(true);
    expect(columns.relation.columnType).toBe("PgText");
    expect(columns.sourceKind.columnType).toBe("PgText");
    expect(columns.targetKind.columnType).toBe("PgText");
    expect(columns.fact.columnType).toBe("PgJsonb");
    expect(columns.qualifiers.columnType).toBe("PgJsonb");
    expect(columns.version.columnType).toBe("PgInteger");
    expect(columns.version.notNull).toBe(true);

    expect(columns.sourceClaimId.columnType).toBe("PgInteger");
    expect(columns.sourceClaimId.notNull).toBe(false);
    expect(columns.sourceEvidenceId.columnType).toBe("PgInteger");
    expect(columns.targetClaimId.columnType).toBe("PgInteger");
    expect(columns.targetEvidenceId.columnType).toBe("PgInteger");
    expect(columns.supersedesId.columnType).toBe("PgInteger");
    expect(columns.supersedesId.notNull).toBe(false);
    expect(columns.sourceEntityRef.columnType).toBe("PgText");
    expect(columns.sourceObservationRef.columnType).toBe("PgText");
    expect(columns.targetEntityRef.columnType).toBe("PgText");
    expect(columns.targetObservationRef.columnType).toBe("PgText");
  });

  it("projects ClaimDisposition onto the migrated column set", () => {
    expect(ClaimDisposition.Table.definition.tableName).toBe("epistemic_claim_disposition");
    expect(ClaimDisposition.Table.definition.entityId.entityType).toBe("EpistemicClaimDisposition");
    expect(ClaimDisposition.Table.entitySchema).toBe(ClaimDispositionModel);
    expect(getTableConfig(ClaimDisposition.Table).name).toBe("epistemic_claim_disposition");

    const columns = getColumns(ClaimDisposition.Table);
    expect(R.map(columns, (column) => column.name)).toStrictEqual({
      ...baseEntityColumnNames,
      claimId: "claim_id",
      reason: "reason",
      resolvedAt: "resolved_at",
      resolvedBy: "resolved_by",
      status: "status",
      violations: "violations",
    });
    expect(columns.claimId.columnType).toBe("PgInteger");
    expect(columns.claimId.notNull).toBe(true);
    expect(columns.reason.columnType).toBe("PgText");
    expect(columns.resolvedAt.columnType).toBe("PgBigInt53");
    expect(columns.resolvedBy.columnType).toBe("PgJsonb");
    expect(columns.status.columnType).toBe("PgText");
    expect(columns.violations.columnType).toBe("PgJsonb");
  });

  it("exports the metadata aggregate and entity namespaces", () => {
    expect(DbSchema.usageRecord).toBe(UsageRecord.Table);
    expect(DbSchema.candidateClaim).toBe(CandidateClaim.Table);
    expect(DbSchema.claimDisposition).toBe(ClaimDisposition.Table);
    expect(DbSchema.contradictionCandidate).toBe(Entities.Contradiction.candidateTable);
    expect(DbSchema.contradictionDisposition).toBe(Entities.Contradiction.dispositionTable);
    expect(DbSchema.contradictionReceipt).toBe(Entities.Contradiction.receiptTable);
    expect(DbSchema.edgeVersion).toBe(EdgeVersion.Table);
    expect(DbSchema.evidence).toBe(Evidence.Table);
    expect(Entities.UsageRecord.Table).toBe(UsageRecord.Table);
    expect(Entities.CandidateClaim.Table).toBe(CandidateClaim.Table);
    expect(Entities.ClaimDisposition.Table).toBe(ClaimDisposition.Table);
    expect(Entities.EdgeVersion.Table).toBe(EdgeVersion.Table);
    expect(Entities.Evidence.Table).toBe(Evidence.Table);
  });

  it("leaves organization-scoped receipt-key uniqueness to the raw migration", () => {
    const indexNames = A.map(
      getTableConfig(DbSchema.contradictionReceipt).indexes,
      (indexConfig) => indexConfig.config.name
    );

    expect(indexNames).not.toContain("epistemic_contradiction_receipt_receipt_key_unique_idx");
  });

  it("round-trips a UsageRecord row through the converters", () => {
    const record = S.decodeUnknownSync(UsageRecordModel)(usageRecordInput(10));

    const insert = UsageRecord.toUsageRecordInsert(record);
    expect("id" in insert).toBe(false);
    expect(insert.provider).toBe("fixture");
    expect(insert.model).toBe("fixture-model");
    expect(insert.entityType).toBe("EpistemicUsageRecord");
    expect(insert.activityId).toBe(7);
    expect(insert.inputTokens).toBe(12);
    expect(insert.outputTokens).toBe(34);
    expect(insert.totalTokens).toBe(46);
    expect(insert.costUsdApproxMicros).toBeNull();
    expect(insert.credentialReference).toBeNull();
    expect(insert.unitCount).toBeNull();

    const decoded = UsageRecord.fromUsageRecordRow({
      ...insert,
      id: 10,
      // $inferInsert types the nullable columns as optional (number | null |
      // undefined); the select-row converter expects number | null, so resolve
      // each absent optional to its concrete null before round-tripping.
      activityId: insert.activityId ?? null,
      costUsdApproxMicros: insert.costUsdApproxMicros ?? null,
      credentialReference: insert.credentialReference ?? null,
      inputTokens: insert.inputTokens ?? null,
      latencyMillis: insert.latencyMillis ?? null,
      outputTokens: insert.outputTokens ?? null,
      totalTokens: insert.totalTokens ?? null,
      unitCount: insert.unitCount ?? null,
    });
    expect(decoded.provider).toBe("fixture");
    expect(decoded.model).toBe("fixture-model");
    expect(O.getOrNull(decoded.inputTokens)).toBe(12);
    expect(O.getOrNull(decoded.costUsdApproxMicros)).toBeNull();
    expect(O.isNone(decoded.unitCount)).toBe(true);
  });

  it("round-trips a CandidateClaim row through the converters", () => {
    const claim = S.decodeUnknownSync(CandidateClaimModel)(candidateClaimInput(10));

    const insert = CandidateClaim.toCandidateClaimInsert(claim);
    expect("id" in insert).toBe(false);
    expect(insert.entityType).toBe("EpistemicCandidateClaim");
    expect(insert.fixtureKey).toBe("claim:patentability");
    expect(insert.lifecycle).toBe("candidate");
    expect(insert.snapshot).toStrictEqual({ text: "The application describes a processor." });

    const decoded = CandidateClaim.fromCandidateClaimRow({ ...insert, id: 10 });
    expect(decoded.id).toBe(10);
    expect(decoded.fixtureKey).toBe("claim:patentability");
    expect(decoded.lifecycle).toBe("candidate");
  });

  it("round-trips an Evidence row through the converters", () => {
    const evidence = S.decodeUnknownSync(EvidenceModel)(evidenceInput(10));

    const insert = Evidence.toEvidenceInsert(evidence);
    expect("id" in insert).toBe(false);
    expect(insert.entityType).toBe("EpistemicEvidence");
    expect(insert.artifactFixtureKey).toBe("artifact:oa-1");
    expect(insert.spanFixtureKey).toBe("span:oa-1:12-57");
    expect(insert.span).toStrictEqual({
      confidence: 0.92,
      endChar: 57,
      quote: "a processor configured to receive sensor data",
      startChar: 12,
    });

    const decoded = Evidence.fromEvidenceRow({ ...insert, id: 10 });
    expect(decoded.id).toBe(10);
    expect(decoded.span.quote).toBe("a processor configured to receive sensor data");
    expect(decoded.span.confidence).toBe(0.92);
  });

  it("normalizes legacy Evidence span widths on read and writes only the strict width", () => {
    const evidence = Result.getOrThrow(S.decodeUnknownResult(EvidenceModel)(evidenceInput(10)));
    const insert = Evidence.toEvidenceInsert(evidence);
    const legacyRow = {
      ...insert,
      id: 10,
      span: {
        ...insert.span,
        endChar: 48,
      },
      spanFixtureKey: "span:oa-1:12-48",
    };

    expect(Result.isFailure(S.decodeUnknownResult(EvidenceModel)(legacyRow))).toBe(true);

    const decoded = Evidence.fromEvidenceRow(legacyRow);
    const canonicalInsert = Evidence.toEvidenceInsert(decoded);

    expect(decoded.span.startChar).toBe(12);
    expect(decoded.span.endChar).toBe(57);
    expect(decoded.span.quote).toBe("a processor configured to receive sensor data");
    expect(decoded.spanFixtureKey).toBe("span:oa-1:12-48");
    expect(canonicalInsert.span.endChar).toBe(57);
  });

  // Exhaustive per-column assertion walk over the widest table in the slice;
  // branch count is the column count, not logic to simplify.
  // fallow-ignore-next-line complexity -- exhaustive assertions cover every column of the slice's widest table
  it("round-trips an EdgeVersion row through the converters", () => {
    const version = S.decodeUnknownSync(EdgeVersionModel)(edgeVersionInput(10));

    const insert = EdgeVersion.toEdgeVersionInsert(version);
    expect("id" in insert).toBe(false);
    expect(insert.entityType).toBe("EpistemicEdgeVersion");
    expect(insert.logicalKey).toBe("abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe");
    expect(insert.relation).toBe("supports");
    expect(insert.sourceKind).toBe("claim");
    expect(insert.sourceClaimId).toBe(1);
    expect(insert.targetKind).toBe("evidence");
    expect(insert.targetEvidenceId).toBe(2);
    expect(insert.qualifiers).toStrictEqual({ statute: "35 USC 103" });
    expect(insert.fact).toStrictEqual({ note: "cited in the office action" });
    expect(insert.version).toBe(1);
    // Open upper bounds encode to null on both axes rather than to a sentinel.
    expect(insert.validFrom).toBe(1_000);
    expect(insert.validTo).toBeNull();
    expect(insert.recordedAt).toBe(1_000);
    expect(insert.expiredAt).toBeNull();
    expect(insert.supersedesId).toBeNull();

    const decoded = EdgeVersion.fromEdgeVersionRow({
      ...insert,
      id: 10,
      evidenceScope: insert.evidenceScope ?? null,
      expiredAt: insert.expiredAt ?? null,
      matterScope: insert.matterScope ?? null,
      sourceClaimId: insert.sourceClaimId ?? null,
      sourceEntityRef: insert.sourceEntityRef ?? null,
      sourceEvidenceId: insert.sourceEvidenceId ?? null,
      sourceObservationRef: insert.sourceObservationRef ?? null,
      supersedesId: insert.supersedesId ?? null,
      targetClaimId: insert.targetClaimId ?? null,
      targetEntityRef: insert.targetEntityRef ?? null,
      targetEvidenceId: insert.targetEvidenceId ?? null,
      targetObservationRef: insert.targetObservationRef ?? null,
      validTo: insert.validTo ?? null,
    });
    expect(decoded.id).toBe(10);
    expect(decoded.relation).toBe("supports");
    expect(O.getOrNull(decoded.sourceClaimId)).toBe(1);
    expect(O.getOrNull(decoded.targetEvidenceId)).toBe(2);
    expect(O.isNone(decoded.validTo)).toBe(true);
    expect(O.isNone(decoded.expiredAt)).toBe(true);
    expect(O.isNone(decoded.supersedesId)).toBe(true);
    expect(O.isNone(decoded.matterScope)).toBe(true);
    expect(O.isNone(decoded.evidenceScope)).toBe(true);
  });

  // Same exhaustive column walk for the closed/Option-some variant.
  // fallow-ignore-next-line complexity -- exhaustive assertions cover the closed and Option-some column variant
  it("round-trips a closed EdgeVersion row through the converters", () => {
    const closed = S.decodeUnknownSync(EdgeVersionModel)({
      ...edgeVersionInput(11),
      evidenceScope: "evidence-set-1",
      expiredAt: 2_500,
      matterScope: "matter-1",
      sourceClaimId: null,
      sourceEntityRef: "workspace:matter-1",
      sourceKind: "entity",
      supersedesId: 10,
      targetEvidenceId: null,
      targetKind: "observation",
      targetObservationRef: "observation:run-1:step-3",
      validTo: 2_000,
      version: 2,
    });

    const insert = EdgeVersion.toEdgeVersionInsert(closed);
    expect(insert.evidenceScope).toBe("evidence-set-1");
    expect(insert.matterScope).toBe("matter-1");
    expect(insert.sourceKind).toBe("entity");
    expect(insert.sourceEntityRef).toBe("workspace:matter-1");
    expect(insert.targetKind).toBe("observation");
    expect(insert.targetObservationRef).toBe("observation:run-1:step-3");
    expect(insert.supersedesId).toBe(10);
    expect(insert.validTo).toBe(2_000);
    expect(insert.expiredAt).toBe(2_500);
    expect(insert.version).toBe(2);

    const decoded = EdgeVersion.fromEdgeVersionRow({
      ...insert,
      id: 11,
      evidenceScope: insert.evidenceScope ?? null,
      expiredAt: insert.expiredAt ?? null,
      matterScope: insert.matterScope ?? null,
      sourceClaimId: insert.sourceClaimId ?? null,
      sourceEntityRef: insert.sourceEntityRef ?? null,
      sourceEvidenceId: insert.sourceEvidenceId ?? null,
      sourceObservationRef: insert.sourceObservationRef ?? null,
      supersedesId: insert.supersedesId ?? null,
      targetClaimId: insert.targetClaimId ?? null,
      targetEntityRef: insert.targetEntityRef ?? null,
      targetEvidenceId: insert.targetEvidenceId ?? null,
      targetObservationRef: insert.targetObservationRef ?? null,
      validTo: insert.validTo ?? null,
    });
    expect(O.getOrNull(O.map(decoded.validTo, DateTime.toEpochMillis))).toBe(2_000);
    expect(O.getOrNull(O.map(decoded.expiredAt, DateTime.toEpochMillis))).toBe(2_500);
    expect(O.getOrNull(decoded.supersedesId)).toBe(10);
    expect(O.getOrNull(decoded.sourceEntityRef)).toBe("workspace:matter-1");
    expect(O.getOrNull(decoded.targetObservationRef)).toBe("observation:run-1:step-3");
  });

  it("round-trips a ClaimDisposition row through the converters", () => {
    const disposition = S.decodeUnknownSync(ClaimDispositionModel)(claimDispositionInput(10));

    const insert = ClaimDisposition.toClaimDispositionInsert(disposition);
    expect("id" in insert).toBe(false);
    expect(insert.entityType).toBe("EpistemicClaimDisposition");
    expect(insert.claimId).toBe(3);
    expect(insert.status).toBe("rejected");
    expect(insert.reason).toBe("Expected at least 1 value(s) for evidence.");
    expect(insert.resolvedAt).toBe(1_000);
    expect(insert.resolvedBy).toStrictEqual(systemPrincipal);
    expect(insert.violations).toStrictEqual([
      {
        focusNode: "https://beep.dev/epistemic/claim/patentability",
        message: "Expected at least 1 value(s) for evidence.",
        path: "https://beep.dev/epistemic/hasEvidenceQuote",
        severity: "violation",
      },
    ]);

    const decoded = ClaimDisposition.fromClaimDispositionRow({ ...insert, id: 10 });
    expect(decoded.id).toBe(10);
    expect(decoded.status).toBe("rejected");
    expect(decoded.violations[0]?.severity).toBe("violation");
  });

  it("round-trips schema-derived UsageRecords through the row converters", () =>
    fc.assert(
      fc.property(UsageRecordArbitrary, (record) => {
        const insert = UsageRecord.toUsageRecordInsert(record);
        const decoded = UsageRecord.fromUsageRecordRow({
          ...insert,
          id: record.id,
          activityId: insert.activityId ?? null,
          costUsdApproxMicros: insert.costUsdApproxMicros ?? null,
          credentialReference: insert.credentialReference ?? null,
          inputTokens: insert.inputTokens ?? null,
          latencyMillis: insert.latencyMillis ?? null,
          outputTokens: insert.outputTokens ?? null,
          totalTokens: insert.totalTokens ?? null,
          unitCount: insert.unitCount ?? null,
        });

        expect(UsageRecordEquivalence(decoded, record)).toBe(true);
      }),
      fcRuns(50)
    ));
});
