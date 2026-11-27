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
import { Confidence } from "@beep/epistemics/Confidence";
import { EvidencePosition } from "@beep/epistemics/EvidencePosition.schema";
import { TextAnchorWidthCheck } from "@beep/text/TextAnchor";

const evidenceQuoteMaximum = 65_536;
const FrozenStrictPosition = S.Struct({
  startChar: S.Natural,
  endChar: S.Natural,
  quote: S.NonEmptyString.check(S.isMaxLength(65_536)),
  confidence: Confidence,
}).check(TextAnchorWidthCheck);

import { $EpistemicId } from "@beep/identity/packages";
import { it } from "@beep/test-runner";
import { fcRuns, productEntityFixtureInput, systemPrincipal } from "@beep/test-utils";
import * as P4NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as P4Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as P4FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as P4Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const sqlDefaultedRowVersion = (rowVersion: number | undefined): number => rowVersion ?? 1;

const decodeEvidenceModelResult = S.decodeUnknownResult(EvidenceModel);
const decodeUnknownEvidenceModelResult = S.decodeUnknownResult(EvidenceModel);
const decodeUnknownCandidateClaimModel = S.decodeUnknownEffect(CandidateClaimModel);
const decodeUnknownClaimDispositionModel = S.decodeUnknownEffect(ClaimDispositionModel);
const decodeUnknownEdgeVersionModel = S.decodeUnknownEffect(EdgeVersionModel);
const decodeUnknownEvidenceModel = S.decodeUnknownEffect(EvidenceModel);
const decodeUnknownUsageRecordModel = S.decodeUnknownEffect(UsageRecordModel);

const UsageRecordArbitrary = Arbitrary.schema(UsageRecordModel);
const UsageRecordEquivalence = S.toEquivalence(UsageRecordModel);

const absentAsNull = <A>(value: A | null | undefined): A | null => value ?? null;

const edgeVersionRow = (insert: EdgeVersion.EdgeVersionInsert, id: number): EdgeVersion.EdgeVersionRow => ({
  ...insert,
  deletedAt: absentAsNull(insert.deletedAt),
  deletedByPrincipal: absentAsNull(insert.deletedByPrincipal),
  rowVersion: sqlDefaultedRowVersion(insert.rowVersion),
  id,
  evidenceScope: absentAsNull(insert.evidenceScope),
  expiredAt: absentAsNull(insert.expiredAt),
  matterScope: absentAsNull(insert.matterScope),
  sourceClaimId: absentAsNull(insert.sourceClaimId),
  sourceEntityRef: absentAsNull(insert.sourceEntityRef),
  sourceEvidenceId: absentAsNull(insert.sourceEvidenceId),
  sourceObservationRef: absentAsNull(insert.sourceObservationRef),
  supersedesId: absentAsNull(insert.supersedesId),
  targetClaimId: absentAsNull(insert.targetClaimId),
  targetEntityRef: absentAsNull(insert.targetEntityRef),
  targetEvidenceId: absentAsNull(insert.targetEvidenceId),
  targetObservationRef: absentAsNull(insert.targetObservationRef),
  validTo: absentAsNull(insert.validTo),
});

const usageRecordInput = (id: number) => ({
  ...productEntityFixtureInput("EpistemicUsageRecord", id),
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
  ...productEntityFixtureInput("EpistemicCandidateClaim", id),
  fixtureKey: "claim:patentability",
  lifecycle: "candidate",
  snapshot: { text: "The application describes a processor." },
});

const evidenceInput = (id: number) => ({
  ...productEntityFixtureInput("EpistemicEvidence", id),
  artifactFixtureKey: "artifact:oa-1",
  span: {
    version: "evidence-position/v2",
    position: { endChar: 57, quote: "a processor configured to receive sensor data", startChar: 12 },
    extractorConfidence: {
      _tag: "Present",
      value: { _tag: "ReportedConfidence", value: 0.92, method: "synthetic-fixture" },
    },
  },
  spanFixtureKey: "span:oa-1:12-57",
});

