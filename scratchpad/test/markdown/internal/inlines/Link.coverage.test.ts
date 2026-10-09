import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { parsePhrasingText } from "../../../../effected/markdown/internal/phrasing.ts";
import { Markdown } from "../../../../effected/markdown/Markdown.ts";

describe("link and image formation", () => {
  it.effect("flattens image children left to right including nested images, HTML, code and hard breaks", () => Effect.sync(() => {
    const [image] = parsePhrasingText("![*a* **b** `c` <i> ![d](d)  \ne](img)", "commonmark");
    if (image?.type !== "image") assert.fail("expected image");
    assert.strictEqual(image.alt, "a b c <i> d\ne");
    assert.strictEqual(image.url, "img");
    assert.strictEqual(image.position.start.offset, 0);
    assert.strictEqual(image.position.end.offset, 37);
  }));
  it.effect("keeps decoded destinations, optional titles and empty image alt text", () => Effect.sync(() => {
    const [link] = parsePhrasingText('[a](<path&amp;more> "a &amp; b")', "commonmark");
    if (link?.type !== "link") assert.fail("expected link");
    assert.strictEqual(link.url, "path&more");
    assert.strictEqual(link.title, "a & b");
    const [image] = parsePhrasingText("![]()", "commonmark");
    if (image?.type !== "image") assert.fail("expected image");
    assert.strictEqual(image.url, "");
    assert.strictEqual(image.alt, undefined);
  }));
  it.effect("retains reference labels and flattens a nested reference image into its parent's alt", () => Effect.gen(function* () {
    const root = yield* Markdown.parse("![![inner][ref]][ref]\n\n[ref]: /u\n");
    const paragraph = root.children[0];
    if (paragraph?.type !== "paragraph") assert.fail("expected paragraph");
    const [image] = paragraph.children;
    if (image?.type !== "imageReference") assert.fail("expected image reference");
    assert.strictEqual(image.alt, "inner");
    assert.strictEqual(image.identifier, "ref");
    assert.strictEqual(image.label, "ref");
    assert.strictEqual(image.referenceType, "full");
  }));
});
