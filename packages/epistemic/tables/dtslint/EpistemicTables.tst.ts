import { describe, expect, it } from "tstyche";
import type { EntityTable } from "@beep/drizzle";
import type * as CandidateClaim from "@beep/epistemic-domain/entities/CandidateClaim";
import type * as ClaimDisposition from "@beep/epistemic-domain/entities/ClaimDisposition";
import type * as EdgeVersion from "@beep/epistemic-domain/entities/EdgeVersion";
import type * as Evidence from "@beep/epistemic-domain/entities/Evidence";
import type * as UsageRecord from "@beep/epistemic-domain/entities/UsageRecord";
import type { DbSchema } from "@beep/epistemic-tables";
import type * as CandidateClaimTables from "@beep/epistemic-tables/entities/CandidateClaim";
import type * as ClaimDispositionTables from "@beep/epistemic-tables/entities/ClaimDisposition";
import type * as EdgeVersionTables from "@beep/epistemic-tables/entities/EdgeVersion";
import type * as EvidenceTables from "@beep/epistemic-tables/entities/Evidence";
import type * as UsageRecordTables from "@beep/epistemic-tables/entities/UsageRecord";

describe("EpistemicTables types", () => {
  it("exports the DbSchema type from the package entrypoint", () => {
    expect<DbSchema>().type.toBe<{
      readonly candidateClaim: typeof CandidateClaimTables.Table;
      readonly claimDisposition: typeof ClaimDispositionTables.Table;
      readonly edgeVersion: typeof EdgeVersionTables.Table;
      readonly evidence: typeof EvidenceTables.Table;
      readonly usageRecord: typeof UsageRecordTables.Table;
    }>();
  });

  it("preserves UsageRecord table and descriptor metadata literals", () => {
    expect<typeof UsageRecordTables.Table>().type.toBeAssignableTo<
      EntityTable.TableFor<typeof UsageRecord.UsageRecord>
    >();
    expect<typeof UsageRecordTables.Table.definition.tableName>().type.toBe<"epistemic_usage_record">();
    expect<typeof UsageRecordTables.Table.definition.entityId.entityType>().type.toBe<"EpistemicUsageRecord">();
    expect<typeof UsageRecordTables.Table.definition.persisted.actor.storageKind>().type.toBe<"jsonb">();
    expect<typeof UsageRecordTables.Table.definition.persisted.metadata.storageKind>().type.toBe<"jsonb">();
    expect<typeof UsageRecordTables.Table.definition.persisted.model.storageKind>().type.toBe<"text">();
    expect<typeof UsageRecordTables.Table.definition.persisted.provider.storageKind>().type.toBe<"text">();
  });

  it("preserves CandidateClaim table and descriptor metadata literals", () => {
    expect<typeof CandidateClaimTables.Table>().type.toBeAssignableTo<
      EntityTable.TableFor<typeof CandidateClaim.CandidateClaim>
    >();
    expect<typeof CandidateClaimTables.Table.definition.tableName>().type.toBe<"epistemic_candidate_claim">();
    expect<typeof CandidateClaimTables.Table.definition.entityId.entityType>().type.toBe<"EpistemicCandidateClaim">();
    expect<typeof CandidateClaimTables.Table.definition.persisted.fixtureKey.storageKind>().type.toBe<"text">();
    expect<typeof CandidateClaimTables.Table.definition.persisted.lifecycle.storageKind>().type.toBe<"literal">();
    expect<typeof CandidateClaimTables.Table.definition.persisted.snapshot.storageKind>().type.toBe<"jsonb">();
  });

  it("preserves Evidence table and descriptor metadata literals", () => {
    expect<typeof EvidenceTables.Table>().type.toBeAssignableTo<EntityTable.TableFor<typeof Evidence.Evidence>>();
    expect<typeof EvidenceTables.Table.definition.tableName>().type.toBe<"epistemic_evidence">();
    expect<typeof EvidenceTables.Table.definition.entityId.entityType>().type.toBe<"EpistemicEvidence">();
    expect<typeof EvidenceTables.Table.definition.persisted.artifactFixtureKey.storageKind>().type.toBe<"text">();
    expect<typeof EvidenceTables.Table.definition.persisted.spanFixtureKey.storageKind>().type.toBe<"text">();
    expect<typeof EvidenceTables.Table.definition.persisted.span.storageKind>().type.toBe<"jsonb">();
  });

  it("preserves EdgeVersion table and bitemporal descriptor metadata literals", () => {
    expect<typeof EdgeVersionTables.Table>().type.toBeAssignableTo<
      EntityTable.TableFor<typeof EdgeVersion.EdgeVersion>
    >();
    expect<typeof EdgeVersionTables.Table.definition.tableName>().type.toBe<"epistemic_edge_version">();
    expect<typeof EdgeVersionTables.Table.definition.entityId.entityType>().type.toBe<"EpistemicEdgeVersion">();
    // Both half-open axes must project onto BIGINT epoch millis, never onto a
    // date storage kind: the millis descriptor is what keeps int8range() valid.
    expect<typeof EdgeVersionTables.Table.definition.persisted.validFrom.storageKind>().type.toBe<"timestampMillis">();
    expect<typeof EdgeVersionTables.Table.definition.persisted.validTo.storageKind>().type.toBe<"timestampMillis">();
    expect<typeof EdgeVersionTables.Table.definition.persisted.recordedAt.storageKind>().type.toBe<"timestampMillis">();
    expect<typeof EdgeVersionTables.Table.definition.persisted.expiredAt.storageKind>().type.toBe<"timestampMillis">();
    expect<typeof EdgeVersionTables.Table.definition.persisted.logicalKey.storageKind>().type.toBe<"text">();
    expect<typeof EdgeVersionTables.Table.definition.persisted.relation.storageKind>().type.toBe<"literal">();
    expect<typeof EdgeVersionTables.Table.definition.persisted.sourceKind.storageKind>().type.toBe<"literal">();
    expect<typeof EdgeVersionTables.Table.definition.persisted.targetKind.storageKind>().type.toBe<"literal">();
    expect<typeof EdgeVersionTables.Table.definition.persisted.sourceClaimId.storageKind>().type.toBe<"entityId">();
    expect<typeof EdgeVersionTables.Table.definition.persisted.targetEvidenceId.storageKind>().type.toBe<"entityId">();
    expect<typeof EdgeVersionTables.Table.definition.persisted.supersedesId.storageKind>().type.toBe<"entityId">();
    expect<typeof EdgeVersionTables.Table.definition.persisted.qualifiers.storageKind>().type.toBe<"jsonb">();
    expect<typeof EdgeVersionTables.Table.definition.persisted.fact.storageKind>().type.toBe<"jsonb">();
    expect<typeof EdgeVersionTables.Table.definition.persisted.version.storageKind>().type.toBe<"int">();
  });

  it("preserves ClaimDisposition table and descriptor metadata literals", () => {
    expect<typeof ClaimDispositionTables.Table>().type.toBeAssignableTo<
      EntityTable.TableFor<typeof ClaimDisposition.ClaimDisposition>
    >();
    expect<typeof ClaimDispositionTables.Table.definition.tableName>().type.toBe<"epistemic_claim_disposition">();
    expect<
      typeof ClaimDispositionTables.Table.definition.entityId.entityType
    >().type.toBe<"EpistemicClaimDisposition">();
    expect<typeof ClaimDispositionTables.Table.definition.persisted.claimId.storageKind>().type.toBe<"entityId">();
    expect<typeof ClaimDispositionTables.Table.definition.persisted.status.storageKind>().type.toBe<"literal">();
    expect<typeof ClaimDispositionTables.Table.definition.persisted.reason.storageKind>().type.toBe<"text">();
    expect<
      typeof ClaimDispositionTables.Table.definition.persisted.resolvedAt.storageKind
    >().type.toBe<"timestampMillis">();
    expect<typeof ClaimDispositionTables.Table.definition.persisted.resolvedBy.storageKind>().type.toBe<"jsonb">();
    expect<typeof ClaimDispositionTables.Table.definition.persisted.violations.storageKind>().type.toBe<"jsonb">();
  });
});
