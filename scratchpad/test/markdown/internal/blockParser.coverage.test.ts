import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Definition, Paragraph } from "../../../effected/markdown/MarkdownNode.ts";
import { parseBlocks } from "../../../effected/markdown/internal/blockParser.ts";
import { blockDialect } from "../../../effected/markdown/internal/blockRegistry.ts";
import type { BlockScanner, BlockNode, BlockStart } from "../../../effected/markdown/internal/blockTypes.ts";
import { makeBlockNode } from "../../../effected/markdown/internal/blockTypes.ts";

// A scoped registry composition exercises scanner boundary contracts through
// the same injected dialect tables the production engine uses. Restore the
// table even when an invariant throws; no state leaks to later parses.
const withStart = (trigger: (scanner: BlockScanner, container: BlockNode) => void): void => {
  const dialect = blockDialect("commonmark");
  const starts = dialect.starts;
  Object.assign(dialect, { starts: [{ name: "scanner-contract", trigger(scanner: BlockScanner, container: BlockNode) { trigger(scanner, container); return 0; } }, ...starts] });
  try { parseBlocks("# heading\n"); } finally { Object.assign(dialect, { starts }); }
};

describe("blockParser scanner boundary", () => {
  it.effect("rejects reading the tip after finalization", () => Effect.sync(() => {
    assert.throws(() => withStart((scanner, container) => {
      scanner.finalizeBlock(container, 1);
      void scanner.tip;
    }), /tip was read after the document was finalized/);
  }));
  it.effect("replaces and inserts detached or missing siblings without corrupting the root", () => Effect.sync(() => {
    withStart((scanner, container) => {
      const detached = makeBlockNode("paragraph", 0, 1);
      const detachedReplacement = scanner.replaceBlock(detached, "heading");
      assert.strictEqual(detachedReplacement.parent, undefined);
      assert.strictEqual(scanner.insertBefore(detached, "definition").parent, undefined);
      const missing = makeBlockNode("paragraph", 0, 1);
      missing.parent = container;
      const replacement = scanner.replaceBlock(missing, "heading");
      assert.strictEqual(container.children.includes(replacement), true);
      const sibling = scanner.insertBefore(missing, "thematicBreak");
      assert.strictEqual(container.children.includes(sibling), true);
      const before = scanner.insertBefore(replacement, "thematicBreak");
      assert.strictEqual(container.children.indexOf(before) + 1, container.children.indexOf(replacement));
      const attachedReplacement = scanner.replaceBlock(replacement, "heading");
      assert.strictEqual(container.children.includes(replacement), false);
      scanner.setLastLineLength(100);
      scanner.finalizeBlock(attachedReplacement, 0);
      // Restore the scan tip to the document before the core starts run.
      assert.strictEqual(scanner.tip, container);
    });
  }));
  it.effect("reports missing constructs and invalid root materialization", () => Effect.sync(() => {
    const table = blockDialect("commonmark").constructs;
    const get = table.get;
    try {
      Object.assign(table, { get: () => undefined });
      assert.throws(() => parseBlocks("text"), /no construct registered/);
      for (const materialize of [() => undefined, () => Paragraph.make({ children: [] })]) {
        Object.assign(table, { get: (key: Parameters<typeof get>[0]) => {
          const construct = get(key);
          return key === "document" && construct !== undefined ? { ...construct, materialize } : construct;
        } });
        assert.throws(() => parseBlocks(""), /document construct did not materialize a root/);
      }
    } finally { Object.assign(table, { get }); }
  }));
  it.effect("skips an absent start-table entry and retains the core parse", () => Effect.sync(() => {
    const dialect = blockDialect("commonmark");
    const starts = dialect.starts;
    try {
      const sparse = new Array<BlockStart>(1);
      Object.assign(dialect, { starts: [...sparse, ...starts] });
      assert.strictEqual(parseBlocks("# title").root.children[0]?.type, "heading");
    } finally { Object.assign(dialect, { starts }); }
  }));
});

