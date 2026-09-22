import { CandidateClaim as CandidateClaimModel } from "@beep/epistemic-domain/entities/CandidateClaim";
import { ClaimDisposition as ClaimDispositionModel } from "@beep/epistemic-domain/entities/ClaimDisposition";
import { EdgeVersion as EdgeVersionModel } from "@beep/epistemic-domain/entities/EdgeVersion";
import { Evidence as EvidenceModel } from "@beep/epistemic-domain/entities/Evidence";
import { UsageRecord as UsageRecordModel } from "@beep/epistemic-domain/entities/UsageRecord";
import { EVIDENCE_SPAN_QUOTE_MAX_LENGTH } from "@beep/epistemic-domain/values/EvidenceSpan";
import { DbSchema, Entities } from "@beep/epistemic-tables";
import * as CandidateClaim from "@beep/epistemic-tables/entities/CandidateClaim";
import * as ClaimDisposition from "@beep/epistemic-tables/entities/ClaimDisposition";
import * as EdgeVersion from "@beep/epistemic-tables/entities/EdgeVersion";
import * as Evidence from "@beep/epistemic-tables/entities/Evidence";
import * as UsageRecord from "@beep/epistemic-tables/entities/UsageRecord";
import { fcRuns, productEntityFixtureInput, systemPrincipal } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeEvidenceModelResult = S.decodeResult(EvidenceModel);
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
      focusNode: "https://beep.dev/epistemic/claim/patentability",
      message: "Expected at least 1 value(s) for evidence.",
      path: "https://beep.dev/epistemic/hasEvidenceQuote",
      severity: "violation",
    },
  ],
});

// Every row codec here is a class schema, so an unencodable entity has to stay
// an instance of its model: clone onto the same prototype and corrupt a single
// column rather than handing the encoder a bare struct it would reject wholesale.
const withUnencodablePublicId = <A extends object>(entity: A): A =>
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

