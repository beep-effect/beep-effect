import { decodePandocJsonLossless, decodePandocJsonStrict, encodePandocJson } from "@beep/pandoc-ast/Pandoc.codec";
import { inspectPandocConformance, PandocConformanceResult } from "@beep/pandoc-ast/Pandoc.conformance";
import { pandocToDocument } from "@beep/pandoc-ast/Pandoc.mapping";
import { PandocColumnWidth } from "@beep/pandoc-ast/Pandoc.model";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const attr = ["", [], []];
const text = (value: string) => ({ c: value, t: "Str" });
const paragraph = (value: string) => ({ c: [text(value)], t: "Para" });

describe("Pandoc current constructor semantic conformance", () => {
  it("strictly round-trips all eleven newly modeled pandoc-types constructors", () => {
    const citation = {
      citationHash: 17,
      citationId: "doe-2024",
      citationMode: { t: "NormalCitation" },
      citationNoteNum: 2,
      citationPrefix: [text("see")],
      citationSuffix: [text("p. 4")],
    };
    const wire = {
      "pandoc-api-version": [1, 23, 1],
      blocks: [
        {
          c: [
            { c: [text("underline")], t: "Underline" },
            { c: [text("super")], t: "Superscript" },
            { c: [text("sub")], t: "Subscript" },
            { c: [text("caps")], t: "SmallCaps" },
            { c: [{ t: "DoubleQuote" }, [text("quoted")]], t: "Quoted" },
            { c: [[citation], [text("Doe")]], t: "Cite" },
            { c: ["html", "<mark>raw</mark>"], t: "RawInline" },
          ],
          t: "Para",
        },
        { c: [[text("first")], [text("second")]], t: "LineBlock" },
        { c: ["html", "<aside>raw</aside>"], t: "RawBlock" },
        {
          c: [[[text("term")], [[paragraph("definition")]]]],
          t: "DefinitionList",
        },
        {
          c: [attr, [null, [paragraph("caption")]], [paragraph("figure body")]],
          t: "Figure",
        },
      ],
      meta: {},
    };

    const semantic = Effect.runSync(decodePandocJsonStrict(wire));
    expect(semantic.blocks.map((block) => block._tag)).toEqual([
      "para",
      "lineBlock",
      "rawBlock",
      "definitionList",
      "figure",
    ]);
    expect(Effect.runSync(encodePandocJson(semantic))).toEqual(wire);
  });

  it("reports malformed Quoted Cite LineBlock DefinitionList and Figure payloads losslessly", () => {
    const malformedCitation = {
      citationHash: 0,
      citationId: "broken",
      citationMode: { t: "FutureCitationMode" },
      citationNoteNum: 0,
      citationPrefix: [],
      citationSuffix: [],
    };
    const wire = {
      "pandoc-api-version": [1, 23, 1],
      blocks: [
        { c: [{ c: [{ t: "FutureQuoteType" }, []], t: "Quoted" }], t: "Para" },
        { c: [{ c: [[malformedCitation], []], t: "Cite" }], t: "Para" },
        { c: [42], t: "LineBlock" },
        { c: [[[], 42]], t: "DefinitionList" },
        { c: [attr, [null, []], 42], t: "Figure" },
      ],
      meta: {},
    };

    expect(Effect.runSyncExit(decodePandocJsonStrict(wire))._tag).toBe("Failure");
    const lossless = Effect.runSync(decodePandocJsonLossless(wire));
    expect(lossless.issues.map((issue) => [issue.constructor, issue.pointer])).toEqual([
      ["FutureQuoteType", "/blocks/0/c/0/c/0"],
      ["FutureCitationMode", "/blocks/1/c/0/c/0/0/citationMode"],
      ["LineBlock", "/blocks/2"],
      ["DefinitionList", "/blocks/3"],
      ["Figure", "/blocks/4"],
    ]);
  });

  it("retains RawInline and RawBlock format and text exactly", () => {
    const wire = {
      "pandoc-api-version": [1, 23, 1],
      blocks: [
        { c: [{ c: ["HTML", "<em>Exact</em>"], t: "RawInline" }], t: "Para" },
        { c: ["LaTeX", "\\newpage"], t: "RawBlock" },
      ],
      meta: {},
    };

    const semantic = Effect.runSync(decodePandocJsonStrict(wire));
    expect(semantic.blocks[0]).toMatchObject({
      children: [{ format: "HTML", text: "<em>Exact</em>" }],
    });
    expect(semantic.blocks[1]).toMatchObject({ format: "LaTeX", text: "\\newpage" });
    expect(Effect.runSync(encodePandocJson(semantic))).toEqual(wire);
  });

  it("rejects malformed raw format and text payloads", () => {
    const wire = {
      "pandoc-api-version": [1, 23, 1],
      blocks: [
        { c: [{ c: [42, "inline"], t: "RawInline" }], t: "Para" },
        { c: ["html", 42], t: "RawBlock" },
      ],
      meta: {},
    };

    expect(Effect.runSyncExit(decodePandocJsonStrict(wire))._tag).toBe("Failure");
    expect(
      Effect.runSync(decodePandocJsonLossless(wire)).issues.map((issue) => [issue.constructor, issue.pointer])
    ).toEqual([
      ["RawInline", "/blocks/0/c/0"],
      ["RawBlock", "/blocks/1"],
    ]);
  });

  it("discriminates finite ColWidth from nullary ColWidthDefault", () => {
    expect(S.is(PandocColumnWidth)({ c: 0.5, t: "ColWidth" })).toBe(true);
    expect(S.is(PandocColumnWidth)({ t: "ColWidthDefault" })).toBe(true);
    expect(S.is(PandocColumnWidth)({ c: "wide", t: "ColWidth" })).toBe(false);
    expect(S.is(PandocColumnWidth)({ c: Number.POSITIVE_INFINITY, t: "ColWidth" })).toBe(false);
    expect(S.is(PandocColumnWidth)({ c: 0.5, t: "ColWidthDefault" })).toBe(false);
  });

  it("accepts every finite generated ColWidth payload", () => {
    fc.assert(
      fc.property(fc.double({ noDefaultInfinity: true, noNaN: true }), (width) =>
        S.is(PandocColumnWidth)({ c: width, t: "ColWidth" })
      ),
      fcRuns(50)
    );
  });

  it("classifies every newly modeled Markdown projection as lossy or unsupported", () => {
    const citation = {
      citationHash: 0,
      citationId: "doe-2024",
      citationMode: { t: "NormalCitation" },
      citationNoteNum: 0,
      citationPrefix: [],
      citationSuffix: [],
    };
    const semantic = Effect.runSync(
      decodePandocJsonStrict({
        "pandoc-api-version": [1, 23, 1],
        blocks: [
          {
            c: [
              { c: [text("underline")], t: "Underline" },
              { c: [text("super")], t: "Superscript" },
              { c: [text("sub")], t: "Subscript" },
              { c: [text("caps")], t: "SmallCaps" },
              { c: [{ t: "DoubleQuote" }, [text("quoted")]], t: "Quoted" },
              { c: [[citation], [text("Doe")]], t: "Cite" },
              { c: ["html", "<mark>raw</mark>"], t: "RawInline" },
            ],
            t: "Para",
          },
          { c: [[text("first")], [text("second")]], t: "LineBlock" },
          { c: ["html", "<aside>raw</aside>"], t: "RawBlock" },
          { c: [[[text("term")], [[paragraph("definition")]]]], t: "DefinitionList" },
          { c: [attr, [null, []], [paragraph("figure body")]], t: "Figure" },
        ],
        meta: {},
      })
    );

    const mapped = Effect.runSync(pandocToDocument(semantic));
    expect(mapped.report.issues.map(({ construct, severity }) => [construct, severity])).toEqual([
      ["Underline", "lossy"],
      ["Superscript", "lossy"],
      ["Subscript", "lossy"],
      ["SmallCaps", "lossy"],
      ["Quoted", "lossy"],
      ["Cite", "unsupported"],
      ["RawInline", "unsupported"],
      ["LineBlock", "lossy"],
      ["RawBlock", "unsupported"],
      ["DefinitionList", "unsupported"],
      ["Figure", "unsupported"],
    ]);
    expect(mapped.document.children.map((block) => block._tag)).toEqual(["p", "p", "p", "p", "blockquote"]);
  });
});

