import { identity } from "effect/Function";
// decision: recursion-surfaces-bounded-at-two-caps

import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { GuardExceeded, isGuardExceeded } from "@beep/markdown/internal/carriers";
import { MAX_NESTING_DEPTH } from "@beep/markdown/internal/limits";
import { InvalidLineTableError, LineIndex } from "@beep/markdown/internal/lineIndex";
import { preprocessLines } from "@beep/markdown/internal/preprocess";
import { Markdown } from "@beep/markdown/Markdown";
import { MarkdownVisitor } from "@beep/markdown/MarkdownVisitor";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { renderHtml } from "./support/htmlWriter.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

it.effect(
  "retains positions when promoting a 150,000-line setext heading under Node's argument limit, which Bun lacks",
  () =>
    Effect.sync(() => {
      const lines = 150_000;
      const source = `${Str.repeat(lines)("x\n")}---\n`;
      const parsed = Markdown.parseResult(source);
      assertSuccess(parsed, parseBlocks(source).root);
      const heading = parsed.success.children[0];
      assert.strictEqual(parsed.success.children.length, 1);
      assert.ok(heading?.type === "heading");
      if (heading?.type === "heading") {
        assert.strictEqual(heading.depth, 2);
        assert.deepStrictEqual({ ...heading.position.start }, { line: 1, column: 1, offset: 0 });
        assert.deepStrictEqual({ ...heading.position.end }, { line: lines + 1, column: 4, offset: source.length - 1 });
        const text = heading.children[0];
        assert.strictEqual(heading.children.length, 1);
        assert.ok(text?.type === "text");
        if (text?.type === "text") {
          assert.strictEqual(text.value, Str.slice(0, lines * 2 - 1)(source));
          assert.deepStrictEqual({ ...text.position.start }, { line: 1, column: 1, offset: 0 });
          assert.deepStrictEqual({ ...text.position.end }, { line: lines, column: 2, offset: lines * 2 - 1 });
        }
      }
      assert.strictEqual(parsed.success.position.end.offset, source.length);
    })
);

