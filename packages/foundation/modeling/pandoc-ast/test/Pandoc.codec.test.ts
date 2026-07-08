import {
  decodePandocJson,
  decodePandocJsonString,
  encodePandocJson,
  encodePandocJsonString,
  PandocJsonFromString,
} from "@beep/pandoc-ast/Pandoc.codec";
import {
  Header,
  Link,
  PandocApiVersion,
  PandocAttr,
  PandocDocument,
  PandocTarget,
  Str,
} from "@beep/pandoc-ast/Pandoc.model";
import { fcRuns } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { PandocBlock } from "@beep/pandoc-ast/Pandoc.model";

const PandocDocumentArbitrary = S.toArbitrary(PandocDocument);
const PandocDocumentEquivalence = S.toEquivalence(PandocDocument);
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
const omitted = Symbol("omitted");

const expectUnknownBlock = (block: PandocBlock | undefined, constructor: string, payload: unknown = omitted): void => {
  expect(block?._tag).toBe("unknownBlock");
  if (block?._tag !== "unknownBlock") {
    throw new Error("expected unknown Pandoc block");
  }
  expect(block.constructor).toBe(constructor);
  if (payload !== omitted) {
    expect(block.payload).toBe(payload);
  }
};

describe("Pandoc.codec", () => {
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

  it("keeps unknown ordered-list numbering metadata explicit", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [[1, { t: "FutureStyle" }, { t: "DefaultDelim" }], []],
              t: "OrderedList",
            },
          ],
          meta: {},
        });
        const block = document.blocks[0];

        expect(block?._tag).toBe("unknownBlock");
        if (block?._tag === "unknownBlock") {
          expect(block.constructor).toBe("OrderedList");
        }
      })
    ));

  it("keeps ordered-list structure when nested item blocks are malformed", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [[7, { t: "DefaultStyle" }, { t: "DefaultDelim" }], [["not-a-block-constructor"]]],
              t: "OrderedList",
            },
          ],
          meta: {},
        });
        const list = document.blocks[0];

        expect(list?._tag).toBe("orderedlist");
        if (list?._tag !== "orderedlist") {
          return;
        }

        expect(list.start).toBe(7);
        expect(list.style).toBe("DefaultStyle");
        expect(list.delimiter).toBe("DefaultDelim");
        expectUnknownBlock(list.items[0]?.[0], "MalformedListItem");
      })
    ));

  it("keeps bullet-list structure when nested item blocks are malformed", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [["not-a-block-constructor"]],
              t: "BulletList",
            },
          ],
          meta: {},
        });
        const list = document.blocks[0];

        expect(list?._tag).toBe("bulletlist");
        if (list?._tag !== "bulletlist") {
          return;
        }

        expectUnknownBlock(list.items[0]?.[0], "MalformedListItem");
      })
    ));

  it("keeps malformed known list item payloads scoped to the item boundary", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [[{ c: "not-inline-list", t: "Plain" }]],
              t: "BulletList",
            },
          ],
          meta: {},
        });
        const list = document.blocks[0];

        expect(list?._tag).toBe("bulletlist");
        if (list?._tag !== "bulletlist") {
          return;
        }

        expectUnknownBlock(list.items[0]?.[0], "MalformedListItem");
      })
    ));

  it("keeps surrounding list items when one item payload is malformed", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                [{ c: [{ c: "before", t: "Str" }], t: "Plain" }],
                "not-a-list-item",
                [{ c: "not-inline-list", t: "Plain" }],
              ],
              t: "BulletList",
            },
          ],
          meta: {},
        });
        const list = document.blocks[0];

        expect(list?._tag).toBe("bulletlist");
        if (list?._tag !== "bulletlist") {
          return;
        }

        expect(list.items).toHaveLength(3);
        expect(list.items[0]?.[0]?._tag).toBe("plain");
        expectUnknownBlock(list.items[1]?.[0], "MalformedListItem", "not-a-list-item");
        expectUnknownBlock(list.items[2]?.[0], "MalformedListItem");
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

  it("keeps malformed table payloads as explicit unknown blocks", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: ["not-an-attr", { c: "not-a-caption-shape", t: "FutureCaption" }, [], [], [], []],
              t: "Table",
            },
          ],
          meta: {},
        });
        const table = document.blocks[0];

        expectUnknownBlock(table, "Table");
      })
    ));

  it("exposes a schema-owned JSON string boundary", () => {
    const decode = S.decodeUnknownSync(PandocJsonFromString);

    expect(decode(`{"pandoc-api-version":[1,23,1],"meta":{},"blocks":[]}`).blocks).toEqual([]);
  });
});
