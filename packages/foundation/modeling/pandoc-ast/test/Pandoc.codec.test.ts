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
  PandocMetaValue,
  PandocTablePayloadArbitrary,
  PandocTarget,
  Para,
  Str,
  Table,
  UnknownBlock,
  UnknownInline,
  UnknownMeta,
} from "@beep/pandoc-ast/Pandoc.model";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { R } from "@beep/utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, vi } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as SchemaIssue from "effect/SchemaIssue";

const decodePandocJsonFromString = S.decodeEffect(PandocJsonFromString);
const encodeTable = S.encodeEffect(Table);
const isPandocLosslessDocument = S.is(PandocLosslessDocument);
const isPandocMetaValue = S.is(PandocMetaValue);
const isTable = S.is(Table);
const isPandocDocument = S.is(PandocDocument);

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

const PandocDocumentArbitrary = Arbitrary.schema(PandocDocument);
const PandocDocumentEquivalence = S.toEquivalence(PandocDocument);

const SemanticClosureDocumentArbitrary = Arbitrary.all([
  PandocDocumentArbitrary,
  Arbitrary.schema(Table),
  Arbitrary.schema(UnknownBlock),
  Arbitrary.schema(UnknownInline),
  Arbitrary.schema(UnknownMeta),
]).pipe(
  Arbitrary.map(([document, table, unknownBlock, unknownInline, unknownMeta]) =>
    PandocDocument.make({
      apiVersion: document.apiVersion,
      blocks: [...document.blocks, table, unknownBlock, Para.make({ children: [unknownInline] })],
      meta: { ...document.meta, semanticClosure: unknownMeta },
    })
  )
);
const JsonArbitrary = Arbitrary.schema(S.Json);
const decodeUnknownJsonString = UnknownFromJsonString.decodeUnknownEffect;
const emptyAttr = ["", [], []];
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
const fixture = Effect.fn("PandocCodecTest.fixture")((name: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.readFileString(new URL(`./fixtures/${name}`, import.meta.url).pathname);
  })
);

const tableWire = ({
  caption = [null, []],
  cellAlignment = { t: "AlignDefault" },
  cellBlocks = [{ c: [{ c: "ok", t: "Str" }], t: "Para" }],
  columnAlignment = { t: "AlignDefault" },
  columnWidth = { t: "ColWidthDefault" },
  headRows = [],
}: {
  readonly caption?: unknown;
  readonly cellAlignment?: unknown;
  readonly cellBlocks?: ReadonlyArray<unknown>;
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
        [[["", [], []], 0, [], [[["", [], []], [[["", [], []], cellAlignment, 1, 1, cellBlocks]]]]]],
        [["", [], []], []],
      ],
      t: "Table",
    },
  ],
  meta: {},
});

const captionPlainTextFromWire = Effect.fnUntraced(function* (caption: unknown) {
  const block = (yield* decodePandocJson(tableWire({ caption }))).blocks[0];

  expect(block?._tag).toBe("table");
  return block?._tag === "table" ? block.captionPlainText : "";
});