describe("recursion surfaces", () => {
  describe("container nesting (surfaces 1, 2 and 3)", () => {
    it("trips the guard rather than overflowing on deep blockquotes", () => {
      let caught: unknown;
      try {
        parseBlocks(`${Str.repeat(MAX_NESTING_DEPTH + 44)(">")} foo\n`);
      } catch (error) {
        caught = error;
      }

      assert.isTrue(isGuardExceeded(caught), "deep containers must trip the guard");
      assert.isFalse(caught instanceof RangeError, "a stack overflow is a defect, not a typed failure");
      if (isGuardExceeded(caught)) {
        assert.strictEqual(caught.reason, "NestingDepthExceeded");
        assert.strictEqual(caught.limit, MAX_NESTING_DEPTH);
      }
    });

    it("trips the guard on deep lists", () => {
      assert.throws(() => parseBlocks(`${Str.repeat(MAX_NESTING_DEPTH)("- ")}foo\n`), GuardExceeded);
    });

    it("parses containers nested just under the cap", () => {
      const { root } = parseBlocks(`${Str.repeat(MAX_NESTING_DEPTH - 2)(">")} foo\n`);
      assert.strictEqual(
        root.children[0]?.type,
        "blockquote",
        "positive control: without it the test above would pass even if the guard fired at depth 1"
      );
    });
  });

  describe("inline nesting (surface 4)", () => {
    const delimitersPerNestingLevel = 2;
    const markersFor = (depth: number): string => Str.repeat(depth * delimitersPerNestingLevel)("*");

    it("trips the guard rather than overflowing on deep emphasis", () => {
      const markers = markersFor(MAX_NESTING_DEPTH + 10);
      let caught: unknown;
      try {
        parseBlocks(`${markers}a${markers}\n`);
      } catch (error) {
        caught = error;
      }

      assert.isTrue(isGuardExceeded(caught), "deep emphasis must trip the guard");
      assert.isFalse(caught instanceof RangeError);
    });

    it("parses emphasis nested just under the cap", () => {
      const markers = markersFor(MAX_NESTING_DEPTH - 6);
      const [paragraph] = parseBlocks(`${markers}a${markers}\n`).root.children;
      assert.strictEqual(paragraph?.type, "paragraph");
      assert.strictEqual(paragraph?.type === "paragraph" ? paragraph.children[0]?.type : undefined, "strong");
    });

    it("counts container and inline nesting against the same cap", () => {
      const source = `${Str.repeat(10)(">")} ${Str.repeat(20)("*")}a${Str.repeat(20)("*")}\n`;
      assert.doesNotThrow(
        () => parseBlocks(source),
        undefined,
        undefined,
        "both guards use MAX_NESTING_DEPTH; neither leaks into the other"
      );
    });
  });

  describe("combined materialized tree depth", () => {
    it("accepts the whole-tree boundary and rejects one deeper with a typed facade failure", () => {
      const atLimit = `${Str.repeat(MAX_NESTING_DEPTH - 4)("> ")}***x***\n`;
      assert.doesNotThrow(() => parseBlocks(atLimit));
      for (const quotes of [MAX_NESTING_DEPTH - 3, MAX_NESTING_DEPTH - 2]) {
        const source = `${Str.repeat(quotes)("> ")}***x***\n`;
        let caught: unknown;
        try {
          parseBlocks(source);
        } catch (error) {
          caught = error;
        }
        assert.isTrue(isGuardExceeded(caught));
        if (isGuardExceeded(caught)) {
          assert.strictEqual(caught.limit, MAX_NESTING_DEPTH);
          assert.strictEqual(caught.actual, MAX_NESTING_DEPTH + 1);
          assert.strictEqual(
            caught.message,
            `NestingDepthExceeded: limit ${MAX_NESTING_DEPTH}, actual ${MAX_NESTING_DEPTH + 1}`
          );
        }
        const parsed = Markdown.parseResult(source);
        assertSuccess(
          Result.map(Result.flip(parsed), (failure) => [failure._tag, failure.diagnostic.code]),
          ["MarkdownParseError", "NestingDepthExceeded"]
        );
      }
    });

    it.effect(
      "visits and stringifies parsed boundary trees without tripping either guard",
      Effect.fnUntraced(function* () {
        const sources = [
          `${Str.repeat(MAX_NESTING_DEPTH - 2)("> ")}x\n`,
          `${Str.repeat(MAX_NESTING_DEPTH - 3)("> ")}*x*\n`,
          `${Str.repeat(MAX_NESTING_DEPTH - 4)("> ")}***x***\n`,
          `${Str.repeat(200)("> ")}${Str.repeat(108)("*")}x${Str.repeat(108)("*")}\n`,
        ];
        for (const source of sources) {
          const root = yield* Markdown.parse(source);
          const events = yield* MarkdownVisitor.visit(root).pipe(Stream.runCollect);
          assert.isFalse(A.some(events, (event) => event._tag === "Error"));
          assert.isTrue(A.some(events, (event) => event.depth === MAX_NESTING_DEPTH));
          const serialized = yield* Markdown.stringify(root);
          assertSuccess(Markdown.stringifyResult(root), serialized);
          const reparsed = yield* Markdown.parse(serialized);
          const repeated = yield* Markdown.stringify(reparsed);
          assert.strictEqual(repeated, serialized);
        }
      })
    );
  });

  describe("image alt flattening (surface 9)", () => {
    it("flattens deeply nested alt content without overflowing the stack", () => {
      const markers = Str.repeat(20000)("*");
      let caught: unknown;
      try {
        parseBlocks(`![${markers}a${markers}](/u)\n`);
      } catch (error) {
        caught = error;
      }

      assert.isFalse(
        caught instanceof RangeError,
        "alt flattening must not recurse: it ran before materialization's guard and died with a RangeError; 10,000 levels is far past any cap"
      );
      assert.isUndefined(caught);
    });

    it("still flattens nested markup into alt text correctly", () => {
      const [paragraph] = parseBlocks("![a *b* `c` [d](/e)](/u)\n").root.children;
      const image = paragraph?.type === "paragraph" ? paragraph.children[0] : undefined;
      assert.strictEqual(image?.type, "image");
      assert.strictEqual(image?.type === "image" ? image.alt : "", "a b c d");
    });
  });
});

describe("the line index", () => {
  it("agrees with the parser about what a line is, for bare CR documents", () => {
    const source = "alpha\rbravo\rcharlie\n";
    const { root } = parseBlocks(source);

    assert.strictEqual(root.children.length, 1, "the three CR-separated lines are one paragraph");
    const paragraph = root.children[0];
    assert.strictEqual(
      paragraph?.position.start.line,
      1,
      "preprocessLines splits on CRLF, LF and a bare CR; the parser hands the line index that same table"
    );
    assert.strictEqual(paragraph?.position.end.line, 3, "charlie is the third line, so the paragraph ends there");
  });

  it("positions a block after a bare CR on the right line", () => {
    const source = "alpha\r\r# heading\n";
    const heading = parseBlocks(source).root.children[1];
    assert.strictEqual(heading?.type, "heading");
    assert.strictEqual(heading?.position.start.line, 3);
  });

  it("keeps LF semantics identical when built from a line table", () => {
    const source = "one\ntwo\nthree";
    const scanned = LineIndex.make(source);
    const handed = LineIndex.fromLineStarts(
      source,
      A.map(preprocessLines(source), (line) => line.start)
    );

    for (let offset = 0; offset <= source.length; offset += 1) {
      assert.deepStrictEqual(
        { ...handed.positionAt(offset) },
        { ...scanned.positionAt(offset) },
        `disagreement at offset ${offset}`
      );
    }
  });

  it("refuses a line table that does not start at zero", () => {
    assert.throws(() => LineIndex.fromLineStarts("abc", [1, 2]), InvalidLineTableError);
    assert.throws(() => LineIndex.fromLineStarts("abc", []), InvalidLineTableError);
  });
});

