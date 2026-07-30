import {
  decodePandocJson,
  decodePandocJsonLossless,
  decodePandocJsonStrict,
  decodePandocJsonString,
  decodePandocJsonStringLossless,
  decodePandocJsonStringStrict,
  encodePandocJson,
  encodePandocJsonLossless,
  encodePandocJsonString,
  encodePandocJsonStringLossless,
  PandocJsonFromString,
} from "@beep/pandoc-ast/Pandoc.codec";
import {
  Header,
  Link,
  MetaList,
  MetaString,
  PandocApiVersion,
  PandocAttr,
  PandocDocument,
  PandocTarget,
  Str,
  Table,
} from "@beep/pandoc-ast/Pandoc.model";
import { fcRuns } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const PandocDocumentArbitrary = S.toArbitrary(PandocDocument);
const PandocDocumentEquivalence = S.toEquivalence(PandocDocument);
const JsonArbitrary = S.toArbitrary(S.Json);
const decodeUnknownJsonString = S.decodeUnknownEffect(S.UnknownFromJsonString);
const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    layer.pipe(
      Layer.build,
      Effect.flatMap((context) => effect.pipe(Effect.provide(context))),
      Effect.scoped
    );
const provideBunFileSystem = provideScopedLayer(BunFileSystem.layer);

