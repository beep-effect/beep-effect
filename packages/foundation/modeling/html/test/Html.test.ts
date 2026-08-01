import {
  BooleanAttribute,
  Comment,
  Doctype,
  ELEMENT_META,
  GlobalAttributesStruct,
  Html,
  HtmlDocument,
  HtmlElementMeta,
  HtmlFragment,
  HtmlNode,
  Text,
} from "@beep/html";
import {
  Div,
  Html as HtmlElement,
  Input,
  Document as LosslessDocument,
  Marquee,
  Script,
  Span,
} from "@beep/html/Html.model";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decode = S.decodeUnknownSync(HtmlNode);
const encode = S.encodeSync(HtmlNode);
const GlobalAttributesArbitrary = S.toArbitrary(GlobalAttributesStruct);
const BooleanAttributeArbitrary = S.toArbitrary(BooleanAttribute);
const TextArbitrary = S.toArbitrary(Text);
const CommentArbitrary = S.toArbitrary(Comment);
const DoctypeArbitrary = S.toArbitrary(Doctype);
const InputArbitrary = S.toArbitrary(Input);
const HtmlElementMetaArbitrary = S.toArbitrary(HtmlElementMeta);

const encodeWith = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): C["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decodeWith = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Encoded"]): C["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): void => {
  expect(Eq.equals(decodeWith(schema, encodeWith(schema, value)), value)).toBe(true);
};

describe("HtmlNode AST — structure & nodes", () => {
  it("exposes staged conformance and safe-policy facades", () => {
    const root = HtmlFragment.make({ children: [] });
    expect(Html.Conformant.issues(root)).toStrictEqual([]);

    const conformant = Effect.runSync(Html.Conformant.decode(root));
    expect(Html.Safe.issues(conformant)).toStrictEqual([]);
    expect(() => Effect.runSync(Html.Safe.decode(conformant))).not.toThrow();
  });

  it("narrows canonical document children without weakening the lossless document", () => {
    const comment = Comment.make({ value: "before root" });
    const documentElement = HtmlElement.make({ children: [] });
    const canonical = {
      _tag: "#document",
      children: [
        { _tag: "#comment", value: "before root" },
        { _tag: "html", children: [] },
      ],
    };
    const diagnostic = { _tag: "#document", children: [{ _tag: "div", children: [] }] };
    const excludedChildren = [
      { encoded: { _tag: "div", children: [] }, type: Div.make({ children: [] }) },
      { encoded: { _tag: "#fragment", children: [] }, type: HtmlFragment.make({ children: [] }) },
      { encoded: { _tag: "#document", children: [] }, type: LosslessDocument.make({ children: [] }) },
      { encoded: { _tag: "#doctype", name: "html" }, type: Doctype.html() },
    ];

    expect(Result.isSuccess(S.decodeUnknownResult(HtmlDocument)(canonical))).toBe(true);
    expect(HtmlDocument.make({ children: [comment, documentElement] })).toBeDefined();
    for (const { encoded, type } of excludedChildren) {
      expect(Result.isFailure(S.decodeUnknownResult(HtmlDocument)({ _tag: "#document", children: [encoded] }))).toBe(
        true
      );
      expect(() =>
        HtmlDocument.make({
          // @ts-expect-error -- exercise constructor validation for excluded document child kinds.
          children: [type],
        })
      ).toThrow();
    }

    expect(Result.isSuccess(S.decodeUnknownResult(LosslessDocument)(diagnostic))).toBe(true);
    expect(LosslessDocument.make({ children: [Div.make({ children: [] })] })).toBeDefined();
  });

  it("decodes and re-encodes a nested tree (JSON identity)", () => {
    const json = {
      _tag: "div",
      id: "root",
      class: "wrap",
      children: [
        { _tag: "span", children: [{ _tag: "#text", value: "hi" }] },
        { _tag: "img", src: "x.png", alt: "logo" },
      ],
    };
    const node = decode(json);
    expect(node._tag).toBe("div");
    expect(encode(node)).toStrictEqual(json);
  });

  it("provides .make constructors that auto-inject _tag", () => {
    expect(Div.make({ children: [] })._tag).toBe("div");
    expect(Span.make({ children: [] })._tag).toBe("span");
    expect(Text.make({ value: "x" })._tag).toBe("#text");
    expect(Marquee.make({ children: [] })._tag).toBe("marquee");
  });

  it("discriminates union members by _tag and rejects unknown tags", () => {
    expect(decode({ _tag: "span", children: [] })._tag).toBe("span");
    expect(() => decode({ _tag: "not-a-real-element", children: [] })).toThrow();
  });

  it("treats void elements as childless", () => {
    const img = decode({ _tag: "img", src: "a.png" });
    expect(img._tag).toBe("img");
    expect("children" in img).toBe(false);
  });

  it("models raw-text elements with a content field", () => {
    const script = Script.make({ content: "console.log(1)" });
    expect(script._tag).toBe("script");
    expect(script.content).toBe("console.log(1)");
    expect(encode(decode({ _tag: "style", content: ".a{}" }))).toStrictEqual({ _tag: "style", content: ".a{}" });
  });
});

