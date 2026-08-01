import { appendTurnFinalizationUsageRecord, CandidateClaim, UsageRecord } from "@beep/epistemic-domain";
import { describe, expect, it } from "tstyche";
import type {
  ClaimLifecycle,
  ClaimLifecycle as ClaimLifecycleType,
  TurnFinalizationUsageAppend,
} from "@beep/epistemic-domain";
import type * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import type { OnePasswordReference } from "@beep/shared-domain/values/OnePasswordReference";
import type * as O from "effect/Option";

declare const candidateClaim: CandidateClaim;
declare const append: TurnFinalizationUsageAppend;

describe("@beep/epistemic-domain", () => {
  it("preserves exported value schema types", () => {
    expect<ClaimLifecycle>().type.toBe<ClaimLifecycleType>();
    expect<ClaimLifecycleType>().type.toBe<"candidate" | "shape_valid" | "consistency_checked" | "admitted">();
  });

  it("preserves CandidateClaim BaseEntity identity wiring", () => {
    expect(CandidateClaim.definition.entityId).type.toBe<typeof Epistemic.CandidateClaimId>();
    expect<typeof CandidateClaim.definition.entityId.tableName>().type.toBe<"epistemic_candidate_claim">();
    expect<typeof CandidateClaim.definition.entityId.entityType>().type.toBe<"EpistemicCandidateClaim">();
    expect<typeof CandidateClaim.definition.persisted.lifecycle.storageKind>().type.toBe<"literal">();
    expect<typeof CandidateClaim.definition.persisted.snapshot.columnName>().type.toBe<"snapshot">();
    expect<typeof CandidateClaim.fields.lifecycle.Type>().type.toBe<ClaimLifecycleType>();
  });

  it("preserves decode and constructor types", () => {
    expect<typeof CandidateClaim.Encoded>().type.toBeAssignableTo<typeof CandidateClaim.Encoded>();
    expect(CandidateClaim.make(candidateClaim)).type.toBe<CandidateClaim>();
    expect<CandidateClaim["lifecycle"]>().type.toBe<ClaimLifecycleType>();
  });

  it("preserves UsageRecord append path types", () => {
    expect<TurnFinalizationUsageAppend["activityId"]>().type.toBe<O.Option<Epistemic.ActivityId>>();
    expect<UsageRecord["activityId"]>().type.toBe<O.Option<Epistemic.ActivityId>>();
    expect(UsageRecord.definition.entityId).type.toBe<typeof Epistemic.UsageRecordId>();
    expect<typeof UsageRecord.definition.persisted.activityId.columnName>().type.toBe<"activity_id">();
    expect<UsageRecord["credentialReference"]>().type.toBe<O.Option<OnePasswordReference>>();
    expect(appendTurnFinalizationUsageRecord(append)).type.toBe<UsageRecord>();
  });
});