const frozenEvidenceRow =
  '{"createdAt":10,"rowVersion":1,"updatedAt":11,"createdByPrincipal":{"component":"Runtime","kind":"System"},"deletedAt":null,"deletedByPrincipal":null,"schemaVersion":"0.0.0","source":"System","updatedByPrincipal":{"component":"Runtime","kind":"System"},"orgId":1,"artifactFixtureKey":"artifact:oa-1","spanFixtureKey":"span:oa-1:12-57","span":{"startChar":12,"endChar":57,"quote":"a processor configured to receive sensor data","confidence":0.92},"entityType":"EpistemicEvidence","publicId":"epistemic_evidence_a10","id":10}';
const FrozenEvidenceColumns = EvidenceModel.select.mapFields(({ id, publicId, ...fields }) => ({
  ...fields,
  span: FrozenStrictPosition,
  publicId,
  id,
}));
const EvidenceColumnsJson = S.toEncoded(FrozenEvidenceColumns).pipe(S.fromJsonString);
const decodeCurrentPosition = S.decodeUnknownResult(S.toType(EvidencePosition));

const edgeVersionInput = (id: number) => ({
  ...productEntityFixtureInput("EpistemicEdgeVersion", id),
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
  ...productEntityFixtureInput("EpistemicClaimDisposition", id),
  claimId: 3,
  reason: "Expected at least 1 value(s) for evidence.",
  resolvedAt: 1_000,
  resolvedBy: systemPrincipal,
  status: "rejected",
  violations: [
    {
      focusNode: $EpistemicId.create("claim/patentability").iri,
      message: "Expected at least 1 value(s) for evidence.",
      path: $EpistemicId.create("hasEvidenceQuote").iri,
      severity: "violation",
    },
  ],
});

const modelInstanceWithBadPublicId = <A extends object>(entity: A): A =>
  Object.assign(Object.create(Object.getPrototypeOf(entity)), entity, { publicId: 42 });

const converterFailure = <A, E>(result: Result.Result<A, E>): Effect.Effect<E, A> =>
  result.pipe(Result.flip, Effect.fromResult);

const expectConverterFailure = (
  error: { readonly _tag: string; readonly operation: string; readonly reason: string },
  tag: string,
  operation: string
): void => {
  expect(error._tag).toBe(tag);
  expect(error.operation).toBe(operation);
  expect(Str.isNonEmpty(error.reason)).toBe(true);
};

const emptyMessageSchemaError = S.decodeUnknownResult(S.String.annotate({ message: "" }))(0).pipe(
  Result.flip,
  Effect.fromResult
);

const fallbackReasonCases = [
  [
    "CandidateClaimConverterError",
    (error: S.SchemaError) => CandidateClaim.CandidateClaimConverterError.fromSchema("fromRow", error),
  ],
  [
    "ClaimDispositionConverterError",
    (error: S.SchemaError) => ClaimDisposition.ClaimDispositionConverterError.fromSchema("fromRow", error),
  ],
  [
    "EdgeVersionConverterError",
    (error: S.SchemaError) => EdgeVersion.EdgeVersionConverterError.fromSchema("fromRow", error),
  ],
  ["EvidenceConverterError", (error: S.SchemaError) => Evidence.EvidenceConverterError.fromSchema("fromRow", error)],
  [
    "UsageRecordConverterError",
    (error: S.SchemaError) => UsageRecord.UsageRecordConverterError.fromSchema("fromRow", error),
  ],
] as const;

