import {
  analyzeEditorStateCompatibility,
  decodeEditorStateLossless,
  decodeEditorStateStrict,
  EditorStateFromJson,
  editorStateToPlainText,
  hasTextFormat,
  LexicalNode,
  LinkNode,
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
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { SerializedTableCellNode } from "@lexical/table";

const NodeArbitrary = S.toArbitrary(LexicalNode);
const SafeUrlArbitrary = S.toArbitrary(SafeUrl);
const StateArbitrary = S.toArbitrary(SerializedEditorState);
const WireStateArbitrary = S.toArbitrary(SerializedEditorStateWire);

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
        videoID: "dQw4w9WgXcQ",
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

describe("Lexical.model", () => {
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
    expect(state.root.children[4]).toMatchObject({ videoID: "dQw4w9WgXcQ", format: "" });
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
    const state = S.decodeUnknownSync(EditorStateFromJson)(json);
    expect(JSON.parse(S.encodeSync(EditorStateFromJson)(state))).toEqual(fixture);
  });

  it("round-trips schema-derived arbitrary nodes and states through encode/decode", () => {
    fc.assert(
      fc.property(NodeArbitrary, StateArbitrary, (node, state) => {
        expect(LexicalNode.fromUnknown(S.encodeSync(LexicalNode)(node))).toEqual(node);
        expect(S.decodeUnknownSync(SerializedEditorState)(S.encodeSync(SerializedEditorState)(state))).toEqual(state);
        expect(SerializedEditorState.decodeOption(S.encodeSync(SerializedEditorState)(state))).toEqual(O.some(state));
      }),
      fcRuns(50)
    );
  });

  it("sanitizes link URLs at the schema boundary and keeps safe URLs fixed", () => {
    expect(S.decodeUnknownSync(SafeUrl)("javascript:alert(1)")).toBe("#");
    expect(S.decodeUnknownSync(SafeUrl)("file:///tmp/beep.txt")).toBe("#");
    expect(S.decodeUnknownSync(SafeUrl)("/\n/evil.example/path")).toBe("#");
    expect(S.decodeUnknownSync(SafeUrl)("/\r/evil.example/path")).toBe("#");
    expect(S.decodeUnknownSync(SafeUrl)("/\t/evil.example/path")).toBe("#");
    expect(S.decodeUnknownSync(SafeUrl)("https://example.com/docs")).toBe("https://example.com/docs");
    expect(S.decodeUnknownSync(SafeUrl)("docs/page")).toBe("docs/page");
    expect(S.encodeSync(SafeUrl)(S.decodeUnknownSync(SafeUrl)("data:text/html,<script>x</script>"))).toBe("#");

    fc.assert(
      fc.property(SafeUrlArbitrary, (url) => {
        expect(sanitizeUrl(url)).toBe(url);
        expect(S.decodeUnknownSync(SafeUrl)(S.encodeSync(SafeUrl)(url))).toBe(url);
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
    const boldUnderline = S.decodeUnknownSync(TextFormatMask)(TextFormatBits.bold | TextFormatBits.underline);
    expect(hasTextFormat(boldUnderline, TextFormatBits.bold)).toBe(true);
    expect(hasTextFormat(boldUnderline, TextFormatBits.underline)).toBe(true);

    expect(() => S.decodeUnknownSync(LexicalNode)({ ...text("bad format"), format: 1 << 11 })).toThrow();
    expect(() => S.decodeUnknownSync(LexicalNode)({ ...text("bad detail"), detail: 1 << 2 })).toThrow();
    expect(() =>
      S.decodeUnknownSync(LexicalNode)({
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
    const list = S.decodeUnknownSync(LexicalNode)({
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
      S.decodeUnknownSync(LexicalNode)({
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
      S.decodeUnknownSync(LexicalNode)({
        type: "youtube",
        version: 1,
        videoID: "https://youtu.be/dQw4w9WgXcQ",
        format: "",
      })
    ).toMatchObject({ videoID: "dQw4w9WgXcQ" });
    expect(
      S.decodeUnknownSync(LexicalNode)({
        ...element,
        type: "code",
        language: "ts bad",
        children: [],
      })
    ).toMatchObject({ language: O.none() });

    expect(() =>
      S.decodeUnknownSync(LexicalNode)({
        type: "youtube",
        version: 1,
        videoID: "https://youtu.be/not-valid",
        format: "",
      })
    ).toThrow();
    expect(() =>
      S.decodeUnknownSync(LexicalNode)({ type: "artifact-ref", version: 1, artifactId: "bad id" })
    ).toThrow();
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
    expect(plain).toContain("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(plain).toContain("Name");
    expect(plain).toContain("Language");
    expect(plain).toContain("[artifact:artifact-123]");

    const node = S.decodeUnknownSync(LexicalNode)({ type: "linebreak", version: 1 });
    expect(nodeToPlainText(node)).toBe("\n");
    expect(
      nodeToPlainText(
        S.decodeUnknownSync(LexicalNode)({
          type: "tab",
          version: 1,
          detail: 0,
          format: 0,
          mode: "normal",
          style: "",
          text: "\t",
        })
      )
    ).toBe("\t");
  });
});
