import {
  BooleanAttribute,
  Comment,
  Div,
  Doctype,
  ELEMENT_META,
  GlobalAttributesStruct,
  HtmlElementMeta,
  HtmlNode,
  Input,
  Marquee,
  Script,
  Span,
  Text,
} from "@beep/html";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
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
      S.encodeSync(HtmlElementMeta)({
        tag: "a",
        interface: "HTMLAnchorElement",
        conformance: "conforming",
        void: false,
        rawText: false,
        categories: ["flow", "phrasing"],
      })
    ).toStrictEqual({
      tag: "a",
      interface: "HTMLAnchorElement",
      conformance: "conforming",
      void: false,
      rawText: false,
      categories: ["flow", "phrasing"],
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
      { numRuns: 50 }
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
    for (const tag of ["marquee", "font", "frame", "frameset", "center", "big", "blink", "applet"]) {
      expect(ELEMENT_META[tag]?.conformance).toBe("non-conforming");
    }
  });
});
