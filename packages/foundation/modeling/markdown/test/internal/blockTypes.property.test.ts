import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  BlockContinueResult,
  BlockData,
  BlockNode,
  BlockStartResult,
  BlockType,
  containsFlow,
  containsNothing,
  DefinitionData,
  FootnoteData,
  flowChildren,
  ListData,
  ListType,
  listItemChildren,
  makeBlockNode,
  PreparedInline,
  RawInlineSegment,
  RawInlineSlice,
  TableData,
  tableCellChildren,
  tableRowChildren,
} from "@beep/markdown/internal/blockTypes";
import { Heading, ListItem, Paragraph, Root, TableCell, TableRow, Text } from "@beep/markdown/MarkdownNode";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { MaterializedBlock } from "@beep/markdown/internal/blockTypes";

const runs = { arbitrary: fcRuns(100) };
const Tags = S.Array(S.Literals(["root", "paragraph", "listItem", "tableRow", "tableCell"]));
const construct = (tag: (typeof Tags.Type)[number]): MaterializedBlock => {
  switch (tag) {
    case "root":
      return Root.make({ children: [] });
    case "paragraph":
      return Paragraph.make({ children: [] });
    case "listItem":
      return ListItem.make({ children: [] });
    case "tableRow":
      return TableRow.make({ children: [] });
    case "tableCell":
      return TableCell.make({ children: [] });
  }
};

describe("blockTypes properties", () => {
  it.effect.prop(
    "child selectors retain order and identity and are idempotent",
    [Arbitrary.schema(Tags)],
    ([tags]) =>
      Effect.sync(() => {
        const children = A.map(tags, construct);
        const selectors: ReadonlyArray<
          readonly [(nodes: ReadonlyArray<MaterializedBlock>) => ReadonlyArray<MaterializedBlock>, string]
        > = [
          [flowChildren, "paragraph"],
          [listItemChildren, "listItem"],
          [tableRowChildren, "tableRow"],
          [tableCellChildren, "tableCell"],
        ];
        for (const [select, type] of selectors) {
          const selected = select(children);
          assert.deepStrictEqual(
            selected,
            A.filter(children, (child) => child.type === type)
          );
          assert.deepStrictEqual(select(selected), selected);
          for (const child of selected) assert.isTrue(A.contains(children, child));
        }
        assert.deepStrictEqual(
          A.map(children, (child) => child.type),
          [...tags]
        );
      }),
    runs
  );
  it.effect.prop(
    "both constructor forms preserve position and allocate isolated mutable carriers",
    [Arbitrary.schema(S.Struct({ offset: S.Int, line: S.Int, depth: S.Int }))],
    ([value]) =>
      Effect.sync(() => {
        const direct = makeBlockNode("paragraph", value.offset, value.line, value.depth);
        const curried = makeBlockNode(value.offset, value.line, value.depth)("paragraph");
        assert.deepStrictEqual(curried, direct);
        assert.strictEqual(direct.startOffset, value.offset);
        assert.strictEqual(direct.endOffset, value.offset);
        assert.strictEqual(direct.startLine, value.line);
        assert.strictEqual(direct.depth, value.depth);
        assert.isTrue(direct instanceof BlockNode);
        assert.isTrue(direct.open);
        assert.strictEqual(direct.parent, undefined);
        direct.children.push(makeBlockNode("heading", 0, 1));
        direct.data.level = 2;
        assert.deepStrictEqual(curried.children, []);
        assert.strictEqual(curried.data.level, undefined);
      }),
    runs
  );
});

it.effect.prop(
  "RawInlineSegment decodes finite plain source runs",
  [Arbitrary.schema(RawInlineSegment)],
  ([segment]) =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeEffect(RawInlineSegment)(segment);
      assert.deepStrictEqual(decoded, segment);
      assert.isFalse("_tag" in decoded);
    }),
  runs
);

it("source-run and block-kind schemas reject invalid domain values", () => {
  const valid = { textOffset: 1.5, sourceOffset: -2, length: 0 };
  assert.isTrue(S.is(RawInlineSegment)(valid));
  for (const field of ["textOffset", "sourceOffset", "length"] as const) {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "1", undefined]) {
      assert.isFalse(S.is(RawInlineSegment)({ ...valid, [field]: value }));
    }
  }
  for (const type of BlockType.literals) assert.isTrue(S.is(BlockType)(type));
  assert.isFalse(S.is(BlockType)("root"));
});

