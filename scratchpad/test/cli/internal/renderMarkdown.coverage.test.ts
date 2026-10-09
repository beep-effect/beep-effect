import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Doc } from "../../../effected/cli/Doc.ts";
import { Status } from "../../../effected/cli/Status.ts";
import { Render } from "../../../effected/cli/Render.ts";
import { renderMarkdown } from "../../../effected/cli/internal/renderMarkdown.ts";
const ctx = Render.contextOf({ audience: "agent" });
describe("renderMarkdown boundary branches", () => {
  it.effect("keeps empty fenced bodies, callouts and empty list items", () => Effect.sync(() => {
    assert.strictEqual(renderMarkdown([Doc.codeBlock("")], ctx), "```\n```");
    assert.strictEqual(renderMarkdown([Doc.verbatim("")], ctx), "```\n```");
    assert.strictEqual(renderMarkdown([Doc.diffText("")], ctx), "```diff\n```");
    assert.strictEqual(renderMarkdown([Doc.callout("note", [])], ctx), "> [!NOTE]");
    assert.strictEqual(renderMarkdown([Doc.list([Doc.table([], [])])], ctx), "-");
    assert.strictEqual(renderMarkdown([Doc.lines([[], []])], ctx), "");
    assert.strictEqual(renderMarkdown([Doc.tree({ label: "", children: [{ label: "" }] })], ctx), "-");
  }));
  it.effect("counts with no counters omit a table and retain metadata", () => Effect.sync(() => {
    for (const layout of ["row", "columns", "inline"] as const) {
      assert.strictEqual(renderMarkdown([Doc.counts({ counters: [], layout })], ctx), "");
      assert.include(renderMarkdown([Doc.counts({ counters: [], layout, label: "Jobs", qualifier: "done", suffix: "today", durationMs: 1000 })], ctx), "Jobs");
    }
  }));
  it.effect("keeps code span padding, emphasis whitespace and compact empty sections", () => Effect.sync(() => {
    assert.strictEqual(renderMarkdown([Doc.paragraph(Doc.code(""))], ctx), "");
    assert.strictEqual(renderMarkdown([Doc.paragraph(Doc.strong(" "))], ctx), "");
    assert.strictEqual(renderMarkdown([Doc.list([Doc.section(undefined, [Doc.table([], []), Doc.paragraph("a"), Doc.paragraph("b")])], { compact: true })], ctx), "- a\\\n  b");
    assert.strictEqual(renderMarkdown([Doc.table([{ header: "" }], [["\n x\n "]])], ctx), "| |\n| --- |\n| x |");
  }));
  it.effect("relative files use suffixes; unsafe repository bases and paths do not form links", () => Effect.sync(() => {
    assert.strictEqual(renderMarkdown([Doc.paragraph(Doc.link({ file: "relative.ts" }, "file"))], ctx), "file (`relative.ts`)");
    assert.strictEqual(renderMarkdown([Doc.paragraph(Doc.link({ file: "relative.ts" }, "file", { suffix: false }))], ctx), "file");
    for (const file of ["/absolute.ts", "C:/drive.ts", "../outside.ts"]) {
      assert.notInclude(renderMarkdown([Doc.paragraph(Doc.link({ file }, "file"))], { ...ctx, linkBase: "https://example.com/" }), "](https:");
    }
    assert.strictEqual(renderMarkdown([Doc.paragraph(Doc.link({ file: "x.ts" }, "file"))], { ...ctx, linkBase: "javascript:" }), "file (`x.ts`)");
    assert.strictEqual(renderMarkdown([Doc.paragraph(Doc.link({ file: "x.ts" }, "file"))], { ...ctx, linkBase: "https://example.com/" }), "[file](https://example.com/x.ts)");
  }));
});

it.effect("an empty file display target has a padded empty code suffix", () => Effect.sync(() => {
  assert.strictEqual(renderMarkdown([Doc.paragraph(Doc.link({ file: "" }, "file"))], ctx), "file (`   `)");
  assert.strictEqual(renderMarkdown([Doc.table([{ header: "A" }], [[Doc.link({ file: "" }, "file")]])], ctx), "| A |\n| --- |\n| file (`   `) |");
}));

it.effect("row counts without shares keep raw counts and suppress absent metadata", () => Effect.sync(() => {
  const counter = Doc.counter(Status.core, "success", { key: "ok", label: "checks", n: 2 });
  assert.strictEqual(renderMarkdown([Doc.counts({ counters: [counter], layout: "row", share: false })], ctx), "| checks |\n| --- |\n| 2 |");
  assert.strictEqual(renderMarkdown([Doc.counts({ counters: [counter], layout: "inline", share: false })], ctx), "2 checks");
  assert.strictEqual(renderMarkdown([Doc.paragraph(Doc.link({ file: "//server/share/x" }, "file"))], ctx), "file (`//server/share/x`)");
}));

it.effect("non-paragraph callouts separate the alert from its body and line blocks trim trailing empty entries", () => Effect.sync(() => {
  assert.strictEqual(renderMarkdown([Doc.callout("note", [Doc.heading(2, "Title")])], ctx), "> [!NOTE]\n>\n> ## Title");
  assert.strictEqual(renderMarkdown([Doc.lines([[Doc.text("kept")], []])], ctx), "kept");
  assert.strictEqual(renderMarkdown([Doc.diffText("+a\n-b", { cap: 1 })], ctx), `\`\`\`diff\n+a\n${ctx.glyphs.ellipsis} 1 more lines\n\`\`\``);
}));
