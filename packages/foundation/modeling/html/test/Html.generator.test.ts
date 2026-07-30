import { describe, expect, it } from "@effect/vitest";
import { assertReviewedCurrentAttributeGap } from "../scripts/generate.ts";

describe("@beep/html generator invariants", () => {
  it("requires an exact reviewed explanation for every pinned/webref gap", () => {
    expect(() =>
      assertReviewedCurrentAttributeGap(
        "button",
        ["disabled", "popovertarget", "popovertargetaction"],
        ["disabled"],
        ["popovertarget", "popovertargetaction"]
      )
    ).not.toThrow();

    expect(() =>
      assertReviewedCurrentAttributeGap(
        "button",
        ["disabled", "popovertarget", "popovertargetaction"],
        ["disabled"],
        ["popovertarget"]
      )
    ).toThrow(/requires an exact reviewed override/u);

    expect(() =>
      assertReviewedCurrentAttributeGap(
        "button",
        ["disabled", "popovertarget"],
        ["disabled", "popovertarget"],
        ["popovertarget"]
      )
    ).toThrow(/requires an exact reviewed override/u);
  });
});
