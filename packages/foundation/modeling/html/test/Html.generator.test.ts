import {
  ELEMENT_META,
  HTML_CONTENT_TOKEN_EXPANSIONS,
  HTML_GLOBAL_ATTRIBUTE_NAMES,
  MATHML_ATTRIBUTE_NAME_ADJUSTMENTS,
  SVG_ATTRIBUTE_NAME_ADJUSTMENTS,
  SVG_ELEMENT_NAME_ADJUSTMENTS,
  XML_FOREIGN_ATTRIBUTE_NAMES,
} from "@beep/html/Html.meta";
import { describe, expect, it } from "@effect/vitest";
import * as R from "effect/Record";
import { assertReviewedCurrentAttributeGap } from "../scripts/generate.ts";

describe("@beep/html generator invariants", () => {
  it("requires an exact reviewed explanation for every pinned/webref gap", () => {
    expect(() =>
      assertReviewedCurrentAttributeGap({
        pinned: ["disabled", "popovertarget", "popovertargetaction"],
        reviewed: ["popovertarget", "popovertargetaction"],
        tag: "button",
        webref: ["disabled"],
      })
    ).not.toThrow();

    expect(() =>
      assertReviewedCurrentAttributeGap({
        pinned: ["disabled", "popovertarget", "popovertargetaction"],
        reviewed: ["popovertarget"],
        tag: "button",
        webref: ["disabled"],
      })
    ).toThrow(/requires an exact reviewed override/u);

    expect(() =>
      assertReviewedCurrentAttributeGap({
        pinned: ["disabled", "popovertarget"],
        reviewed: ["popovertarget"],
        tag: "button",
        webref: ["disabled", "popovertarget"],
      })
    ).toThrow(/requires an exact reviewed override/u);
  });

  it("freezes every public conformance registry recursively", () => {
    expect(Object.isFrozen(SVG_ELEMENT_NAME_ADJUSTMENTS)).toBe(true);
    expect(Object.isFrozen(SVG_ATTRIBUTE_NAME_ADJUSTMENTS)).toBe(true);
    expect(Object.isFrozen(MATHML_ATTRIBUTE_NAME_ADJUSTMENTS)).toBe(true);
    expect(Object.isFrozen(XML_FOREIGN_ATTRIBUTE_NAMES)).toBe(true);
    expect(Object.isFrozen(HTML_GLOBAL_ATTRIBUTE_NAMES)).toBe(true);
    expect(Object.isFrozen(HTML_CONTENT_TOKEN_EXPANSIONS)).toBe(true);

    for (const expansion of R.values(HTML_CONTENT_TOKEN_EXPANSIONS)) {
      expect(Object.isFrozen(expansion)).toBe(true);
    }

    expect(Object.isFrozen(ELEMENT_META)).toBe(true);
    for (const meta of R.values(ELEMENT_META)) {
      expect(Object.isFrozen(meta)).toBe(true);
      expect(Object.isFrozen(meta.categories)).toBe(true);
      expect(Object.isFrozen(meta.children)).toBe(true);
      expect(Object.isFrozen(meta.currentAttributes)).toBe(true);
      expect(Object.isFrozen(meta.obsoleteAttributes)).toBe(true);
      expect(Object.isFrozen(meta.conditionalCategories)).toBe(true);
      for (const rule of meta.conditionalCategories) {
        expect(Object.isFrozen(rule)).toBe(true);
      }
    }
  });
});
