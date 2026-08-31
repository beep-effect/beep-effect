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
import { PosInt } from "@beep/schema";
import { Unknown } from "@beep/schema/Unknown";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { ListItemNode as RuntimeListItemNode, ListNode as RuntimeListNode } from "@lexical/list";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { createEditor } from "lexical";
import type { SerializedTableCellNode } from "@lexical/table";

const ListNodeArbitrary = S.toArbitrary(ListNode)(fc);
const NodeArbitrary = S.toArbitrary(LexicalNode)(fc);
const SafeUrlArbitrary = S.toArbitrary(SafeUrl)(fc);
const StateArbitrary = S.toArbitrary(SerializedEditorState)(fc);
const WireStateArbitrary = S.toArbitrary(SerializedEditorStateWire)(fc);
const decodeEditorState = S.decodeUnknownSync(SerializedEditorState);
const encodeEditorState = S.encodeSync(SerializedEditorState);
const encodeLexicalNode = S.encodeSync(LexicalNode);

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
    const state = S.decodeUnknownSync(SerializedEditorState)(fixture);

    expect(O.isSome(SerializedEditorState.decodeOption(fixture))).toBe(true);
    expect(state.root.direction).toEqual(O.none());
    expect(state.root.textFormat).toEqual(O.none());
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
    expect(table.rowStriping).toEqual(O.none());
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

  it("round-trips the fixture through decode/encode without wire drift", () => {
    const state = S.decodeUnknownSync(SerializedEditorState)(fixture);
    expect(S.encodeSync(SerializedEditorState)(state)).toEqual(fixture);
  });

  it("round-trips through the JSON string codec", () => {
    const json = JSON.stringify(fixture);
    const state = S.decodeSync(EditorStateFromJson)(json);
    expect(JSON.parse(S.encodeSync(EditorStateFromJson)(state))).toEqual(fixture);
  });

  it("round-trips schema-derived arbitrary nodes through encode/decode", () => {
    fc.assert(
      fc.property(NodeArbitrary, (node) => {
        expect(matchedNodeType(node)).toBe(node.type);
        expect(LexicalNode.fromUnknown(encodeLexicalNode(node))).toEqual(node);
      }),
      fcRuns(50)
    );
  });

  it("round-trips schema-derived arbitrary editor states through encode/decode", () => {
    fc.assert(
      fc.property(StateArbitrary, (state) => {
        const encodedState = encodeEditorState(state);
        expect(decodeEditorState(encodedState)).toEqual(state);
        expect(SerializedEditorState.decodeOption(encodedState)).toEqual(O.some(state));
      }),
      // Pinned at the original 50. Nightly `BEEP_FC_NUM_RUNS=1000` times out at
      // 300s on unbounded SerializedEditorState trees (#663). Hard `numRuns`
      // is the one-round-loop seed-exclude form: the env floor cannot raise it.
      { numRuns: 50 }
    );
  });

  it("sanitizes link URLs at the schema boundary and keeps safe URLs fixed", () => {
    expect(S.decodeSync(SafeUrl)("javascript:alert(1)")).toBe("#");
    expect(S.decodeSync(SafeUrl)("file:///tmp/beep.txt")).toBe("#");
    expect(S.decodeSync(SafeUrl)("/\n/evil.example/path")).toBe("#");
    expect(S.decodeSync(SafeUrl)("/\r/evil.example/path")).toBe("#");
    expect(S.decodeSync(SafeUrl)("/\t/evil.example/path")).toBe("#");
    expect(S.decodeSync(SafeUrl)("https://example.com/docs")).toBe("https://example.com/docs");
    expect(S.decodeSync(SafeUrl)("docs/page")).toBe("docs/page");
    expect(S.encodeSync(SafeUrl)(S.decodeSync(SafeUrl)("data:text/html,<script>x</script>"))).toBe("#");

    fc.assert(
      fc.property(SafeUrlArbitrary, (url) => {
        expect(sanitizeUrl(url)).toBe(url);
        expect(S.decodeSync(SafeUrl)(S.encodeSync(SafeUrl)(url))).toBe(url);
      }),
      fcRuns(50)
    );
  });

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

  it("preserves future JSON wire extensions and reports strict incompatibility", () => {
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

    const wire = Effect.runSync(decodeEditorStateLossless(future));
    expect(wire).toEqual(future);

    const compatibility = Effect.runSync(analyzeEditorStateCompatibility(future));
    expect(compatibility.wire).toEqual(future);
    expect(compatibility.isCompatible).toBe(false);
    expect(O.isNone(compatibility.state)).toBe(true);
    expect(compatibility.issues).toHaveLength(1);
    expect(Effect.runSyncExit(decodeEditorStateStrict(future))._tag).toBe("Failure");
  });

  it("requires strict NodeState values to be lossless JSON", () => {
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

    const decoded = Result.getOrThrow(S.decodeUnknownResult(SerializedEditorState)(valid));
    expect(Result.getOrThrow(S.encodeResult(SerializedEditorState)(decoded))).toEqual(valid);
    expect(
      Result.isSuccess(
        S.decodeResult(EditorStateFromJson)(Result.getOrThrow(S.encodeResult(EditorStateFromJson)(decoded)))
      )
    ).toBe(true);

    const nonJsonValues: ReadonlyArray<unknown> = [
      () => true,
      Symbol("node-state"),
      1n,
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ];
    A.forEach(nonJsonValues, (plugin) => {
      const invalid = {
        root: {
          ...element,
          type: "root",
          children: [{ ...element, type: "paragraph", $: { plugin }, children: [] }],
        },
      };

      expect(S.decodeUnknownResult(SerializedEditorState)(invalid)._tag).toBe("Failure");
      expect(Effect.runSyncExit(decodeEditorStateStrict(invalid))._tag).toBe("Failure");
      expect(S.encodeUnknownResult(SerializedEditorState)(invalid)._tag).toBe("Failure");
      expect(S.encodeUnknownResult(EditorStateFromJson)(invalid)._tag).toBe("Failure");
      expect(Effect.runSyncExit(decodeEditorStateLossless(invalid))._tag).toBe("Failure");
    });
  });

  it("rejects excess fields through every strict surface while retaining their lossless wire", () => {
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

    expect(S.decodeResult(LexicalNode)(nodeWithExtension)._tag).toBe("Failure");
    expect(O.isNone(LexicalNode.decodeOption(nodeWithExtension))).toBe(true);
    expect(S.decodeResult(LexicalNode)(rootWithNestedExtension)._tag).toBe("Failure");
    expect(O.isNone(LexicalNode.decodeOption(rootWithNestedExtension))).toBe(true);
    A.forEach(cases, ([stateWithExtension, jsonWithExtension]) => {
      expect(S.decodeResult(SerializedEditorState)(stateWithExtension)._tag).toBe("Failure");
      expect(O.isNone(SerializedEditorState.decodeOption(stateWithExtension))).toBe(true);
      expect(S.decodeResult(EditorStateFromJson)(jsonWithExtension)._tag).toBe("Failure");
      expect(Effect.runSyncExit(decodeEditorStateStrict(stateWithExtension))._tag).toBe("Failure");
      expect(Effect.runSync(decodeEditorStateLossless(stateWithExtension))).toEqual(stateWithExtension);
      expect(Effect.runSync(S.decodeEffect(EditorStateWireFromJson)(jsonWithExtension))).toEqual(stateWithExtension);
    });
  });

  it("round-trips arbitrary open wire states without losing extension fields", () =>
    fc.assert(
      fc.property(WireStateArbitrary, (wire) => {
        const decoded = Effect.runSync(decodeEditorStateLossless(wire));

        expect(decoded).toEqual(wire);
        expect(Effect.runSync(S.encodeEffect(SerializedEditorStateWire)(decoded))).toEqual(wire);
      }),
      fcRuns(50)
    ));

  it("preserves opaque future children fields without imposing semantic child grammar", () => {
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

    expect(Effect.runSync(decodeEditorStateLossless(future))).toEqual(future);
    expect(Effect.runSyncExit(decodeEditorStateStrict(future))._tag).toBe("Failure");
  });

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
    expect(S.is(ListNodeValue)({ ...numberPayload, tag: "ul" })).toBe(false);

    const node = ListNode.make(numberPayload);
    expect(ListNode.is(node)).toBe(true);
    expect(node).toMatchObject({ type: "list", listType: "number", start: 3, tag: "ol", children: [] });
  });

  it("rejects contradictory list metadata strictly while retaining the exact lossless wire", () => {
    const mismatches: ReadonlyArray<readonly [ListType, ListTag]> = [
      ["number", "ul"],
      ["bullet", "ol"],
      ["check", "ol"],
    ];

    A.forEach(mismatches, ([listType, tag]) => {
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
      const source = Effect.runSync(Unknown.encodeEffectFromJsonString(state));
      const canonicalTag = ListType.$match(listType, {
        number: ListTag.thunk.ol,
        bullet: ListTag.thunk.ul,
        check: ListTag.thunk.ul,
      });
      const semanticNode = Effect.runSync(S.decodeUnknownEffect(ListNode)({ ...node, tag: canonicalTag }));
      const semanticMismatch = { ...semanticNode, tag };

      expect(() => ListNode.make(semanticMismatch)).toThrow();
      expect(Effect.runSyncExit(ListNode.makeEffect(semanticMismatch))._tag).toBe("Failure");
      expect(S.decodeUnknownResult(ListNode)(node)._tag).toBe("Failure");
      expect(S.decodeUnknownResult(LexicalNode)(node)._tag).toBe("Failure");
      expect(S.decodeUnknownResult(SerializedEditorState)(state)._tag).toBe("Failure");
      expect(O.isNone(SerializedEditorState.decodeOption(state))).toBe(true);
      expect(S.decodeResult(EditorStateFromJson)(source)._tag).toBe("Failure");
      expect(Effect.runSyncExit(decodeEditorStateStrict(state))._tag).toBe("Failure");

      const compatibility = Effect.runSync(analyzeEditorStateCompatibility(state));
      expect(compatibility.isCompatible).toBe(false);
      expect(O.isNone(compatibility.state)).toBe(true);
      expect(compatibility.wire).toEqual(state);
      expect(compatibility.issues).toHaveLength(1);

      const wire = Effect.runSync(decodeEditorStateLossless(state));
      expect(wire).toEqual(state);
      expect(Effect.runSync(S.encodeEffect(SerializedEditorStateWire)(wire))).toEqual(state);
      expect(Effect.runSync(S.decodeEffect(EditorStateWireFromJson)(source))).toEqual(state);
    });
  });

  it("generates only runtime-canonical list metadata", () =>
    fc.assert(
      fc.property(ListNodeArbitrary, (node) => {
        const expectedTag = ListType.$match(node.listType, {
          number: ListTag.thunk.ol,
          bullet: ListTag.thunk.ul,
          check: ListTag.thunk.ul,
        });

        expect(node.tag).toBe(expectedTag);
      }),
      fcRuns(100)
    ));

  it("keeps canonical list metadata fixed through the real Lexical runtime", () => {
    const editor = createEditor({
      namespace: "lexical-schema-list-fixed-point",
      nodes: [RuntimeListNode, RuntimeListItemNode],
    });
    const canonical: ReadonlyArray<readonly [ListType, ListTag]> = [
      ["number", "ol"],
      ["bullet", "ul"],
      ["check", "ul"],
    ];

    A.forEach(canonical, ([listType, tag]) => {
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

      const strict = Effect.runSync(decodeEditorStateStrict(state));
      const source = Effect.runSync(S.encodeEffect(EditorStateFromJson)(strict));

      expect(editor.parseEditorState(source).toJSON().root.children[0]).toMatchObject({ listType, tag });
    });
  });

  it("enforces the strict v1 child grammar on the established semantic schema", () => {
    const misplacedText = {
      root: {
        ...element,
        type: "root",
        children: [text("not a block")],
      },
    };

    const misplacedRoot = S.decodeUnknownSync(RootNode)(misplacedText.root);
    expect(() => SerializedEditorState.make({ root: misplacedRoot })).toThrow();
    expect(() => S.decodeUnknownSync(SerializedEditorState)(misplacedText)).toThrow();
    expect(Effect.runSync(decodeEditorStateLossless(misplacedText))).toEqual(misplacedText);
    expect(Effect.runSyncExit(decodeEditorStateStrict(misplacedText))._tag).toBe("Failure");
  });

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
      const result = S.decodeUnknownResult(LexicalNode)(input);
      expect(Result.isSuccess(result)).toBe(true);
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
      (input) => expect(Result.isFailure(S.decodeUnknownResult(LexicalNode)(input))).toBe(true)
    );
  });

  it("preserves an empty root losslessly while reporting strict incompatibility", () => {
    const empty = {
      root: {
        ...element,
        type: "root",
        children: [],
      },
    };

    expect(Effect.runSync(decodeEditorStateLossless(empty))).toEqual(empty);
    expect(Effect.runSyncExit(decodeEditorStateStrict(empty))._tag).toBe("Failure");

    const compatibility = Effect.runSync(analyzeEditorStateCompatibility(empty));
    expect(compatibility.wire).toEqual(empty);
    expect(O.isNone(compatibility.state)).toBe(true);
    expect(compatibility.issues).toHaveLength(1);
  });

  it("rejects impossible serialized formatting and structural values", () => {
    const boldUnderline = S.decodeSync(TextFormatMask)(TextFormatBits.bold | TextFormatBits.underline);
    expect(hasTextFormat(boldUnderline, TextFormatBits.bold)).toBe(true);
    expect(hasTextFormat(boldUnderline, TextFormatBits.underline)).toBe(true);

    expect(() => S.decodeSync(LexicalNode)({ ...text("bad format"), format: 1 << 11 })).toThrow();
    expect(() => S.decodeSync(LexicalNode)({ ...text("bad detail"), detail: 1 << 2 })).toThrow();
    expect(() =>
      S.decodeSync(LexicalNode)({
        ...element,
        type: "list",
        listType: "number",
        start: -1,
        tag: "ol",
        children: [],
      })
    ).toThrow();
    expect(() =>
      S.decodeUnknownSync(LexicalNode)({
        ...element,
        type: "tablecell",
        headerState: 4,
        children: [],
      })
    ).toThrow();
  });

  it("normalizes legacy serialized list starts and rejects corrupt item zeros", () => {
    const list = S.decodeSync(LexicalNode)({
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
    });

    expect(list).toMatchObject({
      start: 1,
      children: [{ value: 1 }],
    });
    expect(S.encodeSync(LexicalNode)(list)).toMatchObject({
      start: 1,
      children: [{ value: 1 }],
    });

    expect(() =>
      S.decodeSync(LexicalNode)({
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
      })
    ).toThrow();
  });

  it("normalizes compatible legacy decorator and code metadata", () => {
    expect(legacyYouTubeVideoId("https://www.youtube.com/watch?v=AbCdEfGhI12")).toBe("AbCdEfGhI12");
    expect(legacyYouTubeVideoId("https://youtube.com/embed/AbCdEfGhI12")).toBe("AbCdEfGhI12");

    expect(
      S.decodeSync(LexicalNode)({
        type: "youtube",
        version: 1,
        videoID: "https://youtu.be/M7lc1UVf-VE",
        format: "",
      })
    ).toMatchObject({ videoID: "M7lc1UVf-VE" });
    expect(
      S.decodeSync(LexicalNode)({
        ...element,
        type: "code",
        language: "ts bad",
        children: [],
      })
    ).toMatchObject({ language: O.none() });

    expect(() =>
      S.decodeSync(LexicalNode)({
        type: "youtube",
        version: 1,
        videoID: "https://youtu.be/not-valid",
        format: "",
      })
    ).toThrow();
    expect(() => S.decodeSync(LexicalNode)({ type: "artifact-ref", version: 1, artifactId: "bad id" })).toThrow();
  });

  it("rejects nodes outside the v1 union", () => {
    expect(() => S.decodeUnknownSync(LexicalNode)({ type: "mermaid", version: 1, source: "flowchart TD" })).toThrow();
  });

  it("projects plain text", () => {
    const state = S.decodeUnknownSync(SerializedEditorState)(fixture);
    const plain = editorStateToPlainText(state);
    expect(plain).toContain("Plan");
    expect(plain).toContain("See the docs");
    expect(plain).toContain('console.log("beep")');
    expect(plain).toContain("https://www.youtube.com/watch?v=M7lc1UVf-VE");
    expect(plain).toContain("Name");
    expect(plain).toContain("Language");
    expect(plain).toContain("[artifact:artifact-123]");

    const node = S.decodeSync(LexicalNode)({ type: "linebreak", version: 1 });
    expect(nodeToPlainText(node)).toBe("\n");
    expect(
      nodeToPlainText(
        S.decodeSync(LexicalNode)({
          type: "tab",
          version: 1,
          detail: 2,
          format: 0,
          mode: "normal",
          style: "",
          text: "\t",
        })
      )
    ).toBe("\t");
  });
});
