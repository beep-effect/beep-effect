import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ListItem, Paragraph, Root, TableCell, TableRow } from "../../../effected/markdown/MarkdownNode.ts";
import { flowChildren, listItemChildren, makeBlockNode, tableCellChildren, tableRowChildren } from "../../../effected/markdown/internal/blockTypes.ts";
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