describe("prototype pollution", () => {
  const DANGEROUS = ["__proto__", "constructor", "prototype", "toString", "hasOwnProperty"] as const;

  it("holds dangerous reference labels as data and resolves them", () => {
    const definitions = A.join(
      A.map(DANGEROUS, (label) => `[${label}]: /url-${label}\n`),
      ""
    );
    const references = A.join(
      A.map(DANGEROUS, (label) => `[${label}]\n\n`),
      ""
    );
    const document = `${definitions}\n${references}`;
    const { root, refmap } = parseBlocks(document);

    for (const label of DANGEROUS) {
      const key = Str.toUpperCase(label);
      assert.isTrue(HashMap.has(refmap, key), `the refmap lost the ${label} definition`);
      assert.strictEqual(O.getOrUndefined(HashMap.get(refmap, key))?.url, `/url-${label}`);
    }

    const rendered = renderHtml(root);
    for (const label of DANGEROUS) {
      assert.include(
        rendered,
        `href="/url-${label}"`,
        `the ${label} reference did not resolve: forming against its definition proves the lookup went through the HashMap`
      );
    }
  });

  it("leaves Object.prototype untouched", () => {
    const before = Object.getOwnPropertyNames(Object.prototype).sort();
    parseBlocks('[__proto__]: /evil "polluted"\n\n[constructor]: /evil2\n\n[__proto__]\n');

    assert.deepStrictEqual(Object.getOwnPropertyNames(Object.prototype).sort(), before);
    assert.strictEqual(Object.getPrototypeOf({}), Object.prototype);
    const plain: Record<string, unknown> = {};
    assert.isUndefined(plain.url);
  });

  it("keys the refmap through an Effect HashMap, not an object", () => {
    const { refmap } = parseBlocks("[a]: /1\n");
    assert.isTrue(HashMap.isHashMap(refmap));
  });
});

describe("adversarial characters", () => {
  it("replaces U+0000 with U+FFFD through the whole pipeline", () => {
    const { root } = parseBlocks("a\u0000b\n");
    const paragraph = root.children[0];
    const text = paragraph?.type === "paragraph" ? paragraph.children[0] : undefined;
    assert.strictEqual(text?.type === "text" ? text.value : "", "a\uFFFDb");
    assert.include(renderHtml(root), "a\uFFFDb");
  });

  it("replaces U+0000 inside every construct that carries text", () => {
    const sources = [
      "# a\u0000b\n",
      "    a\u0000b\n",
      "```\na\u0000b\n```\n",
      "> a\u0000b\n",
      "`a\u0000b`\n",
      "[a\u0000b]: /url\n\n[a\u0000b]\n",
    ];
    for (const source of sources) {
      const rendered = renderHtml(parseBlocks(source).root);
      assert.notInclude(
        rendered,
        "\u0000",
        `a NUL survived: ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(source), identity)}`
      );
    }
  });

  it("parses a lone surrogate without throwing", () => {
    for (const source of ["a\uD800b\n", "a\uDFFFb\n", "\uD800\n", "*\uD800*\n", "[\uD800](/u)\n"]) {
      assert.doesNotThrow(
        () => renderHtml(parseBlocks(source).root),
        `failed for ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(source), identity)}`
      );
    }
  });

  it("keeps a lone surrogate in the text it came from", () => {
    const { root } = parseBlocks("a\uD800b\n");
    const paragraph = root.children[0];
    const text = paragraph?.type === "paragraph" ? paragraph.children[0] : undefined;
    assert.strictEqual(text?.type === "text" ? text.value : "", "a\uD800b");
  });

  it("parses an unterminated construct at the end of input without throwing", () => {
    for (const source of ["`code", "[link](", "![img][", "<!-- comment", "***", "> ", "- ", "```"]) {
      assert.doesNotThrow(
        () => renderHtml(parseBlocks(source).root),
        `failed for ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(source), identity)}`
      );
    }
  });

  it("parses the empty document and a lone newline", () => {
    for (const source of ["", "\n", "\r", "\r\n", "\n\n\n"]) {
      const { root } = parseBlocks(source);
      assert.strictEqual(
        root.children.length,
        0,
        `failed for ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(source), identity)}`
      );
    }
  });
});
