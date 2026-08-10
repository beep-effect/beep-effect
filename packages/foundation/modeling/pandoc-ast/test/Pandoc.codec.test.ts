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
  PandocLosslessDocument,
} from "@beep/pandoc-ast/Pandoc.codec";
import {
  Header,
  Link,
  MetaList,
  MetaString,
  PandocApiVersion,
  PandocAttr,
  PandocDocument,
  PandocListNumberDelimiter,
  PandocListNumberStyle,
  PandocMathType,
  PandocTablePayload,
  PandocTarget,
  Para,
  Str,
  Table,
  UnknownBlock,
  UnknownInline,
  UnknownMeta,
} from "@beep/pandoc-ast/Pandoc.model";
import { fcRuns } from "@beep/test-utils";
import { R } from "@beep/utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import { FastCheck as fc } from "effect/testing";

const expectSchemaMakeToFail = (run: () => unknown, messagePart: string): void => {
  const formatIssue = SchemaIssue.makeFormatterDefault();
  try {
    run();
  } catch (error) {
    if (P.hasProperty(error, "cause") && SchemaIssue.isIssue(error.cause)) {
      expect(formatIssue(error.cause)).toContain(messagePart);
      return;
    }
    throw error;
  }
  expect.unreachable("expected schema construction to throw");
};

const PandocDocumentArbitrary = S.toArbitrary(PandocDocument)(fc);
const PandocDocumentEquivalence = S.toEquivalence(PandocDocument);
const PandocTablePayloadArbitrary = S.toArbitrary(PandocTablePayload)(fc);
const SemanticClosureDocumentArbitrary = fc
  .tuple(
    PandocDocumentArbitrary,
    S.toArbitrary(Table)(fc),
    S.toArbitrary(UnknownBlock)(fc),
    S.toArbitrary(UnknownInline)(fc),
    S.toArbitrary(UnknownMeta)(fc)
  )
  .map(([document, table, unknownBlock, unknownInline, unknownMeta]) =>
    PandocDocument.make({
      apiVersion: document.apiVersion,
      blocks: [...document.blocks, table, unknownBlock, Para.make({ children: [unknownInline] })],
      meta: { ...document.meta, semanticClosure: unknownMeta },
    })
  );
const JsonArbitrary = S.toArbitrary(S.Json)(fc);
const decodeUnknownJsonString = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const pinnedPandocConstructorNames = [
  "Pandoc",
  "Meta",
  "MetaMap",
  "MetaList",
  "MetaBool",
  "MetaString",
  "MetaInlines",
  "MetaBlocks",
  "DefaultStyle",
  "Example",
  "Decimal",
  "LowerRoman",
  "UpperRoman",
  "LowerAlpha",
  "UpperAlpha",
  "DefaultDelim",
  "Period",
  "OneParen",
  "TwoParens",
  "Format",
  "RowHeadColumns",
  "AlignLeft",
  "AlignRight",
  "AlignCenter",
  "AlignDefault",
  "ColWidth",
  "ColWidthDefault",
  "Row",
  "TableHead",
  "TableBody",
  "TableFoot",
  "Caption",
  "Cell",
  "RowSpan",
  "ColSpan",
  "Plain",
  "Para",
  "LineBlock",
  "CodeBlock",
  "RawBlock",
  "BlockQuote",
  "OrderedList",
  "BulletList",
  "DefinitionList",
  "Header",
  "HorizontalRule",
  "Table",
  "Figure",
  "Div",
  "SingleQuote",
  "DoubleQuote",
  "DisplayMath",
  "InlineMath",
  "Str",
  "Emph",
  "Underline",
  "Strong",
  "Strikeout",
  "Superscript",
  "Subscript",
  "SmallCaps",
  "Quoted",
  "Cite",
  "Code",
  "Space",
  "SoftBreak",
  "LineBreak",
  "Math",
  "RawInline",
  "Link",
  "Image",
  "Note",
  "Span",
  "Citation",
  "AuthorInText",
  "SuppressAuthor",
  "NormalCitation",
  "TableCaption",
];
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