const fixture = Effect.fn("PandocCodecTest.fixture")((name: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.readFileString(new URL(`./fixtures/${name}`, import.meta.url).pathname);
  }).pipe(provideBunFileSystem)
);
describe("Pandoc.codec", () => {
  it("keeps the established decode names as strict API aliases", () => {
    expect(decodePandocJson).toBe(decodePandocJsonStrict);
    expect(decodePandocJsonString).toBe(decodePandocJsonStringStrict);
  });

  it("rejects payloads on known nullary constructors and reports them losslessly", () => {
    const malformed = [
      {
        expected: [["HorizontalRule", "/blocks/0"]],
        wire: {
          "pandoc-api-version": [1, 23, 1],
          blocks: [{ c: { smuggled: true }, t: "HorizontalRule" }],
          meta: {},
        },
      },
      {
        expected: [["Space", "/blocks/0/c/0"]],
        wire: {
          "pandoc-api-version": [1, 23, 1],
          blocks: [{ c: [{ c: "smuggled", t: "Space" }], t: "Para" }],
          meta: {},
        },
      },
    ];

    for (const { expected, wire } of malformed) {
      expect(Effect.runSyncExit(decodePandocJsonStrict(wire))._tag).toBe("Failure");
      const lossless = Effect.runSync(decodePandocJsonLossless(wire));
      expect(lossless.issues.map((issue) => [issue.constructor, issue.pointer])).toEqual(expected);
      expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(wire);
    }
  });

  it("rejects known constructors in the wrong context and reports their exact paths losslessly", () => {
    const wrongContext = [
      {
        expected: [["Str", "block", "/blocks/0"]],
        wire: {
          "pandoc-api-version": [1, 23, 1],
          blocks: [{ c: "not a block", t: "Str" }],
          meta: {},
        },
      },
      {
        expected: [["Para", "inline", "/blocks/0/c/0"]],
        wire: {
          "pandoc-api-version": [1, 23, 1],
          blocks: [{ c: [{ c: [], t: "Para" }], t: "Para" }],
          meta: {},
        },
      },
      {
        expected: [["Str", "meta", "/meta/invalid"]],
        wire: {
          "pandoc-api-version": [1, 23, 1],
          blocks: [],
          meta: { invalid: { c: "not metadata", t: "Str" } },
        },
      },
      {
        expected: [["TableCaption", "block", "/blocks/0"]],
        wire: {
          "pandoc-api-version": [1, 23, 1],
          blocks: [{ c: [null, []], t: "TableCaption" }],
          meta: {},
        },
      },
    ];

    for (const { expected, wire } of wrongContext) {
      expect(Effect.runSyncExit(decodePandocJsonStrict(wire))._tag).toBe("Failure");
      const lossless = Effect.runSync(decodePandocJsonLossless(wire));
      expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual(expected);
      expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(wire);
    }
  });

  it("rejects malformed known constructors in table captions and cells and reports their exact paths", () => {
    const malformed = [
      {
        expected: "/blocks/0/c/1/1/0/c/0",
        wire: {
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                ["", [], []],
                [null, [{ c: [{ c: 42, extension: "retained", t: "Str" }], t: "Plain" }]],
                [],
                [["", [], []], []],
                [],
                [["", [], []], []],
              ],
              t: "Table",
            },
          ],
          meta: {},
        },
      },
      {
        expected: "/blocks/0/c/4/0/3/0/1/0/4/0/c/0",
        wire: {
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                ["", [], []],
                [null, []],
                [],
                [["", [], []], []],
                [
                  [
                    ["", [], []],
                    0,
                    [],
                    [
                      [
                        ["", [], []],
                        [
                          [
                            ["", [], []],
                            { t: "AlignDefault" },
                            1,
                            1,
                            [{ c: [{ c: 42, extension: "retained", t: "Str" }], t: "Para" }],
                          ],
                        ],
                      ],
                    ],
                  ],
                ],
                [["", [], []], []],
              ],
              t: "Table",
            },
          ],
          meta: {},
        },
      },
    ];

    for (const { expected, wire } of malformed) {
      expect(Effect.runSyncExit(decodePandocJsonStrict(wire))._tag).toBe("Failure");
      const lossless = Effect.runSync(decodePandocJsonLossless(wire));
      expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
        ["Str", "inline", expected],
      ]);
      expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(wire);
    }
  });

  it("retains exact future constructors and extension fields inside table captions and cells", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const wire = {
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                ["", [], []],
                [
                  null,
                  [
                    {
                      c: [{ c: "Caption", extension: { exact: true }, t: "Str" }],
                      t: "Plain",
                    },
                    { c: { exact: "caption" }, extension: [1, 2, 3], t: "FutureCaptionBlock" },
                  ],
                ],
                [],
                [["", [], []], []],
                [
                  [
                    ["", [], []],
                    0,
                    [],
                    [
                      [
                        ["", [], []],
                        [
                          { c: { exact: "cell" }, extension: true, t: "FutureCell" },
                          [
                            ["", [], []],
                            { t: "AlignDefault" },
                            1,
                            1,
                            [{ c: { exact: "block" }, extension: "retained", t: "FutureCellBlock" }],
                          ],
                        ],
                      ],
                    ],
                  ],
                ],
                [["", [], []], []],
              ],
              t: "Table",
            },
          ],
          meta: {},
        };
        const semantic = yield* decodePandocJsonStrict(wire);
        const table = semantic.blocks[0];
        expect(table?._tag).toBe("table");
        if (table?._tag === "table") {
          expect(table.payload).toEqual(wire.blocks[0]?.c);
        }
        expect(yield* encodePandocJson(semantic)).toEqual(wire);

        const lossless = yield* decodePandocJsonLossless(wire);
        expect(lossless.issues).toEqual([]);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      })
    ));

  it("retains exact future constructors, including absent payloads and extension fields", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const wire = {
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            { extension: { exact: true }, t: "FutureNullary" },
            {
              c: [{ inlineExtension: [1, 2, 3], t: "FutureInline" }],
              t: "Para",
            },
          ],
          meta: {
            future: { metadataExtension: "retained", t: "MetaFuture" },
          },
        };
        const semantic = yield* decodePandocJsonStrict(wire);

        expect(semantic.blocks[0]).toMatchObject({
          _tag: "unknownBlock",
          constructorName: "FutureNullary",
          payload: undefined,
          wire: wire.blocks[0],
        });
        const paragraph = semantic.blocks[1];
        expect(paragraph?._tag).toBe("para");
        if (paragraph?._tag === "para") {
          expect(paragraph.children[0]).toMatchObject({
            _tag: "unknownInline",
            constructorName: "FutureInline",
            payload: undefined,
            wire: wire.blocks[1]?.c?.[0],
          });
        }
        expect(semantic.meta.future).toMatchObject({
          _tag: "unknownMeta",
          constructorName: "MetaFuture",
          payload: undefined,
          wire: wire.meta.future,
        });
        expect(yield* encodePandocJson(semantic)).toEqual(wire);
      })
    ));

  it("decodes committed Pandoc JSON fixtures without a pandoc executable", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const source = yield* fixture("green-core.pandoc.json");
        const document = yield* decodePandocJsonString(source);

        expect(document.apiVersion).toEqual([1, 23, 1]);
        expect(document.blocks.map((block) => block._tag)).toEqual([
          "header",
          "para",
          "blockquote",
          "codeblock",
          "bulletlist",
          "orderedlist",
          "horizontalrule",
        ]);
      })
    ));

  it("round-trips supported wire objects through the internal model", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const source = yield* fixture("green-core.pandoc.json");
        const document = yield* decodePandocJsonString(source);
        const encoded = yield* encodePandocJsonString(document);
        const roundTripped = yield* decodePandocJsonString(encoded);

        expect(roundTripped).toEqual(document);
      })
    ));

  it("preserves representative encoded wire shapes for attrs, targets, and API versions", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = PandocDocument.make({
          apiVersion: PandocApiVersion.make([1, 23, 1]),
          blocks: [
            Header.make({
              attr: PandocAttr.make({
                classes: ["primary"],
                id: "intro",
                keyValues: [["custom-style", "Heading1"]],
              }),
              children: [
                Link.make({
                  attr: PandocAttr.empty,
                  children: [Str.make({ text: "docs" })],
                  target: PandocTarget.make({ title: "Docs", url: "https://example.com" }),
                }),
              ],
              level: 2,
            }),
          ],
          meta: {},
        });

        const wire = yield* encodePandocJson(document);

        expect(wire).toEqual({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                2,
                ["intro", ["primary"], [["custom-style", "Heading1"]]],
                [
                  {
                    c: [["", [], []], [{ c: "docs", t: "Str" }], ["https://example.com", "Docs"]],
                    t: "Link",
                  },
                ],
              ],
              t: "Header",
            },
          ],
          meta: {},
        });

        expect(yield* decodePandocJson(wire)).toEqual(document);
      })
    ));

  it("round-trips schema-derived stable Pandoc JSON documents through the object codec", () =>
    fc.assert(
      fc.property(
        PandocDocumentArbitrary.map((document) =>
          PandocDocument.make({
            apiVersion: document.apiVersion,
            blocks: [],
            meta: {},
          })
        ),
        (document) => {
          const encoded = Effect.runSync(encodePandocJson(document));
          const decoded = Effect.runSync(decodePandocJson(encoded));

          expect(encoded).toEqual({
            "pandoc-api-version": document.apiVersion,
            blocks: [],
            meta: {},
          });
          expect(PandocDocumentEquivalence(decoded, document)).toBe(true);
        }
      ),
      fcRuns(50)
    ));

  it("preserves arbitrary future JSON through the public lossless profile", () =>
    fc.assert(
      fc.property(JsonArbitrary, (extension) => {
        const wire = {
          "pandoc-api-version": [1, 23, 1],
          blocks: [{ c: extension, t: "FutureBlock" }],
          meta: {
            future: { c: extension, t: "MetaFuture" },
          },
          extension,
        };

        const semantic = Effect.runSync(decodePandocJsonStrict(wire));
        expect(semantic.blocks[0]?._tag).toBe("unknownBlock");
        expect(semantic.meta.future?._tag).toBe("unknownMeta");

        const lossless = Effect.runSync(decodePandocJsonLossless(wire));
        expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(wire);

        const source = JSON.stringify(wire);
        const fromString = Effect.runSync(decodePandocJsonStringLossless(source));
        const output = Effect.runSync(encodePandocJsonStringLossless(fromString));
        expect(Effect.runSync(decodeUnknownJsonString(output))).toEqual(
          Effect.runSync(decodeUnknownJsonString(source))
        );
      }),
      fcRuns(50)
    ));

  it("keeps DOCX-style gap constructs decodable as explicit model nodes", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const source = yield* fixture("gap-docx-styles.pandoc.json");
        const document = yield* decodePandocJsonString(source);

        expect(document.blocks.map((block) => block._tag)).toEqual(["div", "table"]);
      })
    ));

  it("decodes table attributes and captions from Pandoc table payloads", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                ["table-id", ["wide"], [["custom-style", "EvidenceTable"]]],
                [{ c: [{ c: "Evidence", t: "Str" }], t: "Plain" }],
                [],
                [],
                [],
                [],
              ],
              t: "Table",
            },
          ],
          meta: {},
        });
        const table = document.blocks[0];

        expect(table?._tag).toBe("table");
        if (table?._tag !== "table") {
          return;
        }

        expect(table.attr).toEqual({
          classes: ["wide"],
          id: "table-id",
          keyValues: [["custom-style", "EvidenceTable"]],
        });
        expect(yield* S.encodeEffect(Table)(table)).toEqual({
          _tag: "table",
          payload: table.payload,
        });
        expect(table.caption[0]?._tag).toBe("str");
        if (table.caption[0]?._tag === "str") {
          expect(table.caption[0].text).toBe("Evidence");
        }
      })
    ));

  it("decodes Pandoc TableCaption constructor payloads", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                ["", [], []],
                {
                  c: [
                    null,
                    [
                      {
                        c: [{ c: "Constructor caption", t: "Str" }],
                        t: "Plain",
                      },
                    ],
                  ],
                  t: "TableCaption",
                },
                [],
                [],
                [],
                [],
              ],
              t: "Table",
            },
          ],
          meta: {},
        });
        const table = document.blocks[0];

        expect(table?._tag).toBe("table");
        if (table?._tag !== "table") {
          return;
        }
        expect(table.caption[0]?._tag).toBe("str");
        if (table.caption[0]?._tag === "str") {
          expect(table.caption[0].text).toBe("Constructor caption");
        }
      })
    ));

  it("keeps unknown math explicit while preserving ordered-list item semantics", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [{ c: [{ t: "FutureMath" }, "x"], t: "Math" }],
              t: "Para",
            },
            {
              c: [[1, { t: "DefaultStyle" }, { t: "DefaultDelim" }], []],
              t: "OrderedList",
            },
          ],
          meta: {},
        });
        const paragraph = document.blocks[0];
        const list = document.blocks[1];

        expect(paragraph?._tag).toBe("para");
        if (paragraph?._tag === "para") {
          expect(paragraph.children[0]?._tag).toBe("unknownInline");
        }
        expect(list?._tag).toBe("orderedlist");
        if (list?._tag === "orderedlist") {
          expect(list.style).toBe("DefaultStyle");
          expect(list.delimiter).toBe("DefaultDelim");
        }
      })
    ));

  it("rejects malformed known list constructors through the typed strict API", () => {
    const malformedBlocks = [
      {
        c: [[1, { t: "FutureStyle" }, { t: "DefaultDelim" }], []],
        t: "OrderedList",
      },
      {
        c: [[7, { t: "DefaultStyle" }, { t: "DefaultDelim" }], [["not-a-block-constructor"]]],
        t: "OrderedList",
      },
      {
        c: [["not-a-block-constructor"]],
        t: "BulletList",
      },
      {
        c: [[{ c: "not-inline-list", t: "Plain" }]],
        t: "BulletList",
      },
    ];

    for (const block of malformedBlocks) {
      const exit = Effect.runSyncExit(
        decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [block],
          meta: {},
        })
      );
      expect(exit._tag).toBe("Failure");
    }
  });

  it("retains exact malformed and future constructor wire in lossless mode", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const wire = {
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            { c: { future: [1, 2, 3] }, extension: true, t: "FutureBlock" },
            {
              c: [[{ c: "not-inline-list", t: "Plain" }]],
              t: "BulletList",
            },
          ],
          meta: {},
          topLevelExtension: { retained: true },
        };
        const document = yield* decodePandocJsonLossless(wire);

        expect(document.blocks).toEqual(wire.blocks);
        expect(document.meta).toEqual(wire.meta);
        expect(document.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
          ["Plain", "block", "/blocks/1/c/0/0"],
        ]);
        expect(yield* encodePandocJsonLossless(document)).toEqual(wire);
        expect(yield* decodeUnknownJsonString(yield* encodePandocJsonStringLossless(document))).toEqual(wire);
      })
    ));

  it("locates the nearest malformed nested constructor without replacing its ancestors", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const wire = {
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                { c: "before", t: "Str" },
                {
                  c: [["", [], []], [{ c: 42, extension: "retained", t: "Str" }], ["https://example.com", ""]],
                  t: "Link",
                },
                { c: "after", t: "Str" },
              ],
              t: "Para",
            },
          ],
          meta: {},
        };

        expect(Effect.runSyncExit(decodePandocJsonStrict(wire))._tag).toBe("Failure");
        const lossless = yield* decodePandocJsonLossless(wire);

        expect(lossless.blocks).toEqual(wire.blocks);
        expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
          ["Str", "inline", "/blocks/0/c/1/c/1/0"],
        ]);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      })
    ));

  it("round-trips recursive semantic metadata and preserves unknown metadata constructors", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const wire = {
          "pandoc-api-version": [1, 23, 1],
          blocks: [],
          meta: {
            nested: {
              c: {
                future: { c: { exact: true }, t: "MetaFuture" },
                values: { c: [{ c: "one", t: "MetaString" }], t: "MetaList" },
              },
              t: "MetaMap",
            },
            title: { c: "Document", t: "MetaString" },
          },
        };
        const document = yield* decodePandocJson(wire);

        expect(document.meta.title).toEqual(MetaString.make({ value: "Document" }));
        expect(document.meta.nested?._tag).toBe("metaMap");
        if (document.meta.nested?._tag === "metaMap") {
          expect(document.meta.nested.entries.values).toEqual(
            MetaList.make({ values: [MetaString.make({ value: "one" })] })
          );
          expect(document.meta.nested.entries.future?._tag).toBe("unknownMeta");
        }
        expect(yield* encodePandocJson(document)).toEqual(wire);
      })
    ));

  it("reports malformed metadata in lossless mode and preserves it exactly", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const wire = {
          "pandoc-api-version": [1, 23, 1],
          blocks: [],
          meta: { title: { c: 42, t: "MetaString" } },
        };

        expect(Effect.runSyncExit(decodePandocJson(wire))._tag).toBe("Failure");
        const lossless = yield* decodePandocJsonLossless(wire);
        expect(lossless.meta).toEqual(wire.meta);
        expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
          ["MetaString", "meta", "/meta/title"],
        ]);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      })
    ));

  it("rejects malformed supported top-level block payloads", () =>
    expect(
      Effect.runPromise(
        decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [{ c: "not-inline-list", t: "Plain" }],
          meta: {},
        })
      )
    ).rejects.toThrow());

  it("rejects malformed supported nested block payloads", () =>
    expect(
      Effect.runPromise(
        decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [{ c: "not-inline-list", t: "Plain" }],
              t: "BlockQuote",
            },
          ],
          meta: {},
        })
      )
    ).rejects.toThrow());

  it("rejects malformed supported inline payloads", () =>
    expect(
      Effect.runPromise(
        decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: ["not-inline-constructor", { c: 123, t: "Str" }, { c: "ok", t: "Str" }],
              t: "Para",
            },
          ],
          meta: {},
        })
      )
    ).rejects.toThrow());

  it("rejects malformed supported footnote block payloads", () =>
    expect(
      Effect.runPromise(
        decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [{ c: [{ c: "not-inline-list", t: "Plain" }], t: "Note" }],
              t: "Para",
            },
          ],
          meta: {},
        })
      )
    ).rejects.toThrow());

  it("rejects malformed known table payloads", () =>
    expect(
      Effect.runPromise(
        decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: ["not-an-attr", { c: "not-a-caption-shape", t: "FutureCaption" }, [], [], [], []],
              t: "Table",
            },
          ],
          meta: {},
        })
      )
    ).rejects.toThrow());

  it("exposes a schema-owned JSON string boundary", () => {
    const decode = S.decodeUnknownSync(PandocJsonFromString);

    expect(decode(`{"pandoc-api-version":[1,23,1],"meta":{},"blocks":[]}`).blocks).toEqual([]);
  });
});
