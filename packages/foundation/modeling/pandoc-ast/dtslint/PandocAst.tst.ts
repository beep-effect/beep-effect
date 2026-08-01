import * as Md from "@beep/md/Md.model";
import {
  decodePandocJson,
  decodePandocJsonLossless,
  decodePandocJsonStrict,
  decodePandocJsonString,
  decodePandocJsonStringLossless,
  decodePandocJsonStringStrict,
  documentToPandoc,
  encodePandocJson,
  encodePandocJsonLossless,
  encodePandocJsonString,
  encodePandocJsonStringLossless,
  PandocAttr,
  PandocDocument,
  PandocTarget,
  pandocToDocument,
  Table,
} from "@beep/pandoc-ast";
import { describe, expect, it } from "tstyche";
import type {
  DocumentToPandocResult,
  PandocBlock,
  PandocCompatibilityReport,
  PandocDecodeError,
  PandocInline,
  PandocJsonWire,
  PandocLosslessBlock,
  PandocLosslessDocument,
  PandocMappingError,
  PandocMappingProfile,
  PandocMetaValue,
  PandocToDocumentResult,
  PandocUnknownConstructorWire,
} from "@beep/pandoc-ast";
import type * as Effect from "effect/Effect";
import type * as S from "effect/Schema";

describe("@beep/pandoc-ast public types", () => {
  it("pins recursive AST discriminants", () => {
    expect<PandocInline["_tag"]>().type.toBe<
      | "code"
      | "emph"
      | "image"
      | "linebreak"
      | "link"
      | "math"
      | "note"
      | "softbreak"
      | "space"
      | "span"
      | "str"
      | "strikeout"
      | "strong"
      | "unknownInline"
    >();
    expect<PandocBlock["_tag"]>().type.toBe<
      | "blockquote"
      | "bulletlist"
      | "codeblock"
      | "div"
      | "header"
      | "horizontalrule"
      | "orderedlist"
      | "para"
      | "plain"
      | "table"
      | "unknownBlock"
    >();
    expect<PandocDocument["_tag"]>().type.toBe<"pandocDocument">();
  });

  it("pins mapping result envelopes", () => {
    expect<PandocToDocumentResult["report"]>().type.toBeAssignableTo<PandocCompatibilityReport>();
    expect<DocumentToPandocResult["report"]>().type.toBeAssignableTo<PandocCompatibilityReport>();
    expect<PandocMappingProfile>().type.toBe<"supported" | "gap">();
    expect(pandocToDocument(PandocDocument.make({ blocks: [], meta: {} }))).type.toBe<
      Effect.Effect<PandocToDocumentResult, PandocMappingError>
    >();
    expect(documentToPandoc(Md.Document.make({ children: [] }))).type.toBe<
      Effect.Effect<DocumentToPandocResult, PandocMappingError>
    >();
  });

  it("pins strict and lossless codec profiles", () => {
    expect(decodePandocJsonStrict(null)).type.toBe<Effect.Effect<PandocDocument, PandocDecodeError>>();
    expect(decodePandocJsonStringStrict("")).type.toBe<Effect.Effect<PandocDocument, PandocDecodeError>>();
    expect(decodePandocJson(null)).type.toBe<ReturnType<typeof decodePandocJsonStrict>>();
    expect(decodePandocJsonString("")).type.toBe<ReturnType<typeof decodePandocJsonStringStrict>>();
    const document = PandocDocument.make({ blocks: [], meta: {} });
    expect(encodePandocJson(document)).type.toBe<Effect.Effect<PandocJsonWire>>();
    expect(encodePandocJsonString(document)).type.toBe<Effect.Effect<string, S.SchemaError>>();

    expect(decodePandocJsonLossless(null)).type.toBe<Effect.Effect<PandocLosslessDocument, PandocDecodeError>>();
    expect(decodePandocJsonStringLossless("")).type.toBe<Effect.Effect<PandocLosslessDocument, PandocDecodeError>>();
    expect(encodePandocJsonLossless).type.toBe<
      (document: PandocLosslessDocument) => Effect.Effect<Readonly<Record<string, S.Json>>>
    >();
    expect(encodePandocJsonStringLossless).type.toBe<
      (document: PandocLosslessDocument) => Effect.Effect<string, S.SchemaError>
    >();
    expect<PandocLosslessBlock>().type.toBe<S.Json>();
    expect<PandocLosslessDocument["blocks"]>().type.toBe<ReadonlyArray<S.Json>>();
    expect<PandocLosslessDocument["meta"]>().type.toBe<Readonly<Record<string, S.Json>>>();
  });

  it("pins schema defaults and single-source table encoding", () => {
    expect(PandocAttr.make({})).type.toBe<PandocAttr>();
    expect(PandocTarget.make({ url: "https://example.com" })).type.toBe<PandocTarget>();
    expect(PandocDocument.make({ blocks: [], meta: {} })).type.toBe<PandocDocument>();
    expect<keyof Table.Encoded>().type.toBe<"_tag" | "payload">();
    expect(
      Table.make({
        payload: [["", [], []], [null, []], [], [["", [], []], []], [], [["", [], []], []]],
      })
    ).type.toBe<Table>();
  });

  it("pins recursive metadata constructors", () => {
    expect<PandocMetaValue["_tag"]>().type.toBe<
      "metaBlocks" | "metaBool" | "metaInlines" | "metaList" | "metaMap" | "metaString" | "unknownMeta"
    >();
    expect<Extract<PandocMetaValue, { readonly _tag: "metaMap" }>["entries"][string]>().type.toBe<PandocMetaValue>();
    expect<Extract<PandocBlock, { readonly _tag: "unknownBlock" }>["wire"]>().type.toBe<PandocUnknownConstructorWire>();
    expect<Extract<PandocBlock, { readonly _tag: "unknownBlock" }>["constructorName"]>().type.toBe<string>();
    expect<Extract<PandocInline, { readonly _tag: "unknownInline" }>["payload"]>().type.toBe<S.Json | undefined>();
  });
});
