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
import { pipe } from "effect";
import * as A from "effect/Array";
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
      expect(Object.isFrozen(meta.attributeEqualities)).toBe(true);
      expect(Object.isFrozen(meta.attributeRequirements)).toBe(true);
      expect(Object.isFrozen(meta.numericAttributeRelationships)).toBe(true);
      expect(Object.isFrozen(meta.rules)).toBe(true);
      expect(Object.isFrozen(meta.uniqueAttributes)).toBe(true);
      for (const rule of meta.conditionalCategories) {
        expect(Object.isFrozen(rule)).toBe(true);
      }
      for (const equality of meta.attributeEqualities) {
        expect(Object.isFrozen(equality)).toBe(true);
      }
      for (const requirement of meta.attributeRequirements) {
        expect(Object.isFrozen(requirement)).toBe(true);
        expect(Object.isFrozen(requirement.required)).toBe(true);
        for (const alternatives of requirement.required) {
          expect(Object.isFrozen(alternatives)).toBe(true);
        }
      }
      for (const relationship of meta.numericAttributeRelationships) {
        expect(Object.isFrozen(relationship)).toBe(true);
      }
      if (meta.rules.forbiddenDescendants !== undefined) {
        expect(Object.isFrozen(meta.rules.forbiddenDescendants)).toBe(true);
        expect(Object.isFrozen(meta.rules.forbiddenDescendants.attributes)).toBe(true);
        expect(Object.isFrozen(meta.rules.forbiddenDescendants.categories)).toBe(true);
        expect(Object.isFrozen(meta.rules.forbiddenDescendants.tags)).toBe(true);
      }
      if (meta.rules.forbiddenNamedAncestors !== undefined) {
        expect(Object.isFrozen(meta.rules.forbiddenNamedAncestors)).toBe(true);
        for (const condition of meta.rules.forbiddenNamedAncestors) {
          expect(Object.isFrozen(condition)).toBe(true);
          expect(Object.isFrozen(condition.attributes)).toBe(true);
        }
      }
      if (meta.rules.permittedAncestors !== undefined) {
        expect(Object.isFrozen(meta.rules.permittedAncestors)).toBe(true);
      }
      if (meta.rules.documentVisibilityLimit !== undefined) {
        expect(Object.isFrozen(meta.rules.documentVisibilityLimit)).toBe(true);
      }
    }
  });

  it("publishes the exact reviewed tree-conformance profiles", () => {
    const profileEntries = pipe(
      R.toEntries(ELEMENT_META),
      A.filter(
        ([, meta]) =>
          meta.rules.forbiddenDescendants !== undefined ||
          meta.rules.forbiddenNamedAncestors !== undefined ||
          meta.rules.permittedAncestors !== undefined ||
          meta.rules.documentVisibilityLimit !== undefined
      )
    );
    expect(A.map(profileEntries, ([tag]) => tag)).toStrictEqual([
      "a",
      "address",
      "audio",
      "button",
      "dfn",
      "dt",
      "footer",
      "form",
      "header",
      "label",
      "main",
      "meter",
      "progress",
      "th",
      "video",
    ]);
    expect(ELEMENT_META.dfn.rules.forbiddenDescendants?.tags).toStrictEqual(["dfn"]);
    expect(ELEMENT_META.header.rules.forbiddenDescendants?.tags).toStrictEqual(["footer", "header"]);
    expect(ELEMENT_META.footer.rules.forbiddenDescendants?.tags).toStrictEqual(["footer", "header"]);
    expect(ELEMENT_META.audio.rules.forbiddenDescendants?.tags).toStrictEqual(["audio", "video"]);
    expect(ELEMENT_META.video.rules.forbiddenDescendants?.tags).toStrictEqual(["audio", "video"]);
    expect(ELEMENT_META.main.rules.permittedAncestors).toStrictEqual(["body", "div", "form", "html"]);
    expect(ELEMENT_META.main.rules.forbiddenNamedAncestors).toStrictEqual([
      { attributes: ["aria-label", "aria-labelledby", "title"], tag: "form" },
    ]);
    expect(ELEMENT_META.main.rules.documentVisibilityLimit).toEqual({
      maximum: 1,
      unlessAttribute: "hidden",
    });
    expect(ELEMENT_META.div.childGrammar).toBe("contextual-div");
  });

  it("publishes the complete generated meter and progress relationship profiles", () => {
    expect(ELEMENT_META.meter.attributeRequirements).toContainEqual(expect.objectContaining({ required: [["value"]] }));
    expect(ELEMENT_META.meter.numericAttributeRelationships).toHaveLength(10);
    expect(ELEMENT_META.progress.numericAttributeRelationships).toStrictEqual([
      expect.objectContaining({
        left: "value",
        right: "max",
        rightDefault: 1,
      }),
    ]);
  });

  it("publishes the exact required and tree-unique attribute profiles", () => {
    expect(ELEMENT_META.base.attributeRequirements).toContainEqual(
      expect.objectContaining({ required: [["href", "target"]] })
    );
    expect(ELEMENT_META.map.attributeRequirements).toContainEqual(expect.objectContaining({ required: [["name"]] }));
    expect(ELEMENT_META.map.attributeEqualities).toStrictEqual([
      expect.objectContaining({ left: "id", right: "name" }),
    ]);
    expect(ELEMENT_META.map.uniqueAttributes).toStrictEqual(["name"]);
    expect(ELEMENT_META.track.attributeRequirements).toContainEqual(expect.objectContaining({ required: [["src"]] }));
  });
});