describe("HtmlNode AST — attributes", () => {
  it("enforces enumerated attribute values (input[type])", () => {
    // `as const` keeps each value at its literal type, so `Input.make` actually
    // exercises that the `S.Literals` input-type union accepts every keyword.
    const types = [
      "button",
      "checkbox",
      "color",
      "date",
      "datetime-local",
      "email",
      "file",
      "hidden",
      "image",
      "month",
      "number",
      "password",
      "radio",
      "range",
      "reset",
      "search",
      "submit",
      "tel",
      "text",
      "time",
      "url",
      "week",
    ] as const;
    for (const type of types) {
      expect(() => Input.make({ type: O.some(type) })).not.toThrow();
    }
    expect(() => decode({ _tag: "input", type: "not-a-type" })).toThrow();
  });

  it("accepts global, ARIA, event-handler, and data-* attributes on any element", () => {
    const json = {
      _tag: "button",
      id: "b",
      "aria-label": "Save",
      onclick: "save()",
      dataset: { testid: "save-btn" },
      children: [],
    };
    expect(encode(decode(json))).toStrictEqual(json);
  });
});

describe("HtmlNode AST — schema laws", () => {
  it("keeps option-defaulted fields byte-identical on the encoded wire", () => {
    expect(S.encodeSync(GlobalAttributesStruct)(GlobalAttributesStruct.make({}))).toStrictEqual({});
    expect(
      S.encodeSync(GlobalAttributesStruct)(
        GlobalAttributesStruct.make({
          autofocus: O.some(true),
          dataset: O.some({ testid: "save" }),
          id: O.some("root"),
        })
      )
    ).toStrictEqual({
      autofocus: true,
      dataset: { testid: "save" },
      id: "root",
    });
    expect(S.encodeSync(Doctype)(Doctype.html())).toStrictEqual({ _tag: "#doctype", name: "html" });
    expect(
      S.encodeSync(Input)(
        Input.make({
          alt: O.some("Search"),
          src: O.some("x.png"),
          type: O.some("text"),
        })
      )
    ).toStrictEqual({ _tag: "input", alt: "Search", src: "x.png", type: "text" });
    expect(
      S.encodeSync(HtmlElementMeta)(
        HtmlElementMeta.make({
          tag: "a",
          interface: "HTMLAnchorElement",
          conformance: "conforming",
          void: false,
          rawText: false,
          textMode: "normal",
          categories: ["flow", "phrasing"],
          children: ["transparent"],
          currentAttributes: [],
          obsoleteAttributes: [],
          conditionalCategories: [],
          attributeEqualities: [],
          attributeRequirements: [],
          numericAttributeRelationships: [],
          rules: {},
          uniqueAttributes: [],
        })
      )
    ).toStrictEqual({
      tag: "a",
      interface: "HTMLAnchorElement",
      conformance: "conforming",
      void: false,
      rawText: false,
      textMode: "normal",
      categories: ["flow", "phrasing"],
      children: ["transparent"],
      currentAttributes: [],
      obsoleteAttributes: [],
      conditionalCategories: [],
      attributeEqualities: [],
      attributeRequirements: [],
      numericAttributeRelationships: [],
      rules: {},
      uniqueAttributes: [],
    });
  });

  it("round-trips schema-derived HTML AST schemas", () =>
    fc.assert(
      fc.property(
        GlobalAttributesArbitrary,
        BooleanAttributeArbitrary,
        TextArbitrary,
        CommentArbitrary,
        DoctypeArbitrary,
        InputArbitrary,
        HtmlElementMetaArbitrary,
        (attributes, booleanAttribute, text, comment, doctype, input, meta) => {
          expectRoundTrip(GlobalAttributesStruct, attributes);
          expectRoundTrip(BooleanAttribute, booleanAttribute);
          expectRoundTrip(Text, text);
          expectRoundTrip(Comment, comment);
          expectRoundTrip(Doctype, doctype);
          expectRoundTrip(Input, input);
          expectRoundTrip(HtmlElementMeta, meta);
        }
      ),
      fcRuns(50)
    ));
});

describe("ELEMENT_META", () => {
  it("covers every WHATWG element from the pinned dataset (conforming + obsolete)", () => {
    // Snapshot guard tied to the version-pinned webref dataset: a deliberate
    // re-pin / `bun run generate` that changes the element set should update this.
    expect(Object.keys(ELEMENT_META)).toHaveLength(142);
  });

  it("tags conformance, void, and raw-text correctly", () => {
    expect(ELEMENT_META.div?.conformance).toBe("conforming");
    expect(ELEMENT_META.img?.void).toBe(true);
    expect(ELEMENT_META.script?.rawText).toBe(true);
    expect(ELEMENT_META.a?.categories).toContain("flow");
  });

  it("includes obsolete elements as non-conforming", () => {
    for (const tag of ["marquee", "font", "frame", "frameset", "center", "big", "blink", "applet"] as const) {
      expect(ELEMENT_META[tag].conformance).toBe("non-conforming");
    }
  });
});