const baseEntityColumnNames = {
  createdAt: "created_at",
  createdByPrincipal: "created_by_principal",
  deletedAt: "deleted_at",
  deletedByPrincipal: "deleted_by_principal",
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

    expect(UsageRecord.TABLE_NAME).toBe("epistemic_usage_record");
    expect(UsageRecordModel.sql.tableName).toBe("epistemic_usage_record");
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
    const indexNames = A.map(config.indexes, (index) => index.config.name);
    expect(indexNames).toHaveLength(3);
    expect(indexNames).toEqual(
      expect.arrayContaining([
        "epistemic_usage_record_org_id_btree_idx",
        "epistemic_usage_record_source_btree_idx",
        "epistemic_usage_record_public_id_unique_idx",
      ])
    );
  });

  it("projects CandidateClaim onto the migrated column set", () => {
    expect(CandidateClaimModel.sql.tableName).toBe("epistemic_candidate_claim");
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
    expect(EvidenceModel.sql.tableName).toBe("epistemic_evidence");
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
    expect(columns.span.columnType, "JSONB keeps the fractional confidence; there is no float storage kind").toBe(
      "PgJsonb"
    );
  });

  it("projects EdgeVersion onto the migrated bitemporal column set", () => {
    expect(EdgeVersionModel.sql.tableName).toBe("epistemic_edge_version");
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

    expect(columns.validFrom.columnType).toBe("PgBigInt53");
    expect(columns.validFrom.notNull).toBe(true);
    expect(columns.validTo.columnType).toBe("PgBigInt53");
    expect(columns.validTo.notNull, "an absent upper bound is a nullable column, never a sentinel").toBe(false);
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
    expect(ClaimDispositionModel.sql.tableName).toBe("epistemic_claim_disposition");
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

  it.effect(
    "round-trips a UsageRecord row through the converters",
    Effect.fnUntraced(function* () {
      const record = yield* decodeUnknownUsageRecordModel(usageRecordInput(10));

      const insert = yield* Effect.fromResult(UsageRecord.toUsageRecordInsert(record));
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

      const decoded = yield* Effect.fromResult(
        UsageRecord.fromUsageRecordRow({
          ...insert,
          deletedAt: absentAsNull(insert.deletedAt),
          deletedByPrincipal: absentAsNull(insert.deletedByPrincipal),
          rowVersion: sqlDefaultedRowVersion(insert.rowVersion),
          id: 10,
          activityId: insert.activityId ?? null,
          costUsdApproxMicros: insert.costUsdApproxMicros ?? null,
          credentialReference: insert.credentialReference ?? null,
          inputTokens: insert.inputTokens ?? null,
          latencyMillis: insert.latencyMillis ?? null,
          outputTokens: insert.outputTokens ?? null,
          totalTokens: insert.totalTokens ?? null,
          unitCount: insert.unitCount ?? null,
        })
      );
      expect(decoded.provider).toBe("fixture");
      expect(decoded.model).toBe("fixture-model");
      expect(O.getOrNull(decoded.inputTokens)).toBe(12);
      expect(O.getOrNull(decoded.costUsdApproxMicros)).toBeNull();
      assertNone(decoded.unitCount);
    })
  );

  it.effect(
    "round-trips a CandidateClaim row through the converters",
    Effect.fnUntraced(function* () {
      const claim = yield* decodeUnknownCandidateClaimModel(candidateClaimInput(10));

      const insert = yield* Effect.fromResult(CandidateClaim.toCandidateClaimInsert(claim));
      expect("id" in insert).toBe(false);
      expect(insert.entityType).toBe("EpistemicCandidateClaim");
      expect(insert.fixtureKey).toBe("claim:patentability");
      expect(insert.lifecycle).toBe("candidate");
      expect(insert.snapshot).toStrictEqual({ text: "The application describes a processor." });

      const decoded = yield* Effect.fromResult(
        CandidateClaim.fromCandidateClaimRow({
          ...insert,
          deletedAt: absentAsNull(insert.deletedAt),
          deletedByPrincipal: absentAsNull(insert.deletedByPrincipal),
          rowVersion: sqlDefaultedRowVersion(insert.rowVersion),
          id: 10,
        })
      );
      expect(decoded.id).toBe(10);
      expect(decoded.fixtureKey).toBe("claim:patentability");
      expect(decoded.lifecycle).toBe("candidate");
    })
  );

  it.effect(
    "round-trips an Evidence row through the converters",
    Effect.fnUntraced(function* () {
      const evidence = yield* decodeUnknownEvidenceModel(evidenceInput(10));

      const insert = yield* Effect.fromResult(Evidence.toEvidenceInsert(evidence));
      expect("id" in insert).toBe(false);
      expect(insert.entityType).toBe("EpistemicEvidence");
      expect(insert.artifactFixtureKey).toBe("artifact:oa-1");
      expect(insert.spanFixtureKey).toBe("span:oa-1:12-57");
      expect(insert.span).toStrictEqual(evidenceInput(10).span);

      const decoded = yield* Effect.fromResult(
        Evidence.fromEvidenceRow({
          ...insert,
          deletedAt: absentAsNull(insert.deletedAt),
          deletedByPrincipal: absentAsNull(insert.deletedByPrincipal),
          rowVersion: sqlDefaultedRowVersion(insert.rowVersion),
          id: 10,
        })
      );
      expect(decoded.id).toBe(10);
      expect(Result.getOrThrow(decodeCurrentPosition(decoded.span)).position.quote).toBe(
        "a processor configured to receive sensor data"
      );
      expect(decoded.span).toMatchObject({ extractorConfidence: { _tag: "Present", value: { value: 0.92 } } });
    })
  );

  it.effect(
    "reads frozen Evidence bytes (written by toEvidenceInsert before the anchor schemas moved package; never regenerated) and writes only the versioned position format",
    Effect.fnUntraced(function* () {
      const columns = yield* S.decodeEffect(EvidenceColumnsJson)(frozenEvidenceRow);
      assertTrue(
        Result.isFailure(decodeUnknownEvidenceModelResult(columns)),
        "the strict model refuses the frozen unversioned span; only the legacy row read keeps it alive"
      );
      const read = yield* Effect.fromResult(
        Evidence.fromEvidenceRow({
          ...columns,
          deletedAt: absentAsNull(columns.deletedAt),
          deletedByPrincipal: absentAsNull(columns.deletedByPrincipal),
        })
      );
      expect(read.span).toMatchObject({
        version: "evidence-position/v2",
        position: { startChar: columns.span.startChar, endChar: columns.span.endChar, quote: columns.span.quote },
        extractorConfidence: { _tag: "Present", value: { value: 0.92, method: "legacy-reported" } },
      });
      const reinsert = yield* Effect.fromResult(Evidence.toEvidenceInsert(read));
      expect(reinsert.span).toMatchObject({ version: "evidence-position/v2" });
      const unchanged = yield* S.encodeEffect(EvidenceColumnsJson)(columns);
      expect(unchanged).toBe(frozenEvidenceRow);
    })
  );

  it.effect(
    "normalizes legacy Evidence span widths on read and writes only the strict width",
    Effect.fnUntraced(function* () {
      const evidence = yield* Effect.fromResult(decodeUnknownEvidenceModelResult(evidenceInput(10)));
      const insert = yield* Effect.fromResult(Evidence.toEvidenceInsert(evidence));
      const legacyRow = {
        ...insert,
        deletedAt: absentAsNull(insert.deletedAt),
        deletedByPrincipal: absentAsNull(insert.deletedByPrincipal),
        rowVersion: sqlDefaultedRowVersion(insert.rowVersion),
        id: 10,
        span: {
          confidence: 0.92,
          startChar: 12,
          quote: "a processor configured to receive sensor data",
          endChar: 48,
        },
        spanFixtureKey: "span:oa-1:12-48",
      };

      pipe(decodeEvidenceModelResult(legacyRow), Result.isFailure, assertTrue);

      const decoded = yield* Effect.fromResult(Evidence.fromEvidenceRow(legacyRow));
      const canonicalInsert = yield* Effect.fromResult(Evidence.toEvidenceInsert(decoded));

      expect(Result.getOrThrow(decodeCurrentPosition(decoded.span)).position.startChar).toBe(12);
      expect(Result.getOrThrow(decodeCurrentPosition(decoded.span)).position.endChar).toBe(57);
      expect(Result.getOrThrow(decodeCurrentPosition(decoded.span)).position.quote).toBe(
        "a processor configured to receive sensor data"
      );
      expect(decoded.spanFixtureKey).toBe("span:oa-1:12-48");
      expect(Result.getOrThrow(S.decodeUnknownResult(EvidencePosition)(canonicalInsert.span)).position.endChar).toBe(
        57
      );
    })
  );

  it.effect(
    "preserves reads of legacy Evidence quotes above the current write bound",
    Effect.fnUntraced(function* () {
      const evidence = yield* Effect.fromResult(decodeUnknownEvidenceModelResult(evidenceInput(10)));
      const insert = yield* Effect.fromResult(Evidence.toEvidenceInsert(evidence));
      const quote = Str.repeat(evidenceQuoteMaximum + 1)("a");
      const legacyRow = {
        ...insert,
        deletedAt: absentAsNull(insert.deletedAt),
        deletedByPrincipal: absentAsNull(insert.deletedByPrincipal),
        rowVersion: sqlDefaultedRowVersion(insert.rowVersion),
        id: 10,
        span: {
          confidence: 0.92,
          startChar: 12,
          endChar: 12 + Str.length(quote),
          quote,
        },
      };

      pipe(decodeEvidenceModelResult(legacyRow), Result.isFailure, assertTrue);

      const decoded = yield* Effect.fromResult(Evidence.fromEvidenceRow(legacyRow));

      expect(decoded.span).toMatchObject({ _tag: "LegacyEvidenceUnresolved", quote });
      expect(decoded.span).toMatchObject({ endChar: 12 + Str.length(quote) });

      const reencoded = Evidence.toEvidenceInsert(decoded);
      pipe(reencoded, Result.isFailure, assertTrue);
      const encodeError = yield* reencoded.pipe(Result.flip, Effect.fromResult);
      expect(encodeError._tag).toBe("EvidenceConverterError");
      expect(encodeError.operation).toBe("toInsert");
    })
  );

  it.effect(
    "rejects malformed Evidence rows with a schema error",
    Effect.fnUntraced(function* () {
      const evidence = yield* decodeUnknownEvidenceModel(evidenceInput(10));
      const malformedRow = {
        ...(yield* Effect.fromResult(Evidence.toEvidenceInsert(evidence))),
        id: 10,
        span: null,
      } as unknown as Evidence.EvidenceRow;

      const decodeResult = Evidence.fromEvidenceRow(malformedRow);
      pipe(decodeResult, Result.isFailure, assertTrue);
      const decodeError = yield* decodeResult.pipe(Result.flip, Effect.fromResult);
      expect(decodeError._tag).toBe("EvidenceConverterError");
      expect(decodeError.operation).toBe("fromRow");
    })
  );

  it.effect(
    "round-trips an EdgeVersion row through the converters",
    Effect.fnUntraced(function* () {
      const version = yield* decodeUnknownEdgeVersionModel(edgeVersionInput(10));

      const insert = yield* Effect.fromResult(EdgeVersion.toEdgeVersionInsert(version));
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
      expect(insert.validFrom).toBe(1_000);
      expect(insert.validTo, "an open upper bound encodes to null on both axes, never a sentinel").toBeNull();
      expect(insert.recordedAt).toBe(1_000);
      expect(insert.expiredAt).toBeNull();
      expect(insert.supersedesId).toBeNull();

      const decoded = yield* Effect.fromResult(EdgeVersion.fromEdgeVersionRow(edgeVersionRow(insert, 10)));
      expect(decoded.id).toBe(10);
      expect(decoded.relation).toBe("supports");
      expect(O.getOrNull(decoded.sourceClaimId)).toBe(1);
      expect(O.getOrNull(decoded.targetEvidenceId)).toBe(2);
      assertNone(decoded.validTo);
      assertNone(decoded.expiredAt);
      assertNone(decoded.supersedesId);
      assertNone(decoded.matterScope);
      assertNone(decoded.evidenceScope);
    })
  );

  it.effect(
    "round-trips a closed EdgeVersion row through the converters",
    Effect.fnUntraced(function* () {
      const closed = yield* decodeUnknownEdgeVersionModel({
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

      const insert = yield* Effect.fromResult(EdgeVersion.toEdgeVersionInsert(closed));
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

      const decoded = yield* Effect.fromResult(EdgeVersion.fromEdgeVersionRow(edgeVersionRow(insert, 11)));
      expect(O.getOrNull(O.map(decoded.validTo, DateTime.toEpochMillis))).toBe(2_000);
      expect(O.getOrNull(O.map(decoded.expiredAt, DateTime.toEpochMillis))).toBe(2_500);
      expect(O.getOrNull(decoded.supersedesId)).toBe(10);
      expect(O.getOrNull(decoded.sourceEntityRef)).toBe("workspace:matter-1");
      expect(O.getOrNull(decoded.targetObservationRef)).toBe("observation:run-1:step-3");
    })
  );

  it.effect(
    "round-trips a ClaimDisposition row through the converters",
    Effect.fnUntraced(function* () {
      const disposition = yield* decodeUnknownClaimDispositionModel(claimDispositionInput(10));

      const insert = yield* Effect.fromResult(ClaimDisposition.toClaimDispositionInsert(disposition));
      expect("id" in insert).toBe(false);
      expect(insert.entityType).toBe("EpistemicClaimDisposition");
      expect(insert.claimId).toBe(3);
      expect(insert.status).toBe("rejected");
      expect(insert.reason).toBe("Expected at least 1 value(s) for evidence.");
      expect(insert.resolvedAt).toBe(1_000);
      expect(insert.resolvedBy).toStrictEqual(systemPrincipal);
      expect(insert.violations).toStrictEqual([
        {
          focusNode: $EpistemicId.create("claim/patentability").iri,
          message: "Expected at least 1 value(s) for evidence.",
          path: $EpistemicId.create("hasEvidenceQuote").iri,
          severity: "violation",
        },
      ]);

      const decoded = yield* Effect.fromResult(
        ClaimDisposition.fromClaimDispositionRow({
          ...insert,
          deletedAt: absentAsNull(insert.deletedAt),
          deletedByPrincipal: absentAsNull(insert.deletedByPrincipal),
          rowVersion: sqlDefaultedRowVersion(insert.rowVersion),
          id: 10,
        })
      );
      expect(decoded.id).toBe(10);
      expect(decoded.status).toBe("rejected");
      expect(decoded.violations[0]?.severity).toBe("violation");
    })
  );

  it.effect.prop(
    "round-trips schema-derived UsageRecords through the row converters",
    [UsageRecordArbitrary],
    Effect.fnUntraced(function* ([record]) {
      const insert = yield* Effect.fromResult(UsageRecord.toUsageRecordInsert(record));
      const decoded = yield* Effect.fromResult(
        UsageRecord.fromUsageRecordRow({
          ...insert,
          deletedAt: absentAsNull(insert.deletedAt),
          deletedByPrincipal: absentAsNull(insert.deletedByPrincipal),
          rowVersion: sqlDefaultedRowVersion(insert.rowVersion),
          id: record.id,
          activityId: insert.activityId ?? null,
          costUsdApproxMicros: insert.costUsdApproxMicros ?? null,
          credentialReference: insert.credentialReference ?? null,
          inputTokens: insert.inputTokens ?? null,
          latencyMillis: insert.latencyMillis ?? null,
          outputTokens: insert.outputTokens ?? null,
          totalTokens: insert.totalTokens ?? null,
          unitCount: insert.unitCount ?? null,
        })
      );

      expect(UsageRecordEquivalence(decoded, record)).toBe(true);
    }),
    { arbitrary: fcRuns(50) }
  );
  it.effect(
    "reports a typed CandidateClaim converter failure on both sides of the boundary",
    Effect.fnUntraced(function* () {
      const claim = yield* decodeUnknownCandidateClaimModel(candidateClaimInput(10));
      const insert = yield* Effect.fromResult(CandidateClaim.toCandidateClaimInsert(claim));

      const converterFailure1 = yield* converterFailure(
        CandidateClaim.toCandidateClaimInsert(modelInstanceWithBadPublicId(claim))
      );
      expectConverterFailure(converterFailure1, "CandidateClaimConverterError", "toInsert");
      const converterFailure2 = yield* converterFailure(
        CandidateClaim.fromCandidateClaimRow({
          ...insert,
          id: 10,
          publicId: 42,
        } as unknown as CandidateClaim.CandidateClaimRow)
      );
      expectConverterFailure(converterFailure2, "CandidateClaimConverterError", "fromRow");
    })
  );

  it.effect(
    "reports a typed ClaimDisposition converter failure on both sides of the boundary",
    Effect.fnUntraced(function* () {
      const disposition = yield* decodeUnknownClaimDispositionModel(claimDispositionInput(10));
      const insert = yield* Effect.fromResult(ClaimDisposition.toClaimDispositionInsert(disposition));

      const converterFailure3 = yield* converterFailure(
        ClaimDisposition.toClaimDispositionInsert(modelInstanceWithBadPublicId(disposition))
      );
      expectConverterFailure(converterFailure3, "ClaimDispositionConverterError", "toInsert");
      const converterFailure4 = yield* converterFailure(
        ClaimDisposition.fromClaimDispositionRow({
          ...insert,
          id: 10,
          publicId: 42,
        } as unknown as ClaimDisposition.ClaimDispositionRow)
      );
      expectConverterFailure(converterFailure4, "ClaimDispositionConverterError", "fromRow");
    })
  );

  it.effect(
    "reports a typed EdgeVersion converter failure on both sides of the boundary",
    Effect.fnUntraced(function* () {
      const version = yield* decodeUnknownEdgeVersionModel(edgeVersionInput(10));
      const insert = yield* Effect.fromResult(EdgeVersion.toEdgeVersionInsert(version));

      const converterFailure5 = yield* converterFailure(
        EdgeVersion.toEdgeVersionInsert(modelInstanceWithBadPublicId(version))
      );
      expectConverterFailure(converterFailure5, "EdgeVersionConverterError", "toInsert");
      const converterFailure6 = yield* converterFailure(
        EdgeVersion.fromEdgeVersionRow({
          ...edgeVersionRow(insert, 10),
          publicId: 42,
        } as unknown as EdgeVersion.EdgeVersionRow)
      );
      expectConverterFailure(converterFailure6, "EdgeVersionConverterError", "fromRow");
    })
  );

  it.effect(
    "reports a typed UsageRecord converter failure on both sides of the boundary",
    Effect.fnUntraced(function* () {
      const record = yield* decodeUnknownUsageRecordModel(usageRecordInput(10));
      const insert = yield* Effect.fromResult(UsageRecord.toUsageRecordInsert(record));

      const converterFailure7 = yield* converterFailure(
        UsageRecord.toUsageRecordInsert(modelInstanceWithBadPublicId(record))
      );
      expectConverterFailure(converterFailure7, "UsageRecordConverterError", "toInsert");
      const converterFailure8 = yield* converterFailure(
        UsageRecord.fromUsageRecordRow({
          ...insert,
          id: 10,
          publicId: 42,
        } as unknown as UsageRecord.UsageRecordRow)
      );
      expectConverterFailure(converterFailure8, "UsageRecordConverterError", "fromRow");
    })
  );

  A.forEach(fallbackReasonCases, ([tag, lift]) =>
    it.effect(
      `falls back to a generic reason when ${tag} lifts an empty schema failure`,
      Effect.fnUntraced(function* () {
        const schemaError = yield* emptyMessageSchemaError;
        expect(schemaError.message, 'defaultFormatter renders a message: "" annotation verbatim').toBe("");

        const converterError = lift(schemaError);
        expect(converterError._tag).toBe(tag);
        expect(converterError.operation).toBe("fromRow");
        expect(converterError.reason).toBe("schema conversion failed");
      })
    )
  );
});

const p4V2Json = EvidencePosition.pipe(S.Array, S.fromJsonString);
const encodePosition = S.encodeEffect(EvidencePosition);
const p4CurrentJson = S.fromJsonString(S.Array(FrozenStrictPosition), { space: 2 });

const p4LegacyJson = S.fromJsonString(
  S.Array(
    S.Struct({
      confidence: Confidence,
      endChar: S.Natural,
      quote: S.String,
      startChar: S.Natural,
    })
  ),
  { space: 2 }
);

it.layer(P4Layer.merge(P4NodeFileSystem.layer, P4Digest.layerWebCrypto), {
  timeout: "10 seconds",
  excludeTestServices: true,
})("P4 frozen formats", (it) => {
  it.effect("reads versioned evidence positions through the same table reader", () =>
    Effect.gen(function* () {
      const fs = yield* P4FileSystem.FileSystem;
      const text = yield* fs.readFileString("test/fixtures/evidence-position-v2.json");
      const positions = yield* S.decodeEffect(p4V2Json)(text);
      const current = yield* decodeUnknownEvidenceModel(evidenceInput(10));
      const insert = yield* Effect.fromResult(Evidence.toEvidenceInsert(current));
      for (const position of positions) {
        const span = yield* encodePosition(position);
        const read = yield* Effect.fromResult(
          Evidence.fromEvidenceRow({
            ...insert,
            id: 10,
            span,
            deletedAt: absentAsNull(insert.deletedAt),
            deletedByPrincipal: absentAsNull(insert.deletedByPrincipal),
            rowVersion: sqlDefaultedRowVersion(insert.rowVersion),
          })
        );
        expect(read.span).toEqual(position);
      }
    })
  );
  it.effect("P4 format freeze: evidence-span-current-v1.json retains raw bytes and current reader behavior", () =>
    Effect.gen(function* () {
      const fs = yield* P4FileSystem.FileSystem;
      const fixtureRoot = yield* fs.realPath(".");
      const fixturePath = yield* fs.realPath("test/fixtures/evidence-span-current-v1.json");
      expect(fixturePath).toBe(`${fixtureRoot}/test/fixtures/evidence-span-current-v1.json`);
      const text = yield* fs.readFileString(fixturePath);
      const digest = yield* P4Digest.Digest;
      const rawDigest = yield* digest.digestHex(P4Digest.sha256, new TextEncoder().encode(text));
      expect(rawDigest).toBe("260d742bda99924b64af8103a9f5f687b3eb94cdb6a7260fb868c8bffed1c4b2");
      const spans = yield* S.decodeEffect(p4CurrentJson)(text);
      const encoded = yield* S.encodeEffect(p4CurrentJson)(spans);
      expect(encoded).toBe(Str.slice(0, -1)(text));
      const evidence = yield* decodeUnknownEvidenceModel(evidenceInput(10));
      const insert = yield* Effect.fromResult(Evidence.toEvidenceInsert(evidence));
      const decoded = A.map(spans, (span) =>
        Evidence.fromEvidenceRow({
          ...insert,
          deletedAt: absentAsNull(insert.deletedAt),
          deletedByPrincipal: absentAsNull(insert.deletedByPrincipal),
          rowVersion: sqlDefaultedRowVersion(insert.rowVersion),
          id: 10,
          span,
        })
      );
      expect(A.map(decoded, Result.isSuccess)).toEqual([true, true]);
      const accepted = A.getSomes(A.map(decoded, Result.getSuccess));
      expect(A.map(accepted, ({ span }) => Result.getOrThrow(decodeCurrentPosition(span)).position.endChar)).toEqual([
        5, 4,
      ]);
    })
  );

  it.effect("P4 format freeze: evidence-span-legacy-v0.json retains raw bytes and current reader behavior", () =>
    Effect.gen(function* () {
      const fs = yield* P4FileSystem.FileSystem;
      const fixtureRoot = yield* fs.realPath(".");
      const fixturePath = yield* fs.realPath("test/fixtures/evidence-span-legacy-v0.json");
      expect(fixturePath).toBe(`${fixtureRoot}/test/fixtures/evidence-span-legacy-v0.json`);
      const text = yield* fs.readFileString(fixturePath);
      const digest = yield* P4Digest.Digest;
      const rawDigest = yield* digest.digestHex(P4Digest.sha256, new TextEncoder().encode(text));
      expect(rawDigest).toBe("0644f5fd5939478b0493cc8a097db2cc7f6024a4c8b5f4cd0d8831c4f576379d");
      const spans = yield* S.decodeEffect(p4LegacyJson)(text);
      const encoded = yield* S.encodeEffect(p4LegacyJson)(spans);
      expect(encoded).toBe(Str.slice(0, -1)(text));
      const evidence = yield* decodeUnknownEvidenceModel(evidenceInput(10));
      const insert = yield* Effect.fromResult(Evidence.toEvidenceInsert(evidence));
      const decoded = A.map(spans, (span) =>
        Evidence.fromEvidenceRow({
          ...insert,
          deletedAt: absentAsNull(insert.deletedAt),
          deletedByPrincipal: absentAsNull(insert.deletedByPrincipal),
          rowVersion: sqlDefaultedRowVersion(insert.rowVersion),
          id: 10,
          span,
        })
      );
      expect(A.map(decoded, Result.isSuccess)).toEqual([true, true, true]);
      const accepted = A.getSomes(A.map(decoded, Result.getSuccess));
      expect(A.map(accepted, ({ span }) => ("_tag" in span ? span._tag : span.version))).toEqual([
        "evidence-position/v2",
        "LegacyEvidenceUnresolved",
        "LegacyEvidenceUnresolved",
      ]);
    })
  );
});
