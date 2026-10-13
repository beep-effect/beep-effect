import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as ChildProcess from "effect/process/ChildProcess";
import { Markdown, MarkdownFormat, MarkdownFormattingOptions, Mdast } from "../../../../effected/markdown/index.ts";

import { makeBlockNode } from "../../../../effected/markdown/internal/blockTypes.ts";
import { parseBlocks } from "../../../../effected/markdown/internal/blockParser.ts";
import { extractDefinitions } from "../../../../effected/markdown/internal/blocks/linkReferenceDefinition.ts";

const runs = { arbitrary: fcRuns(100) };
// Positions refer to different byte strings after canonical serialization.
// Compare every semantic mdast field, recursively, excluding only positions.
const semantic = (value: unknown): unknown => {
  if (A.isArray(value)) return A.map(value, semantic);
  if (P.isObject(value)) return R.map(R.filter(value, (_, key) => key !== "position"), semantic);
  return value;
};
const words = S.Array(S.Literals(["alpha", "beta", "gamma", "delta", "é", "世界"])).pipe(Arbitrary.schema, Arbitrary.map((items) => `word ${A.join(items, " ")}`));

const styles = Arbitrary.schema(S.Literals(["one", "Two", "THREE"]));
const sourceOf = (text: string, style: string) => `[${style}]: /target "title"\n\n[${text}][${style}]\n`;
const options = MarkdownFormattingOptions.make({ headingStyle: "atx", bulletChar: "-" });

