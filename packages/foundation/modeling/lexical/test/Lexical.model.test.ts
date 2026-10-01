import {
  analyzeEditorStateCompatibility,
  decodeEditorStateLossless,
  decodeEditorStateStrict,
  EditorStateFromJson,
  EditorStateWireFromJson,
  editorStateToPlainText,
  hasTextFormat,
  LexicalNode,
  LinkNode,
  ListNode,
  ListNodeValue,
  ListTag,
  ListType,
  nodeToPlainText,
  RootNode,
  SafeUrl,
  SerializedEditorState,
  SerializedEditorStateWire,
  TextDetailMask,
  TextFormatBits,
  TextFormatMask,
  TextNode,
} from "@beep/lexical-schema";
import { legacyYouTubeVideoId, sanitizeUrl } from "@beep/lexical-schema/Lexical.normalize";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { ListItemNode as RuntimeListItemNode, ListNode as RuntimeListNode } from "@lexical/list";
import { QuoteNode as RuntimeQuoteNode } from "@lexical/rich-text";
import { pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as F from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import { createEditor } from "lexical";
import type { SerializedTableCellNode } from "@lexical/table";

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" }));
const encodeJsonEffect = S.encodeEffect(S.fromJsonString(S.Unknown));

const decodeEditorStateWireFromJson = S.decodeEffect(EditorStateWireFromJson);
const decodeEditorStateFromJsonResult = S.decodeResult(EditorStateFromJson, { onExcessProperty: "error" });
const decodeLexicalNodeResult = S.decodeResult(LexicalNode, { onExcessProperty: "error" });
const decodeSerializedEditorStateResult = S.decodeResult(SerializedEditorState, { onExcessProperty: "error" });
const decodeSafeUrlResult = S.decodeResult(SafeUrl);
const decodeTextFormatMaskResult = S.decodeResult(TextFormatMask);
const decodeUnknownListNode = S.decodeUnknownEffect(ListNode);
const decodeUnknownLexicalNodeResult = S.decodeUnknownResult(LexicalNode, { onExcessProperty: "error" });
const decodeUnknownListNodeResult = S.decodeUnknownResult(ListNode);
const decodeUnknownSerializedEditorStateResult = S.decodeUnknownResult(SerializedEditorState, {
  onExcessProperty: "error",
});
const decodeUnknownRootNodeResult = S.decodeUnknownResult(RootNode);
const encodeEditorStateFromJson = S.encodeEffect(EditorStateFromJson, { onExcessProperty: "error" });
const encodeSerializedEditorStateWire = S.encodeEffect(SerializedEditorStateWire);
const encodeEditorStateFromJsonResult = S.encodeResult(EditorStateFromJson, { onExcessProperty: "error" });
const encodeSerializedEditorStateResult = S.encodeResult(SerializedEditorState, { onExcessProperty: "error" });
const encodeSafeUrlResult = S.encodeResult(SafeUrl);
const encodeUnknownEditorStateFromJsonResult = S.encodeUnknownResult(EditorStateFromJson, {
  onExcessProperty: "error",
});
const encodeUnknownSerializedEditorStateResult = S.encodeUnknownResult(SerializedEditorState, {
  onExcessProperty: "error",
});
const encodeLexicalNodeResult = S.encodeResult(LexicalNode, { onExcessProperty: "error" });
const isListNodeValue = S.is(ListNodeValue);

const decoded = <A, E>(result: Result.Result<A, E>): A =>
  Result.match(result, {
    onSuccess: (value) => value,
    onFailure: (error) => expect.fail(String(error)),
  });

const ListNodeArbitrary = Arbitrary.schema(ListNode);
const NodeArbitrary = Arbitrary.schema(LexicalNode);
const SafeUrlArbitrary = Arbitrary.schema(SafeUrl);
const StateArbitrary = Arbitrary.schema(SerializedEditorState);
const WireStateArbitrary = Arbitrary.schema(SerializedEditorStateWire);

const matchedNodeType: (node: LexicalNode) => LexicalNode["type"] = LexicalNode.match({
  "artifact-ref": (node) => node.type,
  code: (node) => node.type,
  heading: (node) => node.type,
  linebreak: (node) => node.type,
  link: (node) => node.type,
  list: (node) => node.type,
  listitem: (node) => node.type,
  paragraph: (node) => node.type,
  quote: (node) => node.type,
  root: (node) => node.type,
  tab: (node) => node.type,
  table: (node) => node.type,
  tablecell: (node) => node.type,
  tablerow: (node) => node.type,
  text: (node) => node.type,
  youtube: (node) => node.type,
});

const element = {
  version: 1,
  direction: null,
  format: "",
  indent: 0,
} as const;

const text = (value: string, format = 0) =>
  ({
    type: "text",
    version: 1,
    detail: 0,
    format,
    mode: "normal",
    style: "",
    text: value,
  }) as const;

const paragraphNode = (children: ReadonlyArray<ReturnType<typeof text>>) => ({
  ...element,
  type: "paragraph",
  children,
  textFormat: 0,
  textStyle: "",
});

/**
 * Encoded fixture mirroring what Lexical 0.45 writes for an assistant turn:
 * heading, paragraph (with the 0.45 required paragraph fields), quote, code,
 * check list, link, and the package-owned artifact-ref block.
 */
const fixture = {
  root: {
    ...element,
    type: "root",
    children: [
      {
        ...element,
        type: "heading",
        tag: "h2",
        children: [text("Plan", 1)],
      },
      {
        ...element,
        type: "paragraph",
        textFormat: 0,
        textStyle: "",
        children: [
          text("See "),
          {
            ...element,
            type: "link",
            url: "https://example.com",
            children: [text("the docs")],
          },
          { type: "linebreak", version: 1 },
          text("inline", 16),
        ],
      },
      {
        ...element,
        type: "quote",
        children: [text("Measure twice.")],
      },
      {
        ...element,
        type: "code",
        language: "typescript",
        children: [text('console.log("beep")'), { type: "linebreak", version: 1 }, text("export {}")],
      },
      {
        type: "youtube",
        version: 1,
        videoID: "M7lc1UVf-VE",
        format: "",
      },
      {
        ...element,
        type: "table",
        children: [
          {
            ...element,
            type: "tablerow",
            children: [
              {
                ...element,
                type: "tablecell",
                headerState: 1,
                children: [
                  {
                    ...element,
                    type: "paragraph",
                    children: [text("Name")],
                  },
                ],
              },
              {
                ...element,
                type: "tablecell",
                headerState: 1,
                children: [
                  {
                    ...element,
                    type: "paragraph",
                    children: [text("Value")],
                  },
                ],
              },
            ],
          },
          {
            ...element,
            type: "tablerow",
            children: [
              {
                ...element,
                type: "tablecell",
                headerState: 0,
                children: [
                  {
                    ...element,
                    type: "paragraph",
                    children: [text("Language")],
                  },
                ],
              },
              {
                ...element,
                type: "tablecell",
                headerState: 0,
                children: [
                  {
                    ...element,
                    type: "paragraph",
                    children: [text("ts", 16)],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        ...element,
        type: "list",
        listType: "check",
        start: 1,
        tag: "ul",
        children: [
          {
            ...element,
            type: "listitem",
            checked: true,
            value: 1,
            children: [text("ship schema")],
          },
          {
            ...element,
            type: "listitem",
            value: 2,
            children: [text("ship editor")],
          },
        ],
      },
      {
        type: "artifact-ref",
        version: 1,
        artifactId: "artifact-123",
        label: "Quarterly report",
      },
    ],
  },
};

describe("Lexical.model", { concurrent: false }, () => {
  it("decodes the fixture editor state and captures nullish wire values as Options", () => {
    const state = decoded(decodeUnknownSerializedEditorStateResult(fixture));

    pipe(SerializedEditorState.decodeOption(fixture), O.isSome, assertTrue);
    assertNone(state.root.direction);
    assertNone(state.root.textFormat);
    expect(state.root.children.map((node) => node.type)).toEqual([
      "heading",
      "paragraph",
      "quote",
      "code",
      "youtube",
      "table",
      "list",
      "artifact-ref",
    ]);
    expect(state.root.children[1]).toMatchObject({ textFormat: O.some(0), textStyle: O.some("") });
    expect(state.root.children[3]).toMatchObject({ language: O.some("typescript"), theme: O.none() });
    expect(state.root.children[4]).toMatchObject({ videoID: "M7lc1UVf-VE", format: "" });
    const table = state.root.children[5];
    expect(table?.type).toBe("table");
    if (table?.type !== "table") {
      expect.fail("Expected decoded table node");
    }
    assertNone(table.rowStriping);
    const header = table.children[0];
    expect(header?.type).toBe("tablerow");
    if (header?.type !== "tablerow") {
      expect.fail("Expected decoded table header row");
    }
    const firstHeaderCell = header.children[0];
    if (firstHeaderCell?.type !== "tablecell") {
      expect.fail("Expected decoded table header cell");
    }
    const lexicalHeaderState: SerializedTableCellNode["headerState"] = firstHeaderCell.headerState;
    expect(lexicalHeaderState).toBe(1);
    expect(header.children[1]).toMatchObject({ headerState: 1 });
    expect(state.root.children[6]).toMatchObject({
      children: [{ checked: O.some(true) }, { checked: O.none() }],
    });
    expect(state.root.children[7]).toMatchObject({ artifactId: "artifact-123", label: O.some("Quarterly report") });
  });

  it("rejects values outside nullish optional field domains", () => {
    const invalidDirection = {
      root: {
        ...fixture.root,
        direction: "sideways",
      },
    };

    expect(decodeUnknownSerializedEditorStateResult(invalidDirection)._tag).toBe("Failure");
  });

  it("round-trips the fixture through decode/encode without wire drift", () => {
    const state = decoded(decodeUnknownSerializedEditorStateResult(fixture));
    expect(decoded(encodeSerializedEditorStateResult(state))).toEqual(fixture);
  });

  it("round-trips through the JSON string codec", () => {
    const json = JSON.stringify(fixture);
    const state = decoded(decodeEditorStateFromJsonResult(json));
    expect(JSON.parse(decoded(encodeEditorStateFromJsonResult(state)))).toEqual(fixture);
  });

  it.prop(
    "round-trips schema-derived arbitrary nodes through encode/decode",
    { node: NodeArbitrary },
    ({ node }) => {
      expect(matchedNodeType(node)).toBe(node.type);
      expect(decoded(LexicalNode.decodeUnknownResult(decoded(encodeLexicalNodeResult(node))))).toEqual(node);
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "round-trips schema-derived arbitrary editor states through encode/decode",
    { state: StateArbitrary },
    ({ state }) => {
      const encodedState = decoded(encodeSerializedEditorStateResult(state));
      expect(decoded(decodeUnknownSerializedEditorStateResult(encodedState))).toEqual(state);
      assertSome(SerializedEditorState.decodeOption(encodedState), state);
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "sanitizes link URLs at the schema boundary and keeps safe URLs fixed",
    { url: SafeUrlArbitrary },
    ({ url }) => {
      const unsafeDataUrl = "data:text/html,\x3cscript>x\x3c/script>";
      expect(decoded(decodeSafeUrlResult("javascript:alert(1)"))).toBe("#");
      expect(decoded(decodeSafeUrlResult("file:///tmp/beep.txt"))).toBe("#");
      expect(decoded(decodeSafeUrlResult("/\n/evil.example/path"))).toBe("#");
      expect(decoded(decodeSafeUrlResult("/\r/evil.example/path"))).toBe("#");
      expect(decoded(decodeSafeUrlResult("/\t/evil.example/path"))).toBe("#");
      expect(decoded(decodeSafeUrlResult("https://example.com/docs"))).toBe("https://example.com/docs");
      expect(decoded(decodeSafeUrlResult("docs/page"))).toBe("docs/page");
      expect(decoded(encodeSafeUrlResult(decoded(decodeSafeUrlResult(unsafeDataUrl))))).toBe("#");
      expect(sanitizeUrl(url)).toBe(url);
      expect(decoded(decodeSafeUrlResult(decoded(encodeSafeUrlResult(url))))).toBe(url);
    },
    { arbitrary: fcRuns(50) }
  );

  it("rejects unsafe values passed directly to semantic node constructors", () => {
    expect(() => LinkNode.make({ children: [], url: "javascript:alert(1)" })).toThrow();
    expect(() => LinkNode.make({ children: [], url: "/\n/evil.example/path" })).toThrow();
    expect(() =>
      TextNode.make({
        detail: TextDetailMask.make(0),
        format: TextFormatMask.make(0),
        mode: "normal",
        style: "position:fixed;inset:0",
        text: "unsafe",
      })
    ).toThrow();

    expect(LinkNode.make({ children: [], url: "#" }).url).toBe("#");
    expect(
      TextNode.make({
        detail: TextDetailMask.make(0),
        format: TextFormatMask.make(0),
        mode: "normal",
        style: "color: red",
        text: "safe",
      }).style
    ).toBe("color: red");
  });

  it.effect(
    "preserves future JSON wire extensions and reports strict incompatibility",
    Effect.fnUntraced(function* () {
      const future = {
        root: {
          type: "root",
          version: 7,
          children: [
            {
              type: "future-node",
              version: 3,
              $: { "future-state": { enabled: true, revision: 2 } },
              pluginPayload: { enabled: true, values: [1, 2, 3] },
            },
          ],
          futureRootField: "retained",
        },
        editorExtension: { revision: 9 },
      };

      const wire = yield* decodeEditorStateLossless(future);
      expect(wire).toEqual(future);

      const compatibility = yield* analyzeEditorStateCompatibility(future);
      expect(compatibility.wire).toEqual(future);
      expect(compatibility.isCompatible).toBe(false);
      assertNone(compatibility.state);
      expect(compatibility.issues).toHaveLength(1);
      expect((yield* Effect.exit(decodeEditorStateStrict(future)))._tag).toBe("Failure");
    })
  );

  it.effect(
    "requires strict NodeState values to be lossless JSON",
    Effect.fnUntraced(function* () {
      const nodeState = {
        enabled: true,
        nested: { count: 2, nullable: null, values: ["one", false] },
      };
      const valid = {
        root: {
          ...element,
          type: "root",
          children: [{ ...element, type: "paragraph", $: { plugin: nodeState }, children: [] }],
        },
      };

      const decoded = Result.getOrThrow(decodeUnknownSerializedEditorStateResult(valid));
      expect(Result.getOrThrow(encodeSerializedEditorStateResult(decoded))).toEqual(valid);
      pipe(
        decoded,
        encodeEditorStateFromJsonResult,
        Result.getOrThrow,
        decodeEditorStateFromJsonResult,
        Result.isSuccess,
        assertTrue
      );

      const nonJsonValues: ReadonlyArray<unknown> = [
        () => true,
        Symbol("node-state"),
        1n,
        undefined,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ];
      yield* Effect.forEach(
        nonJsonValues,
        Effect.fnUntraced(function* (plugin) {
          const invalid = {
            root: {
              ...element,
              type: "root",
              children: [{ ...element, type: "paragraph", $: { plugin }, children: [] }],
            },
          };

          expect(decodeUnknownSerializedEditorStateResult(invalid)._tag).toBe("Failure");
          expect((yield* Effect.exit(decodeEditorStateStrict(invalid)))._tag).toBe("Failure");
          expect(encodeUnknownSerializedEditorStateResult(invalid)._tag).toBe("Failure");
          expect(encodeUnknownEditorStateFromJsonResult(invalid)._tag).toBe("Failure");
          expect((yield* Effect.exit(decodeEditorStateLossless(invalid)))._tag).toBe("Failure");
        }),
        { discard: true }
      );
    })
  );

  it.effect(
    "rejects excess fields through every strict surface while retaining their lossless wire",
    Effect.fnUntraced(function* () {
      const state = {
        root: {
          ...element,
          type: "root",
          children: [{ ...element, type: "paragraph", children: [] }],
        },
      } as const;
      const nodeWithExtension = { ...state.root.children[0], futureNode: true } as const;
      const rootWithNestedExtension = { ...state.root, children: [nodeWithExtension] } as const;
      const cases = [
        [
          { ...state, futureEnvelope: true },
          '{"root":{"version":1,"direction":null,"format":"","indent":0,"type":"root","children":[{"version":1,"direction":null,"format":"","indent":0,"type":"paragraph","children":[]}]},"futureEnvelope":true}',
        ],
        [
          { root: { ...state.root, futureRoot: true } },
          '{"root":{"version":1,"direction":null,"format":"","indent":0,"type":"root","children":[{"version":1,"direction":null,"format":"","indent":0,"type":"paragraph","children":[]}],"futureRoot":true}}',
        ],
        [
          { root: { ...state.root, children: [nodeWithExtension] } },
          '{"root":{"version":1,"direction":null,"format":"","indent":0,"type":"root","children":[{"version":1,"direction":null,"format":"","indent":0,"type":"paragraph","children":[],"futureNode":true}]}}',
        ],
      ] as const;

      expect(decodeLexicalNodeResult(nodeWithExtension)._tag).toBe("Failure");
      assertNone(LexicalNode.decodeUnknownOption(nodeWithExtension));
      expect(decodeLexicalNodeResult(rootWithNestedExtension)._tag).toBe("Failure");
      assertNone(LexicalNode.decodeUnknownOption(rootWithNestedExtension));
      yield* Effect.forEach(
        cases,
        Effect.fnUntraced(function* ([stateWithExtension, jsonWithExtension]) {
          expect(decodeSerializedEditorStateResult(stateWithExtension)._tag).toBe("Failure");
          assertNone(SerializedEditorState.decodeOption(stateWithExtension));
          expect(decodeEditorStateFromJsonResult(jsonWithExtension)._tag).toBe("Failure");
          expect((yield* Effect.exit(decodeEditorStateStrict(stateWithExtension)))._tag).toBe("Failure");
          expect(yield* decodeEditorStateLossless(stateWithExtension)).toEqual(stateWithExtension);
          expect(yield* decodeEditorStateWireFromJson(jsonWithExtension)).toEqual(stateWithExtension);
        }),
        { discard: true }
      );
    })
  );

  it.effect.prop(
    "round-trips arbitrary open wire states without losing extension fields",
    { wire: WireStateArbitrary },
    Effect.fnUntraced(function* ({ wire }) {
      const decoded = yield* decodeEditorStateLossless(wire);
      expect(decoded).toEqual(wire);
      expect(yield* encodeSerializedEditorStateWire(decoded)).toEqual(wire);
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect(
    "preserves opaque future children fields without imposing semantic child grammar",
    Effect.fnUntraced(function* () {
      const future = {
        root: {
          type: "root",
          version: 7,
          children: [
            {
              type: "future-node",
              version: 3,
              children: { extensionOwnedShape: ["not", "lexical", "nodes"] },
            },
          ],
        },
      };

      expect(yield* decodeEditorStateLossless(future)).toEqual(future);
      expect((yield* Effect.exit(decodeEditorStateStrict(future)))._tag).toBe("Failure");
    })
  );

  it("constructs exhaustive list payload cases with canonical tags", () => {
    const numberPayload = ListNodeValue.cases.number.make({ children: [], start: PosInt.make(3) });
    const bulletPayload = ListNodeValue.cases.bullet.make({ children: [], start: PosInt.make(1) });
    const checkPayload = ListNodeValue.cases.check.make({ children: [], start: PosInt.make(1) });
    const numberTag: "ol" = numberPayload.tag;
    const bulletTag: "ul" = bulletPayload.tag;
    const checkTag: "ul" = checkPayload.tag;

    expect([numberTag, bulletTag, checkTag]).toEqual(["ol", "ul", "ul"]);
    expect(ListNodeValue.guards.number(numberPayload)).toBe(true);
    expect(ListNodeValue.guards.bullet(numberPayload)).toBe(false);
    expect(ListNodeValue.isAnyOf(["bullet", "check"])(checkPayload)).toBe(true);
    expect(
      ListNodeValue.match(numberPayload, {
        number: ({ tag }) => tag,
        bullet: ({ tag }) => tag,
        check: ({ tag }) => tag,
      })
    ).toBe("ol");
    expect(isListNodeValue({ ...numberPayload, tag: "ul" })).toBe(false);

    const node = ListNode.make(numberPayload);
    expect(ListNode.is(node)).toBe(true);
    expect(node).toMatchObject({ type: "list", listType: "number", start: 3, tag: "ol", children: [] });
  });

  it.effect(
    "rejects contradictory list metadata strictly while retaining the exact lossless wire",
    Effect.fnUntraced(function* () {
      const mismatches: ReadonlyArray<readonly [ListType, ListTag]> = [
        ["number", "ul"],
        ["bullet", "ol"],
        ["check", "ol"],
      ];

      yield* Effect.forEach(
        mismatches,
        Effect.fnUntraced(function* ([listType, tag]) {
          const node = {
            ...element,
            type: "list",
            listType,
            start: 1,
            tag,
            children: [
              {
                ...element,
                type: "listitem",
                value: 1,
                children: [text("item")],
              },
            ],
          };
          const state = {
            root: {
              ...element,
              type: "root",
              children: [node],
            },
          };
          const source = yield* encodeJsonEffect(state);
          const canonicalTag = ListType.$match(listType, {
            number: F.constant(ListTag.Enum.ol),
            bullet: F.constant(ListTag.Enum.ul),
            check: F.constant(ListTag.Enum.ul),
          });
          const semanticNode = yield* decodeUnknownListNode({ ...node, tag: canonicalTag });
          const semanticMismatch = { ...semanticNode, tag };

          expect(() => ListNode.make(semanticMismatch)).toThrow();
          expect((yield* Effect.exit(ListNode.makeEffect(semanticMismatch)))._tag).toBe("Failure");
          expect(decodeUnknownListNodeResult(node)._tag).toBe("Failure");
          expect(decodeUnknownLexicalNodeResult(node)._tag).toBe("Failure");
          expect(decodeUnknownSerializedEditorStateResult(state)._tag).toBe("Failure");
          assertNone(SerializedEditorState.decodeOption(state));
          expect(decodeEditorStateFromJsonResult(source)._tag).toBe("Failure");
          expect((yield* Effect.exit(decodeEditorStateStrict(state)))._tag).toBe("Failure");

          const compatibility = yield* analyzeEditorStateCompatibility(state);
          expect(compatibility.isCompatible).toBe(false);
          assertNone(compatibility.state);
          expect(compatibility.wire).toEqual(state);
          expect(compatibility.issues).toHaveLength(1);

          const wire = yield* decodeEditorStateLossless(state);
          expect(wire).toEqual(state);
          expect(yield* encodeSerializedEditorStateWire(wire)).toEqual(state);
          expect(yield* decodeEditorStateWireFromJson(source)).toEqual(state);
        }),
        { discard: true }
      );
    })
  );

  it.prop(
    "generates only runtime-canonical list metadata",
    { node: ListNodeArbitrary },
    ({ node }) => {
      const expectedTag = ListType.$match(node.listType, {
        number: F.constant(ListTag.Enum.ol),
        bullet: F.constant(ListTag.Enum.ul),
        check: F.constant(ListTag.Enum.ul),
      });
      expect(node.tag).toBe(expectedTag);
    },
    { arbitrary: fcRuns(100) }
  );

  it.effect(
    "keeps canonical list metadata fixed through the real Lexical runtime",
    Effect.fnUntraced(function* () {
      const editor = createEditor({
        namespace: "lexical-schema-list-fixed-point",
        nodes: [RuntimeListNode, RuntimeListItemNode],
      });
      const canonical: ReadonlyArray<readonly [ListType, ListTag]> = [
        ["number", "ol"],
        ["bullet", "ul"],
        ["check", "ul"],
      ];

      yield* Effect.forEach(
        canonical,
        Effect.fnUntraced(function* ([listType, tag]) {
          const state = {
            root: {
              ...element,
              type: "root",
              children: [
                {
                  ...element,
                  type: "list",
                  listType,
                  start: 1,
                  tag,
                  children: [
                    {
                      ...element,
                      type: "listitem",
                      value: 1,
                      children: [text("item")],
                    },
                  ],
                },
              ],
            },
          };

          const strict = yield* decodeEditorStateStrict(state);
          const source = yield* encodeEditorStateFromJson(strict);

          expect(editor.parseEditorState(source).toJSON().root.children[0]).toMatchObject({ listType, tag });
        }),
        { discard: true }
      );
    })
  );

  it.effect(
    "keeps shadow-root quote topology fixed through the real Lexical runtime",
    Effect.fnUntraced(function* () {
      const editor = createEditor({
        namespace: "lexical-schema-shadow-root-quote-fixed-point",
        nodes: [RuntimeQuoteNode],
      });
      const state = {
        root: {
          ...element,
          type: "root",
          children: [
            {
              ...element,
              type: "quote",
              shadowRoot: true,
              children: [paragraphNode([text("first block")]), paragraphNode([text("second block")])],
            },
          ],
        },
      };
      const strict = yield* decodeEditorStateStrict(state);
      const source = yield* encodeEditorStateFromJson(strict);

      expect(editor.parseEditorState(source).toJSON()).toEqual(state);
    })
  );

  it.effect(
    "enforces the strict v1 child grammar on the established semantic schema",
    Effect.fnUntraced(function* () {
      const misplacedText = {
        root: {
          ...element,
          type: "root",
          children: [text("not a block")],
        },
      };

      const misplacedRoot = decoded(decodeUnknownRootNodeResult(misplacedText.root));
      expect(() => SerializedEditorState.make({ root: misplacedRoot })).toThrow();
      pipe(decodeUnknownSerializedEditorStateResult(misplacedText), Result.isFailure, assertTrue);
      expect(yield* decodeEditorStateLossless(misplacedText)).toEqual(misplacedText);
      expect((yield* Effect.exit(decodeEditorStateStrict(misplacedText)))._tag).toBe("Failure");
    })
  );

  it("enforces recursive child placement and non-empty roots on the public node schema", () => {
    const paragraph = { ...element, type: "paragraph", children: [text("valid paragraph")] };
    const listItem = { ...element, type: "listitem", value: 1, children: [text("valid item")] };
    const list = {
      ...element,
      type: "list",
      listType: "bullet",
      start: 1,
      tag: "ul",
      children: [listItem],
    };
    const tableCell = { ...element, type: "tablecell", headerState: 0, children: [paragraph] };
    const tableRow = { ...element, type: "tablerow", children: [tableCell] };
    const table = { ...element, type: "table", children: [tableRow] };
    const root = { ...element, type: "root", children: [paragraph, list, table] };

    A.forEach([text("standalone leaf"), paragraph, list, table, root], (input) => {
      const result = decodeUnknownLexicalNodeResult(input);
      pipe(result, Result.isSuccess, assertTrue);
      if (Result.isSuccess(result)) {
        expect(matchedNodeType(result.success)).toBe(input.type);
      }
    });

    A.forEach(
      [
        { ...element, type: "root", children: [] },
        { ...element, type: "root", children: [text("misplaced text")] },
        { ...list, children: [paragraph] },
        { ...table, children: [tableCell] },
        { ...tableRow, children: [paragraph] },
        { ...tableCell, children: [text("misplaced cell text")] },
      ],
      (input) => pipe(decodeUnknownLexicalNodeResult(input), Result.isFailure, assertTrue)
    );
  });

  it.effect(
    "preserves an empty root losslessly while reporting strict incompatibility",
    Effect.fnUntraced(function* () {
      const empty = {
        root: {
          ...element,
          type: "root",
          children: [],
        },
      };

      expect(yield* decodeEditorStateLossless(empty)).toEqual(empty);
      expect((yield* Effect.exit(decodeEditorStateStrict(empty)))._tag).toBe("Failure");

      const compatibility = yield* analyzeEditorStateCompatibility(empty);
      expect(compatibility.wire).toEqual(empty);
      assertNone(compatibility.state);
      expect(compatibility.issues).toHaveLength(1);
    })
  );

  it("rejects impossible serialized formatting and structural values", () => {
    const boldUnderline = decoded(decodeTextFormatMaskResult(TextFormatBits.bold | TextFormatBits.underline));
    expect(hasTextFormat(boldUnderline, TextFormatBits.bold)).toBe(true);
    expect(hasTextFormat(boldUnderline, TextFormatBits.underline)).toBe(true);

    pipe(decodeLexicalNodeResult({ ...text("bad format"), format: 1 << 11 }), Result.isFailure, assertTrue);
    pipe(decodeLexicalNodeResult({ ...text("bad detail"), detail: 1 << 2 }), Result.isFailure, assertTrue);
    pipe(
      decodeLexicalNodeResult({
        ...element,
        type: "list",
        listType: "number",
        start: -1,
        tag: "ol",
        children: [],
      }),
      Result.isFailure,
      assertTrue
    );
    pipe(
      decodeUnknownLexicalNodeResult({
        ...element,
        type: "tablecell",
        headerState: 4,
        children: [],
      }),
      Result.isFailure,
      assertTrue
    );
  });

  it("normalizes legacy serialized list starts and rejects corrupt item zeros", () => {
    const list = decoded(
      decodeLexicalNodeResult({
        ...element,
        type: "list",
        listType: "number",
        start: 0,
        tag: "ol",
        children: [
          {
            ...element,
            type: "listitem",
            value: 1,
            children: [text("legacy zero")],
          },
        ],
      })
    );

    expect(list).toMatchObject({
      start: 1,
      children: [{ value: 1 }],
    });
    expect(decoded(encodeLexicalNodeResult(list))).toMatchObject({
      start: 1,
      children: [{ value: 1 }],
    });

    pipe(
      decodeLexicalNodeResult({
        ...element,
        type: "list",
        listType: "number",
        start: 1,
        tag: "ol",
        children: [
          {
            ...element,
            type: "listitem",
            value: 0,
            children: [text("corrupt zero")],
          },
          {
            ...element,
            type: "listitem",
            value: 0,
            children: [text("duplicate corrupt zero")],
          },
        ],
      }),
      Result.isFailure,
      assertTrue
    );
  });

  it("normalizes compatible legacy decorator and code metadata", () => {
    expect(legacyYouTubeVideoId("https://www.youtube.com/watch?v=AbCdEfGhI12")).toBe("AbCdEfGhI12");
    expect(legacyYouTubeVideoId("https://youtube.com/embed/AbCdEfGhI12")).toBe("AbCdEfGhI12");

    expect(
      decoded(
        decodeLexicalNodeResult({
          type: "youtube",
          version: 1,
          videoID: "https://youtu.be/M7lc1UVf-VE",
          format: "",
        })
      )
    ).toMatchObject({ videoID: "M7lc1UVf-VE" });
    expect(
      decoded(
        decodeLexicalNodeResult({
          ...element,
          type: "code",
          language: "ts bad",
          children: [],
        })
      )
    ).toMatchObject({ language: O.none() });

    pipe(
      decodeLexicalNodeResult({
        type: "youtube",
        version: 1,
        videoID: "https://youtu.be/not-valid",
        format: "",
      }),
      Result.isFailure,
      assertTrue
    );
    pipe(
      decodeLexicalNodeResult({ type: "artifact-ref", version: 1, artifactId: "bad id" }),
      Result.isFailure,
      assertTrue
    );
  });

  it("rejects nodes outside the v1 union", () => {
    pipe(
      decodeUnknownLexicalNodeResult({ type: "mermaid", version: 1, source: "flowchart TD" }),
      Result.isFailure,
      assertTrue
    );
  });

  it("projects plain text", () => {
    const state = decoded(decodeUnknownSerializedEditorStateResult(fixture));
    const plain = editorStateToPlainText(state);
    expect(plain).toContain("Plan");
    expect(plain).toContain("See the docs");
    expect(plain).toContain('console.log("beep")');
    expect(plain).toContain("https://www.youtube.com/watch?v=M7lc1UVf-VE");
    expect(plain).toContain("Name");
    expect(plain).toContain("Language");
    expect(plain).toContain("[artifact:artifact-123]");

    const node = decoded(decodeLexicalNodeResult({ type: "linebreak", version: 1 }));
    expect(nodeToPlainText(node)).toBe("\n");
    expect(
      nodeToPlainText(
        decoded(
          decodeLexicalNodeResult({
            type: "tab",
            version: 1,
            detail: 2,
            format: 0,
            mode: "normal",
            style: "",
            text: "\t",
          })
        )
      )
    ).toBe("\t");
  });
});

// The arbitrary compiler consumes decode only; verify the advertised encoding separately.
it.effect.prop(
  "encodes SerializedEditorState through its generation link",
  { value: Arbitrary.schema(SerializedEditorState) },
  Effect.fnUntraced(function* ({ value }) {
    const annotations: S.Annotations.Declaration<unknown, []> | undefined = SchemaAST.toType(
      SerializedEditorState.ast
    ).annotations;
    const link = annotations?.toCodecArbitrary?.({ typeParameters: [], constraint: undefined });
    if (link === undefined || link.transformation._tag !== "Transformation")
      throw new Error("Missing generation transformation");
    const codec = S.make<S.Codec<SerializedEditorState, unknown>>(
      SchemaAST.decodeTo(link.to, SchemaAST.toType(SerializedEditorState.ast), link.transformation)
    );
    const encoded = yield* S.encodeEffect(codec)(value);
    expect(encoded).toEqual([]);
  }),
  { arbitrary: fcRuns(50) }
);
