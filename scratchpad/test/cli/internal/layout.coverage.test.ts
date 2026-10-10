import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Render } from "../../../effected/cli/Render.ts";
import { flatten, truncateSpans, wrapSpans, paintSpans } from "../../../effected/cli/internal/layout.ts";

it.effect("numeric edge widths and forced line endings preserve layout progress", () => Effect.sync(() => {
  assert.deepStrictEqual(truncateSpans([{ text: "abc" }], Number.NaN, "…"), []);
  assert.deepStrictEqual(wrapSpans([{ text: "ab" }], Number.NaN), [[{ text: "a" }], [{ text: "b" }]]);
  assert.deepStrictEqual(wrapSpans([{ text: "a\rb\r\nc\n d" }], 10), [[{ text: "a" }], [{ text: "b" }], [{ text: "c" }], [{ text: " d" }]]);
  assert.deepStrictEqual(wrapSpans([{ text: "abc def" }], 2, { hardBreak: false }), [[{ text: "abc" }], [{ text: "def" }]]);
  assert.deepStrictEqual(wrapSpans([{ text: "abc def" }], 2), [[{ text: "ab" }], [{ text: "c" }], [{ text: "de" }], [{ text: "f" }]]);
  assert.deepStrictEqual(wrapSpans([{ text: "a\n" }], 10), [[{ text: "a" }]]);
  assert.deepStrictEqual(wrapSpans([{ text: "a   " }], 10), [[{ text: "a" }]]);
  const ctx = Render.contextOf({ audience: "human", color: "none" });
  assert.deepStrictEqual(flatten([{ _tag: "Link", target: { file: "a\nb" }, label: [{ _tag: "Text", value: "x" }], suffix: false }], ctx), [{ text: "x", link: { file: "ab" }, suffix: false }]);
  assert.strictEqual(paintSpans([{ text: "a", strong: true, em: true }, { text: "b", link: { url: "/b" } }], ctx), "ab");
}));
