import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Markdown, MarkdownFormat, MarkdownFormattingOptions, Mdast } from "@beep/markdown";
import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { extractDefinitions } from "@beep/markdown/internal/blocks/linkReferenceDefinition";
import { makeBlockNode } from "@beep/markdown/internal/blockTypes";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { BlockNode } from "@beep/markdown/internal/blockTypes";

const runs = { arbitrary: fcRuns(100) };
// Positions refer to different byte strings after canonical serialization.
// Compare every semantic mdast field, recursively, excluding only positions.
const semantic = (value: unknown): unknown => {
  if (A.isArray(value)) return A.map(value, semantic);
  if (P.isObject(value))
    return R.map(
      R.filter(value, (_, key) => key !== "position"),
      semantic
    );
  return value;
};
const words = S.Array(S.Literals(["alpha", "beta", "gamma", "delta", "é", "世界"])).pipe(
  Arbitrary.schema,
  Arbitrary.map((items) => `word ${A.join(items, " ")}`)
);

const styles = Arbitrary.schema(S.Literals(["one", "Two", "THREE"]));
const sourceOf = (text: string, style: string) => `[${style}]: /target "title"\n\n[${text}][${style}]\n`;
const options = MarkdownFormattingOptions.make({ headingStyle: "atx", bulletChar: "-" });

/**
 * A paragraph of `size` definitions and a rejected suffix, between two
 * siblings, whose provenance runs (and their iteration) count every read.
 * Each source line sits two characters further on than its text, so offsets
 * prove the runs were consulted rather than assumed contiguous.
 */
const countedDefinitionParagraph = (size: number) => {
  const reads = { count: 0 };
  const parent = makeBlockNode("document", 0, 1);
  const before = makeBlockNode("heading", 0, 1);
  const block = makeBlockNode("paragraph", 100, 7);
  const after = makeBlockNode("heading", 0, 1);
  block.parent = parent;
  parent.children.push(before, block, after);
  const lines = A.makeBy(size, (index) => `[key${index}]: /target${index}\n`);
  const prefix = A.join(lines, "");
  const suffix = "[broken]\ntail\n";
  block.stringContent = prefix + suffix;
  let textOffset = 0;
  A.forEach([...lines, suffix], (line, index) => {
    const at = textOffset;
    block.segments.push({
      get textOffset() {
        reads.count += 1;
        return at;
      },
      get sourceOffset() {
        reads.count += 1;
        return 100 + at + index * 2;
      },
      get length() {
        reads.count += 1;
        return line.length;
      },
    });
    textOffset += line.length;
  });
  const segments = block.segments;
  segments[Symbol.iterator] = () => {
    const iterator = segments.values();
    const next = iterator.next.bind(iterator);
    iterator.next = () => {
      reads.count += 1;
      return next();
    };
    return iterator;
  };
  return { reads, parent, before, block, after, segments, lines, prefix, suffix };
};

/** Every split-out definition sits in order before the paragraph, at its own source span. */
const assertSplitDefinitions = (parent: BlockNode, lines: ReadonlyArray<string>): void => {
  let offset = 0;
  A.forEach(lines, (line, index) => {
    const definition = parent.children[index + 1] ?? assert.fail(`expected definition ${index}`);
    assert.strictEqual(definition.data.definition?.identifier, `key${index}`);
    assert.strictEqual(definition.data.definition?.url, `/target${index}`);
    assert.strictEqual(definition.startOffset, 100 + offset + index * 2);
    assert.strictEqual(definition.endOffset, 100 + offset + index * 2 + line.length - 1);
    assert.strictEqual(definition.startLine, 7 + index);
    assert.strictEqual(definition.endLine, 7 + index);
    offset += line.length;
  });
};

