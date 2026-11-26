import { Markdown } from "@beep/markdown/Markdown";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownFormat } from "@beep/markdown/MarkdownFormat";
import { Heading, Paragraph, Point, Position, Root, Text } from "@beep/markdown/MarkdownNode";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const parseDoc = (text: string) => {
  const result = MarkdownDocument.parseResult(text);
  assertSuccess(result, Result.getOrThrow(result));
  return Result.getOrThrow(result);
};

describe("Position.synthetic", () => {
  it("is the zero-width sentinel: line 1, column 1, offset 0 at both ends", () => {
    assert(S.is(Position)(Position.synthetic));
    assert.deepStrictEqual(Position.synthetic.start, Point.make({ line: 1, column: 1, offset: 0 }));
    assert.deepStrictEqual(Position.synthetic.end, Point.make({ line: 1, column: 1, offset: 0 }));
  });
});

describe("make fills the synthetic position", () => {
  it("constructs a Text fragment in one line", () => {
    const text = Text.make({ value: "shipped" });
    assert(S.is(Text)(text));
    assert.strictEqual(text.value, "shipped");
    assert.deepStrictEqual(text.position, Position.synthetic);
    assert.notStrictEqual(
      text.position,
      Position.synthetic,
      "make validates and copies the default like any nested value: equal to the shared Position.synthetic, never the same object"
    );
  });

  it("constructs Paragraph and Heading fragments in one line", () => {
    const paragraph = Paragraph.make({ children: [Text.make({ value: "p" })] });
    assert.deepStrictEqual(paragraph.position, Position.synthetic);
    const heading = Heading.make({ depth: 2, children: [Text.make({ value: "t" })] });
    assert.strictEqual(heading.depth, 2);
    assert.deepStrictEqual(heading.position, Position.synthetic);
  });

  it("still honors an explicit position over the default", () => {
    const explicit = Position.make({
      start: Point.make({ line: 2, column: 3, offset: 9 }),
      end: Point.make({ line: 2, column: 8, offset: 14 }),
    });
    const text = Text.make({ value: "placed", position: explicit });
    assert.deepStrictEqual(text.position, explicit);
    assert.notDeepEqual(text.position, Position.synthetic, "the point of the test: the default did NOT win");
    assert.notStrictEqual(
      text.position,
      explicit,
      "make copies nested data: an explicit Position comes back deep-equal, never the same object"
    );
  });
});

describe("synthesized trees flow through the render surfaces", () => {
  it("stringifies a fully synthesized tree canonically", () => {
    const root = Root.make({
      children: [
        Heading.make({ depth: 2, children: [Text.make({ value: "Title" })] }),
        Paragraph.make({ children: [Text.make({ value: "Body." })] }),
      ],
    });
    const rendered = Markdown.stringifyResult(root);
    assertSuccess(rendered, Result.getOrThrow(rendered));
    const out = Result.getOrThrow(rendered);
    const reparsed = parseDoc(out);
    assert.deepStrictEqual(
      A.map(reparsed.root.children, (child) => child.type),
      ["heading", "paragraph"],
      "re-parses to the same shape: the canonical-stringify contract"
    );
  });

  it.effect("modify accepts a one-line synthesized fragment", () =>
    Effect.gen(function* () {
      const document = parseDoc("# Old\n\nbody\n");
      const heading = document.find("heading");
      assert.isDefined(heading);
      const out = yield* MarkdownFormat.modifyToString(
        document,
        heading,
        Heading.make({ depth: 1, children: [Text.make({ value: "New" })] })
      );
      assert.strictEqual(out, "# New\n\nbody\n");
    })
  );
});

describe("the default is make-only, leaving the interop corpus's exact-emission contract untouched (controls)", () => {
  it("decode still requires a full position", () => {
    const decoded = S.decodeUnknownResult(Text)({ type: "text", value: "x" });
    assertFailure(decoded, decoded.pipe(Result.flip, Result.getOrThrow));
  });

  it("parsed trees still carry real spans, never the sentinel", () => {
    const document = parseDoc("# Hi\n");
    const heading = document.find("heading");
    assert.isDefined(heading);
    assert.notStrictEqual(heading.position, Position.synthetic);
    assert.strictEqual(heading.position.start.offset, 0);
    assert.strictEqual(heading.position.end.offset, 4);
  });

  it("encode of a synthesized node still emits the position", () => {
    const encoded = S.encodeUnknownResult(Text)(Text.make({ value: "x" }));
    assertSuccess(encoded, Result.getOrThrow(encoded));
    const plain = Result.getOrThrow(encoded);
    assert.deepStrictEqual(plain.position, {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 0 },
    });
  });
});
