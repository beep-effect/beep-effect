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
import { Effect, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeGlobalAttributesStructResult = S.decodeResult(GlobalAttributesStruct);
const decodeOlResult = S.decodeResult(Ol);
const decodeAnchorSync = S.decodeSync(Anchor);
const decodeAutocompleteAttributeSync = S.decodeSync(AutocompleteAttribute);
const decodeLiSync = S.decodeSync(Li);
const decodePopoverSync = S.decodeSync(Popover);
const decodeUnknownHtmlNodeResult = S.decodeUnknownResult(HtmlNode);
const decodeUnknownLiSync = S.decodeUnknownSync(Li);
const decodeUnknownOlSync = S.decodeUnknownSync(Ol);
const encodeGlobalAttributesStructResult = S.encodeResult(GlobalAttributesStruct);
const encodeHtmlNodeResult = S.encodeResult(HtmlNode);
const encodeOlResult = S.encodeResult(Ol);
const encodeAnchorSync = S.encodeSync(Anchor);
const encodeAutocompleteAttributeSync = S.encodeSync(AutocompleteAttribute);
const isAutocompleteAttribute = S.is(AutocompleteAttribute);
const isBooleanAttribute = S.is(BooleanAttribute);
const isDatasetKey = S.is(DatasetKey);
const isHeadingOffset = S.is(HeadingOffset);
const isHtmlFiniteNumber = S.is(HtmlFiniteNumber);
const isHtmlIdValue = S.is(HtmlIdValue);
const isHtmlNonNegativeInteger = S.is(HtmlNonNegativeInteger);
const isHtmlNonNegativeNumber = S.is(HtmlNonNegativeNumber);
const isHtmlPositiveInteger = S.is(HtmlPositiveInteger);
const isHtmlPositiveNumber = S.is(HtmlPositiveNumber);
const isPopover = S.is(Popover);

const Rel = makeSpaceSeparatedTokenList(["noopener", "noreferrer"]);
const decodeRelSync = S.decodeSync(Rel);
const encodeRelSync = S.encodeSync(Rel);
const Enumerated = makeAsciiCaseInsensitiveEnumerated(["image", "script"]);
const decodeEnumeratedResult = S.decodeResult(Enumerated);
const encodeEnumeratedResult = S.encodeResult(Enumerated);
const AsciiK = makeAsciiCaseInsensitiveEnumerated(["k"]);
const decodeAsciiKResult = S.decodeResult(AsciiK);
const BooleanAttributeArbitrary = Arbitrary.schema(BooleanAttribute);
const HtmlNonNegativeIntegerArbitrary = Arbitrary.schema(HtmlNonNegativeInteger);
const HtmlPositiveIntegerArbitrary = Arbitrary.schema(HtmlPositiveInteger);
const HtmlFiniteNumberArbitrary = Arbitrary.schema(HtmlFiniteNumber);
const HtmlNonNegativeNumberArbitrary = Arbitrary.schema(HtmlNonNegativeNumber);
const HtmlPositiveNumberArbitrary = Arbitrary.schema(HtmlPositiveNumber);

describe("@beep/html attribute microsyntaxes", () => {
  it("derives valid presence and integer values from the production schemas", () =>
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([BooleanAttributeArbitrary, HtmlNonNegativeIntegerArbitrary, HtmlPositiveIntegerArbitrary]),
          ([presence, nonNegative, positive]) => {
            expect(isBooleanAttribute(presence)).toBe(true);
            expect(isHtmlNonNegativeInteger(nonNegative)).toBe(true);
            expect(isHtmlPositiveInteger(positive)).toBe(true);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed"));

  it("models boolean presence without a false value", () => {
    expect(isBooleanAttribute(true)).toBe(true);
    expect(isBooleanAttribute("")).toBe(true);
    expect(isBooleanAttribute(false)).toBe(false);
    expect(isBooleanAttribute("false")).toBe(false);
  });

  it("models heading and popover global microsyntaxes canonically", () => {
    expect(isHeadingOffset(0)).toBe(true);
    expect(isHeadingOffset(8)).toBe(true);
    expect(isHeadingOffset(-1)).toBe(false);
    expect(isHeadingOffset(9)).toBe(false);
    expect(decodePopoverSync("")).toBe("auto");
    expect(decodePopoverSync("auto")).toBe("auto");
    expect(isPopover("")).toBe(false);
  });

  it("models non-negative and positive integer domains", () => {
    expect(isHtmlNonNegativeInteger(0)).toBe(true);
    expect(isHtmlNonNegativeInteger(-1)).toBe(false);
    expect(isHtmlNonNegativeInteger(1.5)).toBe(false);
    expect(isHtmlPositiveInteger(1)).toBe(true);
    expect(isHtmlPositiveInteger(0)).toBe(false);
    expect(
      decodeLiSync({
        _tag: "li",
        children: [],
        value: -2,
      }).value
    ).toStrictEqual(expect.objectContaining({ value: -2 }));
    expect(() =>
      decodeUnknownLiSync({
        _tag: "li",
        children: [],
        value: "-2",
      })
    ).toThrow();
  });

  it("models finite, non-negative, and positive floating-point domains", () => {
    expect(isHtmlFiniteNumber(1.5)).toBe(true);
    expect(isHtmlFiniteNumber(Number.NaN)).toBe(false);
    expect(isHtmlFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isHtmlNonNegativeNumber(0)).toBe(true);
    expect(isHtmlNonNegativeNumber(-0.1)).toBe(false);
    expect(isHtmlPositiveNumber(0.1)).toBe(true);
    expect(isHtmlPositiveNumber(0)).toBe(false);
  });

  it("derives only valid floating-point values from the production schemas", () =>
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([HtmlFiniteNumberArbitrary, HtmlNonNegativeNumberArbitrary, HtmlPositiveNumberArbitrary]),
          ([finite, nonNegative, positive]) => {
            expect(isHtmlFiniteNumber(finite)).toBe(true);
            expect(isHtmlNonNegativeNumber(nonNegative)).toBe(true);
            expect(isHtmlPositiveNumber(positive)).toBe(true);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed"));

  it("normalizes token lists to lowercase registry order and one space", () => {
    expect(decodeRelSync("  NOREFERRER   noopener ")).toBe("noopener noreferrer");
    expect(encodeRelSync("noopener noreferrer")).toBe("noopener noreferrer");
    expect(() => Rel.make("noreferrer noopener")).toThrow();

    const decoded = decodeAnchorSync({
      _tag: "a",
      rel: "NOREFERRER  noopener",
      children: [],
    });
    expect(encodeAnchorSync(decoded)).toStrictEqual({
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
      expect(() => decodeRelSync(value)).toThrow();
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
      const decoded = Result.getOrThrow(decodeUnknownHtmlNodeResult(encoded));
      expect(Result.getOrThrow(encodeHtmlNodeResult(decoded))).toStrictEqual(expected);
    }

    expect(Area.make({ shape: O.some("circle") }).shape).toStrictEqual(O.some("circle"));
    expect(Audio.make({ children: [], preload: O.some("metadata") }).preload).toStrictEqual(O.some("metadata"));
    expect(Button.make({ children: [], type: O.some("submit") }).type).toStrictEqual(O.some("submit"));
    expect(Link.make({ as: O.some("image") }).as).toStrictEqual(O.some("image"));
    expect(Meta.make({ "http-equiv": O.some("content-type") })["http-equiv"]).toStrictEqual(O.some("content-type"));
  });

  it("keeps the case-distinguishing ol type keyword contract", () => {
    for (const value of ["a", "A", "i", "I"] as const) {
      const decoded = Result.getOrThrow(decodeOlResult({ _tag: "ol", children: [], type: value }));
      expect(Result.getOrThrow(encodeOlResult(decoded)).type).toBe(value);
    }
    expect(() => decodeUnknownOlSync({ _tag: "ol", children: [], type: "ALPHA" })).toThrow();
  });

  it("obeys the enumerated-attribute ASCII-case fixed-point law", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(S.Array(S.Boolean).check(S.isMinLength(5), S.isMaxLength(5)))]),
          ([uppercase]) => {
            const encoded = [..."image"]
              .map((character, index) => (uppercase[index] === true ? character.toUpperCase() : character))
              .join("");
            const canonical = Result.getOrThrow(decodeEnumeratedResult(encoded));
            expect(canonical).toBe("image");
            const reencoded = Result.getOrThrow(encodeEnumeratedResult(canonical));
            expect(reencoded).toBe("image");
            expect(Result.getOrThrow(decodeEnumeratedResult(reencoded))).toBe(canonical);
            if (encoded !== canonical) {
              expect(() => Reflect.apply(Enumerated.make, Enumerated, [encoded])).toThrow();
            }

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed");
    for (const invalid of [" image", "image ", "ımage"]) {
      expect(Result.isFailure(decodeEnumeratedResult(invalid))).toBe(true);
    }
    expect(Result.isFailure(decodeAsciiKResult("\u212A"))).toBe(true);
  });

  it("canonicalizes the exact enumerated global-attribute inventory", () => {
    const decoded = Result.getOrThrow(
      decodeGlobalAttributesStructResult({
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
    expect(Result.getOrThrow(encodeGlobalAttributesStructResult(decoded))).toStrictEqual({
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
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([
            Arbitrary.schema(
              S.Literals([
                "noopener",
                "noreferrer",
                "noopener noreferrer",
                "noreferrer noopener",
                "  NOOPENER   noreferrer ",
              ])
            ),
          ]),
          ([input]) => {
            const canonical = decodeRelSync(input);
            expect(decodeRelSync(encodeRelSync(canonical))).toBe(canonical);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed"));

  it("validates autocomplete and dataset-key grammars", () => {
    expect(isAutocompleteAttribute("section-checkout shipping email")).toBe(true);
    expect(isAutocompleteAttribute("shipping unknown-field")).toBe(false);
    expect(isAutocompleteAttribute("shipping\u00a0email")).toBe(false);
    expect(decodeAutocompleteAttributeSync(" SECTION-Checkout   SHIPPING Email ")).toBe(
      "section-checkout shipping email"
    );
    expect(encodeAutocompleteAttributeSync("section-checkout shipping email")).toBe("section-checkout shipping email");
    expect(() => AutocompleteAttribute.make("SHIPPING email")).toThrow();
    expect(isDatasetKey("testid")).toBe(true);
    expect(isDatasetKey("1")).toBe(true);
    expect(isDatasetKey("-x")).toBe(true);
    expect(isDatasetKey("méta")).toBe(true);
    expect(isDatasetKey("TestId")).toBe(false);
    expect(isDatasetKey('x" onclick')).toBe(false);
    expect(isHtmlIdValue("section-1")).toBe(true);
    expect(isHtmlIdValue("")).toBe(false);
    expect(isHtmlIdValue("two ids")).toBe(false);
    expect(isHtmlIdValue("two\tids")).toBe(false);
  });
});