describe("linkReferenceDefinition parser properties", () => {
  it("extracts from the final child without reading preceding siblings", () => {
    const parent = makeBlockNode("document", 0, 1);
    const preceding = makeBlockNode("heading", 0, 1);
    let reads = 0;
    for (let index = 0; index < 8_000; index += 1) {
      Object.defineProperty(parent.children, index, {
        configurable: true,
        get: () => {
          reads += 1;
          return preceding;
        },
      });
    }
    const block = makeBlockNode("paragraph", 100, 7);
    block.parent = parent;
    block.stringContent = "[key]: /target\ntail\n";
    block.segments.push({ textOffset: 0, sourceOffset: 100, length: block.stringContent.length });
    parent.children.push(block);
    extractDefinitions(block);
    assert.strictEqual(reads, 0);
    assert.strictEqual(parent.children[8_000]?.data.definition?.url, "/target");
    assert.strictEqual(parent.children[8_001], block);
    assert.strictEqual(block.stringContent, "tail\n");
    assert.strictEqual(block.startOffset, 115);
  });

  // In-process (D-45): the parse is pure, so no child runtime is needed to
  // show that a 150,000-line paragraph after a definition neither overflows
  // the stack nor loses provenance.
  it("extracts a definition before 150,000 shallow paragraph lines", () => {
    const size = 150_000;
    const source = `[a]: /b\n${Str.repeat(size)("x\n")}`;
    const parsed = parseBlocks(source);
    const [definition, paragraph] = parsed.root.children;
    assert.strictEqual(parsed.root.children.length, 2);
    assert.strictEqual(definition?.type, "definition");
    assert.strictEqual(definition?.type === "definition" ? definition.url : undefined, "/b");
    assert.strictEqual(paragraph?.type, "paragraph");
    assert.strictEqual(parsed.rawInlines[0]?.text, `${Str.repeat(size - 1)("x\n")}x`);
    assert.strictEqual(parsed.rawInlines[0]?.segments.length, size);
    assert.strictEqual(paragraph?.position.start.offset, 8);
    assert.strictEqual(paragraph?.position.end.offset, source.length - 1);
  });

  it("bounds scaled extraction reads and preserves segment identity, order and a rejected suffix", () => {
    for (const size of [2_000, 8_000]) {
      const fixture = countedDefinitionParagraph(size);
      const { parent, block, before, after, segments, lines, prefix, suffix } = fixture;
      extractDefinitions(block);
      assert.isAtMost(fixture.reads.count, size * 70);
      assert.strictEqual(block.segments, segments);
      assert.strictEqual(parent.children[0], before);
      assert.strictEqual(parent.children[size + 1], block);
      assert.strictEqual(parent.children[size + 2], after);
      assertSplitDefinitions(parent, lines);
      assert.strictEqual(block.stringContent, suffix);
      assert.strictEqual(block.startLine, 7 + size);
      assert.strictEqual(block.startOffset, 100 + prefix.length + size * 2);
      assert.deepStrictEqual(block.segments, [
        { textOffset: 0, sourceOffset: block.startOffset, length: suffix.length },
      ]);
      extractDefinitions(block);
      assert.strictEqual(parent.children.length, size + 3);
      assert.strictEqual(block.stringContent, suffix);
    }
  });

  it("retains duplicate definitions in order while the first normalized label wins", () => {
    const parsed = parseBlocks(`${Str.repeat(4_000)("[key]: /first\n[KEY]: /later\n")}tail\n`);
    assert.strictEqual(parsed.root.children.length, 8_001);
    for (let index = 0; index < 8_000; index += 1) {
      const definition = parsed.root.children[index];
      if (definition?.type !== "definition") assert.fail("expected a definition");
      assert.strictEqual(definition.identifier, "key");
      assert.strictEqual(definition.url, index % 2 === 0 ? "/first" : "/later");
    }
    assert.strictEqual(O.getOrUndefined(HashMap.get(parsed.refmap, "KEY")), parsed.root.children[0]);
    assert.strictEqual(parsed.definitionOrder.length, 1);
    assert.strictEqual(parsed.definitionOrder[0]?.[1], parsed.root.children[0]);
  });

  it.effect.prop(
    "parse/stringify preserves all semantic fields and stabilizes",
    [words, styles],
    ([text, style]) =>
      Effect.gen(function* () {
        const source = sourceOf(text, style);
        const parsed = yield* Markdown.parse(source);
        const serialized = yield* Markdown.stringify(parsed);
        const reparsed = yield* Markdown.parse(serialized);
        assert.deepStrictEqual(semantic(reparsed), semantic(parsed));
        const stringify1 = yield* Markdown.stringify(reparsed);
        assert.strictEqual(stringify1, serialized);
      }),
    runs
  );
  it.effect.prop(
    "format is idempotent and keeps parsed content",
    [words, styles],
    ([text, style]) =>
      Effect.gen(function* () {
        const source = sourceOf(text, style);
        const once = MarkdownFormat.formatToString(source, undefined, options);
        assert.strictEqual(MarkdownFormat.formatToString(once, undefined, options), once);
        const parsed2 = yield* Markdown.parse(once);
        const argument = semantic(Mdast.toMdast(parsed2));
        const parsed1 = yield* Markdown.parse(source);
        assert.deepStrictEqual(argument, semantic(Mdast.toMdast(parsed1)));
      }),
    runs
  );
  it.effect.prop(
    "README edit fidelity keeps surrounding bytes exact",
    [words, styles],
    ([text, style]) =>
      Effect.gen(function* () {
        const prefix = "<!-- before  keep spacing -->\n\n";
        const suffix = "\n<!-- after\tkeep tabs -->\n";
        const block = sourceOf(text, style);
        const source = `${prefix}${block}${suffix}`;
        const parsed = yield* Markdown.parse(source);
        const first = parsed.children[1];
        assert.ok(first !== undefined);
        if (first !== undefined) {
          assert.strictEqual(first.position.start.offset, prefix.length);
          assert.ok(Str.slice(first.position.start.offset, first.position.end.offset)(source).length > 0);
        }
        const formatted = MarkdownFormat.formatToString(source, undefined, options);
        assert.ok(Str.startsWith(prefix)(formatted));
        assert.ok(Str.endsWith(suffix)(formatted));
        const parsed3 = yield* Markdown.parse(formatted);
        assert.deepStrictEqual(semantic(Mdast.toMdast(parsed3)), semantic(Mdast.toMdast(parsed)));
      }),
    runs
  );

  it.effect.prop(
    "definition extraction is idempotent and preserves trailing paragraph text",
    [words, styles],
    ([text, style]) =>
      Effect.sync(() => {
        const parent = makeBlockNode("document", 0, 1);
        const block = makeBlockNode("paragraph", 0, 1);
        block.parent = parent;
        parent.children.push(block);
        block.stringContent = sourceOf(text, style);
        block.segments.push({ textOffset: 0, sourceOffset: 0, length: block.stringContent.length });
        extractDefinitions(block);
        assert.strictEqual(parent.children.length, 2);
        assert.strictEqual(parent.children[0]?.data.definition?.label, style);
        assert.strictEqual(parent.children[0]?.data.definition?.url, "/target");
        assert.ok(Str.includes(text)(block.stringContent));
        const remaining = block.stringContent;
        const offset = block.startOffset;
        const definitions = A.map(parent.children, (node) => node.data.definition);
        extractDefinitions(block);
        assert.strictEqual(block.stringContent, remaining);
        assert.strictEqual(block.startOffset, offset);
        assert.deepStrictEqual(
          A.map(parent.children, (node) => node.data.definition),
          definitions
        );
      }),
    runs
  );
});
