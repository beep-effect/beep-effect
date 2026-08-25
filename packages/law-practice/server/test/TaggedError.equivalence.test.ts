import { PracticeKgClaimsError, PracticeKgProjectionError } from "@beep/law-practice-server";
import { CandorPromotionSubjectResolutionError } from "@beep/law-practice-server/CandorPromotionGate";
import { PromotionGateRequest, PromotionSubjectRef, PromotionTenantRef } from "@beep/shared-use-cases/PromotionGate";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <A>(same: (self: A, that: A) => boolean, first: A, second: A, different: A) => {
  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

describe("law-practice server tagged-error declared equivalence", () => {
  it("compares CandorPromotionSubjectResolutionError by declared fields", () => {
    const same = S.toEquivalence(CandorPromotionSubjectResolutionError);
    const makeRequest = () =>
      PromotionGateRequest.make({
        subject: PromotionSubjectRef.make({ id: "application-1", kind: "patent-application" }),
        tenantRef: PromotionTenantRef.make("org-1"),
      });
    const first = CandorPromotionSubjectResolutionError.make({ reason: "mapping-unavailable", request: makeRequest() });
    const second = CandorPromotionSubjectResolutionError.make({
      reason: "mapping-unavailable",
      request: makeRequest(),
    });
    const different = CandorPromotionSubjectResolutionError.make({
      reason: "subject-not-found",
      request: makeRequest(),
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("ignores PracticeKgClaimsError cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(PracticeKgClaimsError);
    const first = PracticeKgClaimsError.make({ cause: { diagnostic: "first" }, message: "Claims batch failed." });
    const second = PracticeKgClaimsError.make({ cause: { diagnostic: "second" }, message: "Claims batch failed." });
    const different = PracticeKgClaimsError.make({
      cause: { diagnostic: "first" },
      message: "Claims batch timed out.",
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("ignores PracticeKgProjectionError cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(PracticeKgProjectionError);
    const first = PracticeKgProjectionError.new({ diagnostic: "first" }, "Projection failed.");
    const second = PracticeKgProjectionError.new({ diagnostic: "second" }, "Projection failed.");
    const different = PracticeKgProjectionError.new({ diagnostic: "first" }, "Projection timed out.");

    expectDeclaredEquivalence(same, first, second, different);
  });
});
