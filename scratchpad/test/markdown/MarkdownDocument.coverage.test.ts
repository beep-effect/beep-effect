import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import { MarkdownDocument } from "../../effected/markdown/MarkdownDocument.ts";
import { Break, Heading, Html, Image, ImageReference, MdxTextExpression, Root, Text } from "../../effected/markdown/MarkdownNode.ts";

describe("MarkdownDocument coverage", () => {
  it.effect("projects hard breaks, absent image alt, and MDX expressions into heading text", () => Effect.gen(function* () {
    const heading = Heading.make({ depth: 1, children: [Text.make({ value: "before" }), Break.make({}), Image.make({ url: "image" }), ImageReference.make({ identifier: "missing", referenceType: "shortcut", alt: "image" }), MdxTextExpression.make({ value: "ignored" }), Html.make({ value: "<span>" }), Text.make({ value: "after" })] });
    const doc = MarkdownDocument.make({ source: "", root: Root.make({ children: [heading] }), diagnostics: [], definitions: HashMap.empty(), definitionOrder: [] });
    assert.strictEqual(doc.headings[0]?.text, "before imageafter");
    assert.strictEqual(doc.sections[0]?.text, "before imageafter");
    const withoutAlt = ImageReference.make({ identifier: "missing", referenceType: "shortcut" });
    const other = MarkdownDocument.make({ ...doc, root: Root.make({ children: [Heading.make({ depth: 2, children: [withoutAlt] })] }) });
    assert.strictEqual(other.headings[0]?.text, "");
    assert.deepStrictEqual(other.links, [{ node: withoutAlt }]);
    yield* Effect.void;
  }));

  it.effect("selects the earliest boundary when a shallower heading follows a nearer peer", () => Effect.gen(function* () {
    const doc = yield* MarkdownDocument.parse("# A\n\n## B\n\n## C\n\n# D\n");
    assert.deepStrictEqual(doc.sections.map((section) => [section.text, section.body]), [["A", "\n\n## B\n\n## C\n\n"], ["B", "\n\n"], ["C", "\n\n"], ["D", "\n"]]);
  }));
});
