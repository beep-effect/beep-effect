import { ClaimInvalidTransition } from "@beep/epistemic-domain";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
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
});
