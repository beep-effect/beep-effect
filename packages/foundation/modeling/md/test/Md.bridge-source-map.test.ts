import { Document, Li, P as Paragraph, Text, Ul } from "@beep/md/Md.model";
import { parseResult } from "@beep/md/Md.parse";
import { positionAt } from "@beep/md/Md.syntax";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import { CORPUS_INPUTS } from "./support/corpusInputs.ts";
import type { Block } from "@beep/md/Md.model";
import type { DocumentSafetyPathSegment } from "@beep/md/Md.safe";
import type { MdFromSyntax } from "@beep/md/Md.syntax";

type NodePath = ReadonlyArray<DocumentSafetyPathSegment>;

const childrenOf = (node: unknown): ReadonlyArray<unknown> =>
  P.hasProperty(node, "children") && A.isArray(node.children) ? node.children : [];

const preOrderPathsIndexedBySourceMapOrdinal = (node: unknown, path: NodePath): ReadonlyArray<NodePath> => [
  path,
  ...A.flatMap(childrenOf(node), (child, index) =>
    preOrderPathsIndexedBySourceMapOrdinal(child, [...path, "children", index])
  ),
];

const BRIDGED: ReadonlyArray<readonly [string, MdFromSyntax]> = A.map(CORPUS_INPUTS, (input) => [
  `${input.corpus}#${input.example}`,
  Result.getOrThrow(parseResult(input.markdown, { dialect: input.dialect })),
]);

const sourceLength = (id: string): number =>
  O.match(
    A.findFirst(CORPUS_INPUTS, (input) => `${input.corpus}#${input.example}` === id),
    { onNone: () => 0, onSome: (input) => input.markdown.length }
  );

const withExtraText = (block: Block): Block =>
  block._tag === "p" ? Paragraph.make({ children: [...block.children, Text.make({ value: "extra" })] }) : block;

describe("@beep/md/Md.syntax source map over the corpus", () => {
  it("resolves every node ordinal to its own entry's kit position", () => {
    for (const [id, bridged] of BRIDGED) {
      const paths = preOrderPathsIndexedBySourceMapOrdinal(bridged.document, []);
      expect([id, paths.length]).toStrictEqual([id, bridged.sourceMap.entries.length]);
      A.forEach(paths, (path, ordinal) => {
        const entry = bridged.sourceMap.entries[ordinal];
        const position = positionAt(bridged.sourceMap, bridged.document, path);
        expect([id, ordinal, O.getOrUndefined(position) === entry?.position]).toStrictEqual([id, ordinal, true]);
      });
    }
  });

  it("keeps every position inside the parsed source", () => {
    for (const [id, bridged] of BRIDGED) {
      const outside = A.filter(
        bridged.sourceMap.entries,
        ({ position }) =>
          position.start.offset < 0 ||
          position.end.offset < position.start.offset ||
          position.end.offset > sourceLength(id)
      );
      expect([id, outside.length]).toStrictEqual([id, 0]);
    }
  });

  it("returns None once a transform drops a top-level node", () => {
    for (const [id, bridged] of BRIDGED) {
      if (A.isReadonlyArrayNonEmpty(bridged.document.children)) {
        const transformed = Document.make({
          frontmatter: bridged.document.frontmatter,
          children: A.dropRight(bridged.document.children, 1),
        });
        const resolved = A.filter(preOrderPathsIndexedBySourceMapOrdinal(transformed, []), (path) =>
          O.isSome(positionAt(bridged.sourceMap, transformed, path))
        );
        expect([id, resolved.length]).toStrictEqual([id, 0]);
      }
    }
  });

  it("returns None at and below a node whose child count changed, and keeps its siblings", () => {
    for (const [id, bridged] of BRIDGED) {
      const index = A.findFirstIndex(bridged.document.children, (block) => block._tag === "p");
      if (O.isSome(index)) {
        const transformed = Document.make({
          frontmatter: bridged.document.frontmatter,
          children: A.map(bridged.document.children, (block, at) =>
            at === index.value ? withExtraText(block) : block
          ),
        });
        const lookup = (path: NodePath) => positionAt(bridged.sourceMap, transformed, path);
        assertNone(lookup(["children", index.value]));
        assertNone(lookup(["children", index.value, "children", 0]));
        const siblings = A.filter(
          A.map(transformed.children, (_, at) => at),
          (at) => at !== index.value
        );
        const unresolved = A.filter(siblings, (at) => O.isNone(lookup(["children", at])));
        expect([id, unresolved]).toStrictEqual([id, []]);
      }
    }
  });
});

