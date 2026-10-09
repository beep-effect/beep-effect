import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Doc } from "../../../effected/cli/Doc.ts";
import { Render } from "../../../effected/cli/Render.ts";
import { capOf, textLines, trimLine } from "../../../effected/cli/internal/renderDoc.ts";
import { renderPlain } from "../../../effected/cli/internal/renderPlain.ts";

const ctx = Render.contextOf({ audience: "agent", width: 80 });
describe("renderDoc branch boundaries", () => {
  it.effect("keeps held whitespace, drops empty spans and normalizes raw line endings and caps", () => Effect.sync(() => {
    assert.deepStrictEqual(trimLine([{ text: "x " }, { text: " " }]), [{ text: "x" }]);
    assert.deepStrictEqual(trimLine([{ text: "  ", hold: true }]), [{ text: "  ", hold: true }]);
    assert.deepStrictEqual(textLines("x\r\ny\r"), ["x", "y"]);
    assert.strictEqual(capOf(Number.NaN), undefined);
    assert.strictEqual(capOf(-1), 0);
  }));
  it.effect("renders empty lines and lists whose items draw nothing", () => Effect.sync(() => {
    assert.strictEqual(renderPlain([Doc.list([Doc.table([], [])])], ctx), "-");
    assert.strictEqual(renderPlain([Doc.line([])], ctx), "");
    assert.strictEqual(renderPlain([Doc.lines([[], [Doc.text("x")]])], ctx), "\nx");
    assert.strictEqual(renderPlain([Doc.paragraph("x")], { ...ctx, width: Number.NaN }), "x");
  }));
  it.effect("cuts cells across span boundaries and aligns pipe rows", () => Effect.sync(() => {
    const table = Doc.table([{ header: "A", align: "center" }, { header: "B", align: "right" }], [[[Doc.text("x"), Doc.text("yz\nnext")], "12345"]], { style: "pipe" });
    const output = renderPlain([table], { ...ctx, width: 5 });
    assert.include(output, "|");
    assert.include(output, ctx.glyphs.ellipsis);
    assert.notInclude(output, "next");
    assert.strictEqual(renderPlain([Doc.table([{ header: "A" }], [["\r\n"]])], ctx), "A\n-\n");
  }));
});

it.effect("headerless pipe tables still draw boundaries and report capped rows", () => Effect.sync(() => {
  const table = Doc.table([{ header: [] }], [["a"], ["b"]], { style: "pipe", cap: 1 });
  assert.strictEqual(renderPlain([table], ctx), `--\na\n--\n${ctx.glyphs.ellipsis} 1 more`);
  assert.strictEqual(renderPlain([Doc.counts({ layout: "columns", counters: [], suffix: "done" })], ctx), "done");
}));
