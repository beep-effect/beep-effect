import {
  AutocompleteAttribute,
  BooleanAttribute,
  DatasetKey,
  HeadingOffset,
  HtmlNonNegativeInteger,
  HtmlPositiveInteger,
  makeSpaceSeparatedTokenList,
  Popover,
} from "@beep/html";
import { A as Anchor, Li } from "@beep/html/Html.model";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const Rel = makeSpaceSeparatedTokenList(["noopener", "noreferrer"]);
const BooleanAttributeArbitrary = S.toArbitrary(BooleanAttribute);
const HtmlNonNegativeIntegerArbitrary = S.toArbitrary(HtmlNonNegativeInteger);
const HtmlPositiveIntegerArbitrary = S.toArbitrary(HtmlPositiveInteger);

describe("@beep/html attribute microsyntaxes", () => {
  it("derives valid presence and integer values from the production schemas", () =>
    fc.assert(
      fc.property(
        BooleanAttributeArbitrary,
        HtmlNonNegativeIntegerArbitrary,
        HtmlPositiveIntegerArbitrary,
        (presence, nonNegative, positive) => {
          expect(S.is(BooleanAttribute)(presence)).toBe(true);
          expect(S.is(HtmlNonNegativeInteger)(nonNegative)).toBe(true);
          expect(S.is(HtmlPositiveInteger)(positive)).toBe(true);
        }
      ),
      fcRuns(50)
    ));

  it("models boolean presence without a false value", () => {
    expect(S.is(BooleanAttribute)(true)).toBe(true);
    expect(S.is(BooleanAttribute)("")).toBe(true);
    expect(S.is(BooleanAttribute)(false)).toBe(false);
    expect(S.is(BooleanAttribute)("false")).toBe(false);
  });

  it("models heading and popover global microsyntaxes canonically", () => {
    expect(S.is(HeadingOffset)(0)).toBe(true);
    expect(S.is(HeadingOffset)(8)).toBe(true);
    expect(S.is(HeadingOffset)(-1)).toBe(false);
    expect(S.is(HeadingOffset)(9)).toBe(false);
    expect(S.decodeUnknownSync(Popover)("")).toBe("auto");
    expect(S.decodeUnknownSync(Popover)("auto")).toBe("auto");
    expect(S.is(Popover)("")).toBe(false);
  });

  it("models non-negative and positive integer domains", () => {
    expect(S.is(HtmlNonNegativeInteger)(0)).toBe(true);
    expect(S.is(HtmlNonNegativeInteger)(-1)).toBe(false);
    expect(S.is(HtmlNonNegativeInteger)(1.5)).toBe(false);
    expect(S.is(HtmlPositiveInteger)(1)).toBe(true);
    expect(S.is(HtmlPositiveInteger)(0)).toBe(false);
    expect(
      S.decodeUnknownSync(Li)({
        _tag: "li",
        children: [],
        value: -2,
      }).value
    ).toStrictEqual(expect.objectContaining({ value: -2 }));
    expect(() =>
      S.decodeUnknownSync(Li)({
        _tag: "li",
        children: [],
        value: "-2",
      })
    ).toThrow();
  });

  it("normalizes token lists to lowercase registry order and one space", () => {
    expect(S.decodeUnknownSync(Rel)("  NOREFERRER   noopener ")).toBe("noopener noreferrer");
    expect(S.encodeSync(Rel)("noopener noreferrer")).toBe("noopener noreferrer");
    expect(() => Rel.make("noreferrer noopener")).toThrow();

    const decoded = S.decodeUnknownSync(Anchor)({
      _tag: "a",
      rel: "NOREFERRER  noopener",
      children: [],
    });
    expect(S.encodeSync(Anchor)(decoded)).toStrictEqual({
      _tag: "a",
      rel: "noopener noreferrer",
      children: [],
    });
  });

  it("keeps token normalization decode/encode idempotent", () =>
    fc.assert(
      fc.property(
        fc.constantFrom(
          "noopener",
          "noreferrer",
          "noopener noreferrer",
          "noreferrer noopener",
          "  NOOPENER   noreferrer "
        ),
        (input) => {
          const canonical = S.decodeUnknownSync(Rel)(input);
          expect(S.decodeUnknownSync(Rel)(S.encodeSync(Rel)(canonical))).toBe(canonical);
        }
      ),
      fcRuns(50)
    ));

  it("validates autocomplete and dataset-key grammars", () => {
    expect(S.is(AutocompleteAttribute)("section-checkout shipping email")).toBe(true);
    expect(S.is(AutocompleteAttribute)("shipping unknown-field")).toBe(false);
    expect(S.decodeUnknownSync(AutocompleteAttribute)(" SECTION-Checkout   SHIPPING Email ")).toBe(
      "section-checkout shipping email"
    );
    expect(S.encodeSync(AutocompleteAttribute)("section-checkout shipping email")).toBe(
      "section-checkout shipping email"
    );
    expect(() => AutocompleteAttribute.make("SHIPPING email")).toThrow();
    expect(S.is(DatasetKey)("testid")).toBe(true);
    expect(S.is(DatasetKey)('x" onclick')).toBe(false);
  });
});
