import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Heading, ListItem, Paragraph, Root, TableCell, TableRow, Text } from "../../../effected/markdown/MarkdownNode.ts";
import { BlockContinueResult, BlockStartResult, BlockType, DefinitionData, FootnoteData, PreparedInline, RawInlineSegment, RawInlineSlice, flowChildren, listItemChildren, makeBlockNode, tableCellChildren, tableRowChildren } from "../../../effected/markdown/internal/blockTypes.ts";
import type { MaterializedBlock } from "../../../effected/markdown/internal/blockTypes.ts";

const runs = { arbitrary: fcRuns(100) };
const Tags = S.Array(S.Literals(["root", "paragraph", "listItem", "tableRow", "tableCell"]));
const construct = (tag: typeof Tags.Type[number]): MaterializedBlock => {
  switch (tag) {
    case "root": return Root.make({ children: [] });
    case "paragraph": return Paragraph.make({ children: [] });
    case "listItem": return ListItem.make({ children: [] });
    case "tableRow": return TableRow.make({ children: [] });
    case "tableCell": return TableCell.make({ children: [] });
  }
};

describe("blockTypes properties", () => {
  it.effect.prop("child selectors retain order and identity and are idempotent", [Arbitrary.schema(Tags)], ([tags]) => Effect.sync(() => {
    const children = tags.map(construct);
    const selectors: ReadonlyArray<readonly [(nodes: ReadonlyArray<MaterializedBlock>) => ReadonlyArray<MaterializedBlock>, string]> = [[flowChildren, "paragraph"], [listItemChildren, "listItem"], [tableRowChildren, "tableRow"], [tableCellChildren, "tableCell"]];
    for (const [select, type] of selectors) {
      const selected = select(children);
      assert.deepStrictEqual(selected, children.filter((child) => child.type === type));
      assert.deepStrictEqual(select(selected), selected);
      for (const child of selected) assert.ok(children.includes(child));
    }
    assert.deepStrictEqual(children.map((child) => child.type), [...tags]);
  }), runs);
  it.effect.prop("both constructor forms preserve position and allocate isolated mutable carriers", [Arbitrary.schema(S.Struct({ offset: S.Int, line: S.Int, depth: S.Int }))], ([value]) => Effect.sync(() => {
    const direct = makeBlockNode("paragraph", value.offset, value.line, value.depth);
    const curried = makeBlockNode(value.offset, value.line, value.depth)("paragraph");
    assert.deepStrictEqual(curried, direct);
    assert.strictEqual(direct.startOffset, value.offset);
    assert.strictEqual(direct.endOffset, value.offset);
    assert.strictEqual(direct.startLine, value.line);
    assert.strictEqual(direct.depth, value.depth);
    direct.children.push(makeBlockNode("heading", 0, 1));
    assert.deepStrictEqual(curried.children, []);
  }), runs);
});


it.effect.prop("RawInlineSegment decodes finite plain source runs", [Arbitrary.schema(RawInlineSegment)], ([segment]) => Effect.gen(function* () {
  const decoded = yield* S.decodeEffect(RawInlineSegment)(segment);
  assert.deepStrictEqual(decoded, segment);
  assert.isFalse("_tag" in decoded);
}), runs);

it("source-run and block-kind schemas reject invalid domain values", () => {
  const valid = { textOffset: 1.5, sourceOffset: -2, length: 0 };
  assert.isTrue(S.is(RawInlineSegment)(valid));
  for (const field of ["textOffset", "sourceOffset", "length"] as const) {
    for (const value of [NaN, Infinity, -Infinity, "1", undefined]) {
      assert.isFalse(S.is(RawInlineSegment)({ ...valid, [field]: value }));
    }
  }
  for (const type of BlockType.literals) assert.isTrue(S.is(BlockType)(type));
  assert.isFalse(S.is(BlockType)("root"));
});