const bridgeText = (markdown: string): MdFromSyntax => Result.getOrThrow(parseResult(markdown));

const withChildren = (bridged: MdFromSyntax, children: ReadonlyArray<Block>): Document =>
  Document.make({ frontmatter: bridged.document.frontmatter, children });

const recorded = (bridged: MdFromSyntax, path: NodePath) =>
  O.getOrThrow(positionAt(bridged.sourceMap, bridged.document, path));

describe("@beep/md/Md.syntax source map identity", () => {
  it("resolves every node of an unchanged document and records its tag", () => {
    const bridged = bridgeText("# T\n\n- a\n- b\n- a\n\n> [!NOTE] Title\n> body *x*\n\na\n\nb");
    const paths = preOrderPathsIndexedBySourceMapOrdinal(bridged.document, []);
    A.forEach(paths, (path, ordinal) => {
      const entry = bridged.sourceMap.entries[ordinal];
      assertSome(
        positionAt(bridged.sourceMap, bridged.document, path),
        O.getOrThrow(O.fromUndefinedOr(entry)).position
      );
    });
    const tags = A.map(bridged.sourceMap.entries, (entry) => entry.tag);
    expect(tags[0]).toBe("document");
    expect(A.dedupe(tags)).toStrictEqual(["document", "heading", "text", "ul", "li", "admonition", "p", "em"]);
  });

  it("returns None for both siblings after reversing equal-shape top-level paragraphs", () => {
    const bridged = bridgeText("a\n\nb");
    const reversed = withChildren(bridged, A.reverse(bridged.document.children));
    const lookup = (path: NodePath) => positionAt(bridged.sourceMap, reversed, path);
    assertNone(lookup(["children", 0]));
    assertNone(lookup(["children", 1]));
    assertNone(lookup(["children", 0, "children", 0]));
    assertNone(lookup(["children", 1, "children", 0]));
  });

  it("returns None for swapped same-shape list items and keeps the untouched one", () => {
    const bridged = bridgeText("- a\n- b\n- c");
    const [list] = bridged.document.children;
    if (list?._tag !== "ul") {
      throw new Error("expected a bullet list");
    }
    const [first, middle, last] = list.children;
    if (first === undefined || middle === undefined || last === undefined) {
      throw new Error("expected three items");
    }
    const swapped = withChildren(bridged, [Ul.make({ children: [last, middle, first] })]);
    const lookup = (path: NodePath) => positionAt(bridged.sourceMap, swapped, path);
    assertNone(lookup(["children", 0]));
    assertNone(lookup(["children", 0, "children", 0]));
    assertNone(lookup(["children", 0, "children", 2]));
    assertNone(lookup(["children", 0, "children", 0, "children", 0]));
    assertSome(lookup(["children", 0, "children", 1]), recorded(bridged, ["children", 0, "children", 1]));
    assertSome(
      lookup(["children", 0, "children", 1, "children", 0]),
      recorded(bridged, ["children", 0, "children", 1, "children", 0])
    );
  });

  it("resolves equal content below swapped same-shape siblings to the span recorded at that place", () => {
    const bridged = bridgeText("# foo\n\n## foo");
    const reversed = withChildren(bridged, A.reverse(bridged.document.children));
    const lookup = (path: NodePath) => positionAt(bridged.sourceMap, reversed, path);
    assertNone(lookup(["children", 0]));
    assertNone(lookup(["children", 1]));
    assertSome(lookup(["children", 0, "children", 0]), recorded(bridged, ["children", 0, "children", 0]));
  });

  it("returns None at and above an in-place leaf text edit and keeps unrelated nodes", () => {
    const bridged = bridgeText("a\n\n- b");
    const [paragraph, list] = bridged.document.children;
    if (paragraph?._tag !== "p" || list?._tag !== "ul") {
      throw new Error("expected a paragraph and a list");
    }
    const edited = withChildren(bridged, [
      paragraph,
      Ul.make({ children: [Li.make({ children: [Text.make({ value: "c" })] })] }),
    ]);
    const lookup = (path: NodePath) => positionAt(bridged.sourceMap, edited, path);
    assertNone(lookup([]));
    assertNone(lookup(["children", 1]));
    assertNone(lookup(["children", 1, "children", 0]));
    assertNone(lookup(["children", 1, "children", 0, "children", 0]));
    assertSome(lookup(["children", 0]), recorded(bridged, ["children", 0]));
    assertSome(lookup(["children", 0, "children", 0]), recorded(bridged, ["children", 0, "children", 0]));
  });
});
