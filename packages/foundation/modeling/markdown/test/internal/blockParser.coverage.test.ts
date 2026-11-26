import { parseBlocks } from "@beep/markdown/internal/blockParser";
import * as BlockRegistry from "@beep/markdown/internal/blockRegistry";
import { blockDialect } from "@beep/markdown/internal/blockRegistry";
import {
  BlockConstruct,
  BlockDialect,
  BlockStart,
  leafMaterializer,
  makeBlockNode,
} from "@beep/markdown/internal/blockTypes";
import { Definition, Paragraph } from "@beep/markdown/MarkdownNode";
import { assert, describe, it, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Str from "effect/String";
import type {
  BlockBehaviour,
  BlockNode,
  BlockScanner,
  BlockStartResult,
  BlockType,
  MaterializedBlock,
} from "@beep/markdown/internal/blockTypes";

const withDialect = (dialect: BlockDialect, run: () => void): void => {
  const lookup = vi.spyOn(BlockRegistry, "blockDialect").mockReturnValue(dialect);
  try {
    run();
  } finally {
    lookup.mockRestore();
  }
};
const withMaterialize = (
  base: BlockDialect,
  type: BlockType,
  materialize: BlockBehaviour["materialize"]
): BlockDialect =>
  new BlockDialect(
    A.map(base.constructs, (construct) =>
      construct.type === type
        ? new BlockConstruct(construct.type, construct.acceptsLines, {
            canContain: construct.canContain,
            continue: construct.continue,
            materialize,
            ...(construct.finalize === undefined ? {} : { finalize: construct.finalize }),
          })
        : construct
    ),
    base.starts,
    base.mayStartBlock
  );

const materializeTo = (node: MaterializedBlock | undefined): BlockBehaviour["materialize"] =>
  leafMaterializer(() => node);

const withStart = (
  trigger: (scanner: BlockScanner, container: BlockNode) => void,
  dialect = blockDialect("commonmark")
): void => {
  withDialect(
    new BlockDialect(
      dialect.constructs,
      [
        new BlockStart(
          "scanner-contract",
          dual(2, (scanner: BlockScanner, container: BlockNode): BlockStartResult => {
            trigger(scanner, container);
            return 0;
          })
        ),
        ...dialect.starts,
      ],
      dialect.mayStartBlock
    ),
    () => {
      parseBlocks("# heading\n");
    }
  );
};

describe("blockParser scanner boundary", () => {
  it.effect("rejects reading the tip after finalization", () =>
    Effect.sync(() => {
      assert.throws(
        () =>
          withStart((scanner, container) => {
            scanner.finalizeBlock(container, 1);
            void scanner.tip;
          }),
        /tip was read after the document was finalized/
      );
    })
  );
  it.effect("replaces and inserts detached or missing siblings without corrupting the root", () =>
    Effect.sync(() => {
      withStart((scanner, container) => {
        const detached = makeBlockNode("paragraph", 0, 1);
        const detachedReplacement = scanner.replaceBlock(detached, "heading");
        assert.strictEqual(detachedReplacement.parent, undefined);
        assert.strictEqual(scanner.insertBefore(detached, "definition").parent, undefined);
        const missing = makeBlockNode("paragraph", 0, 1);
        missing.parent = container;
        const replacement = scanner.replaceBlock(missing, "heading");
        assert.isTrue(A.contains(container.children, replacement));
        const sibling = scanner.insertBefore(missing, "thematicBreak");
        assert.isTrue(A.contains(container.children, sibling));
        const before = scanner.insertBefore(replacement, "thematicBreak");
        assert.strictEqual(container.children.indexOf(before) + 1, container.children.indexOf(replacement));
        const attachedReplacement = scanner.replaceBlock(replacement, "heading");
        assert.isFalse(A.contains(container.children, replacement));
        scanner.setLastLineLength(100);
        scanner.finalizeBlock(attachedReplacement, 0);
        assert.strictEqual(
          scanner.tip,
          container,
          "the scan tip is restored to the document before the core starts run"
        );
      });
    })
  );
  it.effect("reports missing constructs and invalid root materialization", () =>
    Effect.sync(() => {
      const dialect = blockDialect("commonmark");
      withDialect(new BlockDialect([], dialect.starts), () => {
        assert.throws(() => parseBlocks("text"), /no construct registered/);
      });
      for (const node of [undefined, Paragraph.make({ children: [] })]) {
        withDialect(withMaterialize(dialect, "document", materializeTo(node)), () => {
          assert.throws(() => parseBlocks(""), /document construct did not materialize a root/);
        });
      }
      assert.strictEqual(
        blockDialect("commonmark"),
        dialect,
        "each parse gets a fresh composition; the shared registry's construct table and starts are never mutated"
      );
    })
  );
  it.effect("tries the dialect's own starts after an injected start declines", () =>
    Effect.sync(() => {
      withStart(() => undefined);
      assert.strictEqual(parseBlocks("# title").root.children[0]?.type, "heading");
    })
  );
});

it.effect("omits unmaterialized extension blocks and nested roots", () =>
  Effect.sync(() => {
    withStart((scanner, container) => {
      const detachedBeforeRoot = scanner.insertBefore(container, "definition");
      container.children.push(detachedBeforeRoot);
      assert.strictEqual(
        detachedBeforeRoot.open,
        false,
        "insertBefore a root returns a detached block on purpose; the extension owns attaching it"
      );
    });
    const dialect = blockDialect("commonmark");
    withDialect(withMaterialize(dialect, "heading", materializeTo(undefined)), () => {
      assert.deepStrictEqual(parseBlocks("# dropped\n").root.children, []);
    });
    const emptyRoot = parseBlocks("").root;
    withDialect(withMaterialize(dialect, "heading", materializeTo(emptyRoot)), () => {
      assert.deepStrictEqual(parseBlocks("# nested root\n").root.children, []);
    });
  })
);

it.effect("scanner whitespace and tab boundaries retain their documented state", () =>
  Effect.sync(() => {
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
  })
);

it.effect("parses tabs, lazy containers, HTML, references and frontmatter with absolute root spans", () =>
  Effect.sync(() => {
    for (const source of [
      "> a\nb\n\n> \tcode\n",
      "- \tcode\n  continued\n\n- next\n",
      "    code\n\tcontinued\n",
      "<script>\nhello\n</script>\n",
      "<!-- comment -->\n",
      "```\ncode\n```\n",
      "[id]: ./first\n[id]: ./second\n\n[id]\n",
      "[^note]: a\n\n[^note]\n",
      "| a | b |\n| --- | --- |\n| c | d |\n",
      "---\na: b\n---\n",
      "+++\na = 1\n+++\nbody\n",
      "",
      "\n",
      ">\n\n",
      "title\n===\n",
    ]) {
      const parsed = parseBlocks(source, { dialect: "gfm", frontmatter: true });
      assert.strictEqual(parsed.root.type, "root");
      assert.strictEqual(parsed.root.position.end.offset, source.length);
      for (const [key, definition] of parsed.definitionOrder) {
        assert.isTrue(A.contains(parsed.root.children, definition));
        assert.strictEqual(key, "ID");
        assert.strictEqual(definition.url, "./first");
      }
    }
  })
);

it.effect("does not index extension definitions without lookup keys", () =>
  Effect.sync(() => {
    const dialect = withMaterialize(
      blockDialect("commonmark"),
      "definition",
      materializeTo(Definition.make({ identifier: "missing", url: "./target" }))
    );
    withStart((scanner, container) => {
      const block = scanner.insertBefore(container, "definition");
      container.children.push(block);
    }, dialect);
  })
);

it.effect("closes an incompatible leaf before adding a sibling", () =>
  Effect.sync(() => {
    withStart((scanner, container) => {
      const heading = scanner.addChild("heading", 0);
      const paragraph = scanner.addChild("paragraph", 0);
      assert.strictEqual(heading.open, false);
      assert.strictEqual(paragraph.parent, container);
      assert.deepStrictEqual(container.children, [heading, paragraph]);
      scanner.finalizeBlock(paragraph, 1);
    });
  })
);

it.effect("refuses container nesting past the parser's guard", () =>
  Effect.sync(() => {
    assert.throws(() => parseBlocks(`${Str.repeat(300)("> ")}text\n`), /NestingDepthExceeded: limit/);
  })
);
