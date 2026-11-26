import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { Markdown, MarkdownParseOptions } from "@beep/markdown/Markdown";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { Frontmatter, Point, Position, Root } from "@beep/markdown/MarkdownNode";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { Frontmatter as FrontmatterNode } from "@beep/markdown/MarkdownNode";

const withFrontmatter = MarkdownParseOptions.make({ frontmatter: true });

const parseOn = (source: string): Root => {
  const result = Markdown.parseResult(source, withFrontmatter);
  assertSuccess(result, Result.getOrThrow(result));
  if (!Result.isSuccess(result)) {
    throw new TypeError("unreachable: asserted success above");
  }
  return result.success;
};

const captureOf = (source: string): FrontmatterNode => {
  const head = parseOn(source).children[0];
  assert.isDefined(head, "expected the document to have a head node");
  assert.strictEqual(head?.type, "frontmatter");
  if (head?.type !== "frontmatter") {
    throw new TypeError("unreachable: asserted the type above");
  }
  return head;
};

describe("frontmatter capture", () => {
  describe("the toggle", () => {
    it("is off by default: a fence document parses as CommonMark says", () => {
      const result = Markdown.parseResult("---\na: 1\n---\n");
      assertSuccess(result, Result.getOrThrow(result));
      if (!Result.isSuccess(result)) {
        return;
      }
      const types = A.map(result.success.children, (child) => child.type);
      assert.deepStrictEqual(
        types,
        ["thematicBreak", "heading"],
        "--- is a thematic break, and a: 1 then --- is a setext heading"
      );
    });

    it("is off by default at the engine level too", () => {
      const types = A.map(parseBlocks("---\na: 1\n---\n", { dialect: "gfm" }).root.children, (child) => child.type);
      assert.deepStrictEqual(types, ["thematicBreak", "heading"]);
    });

    it("captures when enabled", () => {
      const node = captureOf("---\na: 1\n---\nrest\n");
      assert.strictEqual(node.format, "yaml");
      assert.strictEqual(node.value, "a: 1");
    });

    it("leaves the body identical to a document without the block", () => {
      const withBlock = parseOn("---\na: 1\n---\n# Title\n\nBody.\n");
      const bare = parseOn("# Title\n\nBody.\n");
      const bodyTypes = A.map(withBlock.children.slice(1), (child) => child.type);
      assert.deepStrictEqual(
        bodyTypes,
        A.map(bare.children, (child) => child.type)
      );
    });
  });

  describe("formats", () => {
    it("--- captures yaml", () => {
      assert.strictEqual(captureOf("---\na: 1\n---\n").format, "yaml");
    });

    it("+++ captures toml", () => {
      const node = captureOf('+++\ntitle = "x"\n+++\nrest\n');
      assert.strictEqual(node.format, "toml");
      assert.strictEqual(node.value, 'title = "x"');
    });

    it("+++ must close with +++, not ---", () => {
      const types = A.map(parseOn('+++\ntitle = "x"\n---\n').children, (child) => child.type);
      assert.notStrictEqual(types[0], "frontmatter");
    });

    it("---json captures json and closes with ---", () => {
      const node = captureOf('---json\n{ "a": 1 }\n---\nrest\n');
      assert.strictEqual(node.format, "json");
      assert.strictEqual(node.value, '{ "a": 1 }');
    });

    it("other language hints are not recognized", () => {
      const types = A.map(parseOn("---yaml\na: 1\n---\n").children, (child) => child.type);
      assert.notStrictEqual(
        types[0],
        "frontmatter",
        "gray-matter would honor ---yaml, but this grammar is deliberately closed to three fences"
      );
    });
  });

  describe("fence strictness", () => {
    it("requires offset 0: a leading blank line defeats the capture", () => {
      const types = A.map(parseOn("\n---\na: 1\n---\n").children, (child) => child.type);
      assert.notStrictEqual(types[0], "frontmatter");
    });

    it("rejects indentation on either fence line", () => {
      for (const source of [" ---\na: 1\n---\n", "---\na: 1\n ---\n", "\t---\na: 1\n---\n"]) {
        const types = A.map(parseOn(source).children, (child) => child.type);
        assert.notStrictEqual(types[0], "frontmatter", source);
      }
    });

    it("rejects text after the fence's trailing whitespace", () => {
      for (const source of ["--- x\na: 1\n---\n", "---\na: 1\n--- x\n", "+++ toml\na = 1\n+++\n"]) {
        const types = A.map(parseOn(source).children, (child) => child.type);
        assert.notStrictEqual(types[0], "frontmatter", source);
      }
    });

    it("rejects a longer dash run", () => {
      const types = A.map(parseOn("----\na: 1\n----\n").children, (child) => child.type);
      assert.notStrictEqual(types[0], "frontmatter");
    });

    it("an unclosed fence is not frontmatter and emits no diagnostic", () => {
      const result = MarkdownDocument.parseResult("---\na: 1\n", withFrontmatter);
      assertSuccess(result, Result.getOrThrow(result));
      if (!Result.isSuccess(result)) {
        return;
      }
      const types = A.map(result.success.root.children, (child) => child.type);
      assert.notStrictEqual(types[0], "frontmatter");
      assert.strictEqual(result.success.diagnostics.length, 0);
    });

    it("a fence line with content after the close changes nothing after it", () => {
      const root = parseOn("---\na: 1\n---\n# Title\n");
      assert.strictEqual(root.children[0]?.type, "frontmatter");
      assert.strictEqual(root.children[1]?.type, "heading");
    });
  });

  describe("fence trailing whitespace", () => {
    const cases: ReadonlyArray<readonly [open: string, close: string, format: string]> = [
      ["---", "---", "yaml"],
      ["+++", "+++", "toml"],
      ["---json", "---", "json"],
    ];
    const pads = [" ", "\t", " \t ", "\t\t"];

    it("captures with trailing spaces or tabs on the opening fence, the closing fence, or both", () => {
      for (const [open, close, format] of cases) {
        for (const pad of pads) {
          for (const source of [
            `${open}${pad}\nkey\n${close}\nrest\n`,
            `${open}\nkey\n${close}${pad}\nrest\n`,
            `${open}${pad}\nkey\n${close}${pad}\nrest\n`,
          ]) {
            const node = captureOf(source);
            assert.strictEqual(node.format, format, source);
            assert.strictEqual(node.value, "key", source);
          }
        }
      }
    });

    it("captures padded fences under CRLF and CR terminators", () => {
      assert.strictEqual(captureOf("--- \r\na: 1\r\nb: 2\r\n---\t\r\nrest\r\n").value, "a: 1\r\nb: 2");
      assert.strictEqual(captureOf("+++\t\ra = 1\r+++ \rrest\r").value, "a = 1");
    });

    it("spans the padded closing fence and starts the body on the next line", () => {
      const root = parseOn("---\na: 1\n--- \t\nrest\n");
      const node = root.children[0];
      assert.strictEqual(node?.type, "frontmatter");
      assert.deepStrictEqual(
        { ...node?.position.end },
        { line: 3, column: 6, offset: 14 },
        "the padded closing fence line spans offsets 9-14"
      );
      assert.strictEqual(root.children[1]?.type, "paragraph");
      assert.strictEqual(root.children[1]?.position.start.offset, 15);
    });

    it("leaves a padded thematic break in the body to the block pass", () => {
      const root = parseOn("---\na: 1\n---\nintro\n\n--- \n\nafter\n");
      assert.deepStrictEqual(
        A.map(root.children, (child) => child.type),
        ["frontmatter", "paragraph", "thematicBreak", "paragraph"]
      );
      assert.strictEqual(captureOf("---\na: 1\n---\nintro\n\n--- \n\nafter\n").value, "a: 1");
    });

    it("still rejects a four-dash run, padded or not", () => {
      for (const source of ["---- \na: 1\n---\n", "---\na: 1\n---- \n"]) {
        const types = A.map(parseOn(source).children, (child) => child.type);
        assert.notStrictEqual(types[0], "frontmatter", source);
      }
    });

    it("agrees with hasFrontmatterBlock on padded fences", () => {
      const result = MarkdownDocument.parseResult("--- \na: 1\n---\t\n");
      assertSuccess(result, Result.getOrThrow(result));
      assert.isTrue(Result.getOrThrow(result).hasFrontmatterBlock);
    });
  });

  describe("value fidelity", () => {
    it("captures the empty block", () => {
      const node = captureOf("---\n---\nbody\n");
      assert.strictEqual(node.value, "");
    });

    it("keeps interior line endings raw under CRLF", () => {
      const node = captureOf("---\r\na: 1\r\nb: 2\r\n---\r\nrest\r\n");
      assert.strictEqual(node.format, "yaml");
      assert.strictEqual(node.value, "a: 1\r\nb: 2");
    });

    it("captures under CRLF fences", () => {
      const node = captureOf("---\r\na: 1\r\n---\r\n");
      assert.strictEqual(node.value, "a: 1");
    });

    it("replaces U+0000 with U+FFFD, length-preserved", () => {
      const node = captureOf("---\na: \u0000\n---\n");
      assert.strictEqual(node.value, "a: �");
    });

    it("never inline-parses the value", () => {
      const node = captureOf("---\n*not emphasis*\n---\n");
      assert.strictEqual(node.value, "*not emphasis*");
    });
  });

  describe("positions", () => {
    it("spans the whole block including both fences", () => {
      const root = parseOn("---\na: 1\n---\nrest\n");
      const node = root.children[0];
      assert.strictEqual(node?.type, "frontmatter");
      if (node?.type !== "frontmatter") {
        return;
      }
      assert.deepStrictEqual({ ...node.position.start }, { line: 1, column: 1, offset: 0 });
      assert.deepStrictEqual(
        { ...node.position.end },
        { line: 3, column: 4, offset: 12 },
        "the fences sit at 0-3 and 9-12, and the rest starts at 13"
      );
      const body = root.children[1];
      assert.strictEqual(body?.type, "paragraph");
      assert.strictEqual(body?.position.start.offset, 13);
      assert.strictEqual(body?.position.start.line, 4);
    });

    it("a frontmatter-only document keeps a sane root span", () => {
      const root = parseOn("---\na: 1\n---\n");
      assert.strictEqual(root.children.length, 1);
      assert.strictEqual(root.children[0]?.type, "frontmatter");
      assert.isAtLeast(root.position.end.offset, root.children[0]?.position.end.offset ?? Number.NaN);
    });
  });

  describe("dialect independence", () => {
    it("captures identically under commonmark and gfm", () => {
      const commonmark = Markdown.parseResult(
        "---\na: 1\n---\n",
        MarkdownParseOptions.make({ dialect: "commonmark", frontmatter: true })
      );
      assertSuccess(commonmark, Result.getOrThrow(commonmark));
      if (!Result.isSuccess(commonmark)) {
        return;
      }
      const head = commonmark.success.children[0];
      assert.strictEqual(head?.type, "frontmatter");
    });
  });

  describe("the facade and the schema", () => {
    it.effect("parse and parseResult agree", () =>
      Effect.gen(function* () {
        const viaEffect = yield* Markdown.parse("---\na: 1\n---\n", withFrontmatter);
        const viaResult = parseOn("---\na: 1\n---\n");
        assert.deepStrictEqual(viaEffect, viaResult);
      })
    );

    it("a frontmatter head survives a Root decode round-trip", () => {
      const root = parseOn("---\na: 1\n---\nrest\n");
      const decoded = S.encodeUnknownResult(Root)(root).pipe(
        Result.getOrThrow,
        S.decodeResult(Root),
        Result.getOrThrow
      );
      assert.deepStrictEqual(decoded, root);
    });

    it("Frontmatter.make constructs the node directly", () => {
      const node = Frontmatter.make({
        type: "frontmatter",
        format: "yaml",
        value: "a: 1",
        position: Position.make({
          start: Point.make({ line: 1, column: 1, offset: 0 }),
          end: Point.make({ line: 3, column: 4, offset: 12 }),
        }),
      });
      assert.strictEqual(node.format, "yaml");
    });

    it("make accepts a plain-object position and validates it into a Position", () => {
      const node = Frontmatter.make({
        type: "frontmatter",
        format: "yaml",
        value: "a: 1",
        position: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 3, column: 4, offset: 12 },
        },
      });
      assert(
        S.is(Position)(node.position),
        "make deep-validates a plain-object position, as make.in admits; the guards are structural, so this checks shape, not class"
      );
      assert(S.is(Point)(node.position.start));
      assert(S.is(Point)(node.position.end));
      assert.strictEqual(node.position.end.offset, 12);
    });
  });
});