it.effect("omits unmaterialized extension blocks and nested roots", () => Effect.sync(() => {
  withStart((scanner, container) => {
    const missing = scanner.insertBefore(container, "definition");
    // insertBefore a root intentionally returns a detached block; the
    // extension owns attaching that block to the document.
    container.children.push(missing);
    assert.strictEqual(missing.open, false);
  });
  const table = blockDialect("commonmark").constructs;
  const get = table.get;
  try {
    Object.assign(table, { get: (key: Parameters<typeof get>[0]) => {
      const construct = get(key);
      return key === "heading" && construct !== undefined ? { ...construct, materialize: () => undefined } : construct;
    } });
    assert.deepStrictEqual(parseBlocks("# dropped\n").root.children, []);
    Object.assign(table, { get: (key: Parameters<typeof get>[0]) => {
      const construct = get(key);
      return key === "heading" && construct !== undefined ? { ...construct, materialize: () => parseBlocks("").root } : construct;
    } });
    assert.deepStrictEqual(parseBlocks("# nested root\n").root.children, []);
  } finally { Object.assign(table, { get }); }
}));

it.effect("scanner whitespace and tab boundaries retain their documented state", () => Effect.sync(() => {
  withStart((scanner) => {
    const line = scanner.currentLine;
    for (const ending of ["\n", "\r", ""]) {
      Object.assign(scanner, { currentLine: ending });
      scanner.setScanPosition(0, 0);
      scanner.findNextNonspace();
      assert.strictEqual(scanner.blank, true);
    }
    Object.assign(scanner, { currentLine: "\ttext" });
    scanner.setScanPosition(0, 0);
    scanner.advanceOffset(1);
    assert.strictEqual(scanner.offset, 1);
    assert.strictEqual(scanner.column, 4);
    scanner.setScanPosition(0, 0);
    scanner.advanceOffset(4, true);
    assert.strictEqual(scanner.offset, 1);
    assert.strictEqual(scanner.column, 4);
    scanner.setScanPosition(0, 0);
    const paragraph = scanner.addChild("paragraph", 0);
    scanner.advanceOffset(1, true);
    scanner.addLine();
    assert.strictEqual(paragraph.stringContent, "   text\n");
    assert.deepStrictEqual(paragraph.segments, [{ textOffset: 3, sourceOffset: 1, length: 4 }]);
    scanner.finalizeBlock(paragraph, 1);
    Object.assign(scanner, { currentLine: line });
    scanner.setScanPosition(0, 0);
    scanner.findNextNonspace();
  });
}));


it.effect("parses tabs, lazy containers, HTML, references and frontmatter with absolute root spans", () => Effect.sync(() => {
  for (const source of [
    "> a\nb\n\n> \tcode\n", "- \tcode\n  continued\n\n- next\n", "    code\n\tcontinued\n",
    "<script>\nhello\n</script>\n", "<!-- comment -->\n", "```\ncode\n```\n",
    "[id]: ./first\n[id]: ./second\n\n[id]\n", "[^note]: a\n\n[^note]\n", "| a | b |\n| --- | --- |\n| c | d |\n",
    "---\na: b\n---\n", "+++\na = 1\n+++\nbody\n", "", "\n", ">\n\n", "title\n===\n",
  ]) {
    const parsed = parseBlocks(source, { dialect: "gfm", frontmatter: true });
    assert.strictEqual(parsed.root.type, "root");
    assert.strictEqual(parsed.root.position.end.offset, source.length);
    for (const [key, definition] of parsed.definitionOrder) {
      assert.strictEqual(parsed.root.children.includes(definition), true);
      assert.strictEqual(key, "ID");
      assert.strictEqual(definition.url, "./first");
    }
  }
}));

it.effect("does not index extension definitions without lookup keys", () => Effect.sync(() => {
  const table = blockDialect("commonmark").constructs;
  const get = table.get;
  try {
    Object.assign(table, { get: (key: Parameters<typeof get>[0]) => {
      const construct = get(key);
      return key === "definition" && construct !== undefined ? { ...construct, materialize: () => Definition.make({ identifier: "missing", url: "./target" }) } : construct;
    } });
    withStart((scanner, container) => {
      const block = scanner.insertBefore(container, "definition");
      container.children.push(block);
    });
  } finally { Object.assign(table, { get }); }
}));

it.effect("closes an incompatible leaf before adding a sibling", () => Effect.sync(() => {
  withStart((scanner, container) => {
    const heading = scanner.addChild("heading", 0);
    const paragraph = scanner.addChild("paragraph", 0);
    assert.strictEqual(heading.open, false);
    assert.strictEqual(paragraph.parent, container);
    assert.deepStrictEqual(container.children, [heading, paragraph]);
    scanner.finalizeBlock(paragraph, 1);
  });
}));

it.effect("refuses container nesting past the parser's guard", () => Effect.sync(() => {
  assert.throws(() => parseBlocks(`${"> ".repeat(300)}text\n`), /NestingDepthExceeded: limit/);
}));