describe("linkReferenceDefinition parser properties", () => {
  it("extracts from the final child without reading preceding siblings", () => {
    const parent = makeBlockNode("document", 0, 1);
    const preceding = makeBlockNode("heading", 0, 1);
    let reads = 0;
    for (let index = 0; index < 8_000; index += 1) {
      Object.defineProperty(parent.children, index, {
        configurable: true,
        get: () => { reads += 1; return preceding; },
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

  it.effect("extracts a definition before 150,000 shallow paragraph lines in Node", () => Effect.scopedWith((scope) => Effect.gen(function* () {
    const context = yield* Layer.buildWithScope(NodeServices.layer, scope);
    const parser = new URL("../../../../effected/markdown/internal/blockParser.ts", import.meta.url);
    const child = yield* Effect.provideContext(ChildProcess.make("node", ["--experimental-strip-types", "--input-type=module", "-e", `
      import assert from "node:assert/strict";
      import { parseBlocks } from "${parser.href}";
      const size = 150_000;
      const source = "[a]: /b\\n" + "x\\n".repeat(size);
      const parsed = parseBlocks(source);
      assert.equal(parsed.root.children.length, 2);
      assert.equal(parsed.root.children[0]?.type, "definition");
      assert.equal(parsed.root.children[0]?.url, "/b");
      assert.equal(parsed.root.children[1]?.type, "paragraph");
      assert.equal(parsed.rawInlines[0]?.text, "x\\n".repeat(size - 1) + "x");
      assert.equal(parsed.rawInlines[0]?.segments.length, size);
      assert.equal(parsed.root.children[1]?.position.start.offset, 8);
      assert.equal(parsed.root.children[1]?.position.end.offset, source.length - 1);
    `], { stderr: "inherit" }), context);
    assert.strictEqual(yield* child.exitCode, 0);
  })));

  it("bounds scaled extraction reads and preserves segment identity, order and a rejected suffix", () => {
    for (const size of [2_000, 8_000]) {
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
      let reads = 0;
      let textOffset = 0;
      for (const [index, line] of A.map([...lines, suffix], (line, index) => [index, line] as const)) {
        const at = textOffset;
        block.segments.push({
          get textOffset() { reads += 1; return at; },
          get sourceOffset() { reads += 1; return 100 + at + index * 2; },
          get length() { reads += 1; return line.length; },
        });
        textOffset += line.length;
      }
      const segments = block.segments;
      segments[Symbol.iterator] = () => {
        const iterator = segments.values();
        const next = iterator.next.bind(iterator);
        iterator.next = () => { reads += 1; return next(); };
        return iterator;
      };
      extractDefinitions(block);
      assert.isAtMost(reads, size * 70);
      assert.strictEqual(block.segments, segments);
      assert.strictEqual(parent.children[0], before);
      assert.strictEqual(parent.children[size + 1], block);
      assert.strictEqual(parent.children[size + 2], after);
      let offset = 0;
      for (let index = 0; index < size; index += 1) {
        const line = lines[index];
        assert.ok(line !== undefined);
        const definition = parent.children[index + 1];
        assert.strictEqual(definition?.data.definition?.identifier, `key${index}`);
        assert.strictEqual(definition?.data.definition?.url, `/target${index}`);
        assert.strictEqual(definition?.startOffset, 100 + offset + index * 2);
        assert.strictEqual(definition?.endOffset, 100 + offset + index * 2 + line.length - 1);
        assert.strictEqual(definition?.startLine, 7 + index);
        assert.strictEqual(definition?.endLine, 7 + index);
        offset += line.length;
      }
      assert.strictEqual(block.stringContent, suffix);
      assert.strictEqual(block.startLine, 7 + size);
      assert.strictEqual(block.startOffset, 100 + prefix.length + size * 2);
      assert.strictEqual(block.segments.length, 1);
      assert.deepStrictEqual(block.segments[0], { textOffset: 0, sourceOffset: block.startOffset, length: suffix.length });
      extractDefinitions(block);
      assert.strictEqual(parent.children.length, size + 3);
      assert.strictEqual(block.stringContent, suffix);
    }
  });

  it("retains duplicate definitions in order while the first normalized label wins", () => {
    const parsed = parseBlocks(Str.repeat(4_000)("[key]: /first\n[KEY]: /later\n") + "tail\n");
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

  it.effect.prop("parse/stringify preserves all semantic fields and stabilizes", [words, styles], ([text, style]) => Effect.gen(function* () {
    const source = sourceOf(text, style);
    const parsed = yield* Markdown.parse(source);
    const serialized = yield* Markdown.stringify(parsed);
    const reparsed = yield* Markdown.parse(serialized);
    assert.deepStrictEqual(semantic(reparsed), semantic(parsed));
    assert.strictEqual(yield* Markdown.stringify(reparsed), serialized);
  }), runs);
  it.effect.prop("format is idempotent and keeps parsed content", [words, styles], ([text, style]) => Effect.gen(function* () {
    const source = sourceOf(text, style);
    const once = MarkdownFormat.formatToString(source, undefined, options);
    assert.strictEqual(MarkdownFormat.formatToString(once, undefined, options), once);
    assert.deepStrictEqual(semantic(Mdast.toMdast(yield* Markdown.parse(once))), semantic(Mdast.toMdast(yield* Markdown.parse(source))));
  }), runs);
  it.effect.prop("README edit fidelity keeps surrounding bytes exact", [words, styles], ([text, style]) => Effect.gen(function* () {
    const prefix = "<!-- before  keep spacing -->\n\n";
    const suffix = "\n<!-- after\tkeep tabs -->\n";
    const block = sourceOf(text, style);
    const source = `${prefix}${block}${suffix}`;
    const parsed = yield* Markdown.parse(source);
    const first = parsed.children[1];
    assert.ok(first !== undefined);
    if (first !== undefined) {
      assert.strictEqual(first.position.start.offset, prefix.length);
      assert.ok(source.slice(first.position.start.offset, first.position.end.offset).length > 0);
    }
    const formatted = MarkdownFormat.formatToString(source, undefined, options);
    assert.ok(formatted.startsWith(prefix));
    assert.ok(formatted.endsWith(suffix));
    assert.deepStrictEqual(semantic(Mdast.toMdast(yield* Markdown.parse(formatted))), semantic(Mdast.toMdast(parsed)));
  }), runs);

  it.effect.prop("definition extraction is idempotent and preserves trailing paragraph text", [words, styles], ([text, style]) => Effect.sync(() => {
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
    assert.ok(block.stringContent.includes(text));
    const remaining = block.stringContent;
    const offset = block.startOffset;
    const definitions = parent.children.map((node) => node.data.definition);
    extractDefinitions(block);
    assert.strictEqual(block.stringContent, remaining);
    assert.strictEqual(block.startOffset, offset);
    assert.deepStrictEqual(parent.children.map((node) => node.data.definition), definitions);
  }), runs);

});