// `defaultFormatter` renders a `message: ""` annotation verbatim, so this is a
// real SchemaError whose rendered message is empty - the input every
// `fromSchema` fallback branch is written for.
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
    const indexNames = config.indexes.map((index) => index.config.name);
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
    // The span is JSONB precisely so the fractional confidence survives: there
    // is no float storage kind to project it onto.
    expect(columns.span.columnType).toBe("PgJsonb");
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
        })
      );
      expect(decoded.provider).toBe("fixture");
      expect(decoded.model).toBe("fixture-model");
      expect(O.getOrNull(decoded.inputTokens)).toBe(12);
      expect(O.getOrNull(decoded.costUsdApproxMicros)).toBeNull();
      expect(O.isNone(decoded.unitCount)).toBe(true);
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

      const decoded = yield* Effect.fromResult(CandidateClaim.fromCandidateClaimRow({ ...insert, id: 10 }));
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
      expect(insert.span).toStrictEqual({
        confidence: 0.92,
        endChar: 57,
        quote: "a processor configured to receive sensor data",
        startChar: 12,
      });

      const decoded = yield* Effect.fromResult(Evidence.fromEvidenceRow({ ...insert, id: 10 }));
      expect(decoded.id).toBe(10);
      expect(decoded.span.quote).toBe("a processor configured to receive sensor data");
      expect(decoded.span.confidence).toBe(0.92);
    })
  );

  it.effect(
    "normalizes legacy Evidence span widths on read and writes only the strict width",
    Effect.fnUntraced(function* () {
      const evidence = yield* Effect.fromResult(decodeUnknownEvidenceModelResult(evidenceInput(10)));
      const insert = yield* Effect.fromResult(Evidence.toEvidenceInsert(evidence));
      const legacyRow = {
        ...insert,
        id: 10,
        span: {
          ...insert.span,
          endChar: 48,
        },
        spanFixtureKey: "span:oa-1:12-48",
      };

      expect(Result.isFailure(decodeEvidenceModelResult(legacyRow))).toBe(true);

      const decoded = yield* Effect.fromResult(Evidence.fromEvidenceRow(legacyRow));
      const canonicalInsert = yield* Effect.fromResult(Evidence.toEvidenceInsert(decoded));

      expect(decoded.span.startChar).toBe(12);
      expect(decoded.span.endChar).toBe(57);
      expect(decoded.span.quote).toBe("a processor configured to receive sensor data");
      expect(decoded.spanFixtureKey).toBe("span:oa-1:12-48");
      expect(canonicalInsert.span.endChar).toBe(57);
    })
  );

  it.effect(
    "preserves reads of legacy Evidence quotes above the current write bound",
    Effect.fnUntraced(function* () {
      const evidence = yield* Effect.fromResult(decodeUnknownEvidenceModelResult(evidenceInput(10)));
      const insert = yield* Effect.fromResult(Evidence.toEvidenceInsert(evidence));
      const quote = Str.repeat(EVIDENCE_SPAN_QUOTE_MAX_LENGTH + 1)("a");
      const legacyRow = {
        ...insert,
        id: 10,
        span: {
          ...insert.span,
          endChar: 12 + Str.length(quote),
          quote,
        },
      };

      expect(Result.isFailure(decodeEvidenceModelResult(legacyRow))).toBe(true);

      const decoded = yield* Effect.fromResult(Evidence.fromEvidenceRow(legacyRow));

      expect(decoded.span.quote).toBe(quote);
      expect(decoded.span.endChar).toBe(12 + Str.length(quote));

      const reencoded = Evidence.toEvidenceInsert(decoded);
      expect(Result.isFailure(reencoded)).toBe(true);
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
      expect(Result.isFailure(decodeResult)).toBe(true);
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
      // Open upper bounds encode to null on both axes rather than to a sentinel.
      expect(insert.validFrom).toBe(1_000);
      expect(insert.validTo).toBeNull();
      expect(insert.recordedAt).toBe(1_000);
      expect(insert.expiredAt).toBeNull();
      expect(insert.supersedesId).toBeNull();

      const decoded = yield* Effect.fromResult(EdgeVersion.fromEdgeVersionRow(edgeVersionRow(insert, 10)));
      expect(decoded.id).toBe(10);
      expect(decoded.relation).toBe("supports");
      expect(O.getOrNull(decoded.sourceClaimId)).toBe(1);
      expect(O.getOrNull(decoded.targetEvidenceId)).toBe(2);
      expect(O.isNone(decoded.validTo)).toBe(true);
      expect(O.isNone(decoded.expiredAt)).toBe(true);
      expect(O.isNone(decoded.supersedesId)).toBe(true);
      expect(O.isNone(decoded.matterScope)).toBe(true);
      expect(O.isNone(decoded.evidenceScope)).toBe(true);
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
          focusNode: "https://beep.dev/epistemic/claim/patentability",
          message: "Expected at least 1 value(s) for evidence.",
          path: "https://beep.dev/epistemic/hasEvidenceQuote",
          severity: "violation",
        },
      ]);

      const decoded = yield* Effect.fromResult(ClaimDisposition.fromClaimDispositionRow({ ...insert, id: 10 }));
      expect(decoded.id).toBe(10);
      expect(decoded.status).toBe("rejected");
      expect(decoded.violations[0]?.severity).toBe("violation");
    })
  );

  it.effect(
    "round-trips schema-derived UsageRecords through the row converters",
    Effect.fnUntraced(function* () {
      const outcome = yield* Arbitrary.checkEffect(
        Arbitrary.all([UsageRecordArbitrary]),
        Effect.fnUntraced(function* ([record]) {
          const insert = yield* Effect.fromResult(UsageRecord.toUsageRecordInsert(record));
          const decoded = yield* Effect.fromResult(
            UsageRecord.fromUsageRecordRow({
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
            })
          );

          expect(UsageRecordEquivalence(decoded, record)).toBe(true);

          return true;
        }),
        fcRuns(50)
      );

      expect(outcome._tag).toBe("Passed");
    })
  );
  it.effect(
    "reports a typed CandidateClaim converter failure on both sides of the boundary",
    Effect.fnUntraced(function* () {
      const claim = yield* decodeUnknownCandidateClaimModel(candidateClaimInput(10));
      const insert = yield* Effect.fromResult(CandidateClaim.toCandidateClaimInsert(claim));

      expectConverterFailure(
        yield* converterFailure(CandidateClaim.toCandidateClaimInsert(withUnencodablePublicId(claim))),
        "CandidateClaimConverterError",
        "toInsert"
      );
      expectConverterFailure(
        yield* converterFailure(
          CandidateClaim.fromCandidateClaimRow({
            ...insert,
            id: 10,
            publicId: 42,
          } as unknown as CandidateClaim.CandidateClaimRow)
        ),
        "CandidateClaimConverterError",
        "fromRow"
      );
    })
  );

  it.effect(
    "reports a typed ClaimDisposition converter failure on both sides of the boundary",
    Effect.fnUntraced(function* () {
      const disposition = yield* decodeUnknownClaimDispositionModel(claimDispositionInput(10));
      const insert = yield* Effect.fromResult(ClaimDisposition.toClaimDispositionInsert(disposition));

      expectConverterFailure(
        yield* converterFailure(ClaimDisposition.toClaimDispositionInsert(withUnencodablePublicId(disposition))),
        "ClaimDispositionConverterError",
        "toInsert"
      );
      expectConverterFailure(
        yield* converterFailure(
          ClaimDisposition.fromClaimDispositionRow({
            ...insert,
            id: 10,
            publicId: 42,
          } as unknown as ClaimDisposition.ClaimDispositionRow)
        ),
        "ClaimDispositionConverterError",
        "fromRow"
      );
    })
  );

  it.effect(
    "reports a typed EdgeVersion converter failure on both sides of the boundary",
    Effect.fnUntraced(function* () {
      const version = yield* decodeUnknownEdgeVersionModel(edgeVersionInput(10));
      const insert = yield* Effect.fromResult(EdgeVersion.toEdgeVersionInsert(version));

      expectConverterFailure(
        yield* converterFailure(EdgeVersion.toEdgeVersionInsert(withUnencodablePublicId(version))),
        "EdgeVersionConverterError",
        "toInsert"
      );
      expectConverterFailure(
        yield* converterFailure(
          EdgeVersion.fromEdgeVersionRow({
            ...edgeVersionRow(insert, 10),
            publicId: 42,
          } as unknown as EdgeVersion.EdgeVersionRow)
        ),
        "EdgeVersionConverterError",
        "fromRow"
      );
    })
  );

  it.effect(
    "reports a typed UsageRecord converter failure on both sides of the boundary",
    Effect.fnUntraced(function* () {
      const record = yield* decodeUnknownUsageRecordModel(usageRecordInput(10));
      const insert = yield* Effect.fromResult(UsageRecord.toUsageRecordInsert(record));

      expectConverterFailure(
        yield* converterFailure(UsageRecord.toUsageRecordInsert(withUnencodablePublicId(record))),
        "UsageRecordConverterError",
        "toInsert"
      );
      expectConverterFailure(
        yield* converterFailure(
          UsageRecord.fromUsageRecordRow({
            ...insert,
            id: 10,
            publicId: 42,
          } as unknown as UsageRecord.UsageRecordRow)
        ),
        "UsageRecordConverterError",
        "fromRow"
      );
    })
  );

  A.forEach(fallbackReasonCases, ([tag, lift]) =>
    it.effect(
      `falls back to a generic reason when ${tag} lifts an empty schema failure`,
      Effect.fnUntraced(function* () {
        const schemaError = yield* emptyMessageSchemaError;
        expect(schemaError.message).toBe("");

        const converterError = lift(schemaError);
        expect(converterError._tag).toBe(tag);
        expect(converterError.operation).toBe("fromRow");
        expect(converterError.reason).toBe("schema conversion failed");
      })
    )
  );
});