const tableWire = ({
  caption = [null, []],
  cellAlignment = { t: "AlignDefault" },
  columnAlignment = { t: "AlignDefault" },
  columnWidth = { t: "ColWidthDefault" },
  headRows = [],
}: {
  readonly caption?: unknown;
  readonly cellAlignment?: unknown;
  readonly columnAlignment?: unknown;
  readonly columnWidth?: unknown;
  readonly headRows?: ReadonlyArray<unknown>;
} = {}) => ({
  "pandoc-api-version": [1, 23, 1],
  blocks: [
    {
      c: [
        ["", [], []],
        caption,
        [[columnAlignment, columnWidth]],
        [["", [], []], headRows],
        [
          [
            ["", [], []],
            0,
            [],
            [[["", [], []], [[["", [], []], cellAlignment, 1, 1, [{ c: [{ c: "ok", t: "Str" }], t: "Para" }]]]]],
          ],
        ],
        [["", [], []], []],
      ],
      t: "Table",
    },
  ],
  meta: {},
});

describe("Pandoc.codec", () => {
  it("derives semantic documents without arbitrary warnings", () => {});

  it("preserves public model schema identities after centralizing constructor registries", () => {
    const publicSchemas = [
      [PandocMathType, "PandocMathType"],
      [PandocListNumberStyle, "PandocListNumberStyle"],
      [PandocListNumberDelimiter, "PandocListNumberDelimiter"],
    ] as const;

    for (const [schema, name] of publicSchemas) {
      expect(S.toJsonSchemaDocument(schema).schema).toEqual({
        $ref: `#/$defs/@beep~1pandoc-ast~1Pandoc.model~1${name}`,
      });
    }
  });

  it("keeps the established decode names as strict API aliases", () => {
    expect(decodePandocJson).toBe(decodePandocJsonStrict);
    expect(decodePandocJsonString).toBe(decodePandocJsonStringStrict);
  });

  it("issues lossless views from one immutable canonical wire", () => {
    const input = {
      "pandoc-api-version": [1, 23, 1],
      blocks: [{ c: [], t: "Para" }],
      extension: { retained: true },
      meta: {},
    };
    const document = Effect.runSync(decodePandocJsonLossless(input));

    expect(S.is(PandocLosslessDocument)(document)).toBe(true);
    expect(S.is(PandocLosslessDocument)({ ...document })).toBe(false);
    expect(document.apiVersion).toEqual(document.wire["pandoc-api-version"]);
    expect(document.blocks).toEqual(document.wire.blocks);
    expect(document.meta).toEqual(document.wire.meta);

    const exposedWire = document.wire;
    (exposedWire.blocks as Array<S.Json>).push({ c: "forged", t: "Para" });
    expect(document.blocks).toEqual([{ c: [], t: "Para" }]);
    expect(Effect.runSync(encodePandocJsonLossless(document))).toEqual(input);
  });

  it("round-trips blocked object names as safe own metadata keys", () => {
    const meta = R.fromEntries([
      ["__proto__", { c: "proto", t: "MetaString" }],
      ["constructor", { c: "constructor", t: "MetaString" }],
      ["prototype", { c: "prototype", t: "MetaString" }],
    ] as const);
    const wire = {
      "pandoc-api-version": [1, 23, 1],
      blocks: [],
      meta,
    };

    const semantic = Effect.runSync(decodePandocJsonStrict(wire));
    const encoded = Effect.runSync(encodePandocJson(semantic));
    expect(encoded.meta).toEqual(meta);
    expect(Object.hasOwn(encoded.meta, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(encoded.meta)).toBe(Object.prototype);

    const lossless = Effect.runSync(decodePandocJsonLossless(wire));
    expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(wire);
  });

  it("rejects shallow-only semantic table payloads while preserving their lossless wire", () => {
    const wire = {
      "pandoc-api-version": [1, 23, 1],
      blocks: [{ c: [["", [], []], null, [], null, [], null], t: "Table" }],
      meta: {},
    };

    expectSchemaMakeToFail(
      () =>
        Table.make({
          payload: [["", [], []], null, [], null, [], null],
        }),
      "Expected a Pandoc table payload whose nested constructors are valid in their semantic contexts."
    );
    expect(() => Effect.runSync(decodePandocJsonStrict(wire))).toThrow();

    const lossless = Effect.runSync(decodePandocJsonLossless(wire));
    expect(lossless.issues).not.toHaveLength(0);
    expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(wire);
  });

  it("rejects malformed caption, head, and foot slots with exact lossless diagnostics", () => {
    const attr = ["", [], []];
    const malformed = [
      {
        constructor: "Table",
        payload: [attr, [{ c: [], t: "Plain" }], [], [attr, []], [], [attr, []]],
        pointer: "/blocks/0/c/1",
      },
      {
        constructor: "TableCaption",
        payload: [attr, { c: [null, []], t: "TableCaption" }, [], [attr, []], [], [attr, []]],
        pointer: "/blocks/0/c/1",
      },
      {
        constructor: "Table",
        payload: [attr, [null, []], [], [], [], [attr, []]],
        pointer: "/blocks/0/c/3",
      },
      {
        constructor: "Table",
        payload: [attr, [null, []], [], [attr, []], [], []],
        pointer: "/blocks/0/c/5",
      },
    ];

    for (const { constructor, payload, pointer } of malformed) {
      const wire = {
        "pandoc-api-version": [1, 23, 1],
        blocks: [{ c: payload, t: "Table" }],
        meta: {},
      };

      expect(Effect.runSyncExit(decodePandocJsonStrict(wire))._tag).toBe("Failure");
      const lossless = Effect.runSync(decodePandocJsonLossless(wire));
      expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
        [constructor, "block", pointer],
      ]);
      expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(wire);
    }
  });

  it("uses the semantic table schema at the strict decoder boundary", () =>
    fc.assert(
      fc.property(PandocTablePayloadArbitrary, (payload) => {
        const document = PandocDocument.make({ blocks: [Table.make({ payload })], meta: {} });
        const encoded = Effect.runSync(encodePandocJson(document));
        const decoded = Effect.runSync(decodePandocJsonStrict(encoded));

        expect(PandocDocumentEquivalence(decoded, document)).toBe(true);
      }),
      fcRuns(50)
    ));

  it("retains valid future constructors in every semantic table component slot", () => {
    const document = PandocDocument.make({
      blocks: [
        Table.make({
          payload: [
            ["", [], []],
            { t: "FutureCaption" },
            [{ t: "FutureColumnSpec" }],
            { t: "FutureHead" },
            [{ t: "FutureBody" }],
            { t: "FutureFoot" },
          ],
        }),
      ],
      meta: {},
    });
    const encoded = Effect.runSync(encodePandocJson(document));

    expect(Effect.runSync(decodePandocJsonStrict(encoded))).toEqual(document);
  });

  it("rejects known names from semantic unknown constructors and retains valid future constructors", () => {
    expect(pinnedPandocConstructorNames).toHaveLength(78);
    for (const name of pinnedPandocConstructorNames) {
      expectSchemaMakeToFail(
        () => UnknownBlock.make({ wire: { t: name } }),
        "Expected a future Pandoc constructor name that is not already known."
      );
    }
    expectSchemaMakeToFail(
      () => UnknownInline.make({ wire: { c: 42, t: "Row" } }),
      "Expected a future Pandoc constructor name that is not already known."
    );
    expectSchemaMakeToFail(
      () => UnknownMeta.make({ wire: { c: 42, t: "Citation" } }),
      "Expected a future Pandoc constructor name that is not already known."
    );

    const future = UnknownBlock.make({
      wire: { c: { exact: true }, extension: "retained", t: "FutureBlock" },
    });
    const document = PandocDocument.make({ blocks: [future], meta: {} });
    const encoded = Effect.runSync(encodePandocJson(document));

    expect(encoded.blocks).toEqual([{ c: { exact: true }, extension: "retained", t: "FutureBlock" }]);
    expect(Effect.runSync(decodePandocJsonStrict(encoded))).toEqual(document);
  });

  it("rejects pinned current constructors outside the semantic subset and reports them losslessly", () => {
    const unsupported = [
      {
        expected: ["Cite", "inline", "/blocks/0/c/0"],
        wire: {
          "pandoc-api-version": [1, 23, 1],
          blocks: [{ c: [{ c: 42, t: "Cite" }], t: "Para" }],
          meta: {},
        },
      },
      {
        expected: ["Figure", "block", "/blocks/0"],
        wire: {
          "pandoc-api-version": [1, 23, 1],
          blocks: [{ c: {}, t: "Figure" }],
          meta: {},
        },
      },
    ] as const;

    for (const { expected, wire } of unsupported) {
      expect(Effect.runSyncExit(decodePandocJsonStrict(wire))._tag).toBe("Failure");
      const lossless = Effect.runSync(decodePandocJsonLossless(wire));
      expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([expected]);
      expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(wire);
    }

    const futureWire = {
      "pandoc-api-version": [1, 23, 1],
      blocks: [
        { c: {}, t: "FutureFigure" },
        { c: [{ c: 42, t: "FutureCite" }], t: "Para" },
      ],
      meta: {},
    };
    const semantic = Effect.runSync(decodePandocJsonStrict(futureWire));
    expect(semantic.blocks[0]?._tag).toBe("unknownBlock");
    const paragraph = semantic.blocks[1];
    expect(paragraph?._tag).toBe("para");
    if (paragraph?._tag === "para") {
      expect(paragraph.children[0]?._tag).toBe("unknownInline");
    }
    const lossless = Effect.runSync(decodePandocJsonLossless(futureWire));
    expect(lossless.issues).toEqual([]);
    expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(futureWire);
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

  it("rejects known constructors in table structural slots and reports their exact paths", () => {
    const wrongContext = [
      {
        expected: ["Para", "/blocks/0/c/4/0/3/0/1/0/1"],
        wire: tableWire({ cellAlignment: { c: [], t: "Para" } }),
      },
      {
        expected: ["Str", "/blocks/0/c/4/0/3/0/1/0/1"],
        wire: tableWire({ cellAlignment: { c: 42, t: "Str" } }),
      },
      {
        expected: ["Para", "/blocks/0/c/2/0/0"],
        wire: tableWire({ columnAlignment: { c: [], t: "Para" } }),
      },
      {
        expected: ["Str", "/blocks/0/c/2/0/1"],
        wire: tableWire({ columnWidth: { c: 42, t: "Str" } }),
      },
    ] as const;

    for (const { expected, wire } of wrongContext) {
      expect(Effect.runSyncExit(decodePandocJsonStrict(wire))._tag).toBe("Failure");
      const lossless = Effect.runSync(decodePandocJsonLossless(wire));
      expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
        [expected[0], "block", expected[1]],
      ]);
      expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(wire);
    }
  });

  it("rejects pinned structural and newtype constructors nested in opaque table slots", () => {
    const malformed = [
      {
        expected: ["Caption", "/blocks/0/c/1"],
        wire: tableWire({ caption: { c: 42, t: "Caption" } }),
      },
      {
        expected: ["Row", "/blocks/0/c/3/1/0"],
        wire: tableWire({ headRows: [{ c: 42, t: "Row" }] }),
      },
      {
        expected: ["RowSpan", "/blocks/0/c/3/1/0/1/0"],
        wire: tableWire({
          headRows: [[["", [], []], [{ c: 42, t: "RowSpan" }]]],
        }),
      },
    ] as const;

    for (const { expected, wire } of malformed) {
      expect(Effect.runSyncExit(decodePandocJsonStrict(wire))._tag).toBe("Failure");
      const lossless = Effect.runSync(decodePandocJsonLossless(wire));
      expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
        [expected[0], "block", expected[1]],
      ]);
      expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(wire);
    }

    const futureWire = tableWire({
      caption: { c: { exact: "caption" }, extension: true, t: "FutureCaption" },
      headRows: [
        { c: { exact: "row" }, extension: [1, 2], t: "FutureRow" },
        [["", [], []], [{ c: { exact: "row-span" }, extension: { retained: true }, t: "FutureRowSpan" }]],
      ],
    });
    const semantic = Effect.runSync(decodePandocJsonStrict(futureWire));
    expect(Effect.runSync(encodePandocJson(semantic))).toEqual(futureWire);
    const lossless = Effect.runSync(decodePandocJsonLossless(futureWire));
    expect(lossless.issues).toEqual([]);
    expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(futureWire);
  });

  it("rejects malformed standard table constructors and retains their exact wire losslessly", () => {
    const malformed = [
      {
        expected: ["AlignRight", "/blocks/0/c/4/0/3/0/1/0/1"],
        wire: tableWire({ cellAlignment: { c: [], t: "AlignRight" } }),
      },
      {
        expected: ["ColWidth", "/blocks/0/c/2/0/1"],
        wire: tableWire({ columnWidth: { c: "wide", t: "ColWidth" } }),
      },
    ] as const;

    for (const { expected, wire } of malformed) {
      expect(Effect.runSyncExit(decodePandocJsonStrict(wire))._tag).toBe("Failure");
      const lossless = Effect.runSync(decodePandocJsonLossless(wire));
      expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
        [expected[0], "block", expected[1]],
      ]);
      expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(wire);
    }
  });

  it("rejects non-constructor values in required table constructor slots", () => {
    const malformed = [
      {
        expected: "/blocks/0/c/4/0/3/0/1/0/1",
        wire: tableWire({ cellAlignment: 42 }),
      },
      {
        expected: "/blocks/0/c/2/0/0",
        wire: tableWire({ columnAlignment: null }),
      },
      {
        expected: "/blocks/0/c/2/0/1",
        wire: tableWire({ columnWidth: "wide" }),
      },
    ];

    for (const { expected, wire } of malformed) {
      expect(Effect.runSyncExit(decodePandocJsonStrict(wire))._tag).toBe("Failure");
      const lossless = Effect.runSync(decodePandocJsonLossless(wire));
      expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
        ["Table", "block", expected],
      ]);
      expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(wire);
    }
  });

  it("retains valid and future table structural constructors exactly", () => {
    const accepted = [
      tableWire(),
      tableWire({
        cellAlignment: { t: "AlignRight" },
        columnAlignment: { t: "AlignCenter" },
        columnWidth: { c: 0.5, t: "ColWidth" },
      }),
      tableWire({
        cellAlignment: { c: { exact: "cell" }, extension: true, t: "FutureCellAlignment" },
        columnAlignment: { c: { exact: "column" }, extension: [1, 2], t: "FutureColumnAlignment" },
        columnWidth: { c: { exact: "width" }, extension: { retained: true }, t: "FutureColumnWidth" },
      }),
    ];

    for (const wire of accepted) {
      const semantic = Effect.runSync(decodePandocJsonStrict(wire));
      expect(Effect.runSync(encodePandocJson(semantic))).toEqual(wire);
      const lossless = Effect.runSync(decodePandocJsonLossless(wire));
      expect(lossless.issues).toEqual([]);
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

  it("keeps schema-derived semantic documents closed under encode and strict decode", () =>
    fc.assert(
      fc.property(SemanticClosureDocumentArbitrary, (document) => {
        const encoded = Effect.runSync(encodePandocJson(document));
        const decoded = Effect.runSync(decodePandocJsonStrict(encoded));

        expect(PandocDocumentEquivalence(decoded, document)).toBe(true);
      }),
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

  it("decodes authentic Pandoc 1.23.1 table attributes, captions, heads, and feet", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                ["table-id", ["wide"], [["custom-style", "EvidenceTable"]]],
                [[{ c: "Evidence", t: "Str" }], [{ c: [{ c: "Long caption", t: "Str" }], t: "Plain" }]],
                [],
                [["", [], []], []],
                [],
                [["", [], []], []],
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

  it("rejects unsupported Math subtypes strictly, retains them losslessly, and preserves ordered-list semantics", () => {
    const unsupportedMath = {
      "pandoc-api-version": [1, 23, 1],
      blocks: [{ c: [{ c: [{ t: "FutureMath" }, "x"], t: "Math" }], t: "Para" }],
      meta: {},
    };

    expect(() => Effect.runSync(decodePandocJsonStrict(unsupportedMath))).toThrow();
    const lossless = Effect.runSync(decodePandocJsonLossless(unsupportedMath));
    expect(lossless.issues).toEqual([
      expect.objectContaining({
        constructor: "FutureMath",
        path: ["blocks", 0, "c", 0, "c", 0],
      }),
    ]);
    expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(unsupportedMath);

    const document = Effect.runSync(
      decodePandocJsonStrict({
        "pandoc-api-version": [1, 23, 1],
        blocks: [
          {
            c: [[1, { t: "DefaultStyle" }, { t: "DefaultDelim" }], []],
            t: "OrderedList",
          },
        ],
        meta: {},
      })
    );
    const list = document.blocks[0];
    expect(list?._tag).toBe("orderedlist");
    if (list?._tag === "orderedlist") {
      expect(list.style).toBe("DefaultStyle");
      expect(list.delimiter).toBe("DefaultDelim");
    }
  });

  it("rejects known or malformed nullary constructors in a Math type slot", () => {
    const malformed = [
      { expected: "AlignLeft", mathType: { t: "AlignLeft" } },
      { expected: "InlineMath", mathType: { c: "smuggled", t: "InlineMath" } },
    ];

    for (const { expected, mathType } of malformed) {
      const wire = {
        "pandoc-api-version": [1, 23, 1],
        blocks: [{ c: [{ c: [mathType, "x"], t: "Math" }], t: "Para" }],
        meta: {},
      };

      expect(Effect.runSyncExit(decodePandocJsonStrict(wire))._tag).toBe("Failure");
      const lossless = Effect.runSync(decodePandocJsonLossless(wire));
      expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
        [expected, "inline", "/blocks/0/c/0/c/0"],
      ]);
      expect(Effect.runSync(encodePandocJsonLossless(lossless))).toEqual(wire);
    }
  });

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