it.effect.prop(
  "inline engine records carry the prepared text to every inline host",
  [
    Arbitrary.schema(
      S.Struct({
        text: S.String,
        startOffset: S.Finite,
        endOffset: S.Finite,
        segments: S.Array(RawInlineSegment),
      })
    ),
  ],
  ([source]) =>
    Effect.sync(() => {
      const children = [Text.make({ value: source.text })];
      const prepared = new PreparedInline(source.text, source.startOffset, source.endOffset, source.segments, children);
      assert.deepStrictEqual({ ...prepared }, { ...source, children });
      for (const parent of [
        Paragraph.make({ children }),
        Heading.make({ depth: 2, children }),
        TableCell.make({ children }),
      ]) {
        const slice = new RawInlineSlice(parent, prepared);
        assert.strictEqual(slice.parent, parent);
        assert.strictEqual(slice.text, source.text);
        assert.strictEqual(slice.startOffset, source.startOffset);
        assert.strictEqual(slice.segments, source.segments);
        assert.isFalse("endOffset" in slice);
      }
    }),
  runs
);

it.effect.prop(
  "definition payload schema round-trips the exact optional title key",
  [Arbitrary.schema(DefinitionData)],
  ([definition]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(DefinitionData)(definition);
      const decoded = yield* S.decodeEffect(DefinitionData)(encoded);
      assert.deepStrictEqual(decoded, definition);
      assert.strictEqual("title" in decoded, "title" in definition);
      assert.isFalse("_tag" in decoded);
    }),
  runs
);

it.effect.prop(
  "footnote payload schema round-trips normalized and raw labels",
  [Arbitrary.schema(FootnoteData)],
  ([footnote]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(FootnoteData)(footnote);
      const decoded = yield* S.decodeEffect(FootnoteData)(encoded);
      assert.deepStrictEqual(decoded, footnote);
      assert.isFalse("_tag" in decoded);
    }),
  runs
);

it("payload schemas retain required fields and verdict schemas retain numeric codes", () => {
  const definition = { key: "ref", identifier: "ref", label: "Ref", url: "/target" };
  const footnote = { key: "note", identifier: "note", label: "Note" };
  assert.isTrue(S.is(DefinitionData)(definition));
  assert.isTrue(S.is(DefinitionData)({ ...definition, title: "" }));
  assert.isTrue(S.is(FootnoteData)(footnote));
  assert.isFalse(S.is(DefinitionData)({ ...definition, title: undefined }));
  assert.isFalse(S.is(DefinitionData)({ key: "ref", identifier: "ref", label: "Ref" }));
  assert.isFalse(S.is(FootnoteData)({ key: "note", identifier: "note" }));
  assert.strictEqual(DefinitionData.make(definition).url, "/target");
  for (const verdict of [BlockContinueResult, BlockStartResult]) {
    assert.deepStrictEqual(verdict.literals, [0, 1, 2]);
    for (const code of [0, 1, 2]) assert.isTrue(S.is(verdict)(code));
    for (const code of [-1, 3, "0", undefined]) assert.isFalse(S.is(verdict)(code));
  }
});

it("mutable engine records start from their documented defaults", () => {
  const list = new ListData("ordered", 2);
  assert.deepStrictEqual(
    [list.type, list.markerOffset, list.padding, list.tight, "start" in list, "bulletChar" in list],
    ["ordered", 2, 0, true, false, false]
  );
  assert.deepStrictEqual(ListType.literals, ["bullet", "ordered"]);
  const table = new TableData(["left", null], 2);
  assert.deepStrictEqual([table.align, table.columns, table.rows, table.nonemptyCells], [["left", null], 2, 0, 0]);
  const data = new BlockData();
  assert.isFalse("lang" in data, "declared, not initialized: an unset field is absent, not undefined");
  assert.isFalse("listData" in data);
  data.lang = "ts";
  assert.isTrue("lang" in data);
  assert.isFalse(containsNothing("paragraph"));
  assert.isTrue(containsFlow("paragraph"));
  assert.isFalse(containsFlow("listItem"));
});
