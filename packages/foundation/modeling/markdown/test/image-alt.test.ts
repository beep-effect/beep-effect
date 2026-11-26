import { Markdown } from "@beep/markdown/Markdown";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import { childOfType } from "./support/tree.ts";

const descriptions = [
  { name: "backslash hard break", source: "a\\\nb", alt: "a\nb" },
  { name: "two-space hard break", source: "a  \nb", alt: "a\nb" },
  { name: "raw tags", source: "a <b>c</b>", alt: "a <b>c</b>" },
  { name: "unclosed raw tag", source: "a <b>c", alt: "a <b>c" },
  { name: "raw comment", source: "a <!-- note -->c", alt: "a <!-- note -->c" },
];

type Dialect = "commonmark" | "gfm";

const onlyInline = (markdown: string, dialect: Dialect) => {
  const result = Markdown.parseResult(markdown, { dialect });
  assertSuccess(
    Result.map(result, () => undefined),
    undefined
  );
  const paragraph = childOfType(Result.getOrThrow(result).children, 0, "paragraph");
  assert.strictEqual(paragraph.children.length, 1);
  return paragraph.children;
};

const cases = A.flatMap(["commonmark", "gfm"] as const, (dialect) =>
  A.flatMap(descriptions, (description) => [
    { ...description, dialect, reference: false },
    { ...description, dialect, reference: true },
  ])
);

describe("image alt keeps leaf HTML and hard breaks, a regression for the upstream flattening bug", () => {
  for (const { name, source, alt, dialect, reference } of cases) {
    if (reference) {
      it(`${dialect}: ${name} in a reference image`, () => {
        const image = childOfType(onlyInline(`![${source}][ref]\n\n[ref]: /u\n`, dialect), 0, "imageReference");
        assert.strictEqual(image.alt, alt);
        assert.strictEqual(image.identifier, "ref");
        assert.strictEqual(image.referenceType, "full");
      });
    } else {
      it(`${dialect}: ${name} in an inline image`, () => {
        assert.strictEqual(childOfType(onlyInline(`![${source}](/u)`, dialect), 0, "image").alt, alt);
      });
    }
  }
});