describe("Pandoc conformance facade", () => {
  it("classifies an exact current document as compatible with stable invariant IDs", () => {
    const result = Effect.runSync(
      inspectPandocConformance({
        "pandoc-api-version": [1, 23, 1],
        blocks: [paragraph("exact")],
        meta: {},
      })
    );

    expect(result._tag).toBe("compatible");
    expect(result.checkedInvariantIds).toEqual([
      "pandoc.semantic-subset",
      "pandoc.raw.exact-retention",
      "pandoc.table.column-width-payload",
    ]);
  });

  it("classifies retained future constructors as unsupported through exhaustive helpers", () => {
    const result = Effect.runSync(
      inspectPandocConformance({
        "pandoc-api-version": [1, 23, 1],
        blocks: [{ c: { exact: true }, t: "FutureBlock" }],
        meta: {},
      })
    );

    expect(PandocConformanceResult.guards.unsupported(result)).toBe(true);
    expect(
      PandocConformanceResult.match(result, {
        compatible: () => "compatible",
        unsupported: ({ issues }) => issues[0]?._tag,
        invalid: () => "invalid",
      })
    ).toBe("futureConstructor");
  });

  it("classifies malformed current constructors as invalid with lossless diagnostics", () => {
    const result = Effect.runSync(
      inspectPandocConformance({
        "pandoc-api-version": [1, 23, 1],
        blocks: [{ c: {}, t: "Figure" }],
        meta: {},
      })
    );

    expect(result._tag).toBe("invalid");
    if (result._tag === "invalid") {
      expect(result.issues.map((issue) => [issue.constructor, issue.pointer])).toEqual([["Figure", "/blocks/0"]]);
      expect(result.wire).toEqual(
        O.some({
          "pandoc-api-version": [1, 23, 1],
          blocks: [{ c: {}, t: "Figure" }],
          meta: {},
        })
      );
    }
  });

  it("classifies a malformed Pandoc envelope as invalid before wire retention", () => {
    const result = Effect.runSync(inspectPandocConformance(null));

    expect(result._tag).toBe("invalid");
    if (result._tag === "invalid") {
      expect(result.issues).toEqual([]);
      expect(O.isNone(result.wire)).toBe(true);
      expect(Effect.runSync(S.encodeEffect(PandocConformanceResult)(result))).not.toHaveProperty("wire");
    }
  });

  it("does not call lossy strict rewrites normalizable", () => {
    const result = Effect.runSync(
      inspectPandocConformance({
        "pandoc-api-version": [1, 23, 1],
        blocks: [{ extension: true, t: "HorizontalRule" }],
        meta: {},
      })
    );

    expect(result._tag).toBe("unsupported");
    if (result._tag === "unsupported") {
      expect(result.issues.map((issue) => issue._tag)).toEqual(["nonCanonicalWire"]);
    }
  });
});
