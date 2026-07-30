import { describe, expect, it } from "tstyche";
import type {
  addGrant,
  boundaryDenialReasons,
  DenialReason,
  DraftGrantSet,
  EgressClassification,
  ExecutionRequestEvaluationOptions,
  ExecutionSettlement,
  ExecutionVerdict,
  evaluateExecutionRequest,
  evaluatorDenialReasons,
  FrozenGrantSet,
  GrantSet,
  SinkAudience,
  SinkClass,
} from "@beep/epistemic-domain";

describe("ExecutionAuthority", () => {
  it("pins the bounded literal vocabularies", () => {
    expect<DenialReason>().type.toBe<
      | "no-grant-in-scope"
      | "grant-set-digest-mismatch"
      | "operation-not-granted"
      | "sink-class-not-granted"
      | "audience-not-granted"
      | "destination-not-granted"
      | "grant-expired"
      | "policy-revision-mismatch"
      | "ledger-unavailable"
    >();
    expect<SinkClass>().type.toBe<"network-egress" | "mcp-write">();
    expect<SinkAudience>().type.toBe<"local-workspace" | "external-network">();
    expect<ExecutionSettlement>().type.toBe<"completed" | "failed" | "interrupted">();
    expect<EgressClassification>().type.toBe<"governed-allowed" | "governed-denied" | "ungoverned-infrastructure">();
  });

  it("splits the denial reasons exactly between evaluator and boundary", () => {
    expect<(typeof evaluatorDenialReasons)[number]>().type.toBe<
      | "grant-set-digest-mismatch"
      | "policy-revision-mismatch"
      | "operation-not-granted"
      | "sink-class-not-granted"
      | "audience-not-granted"
      | "destination-not-granted"
      | "grant-expired"
    >();
    expect<(typeof boundaryDenialReasons)[number]>().type.toBe<"no-grant-in-scope" | "ledger-unavailable">();
  });

  it("expresses the freeze invariant as parameter types", () => {
    expect<Parameters<typeof addGrant>[0]>().type.toBe<DraftGrantSet>();
    expect<Parameters<typeof evaluateExecutionRequest>[0]>().type.toBe<FrozenGrantSet>();
    expect<Parameters<typeof evaluateExecutionRequest>[2]>().type.toBe<ExecutionRequestEvaluationOptions>();
  });

  it("keeps GrantSet the Draft/Frozen union", () => {
    expect<GrantSet>().type.toBe<DraftGrantSet | FrozenGrantSet>();
  });

  it("keeps the verdict discriminant a literal union", () => {
    expect<ExecutionVerdict["verdict"]>().type.toBe<"allowed" | "denied">();
  });
});
