import {
  AutocompleteAttribute,
  BooleanAttribute,
  DatasetKey,
  GlobalAttributesStruct,
  HeadingOffset,
  HtmlFiniteNumber,
  HtmlIdValue,
  HtmlNonNegativeInteger,
  HtmlNonNegativeNumber,
  HtmlPositiveInteger,
  HtmlPositiveNumber,
  makeAsciiCaseInsensitiveEnumerated,
  makeSpaceSeparatedTokenList,
  Popover,
} from "@beep/html";
import { tokenizeHtmlSpaceSeparated } from "@beep/html/Html.attributes";
import { A as Anchor, Area, Audio, Button, HtmlNode, Li, Link, Meta, Ol } from "@beep/html/Html.model";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const Rel = makeSpaceSeparatedTokenList(["noopener", "noreferrer"]);
const BooleanAttributeArbitrary = S.toArbitrary(BooleanAttribute)(fc);
const HtmlNonNegativeIntegerArbitrary = S.toArbitrary(HtmlNonNegativeInteger)(fc);
const HtmlPositiveIntegerArbitrary = S.toArbitrary(HtmlPositiveInteger)(fc);
const HtmlFiniteNumberArbitrary = S.toArbitrary(HtmlFiniteNumber)(fc);
const HtmlNonNegativeNumberArbitrary = S.toArbitrary(HtmlNonNegativeNumber)(fc);
const HtmlPositiveNumberArbitrary = S.toArbitrary(HtmlPositiveNumber)(fc);

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
    expect(S.decodeSync(Popover)("")).toBe("auto");
    expect(S.decodeSync(Popover)("auto")).toBe("auto");
    expect(S.is(Popover)("")).toBe(false);
  });

  it("models non-negative and positive integer domains", () => {
    expect(S.is(HtmlNonNegativeInteger)(0)).toBe(true);
    expect(S.is(HtmlNonNegativeInteger)(-1)).toBe(false);
    expect(S.is(HtmlNonNegativeInteger)(1.5)).toBe(false);
    expect(S.is(HtmlPositiveInteger)(1)).toBe(true);
    expect(S.is(HtmlPositiveInteger)(0)).toBe(false);
    expect(
      S.decodeSync(Li)({
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

  it("models finite, non-negative, and positive floating-point domains", () => {
    expect(S.is(HtmlFiniteNumber)(1.5)).toBe(true);
    expect(S.is(HtmlFiniteNumber)(Number.NaN)).toBe(false);
    expect(S.is(HtmlFiniteNumber)(Number.POSITIVE_INFINITY)).toBe(false);
    expect(S.is(HtmlNonNegativeNumber)(0)).toBe(true);
    expect(S.is(HtmlNonNegativeNumber)(-0.1)).toBe(false);
    expect(S.is(HtmlPositiveNumber)(0.1)).toBe(true);
    expect(S.is(HtmlPositiveNumber)(0)).toBe(false);
  });

  it("derives only valid floating-point values from the production schemas", () =>
    fc.assert(
      fc.property(
        HtmlFiniteNumberArbitrary,
        HtmlNonNegativeNumberArbitrary,
        HtmlPositiveNumberArbitrary,
        (finite, nonNegative, positive) => {
          expect(S.is(HtmlFiniteNumber)(finite)).toBe(true);
          expect(S.is(HtmlNonNegativeNumber)(nonNegative)).toBe(true);
          expect(S.is(HtmlPositiveNumber)(positive)).toBe(true);
        }
      ),
      fcRuns(50)
    ));

  it("normalizes token lists to lowercase registry order and one space", () => {
    expect(S.decodeSync(Rel)("  NOREFERRER   noopener ")).toBe("noopener noreferrer");
    expect(S.encodeSync(Rel)("noopener noreferrer")).toBe("noopener noreferrer");
    expect(() => Rel.make("noreferrer noopener")).toThrow();

    const decoded = S.decodeSync(Anchor)({
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

  it("uses only the five HTML ASCII whitespace code points as token separators", () => {
    for (const separator of [" ", "\t", "\n", "\f", "\r"]) {
      expect(tokenizeHtmlSpaceSeparated(`noopener${separator}noreferrer`)).toStrictEqual(["noopener", "noreferrer"]);
    }
    for (const separator of ["\u00a0", "\u2003", "\u202f"]) {
      const value = `noopener${separator}noreferrer`;
      expect(tokenizeHtmlSpaceSeparated(value)).toStrictEqual([value]);
      expect(() => S.decodeSync(Rel)(value)).toThrow();
      expect(() => Rel.make(value)).toThrow();
    }
  });

  it("canonicalizes encoded enumerated keywords while preserving fixed-point Types", () => {
    const cases = [
      [
        { _tag: "area", shape: "CIRCLE" },
        { _tag: "area", shape: "circle" },
      ],
      [
        { _tag: "audio", children: [], crossorigin: "USE-CREDENTIALS", loading: "EAGER", preload: "METADATA" },
        { _tag: "audio", children: [], crossorigin: "use-credentials", loading: "eager", preload: "metadata" },
      ],
      [
        { _tag: "button", children: [], formenctype: "TEXT/PLAIN", formmethod: "POST", type: "SUBMIT" },
        { _tag: "button", children: [], formenctype: "text/plain", formmethod: "post", type: "submit" },
      ],
      [
        { _tag: "link", as: "IMAGE", crossorigin: "ANONYMOUS", fetchpriority: "HIGH", href: "/image" },
        { _tag: "link", as: "image", crossorigin: "anonymous", fetchpriority: "high", href: "/image" },
      ],
      [
        { _tag: "meta", "http-equiv": "CONTENT-SECURITY-POLICY", content: "default-src 'none'" },
        { _tag: "meta", "http-equiv": "content-security-policy", content: "default-src 'none'" },
      ],
    ];
    for (const [encoded, expected] of cases) {
      const decoded = Result.getOrThrow(S.decodeUnknownResult(HtmlNode)(encoded));
      expect(Result.getOrThrow(S.encodeResult(HtmlNode)(decoded))).toStrictEqual(expected);
    }

    expect(Area.make({ shape: O.some("circle") }).shape).toStrictEqual(O.some("circle"));
    expect(Audio.make({ children: [], preload: O.some("metadata") }).preload).toStrictEqual(O.some("metadata"));
    expect(Button.make({ children: [], type: O.some("submit") }).type).toStrictEqual(O.some("submit"));
    expect(Link.make({ as: O.some("image") }).as).toStrictEqual(O.some("image"));
    expect(Meta.make({ "http-equiv": O.some("content-type") })["http-equiv"]).toStrictEqual(O.some("content-type"));
  });

  it("keeps the case-distinguishing ol type keyword contract", () => {
    for (const value of ["a", "A", "i", "I"] as const) {
      const decoded = Result.getOrThrow(S.decodeResult(Ol)({ _tag: "ol", children: [], type: value }));
      expect(Result.getOrThrow(S.encodeResult(Ol)(decoded)).type).toBe(value);
    }
    expect(() => S.decodeUnknownSync(Ol)({ _tag: "ol", children: [], type: "ALPHA" })).toThrow();
  });

  it("obeys the enumerated-attribute ASCII-case fixed-point law", () => {
    const Enumerated = makeAsciiCaseInsensitiveEnumerated(["image", "script"]);
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 5, maxLength: 5 }), (uppercase) => {
        const encoded = [..."image"]
          .map((character, index) => (uppercase[index] === true ? character.toUpperCase() : character))
          .join("");
        const canonical = Result.getOrThrow(S.decodeResult(Enumerated)(encoded));
        expect(canonical).toBe("image");
        const reencoded = Result.getOrThrow(S.encodeResult(Enumerated)(canonical));
        expect(reencoded).toBe("image");
        expect(Result.getOrThrow(S.decodeResult(Enumerated)(reencoded))).toBe(canonical);
        if (encoded !== canonical) {
          expect(() => Reflect.apply(Enumerated.make, Enumerated, [encoded])).toThrow();
        }
      }),
      fcRuns(50)
    );
    for (const invalid of [" image", "image ", "ımage"]) {
      expect(Result.isFailure(S.decodeResult(Enumerated)(invalid))).toBe(true);
    }
    expect(Result.isFailure(S.decodeResult(makeAsciiCaseInsensitiveEnumerated(["k"]))("\u212A"))).toBe(true);
  });

  it("canonicalizes the exact enumerated global-attribute inventory", () => {
    const decoded = Result.getOrThrow(
      S.decodeResult(GlobalAttributesStruct)({
        autocapitalize: "SENTENCES",
        autocorrect: "ON",
        contenteditable: "",
        dir: "RTL",
        draggable: "TRUE",
        enterkeyhint: "SEND",
        hidden: "",
        inputmode: "EMAIL",
        popover: "",
        spellcheck: "",
        translate: "",
        writingsuggestions: "FALSE",
      })
    );
    expect(Result.getOrThrow(S.encodeResult(GlobalAttributesStruct)(decoded))).toStrictEqual({
      autocapitalize: "sentences",
      autocorrect: "on",
      contenteditable: "true",
      dir: "rtl",
      draggable: "true",
      enterkeyhint: "send",
      hidden: "hidden",
      inputmode: "email",
      popover: "auto",
      spellcheck: "true",
      translate: "yes",
      writingsuggestions: "false",
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
          const canonical = S.decodeSync(Rel)(input);
          expect(S.decodeSync(Rel)(S.encodeSync(Rel)(canonical))).toBe(canonical);
        }
      ),
      fcRuns(50)
    ));

  it("validates autocomplete and dataset-key grammars", () => {
    expect(S.is(AutocompleteAttribute)("section-checkout shipping email")).toBe(true);
    expect(S.is(AutocompleteAttribute)("shipping unknown-field")).toBe(false);
    expect(S.is(AutocompleteAttribute)("shipping\u00a0email")).toBe(false);
    expect(S.decodeSync(AutocompleteAttribute)(" SECTION-Checkout   SHIPPING Email ")).toBe(
      "section-checkout shipping email"
    );
    expect(S.encodeSync(AutocompleteAttribute)("section-checkout shipping email")).toBe(
      "section-checkout shipping email"
    );
    expect(() => AutocompleteAttribute.make("SHIPPING email")).toThrow();
    expect(S.is(DatasetKey)("testid")).toBe(true);
    expect(S.is(DatasetKey)("1")).toBe(true);
    expect(S.is(DatasetKey)("-x")).toBe(true);
    expect(S.is(DatasetKey)("méta")).toBe(true);
    expect(S.is(DatasetKey)("TestId")).toBe(false);
    expect(S.is(DatasetKey)('x" onclick')).toBe(false);
    expect(S.is(HtmlIdValue)("section-1")).toBe(true);
    expect(S.is(HtmlIdValue)("")).toBe(false);
    expect(S.is(HtmlIdValue)("two ids")).toBe(false);
    expect(S.is(HtmlIdValue)("two\tids")).toBe(false);
  });
});