it.effect.prop("inline payload schemas round-trip plain records for every inline host", [Arbitrary.schema(S.Struct({
  text: S.String,
  startOffset: S.Finite,
  endOffset: S.Finite,
  segments: S.Array(RawInlineSegment),
}))], ([source]) => Effect.gen(function* () {
  const children = [Text.make({ value: source.text })];
  const prepared = { ...source, children };
  assert.isTrue(S.is(PreparedInline)(prepared));
  const encodedPrepared = yield* S.encodeEffect(PreparedInline)(prepared);
  const decodedPrepared = yield* S.decodeEffect(PreparedInline)(encodedPrepared);
  assert.deepStrictEqual(decodedPrepared, prepared);
  assert.isFalse("_tag" in decodedPrepared);
  for (const parent of [Paragraph.make({ children }), Heading.make({ depth: 2, children }), TableCell.make({ children })]) {
    const slice = { parent, text: source.text, startOffset: source.startOffset, segments: source.segments };
    assert.isTrue(S.is(RawInlineSlice)(slice));
    const encodedSlice = yield* S.encodeEffect(RawInlineSlice)(slice);
    const decodedSlice = yield* S.decodeEffect(RawInlineSlice)(encodedSlice);
    assert.deepStrictEqual(decodedSlice, slice);
    assert.isFalse("_tag" in decodedSlice);
  }
}), runs);

it.effect.prop("definition payload schema round-trips the exact optional title key", [Arbitrary.schema(DefinitionData)], ([definition]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(DefinitionData)(definition);
  const decoded = yield* S.decodeEffect(DefinitionData)(encoded);
  assert.deepStrictEqual(decoded, definition);
  assert.strictEqual("title" in decoded, "title" in definition);
  assert.isFalse("_tag" in decoded);
}), runs);

it.effect.prop("footnote payload schema round-trips normalized and raw labels", [Arbitrary.schema(FootnoteData)], ([footnote]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(FootnoteData)(footnote);
  const decoded = yield* S.decodeEffect(FootnoteData)(encoded);
  assert.deepStrictEqual(decoded, footnote);
  assert.isFalse("_tag" in decoded);
}), runs);

it("payload schemas retain required fields and verdict schemas retain numeric codes", () => {
  const parent = Paragraph.make({ children: [] });
  const slice = { parent, text: "", startOffset: 0, segments: [] };
  const prepared = { text: "", startOffset: 0, endOffset: 0, segments: [], children: [] };
  const definition = { key: "ref", identifier: "ref", label: "Ref", url: "/target" };
  const footnote = { key: "note", identifier: "note", label: "Note" };
  assert.isTrue(S.is(RawInlineSlice)(slice));
  assert.isTrue(S.is(PreparedInline)(prepared));
  assert.isTrue(S.is(DefinitionData)(definition));
  assert.isTrue(S.is(DefinitionData)({ ...definition, title: "" }));
  assert.isTrue(S.is(FootnoteData)(footnote));
  assert.isFalse(S.is(DefinitionData)({ ...definition, title: undefined }));
  assert.isFalse(S.is(DefinitionData)({ key: "ref", identifier: "ref", label: "Ref" }));
  assert.isFalse(S.is(FootnoteData)({ key: "note", identifier: "note" }));
  assert.isFalse(S.is(RawInlineSlice)({ ...slice, parent: Root.make({ children: [] }) }));
  assert.isFalse(S.is(RawInlineSlice)({ parent, text: "", startOffset: 0 }));
  assert.isFalse(S.is(PreparedInline)({ text: "", startOffset: 0, segments: [], children: [] }));
  assert.isFalse(S.is(PreparedInline)({ ...prepared, children: [Root.make({ children: [] })] }));
  for (const verdict of [BlockContinueResult, BlockStartResult]) {
    assert.deepStrictEqual(verdict.literals, [0, 1, 2]);
    for (const code of [0, 1, 2]) assert.isTrue(S.is(verdict)(code));
    for (const code of [-1, 3, "0", undefined]) assert.isFalse(S.is(verdict)(code));
  }
});
