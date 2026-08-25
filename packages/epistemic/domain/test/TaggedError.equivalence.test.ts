import { ClaimInvalidTransition, GrantRevisionMismatch, PolicyRevision } from "@beep/epistemic-domain";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("epistemic-domain tagged-error declared equivalence", () => {
  it("compares ClaimInvalidTransition by lifecycle fields", () => {
    const sameError = S.toEquivalence(ClaimInvalidTransition);
    const a = ClaimInvalidTransition.between("candidate", "shape_valid");
    const b = ClaimInvalidTransition.between("candidate", "shape_valid");
    const c = ClaimInvalidTransition.between("shape_valid", "admitted");

    expect(sameError(a, b)).toBe(true);
    expect(sameError(a, c)).toBe(false);
  });

  it("compares GrantRevisionMismatch by both revision fields", () => {
    const sameError = S.toEquivalence(GrantRevisionMismatch);
    const revision1 = PolicyRevision.make("1.0.0");
    const revision2 = PolicyRevision.make("2.0.0");
    const revision3 = PolicyRevision.make("3.0.0");
    const a = GrantRevisionMismatch.between(revision1, revision2);
    const b = GrantRevisionMismatch.between(revision1, revision2);
    const c = GrantRevisionMismatch.between(revision1, revision3);

    expect(sameError(a, b)).toBe(true);
    expect(sameError(a, c)).toBe(false);
  });
});