describe("Pandoc.codec", { concurrent: false }, () => {
  it.effect("derives semantic documents without arbitrary warnings", () =>
    Effect.gen(function* () {
      // Observe real derivation and sampling; restore the passthrough observer
      // even when compilation, generation or an assertion fails.
      const warnings = yield* Effect.acquireRelease(
        Effect.sync(() => vi.spyOn(console, "warn")),
        (spy) => Effect.sync(() => spy.mockRestore())
      );
      const { runs, seed } = fcRuns(50);
      const arbitrary = yield* Effect.sync(() => Arbitrary.schema(PandocDocument));
      const documents = yield* Arbitrary.sampleEffect(arbitrary, { count: runs, seed });
      expect(documents).toHaveLength(runs);
      assertTrue(A.every(documents, isPandocDocument));
      expect(warnings).not.toHaveBeenCalled();
    })
  );

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

  it.effect(
    "issues lossless views from one immutable canonical wire",
    Effect.fnUntraced(function* () {
      const input = {
        "pandoc-api-version": [1, 23, 1],
        blocks: [{ c: [], t: "Para" }],
        extension: { retained: true },
        meta: {},
      };
      const document = yield* decodePandocJsonLossless(input);

      expect(isPandocLosslessDocument(document)).toBe(true);
      expect(isPandocLosslessDocument({ ...document })).toBe(false);
      expect(document.apiVersion).toEqual(document.wire["pandoc-api-version"]);
      expect(document.blocks).toEqual(document.wire.blocks);
      expect(document.meta).toEqual(document.wire.meta);

      const exposedWire = document.wire;
      (exposedWire.blocks as Array<S.Json>).push({ c: "forged", t: "Para" });
      expect(document.blocks).toEqual([{ c: [], t: "Para" }]);
      expect(yield* encodePandocJsonLossless(document)).toEqual(input);
    })
  );

  it.effect(
    "round-trips blocked object names as safe own metadata keys",
    Effect.fnUntraced(function* () {
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

      const semantic = yield* decodePandocJsonStrict(wire);
      const encoded = yield* encodePandocJson(semantic);
      expect(encoded.meta).toEqual(meta);
      expect(Object.hasOwn(encoded.meta, "__proto__")).toBe(true);
      expect(Object.getPrototypeOf(encoded.meta)).toBe(Object.prototype);

      const lossless = yield* decodePandocJsonLossless(wire);
      expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
    })
  );

  it.effect(
    "rejects shallow-only semantic table payloads while preserving their lossless wire",
    Effect.fnUntraced(function* () {
      const wire = {
        "pandoc-api-version": [1, 23, 1],
        blocks: [{ c: [["", [], []], null, [], null, [], null], t: "Table" }],
        meta: {},
      };

      expect(
        isTable({
          _tag: "table",
          payload: [["", [], []], null, [], null, [], null],
        })
      ).toBe(false);
      expect((yield* Effect.exit(decodePandocJsonStrict(wire)))._tag).toBe("Failure");

      const lossless = yield* decodePandocJsonLossless(wire);
      expect(lossless.issues).not.toHaveLength(0);
      expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
    })
  );

  it.effect(
    "rejects malformed caption, head, and foot slots with exact lossless diagnostics",
    Effect.fnUntraced(function* () {
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

        expect((yield* Effect.exit(decodePandocJsonStrict(wire)))._tag).toBe("Failure");
        const lossless = yield* decodePandocJsonLossless(wire);
        expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
          [constructor, "block", pointer],
        ]);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      }
    })
  );

  it.effect.prop(
    "uses the semantic table schema at the strict decoder boundary",
    { payload: PandocTablePayloadArbitrary },
    Effect.fnUntraced(function* ({ payload }) {
      const document = PandocDocument.make({ blocks: [Table.make({ payload })], meta: {} });
      const encoded = yield* encodePandocJson(document);
      const decoded = yield* decodePandocJsonStrict(encoded);
      expect(PandocDocumentEquivalence(decoded, document)).toBe(true);
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect(
    "round-trips a recursively nested table inside table-cell block content",
    Effect.fnUntraced(function* () {
      const nestedTable = tableWire().blocks[0];
      const wire = tableWire({ cellBlocks: [nestedTable] });
      const document = yield* decodePandocJsonStrict(wire);

      expect(document.blocks[0]?._tag).toBe("table");
      expect(yield* encodePandocJson(document)).toEqual(wire);
    })
  );

  it.effect(
    "retains valid future constructors in every semantic table component slot",
    Effect.fnUntraced(function* () {
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
      const encoded = yield* encodePandocJson(document);

      expect(yield* decodePandocJsonStrict(encoded)).toEqual(document);
    })
  );

  it.effect(
    "rejects known names from semantic unknown constructors and retains valid future constructors",
    Effect.fnUntraced(function* () {
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
      const encoded = yield* encodePandocJson(document);

      expect(encoded.blocks).toEqual([{ c: { exact: true }, extension: "retained", t: "FutureBlock" }]);
      expect(yield* decodePandocJsonStrict(encoded)).toEqual(document);
    })
  );

  it.effect(
    "rejects malformed Cite and Figure payloads and reports them losslessly",
    Effect.fnUntraced(function* () {
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
        expect((yield* Effect.exit(decodePandocJsonStrict(wire)))._tag).toBe("Failure");
        const lossless = yield* decodePandocJsonLossless(wire);
        expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([expected]);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      }

      const futureWire = {
        "pandoc-api-version": [1, 23, 1],
        blocks: [
          { c: {}, t: "FutureFigure" },
          { c: [{ c: 42, t: "FutureCite" }], t: "Para" },
        ],
        meta: {},
      };
      const semantic = yield* decodePandocJsonStrict(futureWire);
      expect(semantic.blocks[0]?._tag).toBe("unknownBlock");
      const paragraph = semantic.blocks[1];
      expect(paragraph?._tag).toBe("para");
      if (paragraph?._tag === "para") {
        expect(paragraph.children[0]?._tag).toBe("unknownInline");
      }
      const lossless = yield* decodePandocJsonLossless(futureWire);
      expect(lossless.issues).toEqual([]);
      expect(yield* encodePandocJsonLossless(lossless)).toEqual(futureWire);
    })
  );

  it.effect(
    "rejects payloads on known nullary constructors and reports them losslessly",
    Effect.fnUntraced(function* () {
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
        {
          expected: [["Decimal", "/blocks/0/c/0/1"]],
          wire: {
            "pandoc-api-version": [1, 23, 1],
            blocks: [
              {
                c: [[1, { c: 1, t: "Decimal" }, { t: "Period" }], []],
                t: "OrderedList",
              },
            ],
            meta: {},
          },
        },
        {
          expected: [["Period", "/blocks/0/c/0/2"]],
          wire: {
            "pandoc-api-version": [1, 23, 1],
            blocks: [
              {
                c: [[1, { t: "Decimal" }, { c: 1, t: "Period" }], []],
                t: "OrderedList",
              },
            ],
            meta: {},
          },
        },
      ];

      for (const { expected, wire } of malformed) {
        expect((yield* Effect.exit(decodePandocJsonStrict(wire)))._tag).toBe("Failure");
        const lossless = yield* decodePandocJsonLossless(wire);
        expect(lossless.issues.map((issue) => [issue.constructor, issue.pointer])).toEqual(expected);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      }
    })
  );

  it.effect(
    "rejects known constructors in the wrong context and reports their exact paths losslessly",
    Effect.fnUntraced(function* () {
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
        expect((yield* Effect.exit(decodePandocJsonStrict(wire)))._tag).toBe("Failure");
        const lossless = yield* decodePandocJsonLossless(wire);
        expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual(expected);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      }
    })
  );

  it.effect(
    "rejects malformed known constructors in table captions and cells and reports their exact paths",
    Effect.fnUntraced(function* () {
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
        expect((yield* Effect.exit(decodePandocJsonStrict(wire)))._tag).toBe("Failure");
        const lossless = yield* decodePandocJsonLossless(wire);
        expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
          ["Str", "inline", expected],
        ]);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      }
    })
  );

  it.effect(
    "rejects known constructors in table structural slots and reports their exact paths",
    Effect.fnUntraced(function* () {
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
        expect((yield* Effect.exit(decodePandocJsonStrict(wire)))._tag).toBe("Failure");
        const lossless = yield* decodePandocJsonLossless(wire);
        expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
          [expected[0], "block", expected[1]],
        ]);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      }
    })
  );

  it.effect(
    "rejects pinned structural and newtype constructors nested in opaque table slots",
    Effect.fnUntraced(function* () {
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
        expect((yield* Effect.exit(decodePandocJsonStrict(wire)))._tag).toBe("Failure");
        const lossless = yield* decodePandocJsonLossless(wire);
        expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
          [expected[0], "block", expected[1]],
        ]);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      }

      const futureWire = tableWire({
        caption: { c: { exact: "caption" }, extension: true, t: "FutureCaption" },
        headRows: [
          { c: { exact: "row" }, extension: [1, 2], t: "FutureRow" },
          [["", [], []], [{ c: { exact: "row-span" }, extension: { retained: true }, t: "FutureRowSpan" }]],
        ],
      });
      const semantic = yield* decodePandocJsonStrict(futureWire);
      expect(yield* encodePandocJson(semantic)).toEqual(futureWire);
      const lossless = yield* decodePandocJsonLossless(futureWire);
      expect(lossless.issues).toEqual([]);
      expect(yield* encodePandocJsonLossless(lossless)).toEqual(futureWire);
    })
  );

  it.effect(
    "rejects malformed standard table constructors and retains their exact wire losslessly",
    Effect.fnUntraced(function* () {
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
        expect((yield* Effect.exit(decodePandocJsonStrict(wire)))._tag).toBe("Failure");
        const lossless = yield* decodePandocJsonLossless(wire);
        expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
          [expected[0], "block", expected[1]],
        ]);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      }
    })
  );

  it.effect(
    "rejects non-constructor values in required table constructor slots",
    Effect.fnUntraced(function* () {
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
        expect((yield* Effect.exit(decodePandocJsonStrict(wire)))._tag).toBe("Failure");
        const lossless = yield* decodePandocJsonLossless(wire);
        expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
          ["Table", "block", expected],
        ]);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      }
    })
  );

  it.effect(
    "retains valid and future table structural constructors exactly",
    Effect.fnUntraced(function* () {
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
        const semantic = yield* decodePandocJsonStrict(wire);
        expect(yield* encodePandocJson(semantic)).toEqual(wire);
        const lossless = yield* decodePandocJsonLossless(wire);
        expect(lossless.issues).toEqual([]);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      }
    })
  );

  it.effect("retains exact future constructors and extension fields inside table captions and cells", () =>
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
  );

  it.effect("retains exact future constructors, including absent payloads and extension fields", () =>
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
  );

  it.layer(BunFileSystem.layer)("decodes committed Pandoc JSON fixtures without a pandoc executable", (it) => {
    it.effect("decodes committed Pandoc JSON fixtures without a pandoc executable", () =>
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
    );
  });

  it.layer(BunFileSystem.layer)("round-trips supported wire objects through the internal model", (it) => {
    it.effect("round-trips supported wire objects through the internal model", () =>
      Effect.gen(function* () {
        const source = yield* fixture("green-core.pandoc.json");
        const document = yield* decodePandocJsonString(source);
        const encoded = yield* encodePandocJsonString(document);
        const roundTripped = yield* decodePandocJsonString(encoded);

        expect(roundTripped).toEqual(document);
      })
    );
  });

  it.effect("preserves representative encoded wire shapes for attrs, targets, and API versions", () =>
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
  );

  it.effect.prop(
    "keeps schema-derived semantic documents closed under encode and strict decode",
    { document: SemanticClosureDocumentArbitrary },
    Effect.fnUntraced(function* ({ document }) {
      const encoded = yield* encodePandocJson(document);
      const decoded = yield* decodePandocJsonStrict(encoded);
      expect(PandocDocumentEquivalence(decoded, document)).toBe(true);
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "preserves arbitrary future JSON through the public lossless profile",
    { extension: JsonArbitrary },
    Effect.fnUntraced(function* ({ extension }) {
      const wire = {
        "pandoc-api-version": [1, 23, 1],
        blocks: [{ c: extension, t: "FutureBlock" }],
        meta: {
          future: { c: extension, t: "MetaFuture" },
        },
        extension,
      };
      const semantic = yield* decodePandocJsonStrict(wire);
      expect(semantic.blocks[0]?._tag).toBe("unknownBlock");
      expect(semantic.meta.future?._tag).toBe("unknownMeta");
      const lossless = yield* decodePandocJsonLossless(wire);
      expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      const source = yield* UnknownFromJsonString.encodeUnknownEffect(wire);
      const fromString = yield* decodePandocJsonStringLossless(source);
      const output = yield* encodePandocJsonStringLossless(fromString);
      expect(yield* decodeUnknownJsonString(output)).toEqual(yield* decodeUnknownJsonString(source));
    }),
    { arbitrary: fcRuns(50) }
  );

  it.layer(BunFileSystem.layer)("keeps DOCX-style gap constructs decodable as explicit model nodes", (it) => {
    it.effect("keeps DOCX-style gap constructs decodable as explicit model nodes", () =>
      Effect.gen(function* () {
        const source = yield* fixture("gap-docx-styles.pandoc.json");
        const document = yield* decodePandocJsonString(source);

        expect(document.blocks.map((block) => block._tag)).toEqual(["div", "table"]);
      })
    );
  });

  it.effect("decodes authentic Pandoc 1.23.1 table attributes, captions, heads, and feet", () =>
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
      expect(yield* encodeTable(table)).toEqual({
        _tag: "table",
        payload: table.payload,
      });
      expect(table.captionPlainText).toBe("Evidence");
    })
  );

  it.effect(
    "round-trips populated citations in a non-empty short table caption",
    Effect.fnUntraced(function* () {
      const citation = {
        citationHash: 17,
        citationId: "doe-2024",
        citationMode: { t: "NormalCitation" },
        citationNoteNum: 2,
        citationPrefix: [{ c: "see", t: "Str" }],
        citationSuffix: [{ c: "p. 4", t: "Str" }],
      };
      const wire = tableWire({
        caption: [
          [
            {
              c: [[citation], [{ c: "Doe", t: "Str" }]],
              t: "Cite",
            },
          ],
          [],
        ],
      });

      const semantic = yield* decodePandocJsonStrict(wire);
      expect(yield* encodePandocJson(semantic)).toEqual(wire);
      expect(yield* captionPlainTextFromWire(wire.blocks[0]?.c[1])).toBe("Doe");

      const lossless = yield* decodePandocJsonLossless(wire);
      expect(lossless.issues).toEqual([]);
      expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
    })
  );

  it.effect(
    "round-trips a non-empty short Figure caption",
    Effect.fnUntraced(function* () {
      const wire = {
        "pandoc-api-version": [1, 23, 1],
        blocks: [
          {
            c: [emptyAttr, [[{ c: "Short", t: "Str" }], []], []],
            t: "Figure",
          },
        ],
        meta: {},
      };

      const semantic = yield* decodePandocJsonStrict(wire);
      expect(yield* encodePandocJson(semantic)).toEqual(wire);
    })
  );

  it.effect(
    "rejects an unsupported citation mode without relying on an earlier malformed block",
    Effect.fnUntraced(function* () {
      const wire = {
        "pandoc-api-version": [1, 23, 1],
        blocks: [
          {
            c: [
              {
                c: [
                  [
                    {
                      citationHash: 0,
                      citationId: "future-mode",
                      citationMode: { t: "FutureCitationMode" },
                      citationNoteNum: 0,
                      citationPrefix: [],
                      citationSuffix: [],
                    },
                  ],
                  [],
                ],
                t: "Cite",
              },
            ],
            t: "Para",
          },
        ],
        meta: {},
      };

      expect((yield* Effect.exit(decodePandocJsonStrict(wire)))._tag).toBe("Failure");
      expect((yield* decodePandocJsonLossless(wire)).issues.map((issue) => [issue.constructor, issue.pointer])).toEqual(
        [["FutureCitationMode", "/blocks/0/c/0/c/0/0/citationMode"]]
      );
    })
  );

  it.effect(
    "projects every current inline caption constructor to stable plaintext",
    Effect.fnUntraced(function* () {
      const inlineCases: ReadonlyArray<readonly [unknown, string]> = [
        [{ c: "text", t: "Str" }, "text"],
        [{ t: "Space" }, " "],
        [{ t: "SoftBreak" }, " "],
        [{ t: "LineBreak" }, "\n"],
        [{ c: [{ c: "emphasis", t: "Str" }], t: "Emph" }, "emphasis"],
        [{ c: [{ c: "underline", t: "Str" }], t: "Underline" }, "underline"],
        [{ c: [{ c: "strong", t: "Str" }], t: "Strong" }, "strong"],
        [{ c: [{ c: "strikeout", t: "Str" }], t: "Strikeout" }, "strikeout"],
        [{ c: [{ c: "superscript", t: "Str" }], t: "Superscript" }, "superscript"],
        [{ c: [{ c: "subscript", t: "Str" }], t: "Subscript" }, "subscript"],
        [{ c: [{ c: "small-caps", t: "Str" }], t: "SmallCaps" }, "small-caps"],
        [{ c: [{ t: "DoubleQuote" }, [{ c: "quoted", t: "Str" }]], t: "Quoted" }, "quoted"],
        [{ c: [[], [{ c: "cited", t: "Str" }]], t: "Cite" }, "cited"],
        [{ c: [emptyAttr, "code"], t: "Code" }, "code"],
        [{ c: [emptyAttr, [{ c: "link", t: "Str" }], ["https://example.com", ""]], t: "Link" }, "link"],
        [{ c: [emptyAttr, [{ c: "image", t: "Str" }], ["image.png", ""]], t: "Image" }, "image"],
        [{ c: [emptyAttr, [{ c: "span", t: "Str" }]], t: "Span" }, "span"],
        [{ c: [{ t: "InlineMath" }, "math"], t: "Math" }, "math"],
        [{ c: ["html", "raw"], t: "RawInline" }, "raw"],
        [{ c: [{ c: [{ c: "note", t: "Str" }], t: "Para" }], t: "Note" }, "note"],
        [{ c: { retained: true }, t: "FutureInline" }, ""],
      ];

      for (const [inline, expected] of inlineCases) {
        expect(yield* captionPlainTextFromWire([[inline], []])).toBe(expected);
      }
    })
  );

  it.effect(
    "falls back to current long-caption block constructors when the short caption is absent",
    Effect.fnUntraced(function* () {
      const blockCases: ReadonlyArray<readonly [unknown, string]> = [
        [{ c: [{ c: "plain", t: "Str" }], t: "Plain" }, "plain"],
        [{ c: [{ c: "paragraph", t: "Str" }], t: "Para" }, "paragraph"],
        [{ c: [2, emptyAttr, [{ c: "heading", t: "Str" }]], t: "Header" }, "heading"],
        [{ c: [emptyAttr, "code-block"], t: "CodeBlock" }, "code-block"],
        [{ c: ["html", "raw-block"], t: "RawBlock" }, "raw-block"],
        [{ c: [{ c: [{ c: "quote", t: "Str" }], t: "Para" }], t: "BlockQuote" }, "quote"],
        [{ c: { retained: true }, t: "FutureBlock" }, ""],
      ];

      for (const [block, expected] of blockCases) {
        expect(yield* captionPlainTextFromWire([null, [block]])).toBe(expected);
      }
    })
  );

  it.effect(
    "rejects unsupported Math subtypes strictly, retains them losslessly, and preserves ordered-list semantics",
    Effect.fnUntraced(function* () {
      const unsupportedMath = {
        "pandoc-api-version": [1, 23, 1],
        blocks: [{ c: [{ c: [{ t: "FutureMath" }, "x"], t: "Math" }], t: "Para" }],
        meta: {},
      };

      expect((yield* Effect.exit(decodePandocJsonStrict(unsupportedMath)))._tag).toBe("Failure");
      const lossless = yield* decodePandocJsonLossless(unsupportedMath);
      expect(lossless.issues).toEqual([
        expect.objectContaining({
          constructor: "FutureMath",
          path: ["blocks", 0, "c", 0, "c", 0],
        }),
      ]);
      expect(yield* encodePandocJsonLossless(lossless)).toEqual(unsupportedMath);

      const document = yield* decodePandocJsonStrict({
        "pandoc-api-version": [1, 23, 1],
        blocks: [
          {
            c: [[1, { t: "DefaultStyle" }, { t: "DefaultDelim" }], []],
            t: "OrderedList",
          },
        ],
        meta: {},
      });
      const list = document.blocks[0];
      expect(list?._tag).toBe("orderedlist");
      if (list?._tag === "orderedlist") {
        expect(list.style).toBe("DefaultStyle");
        expect(list.delimiter).toBe("DefaultDelim");
      }
    })
  );

  it.effect(
    "rejects known or malformed nullary constructors in a Math type slot",
    Effect.fnUntraced(function* () {
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

        expect((yield* Effect.exit(decodePandocJsonStrict(wire)))._tag).toBe("Failure");
        const lossless = yield* decodePandocJsonLossless(wire);
        expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
          [expected, "inline", "/blocks/0/c/0/c/0"],
        ]);
        expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
      }
    })
  );

  it.effect(
    "rejects malformed known list constructors through the typed strict API",
    Effect.fnUntraced(function* () {
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
        const exit = yield* Effect.exit(
          decodePandocJson({
            "pandoc-api-version": [1, 23, 1],
            blocks: [block],
            meta: {},
          })
        );
        expect(exit._tag).toBe("Failure");
      }
    })
  );

  it.effect("retains exact malformed and future constructor wire in lossless mode", () =>
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
  );

  it.effect("locates the nearest malformed nested constructor without replacing its ancestors", () =>
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

      expect((yield* Effect.exit(decodePandocJsonStrict(wire)))._tag).toBe("Failure");
      const lossless = yield* decodePandocJsonLossless(wire);

      expect(lossless.blocks).toEqual(wire.blocks);
      expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
        ["Str", "inline", "/blocks/0/c/1/c/1/0"],
      ]);
      expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
    })
  );

  it.effect("round-trips recursive semantic metadata and preserves unknown metadata constructors", () =>
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

      expect(isPandocMetaValue(document.meta.title)).toBe(true);
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
  );

  it.effect("reports malformed metadata in lossless mode and preserves it exactly", () =>
    Effect.gen(function* () {
      const wire = {
        "pandoc-api-version": [1, 23, 1],
        blocks: [],
        meta: { title: { c: 42, t: "MetaString" } },
      };

      expect((yield* Effect.exit(decodePandocJson(wire)))._tag).toBe("Failure");
      const lossless = yield* decodePandocJsonLossless(wire);
      expect(lossless.meta).toEqual(wire.meta);
      expect(lossless.issues.map((issue) => [issue.constructor, issue.context, issue.pointer])).toEqual([
        ["MetaString", "meta", "/meta/title"],
      ]);
      expect(yield* encodePandocJsonLossless(lossless)).toEqual(wire);
    })
  );

  it.effect(
    "rejects malformed supported top-level block payloads",
    Effect.fnUntraced(function* () {
      expect(
        (yield* Effect.exit(
          decodePandocJson({
            "pandoc-api-version": [1, 23, 1],
            blocks: [{ c: "not-inline-list", t: "Plain" }],
            meta: {},
          })
        ))._tag
      ).toBe("Failure");
    })
  );

  it.effect(
    "rejects malformed supported nested block payloads",
    Effect.fnUntraced(function* () {
      expect(
        (yield* Effect.exit(
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
        ))._tag
      ).toBe("Failure");
    })
  );

  it.effect(
    "rejects malformed supported inline payloads",
    Effect.fnUntraced(function* () {
      expect(
        (yield* Effect.exit(
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
        ))._tag
      ).toBe("Failure");
    })
  );

  it.effect(
    "rejects malformed supported footnote block payloads",
    Effect.fnUntraced(function* () {
      expect(
        (yield* Effect.exit(
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
        ))._tag
      ).toBe("Failure");
    })
  );

  it.effect(
    "rejects malformed known table payloads",
    Effect.fnUntraced(function* () {
      expect(
        (yield* Effect.exit(
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
        ))._tag
      ).toBe("Failure");
    })
  );

  it.effect("exposes a schema-owned JSON string boundary", () =>
    Effect.gen(function* () {
      const decoded = yield* decodePandocJsonFromString(`{"pandoc-api-version":[1,23,1],"meta":{},"blocks":[]}`);
      expect(decoded.blocks).toEqual([]);
    })
  );
});

// The arbitrary compiler consumes decode only; verify the advertised encoding separately.
it.effect.prop(
  "encodes Table through its generation link",
  { value: Arbitrary.schema(Table) },
  Effect.fnUntraced(function* ({ value }) {
    const annotations: S.Annotations.Declaration<unknown, []> | undefined = SchemaAST.toType(Table.ast).annotations;
    const link = annotations?.toCodecArbitrary?.({ typeParameters: [], constraint: undefined });
    if (link === undefined || link.transformation._tag !== "Transformation")
      throw new Error("Missing generation transformation");
    const codec = S.make<S.Codec<Table, unknown>>(
      SchemaAST.decodeTo(link.to, SchemaAST.toType(Table.ast), link.transformation)
    );
    const encodeGenerationTable = S.encodeEffect(codec);
    const encoded = yield* encodeGenerationTable(value);
    expect(encoded).toEqual({});
  }),
  { arbitrary: fcRuns(50) }
);
