import { MAX_NESTING_DEPTH } from "@beep/markdown/internal/limits";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownFormat } from "@beep/markdown/MarkdownFormat";
import { Blockquote, Heading, List, Paragraph, Root, Table, Text } from "@beep/markdown/MarkdownNode";
import { MarkdownVisitor } from "@beep/markdown/MarkdownVisitor";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type { FlowContent } from "@beep/markdown/MarkdownNode";

const parseDoc = (text: string) => {
  const result = MarkdownDocument.parseResult(text);
  assert.isTrue(Result.isSuccess(result));
  return Result.getOrThrow(result);
};

const source = A.join(
  [
    "# Title",
    "",
    "Intro with a [link](/a).",
    "",
    "> ## Quoted heading",
    "",
    "- item one",
    "- item two",
    "",
    "| h |",
    "| - |",
    "| c |",
    "",
    "## Outro",
    "",
  ],
  "\n"
);

describe("MarkdownDocument.find", () => {
  it("finds the first node of a type, narrowed through the type tag", () => {
    const document = parseDoc(source);
    const heading = document.find("heading");
    assert.isDefined(heading);
    assert(S.is(Heading)(heading));
    assert.strictEqual(heading.depth, 1, "the narrowed static type exposes depth without a cast");
  });

  it("matches by identity against the document's own tree", () => {
    const document = parseDoc(source);
    assert.strictEqual(document.find("heading"), document.root.children[0]);
    assert.strictEqual(
      document.find(() => true),
      document.root,
      "the root is in the walk, so the widest query returns it first"
    );
    assert.strictEqual(document.find("root"), document.root);
  });

  it("accepts a plain predicate and returns the wide node union", () => {
    const document = parseDoc(source);
    const found = document.find((node) => node.type === "heading" && node.depth === 2);
    assert.isDefined(found);
    assert(S.is(Heading)(found));
  });

  it("narrows through a type-guard predicate", () => {
    const document = parseDoc(source);
    const table = document.find((node): node is Table => node.type === "table");
    assert.isDefined(table);
    assert(S.is(Table)(table));
    assert.isDefined(table.align);
  });

  it("returns undefined when nothing matches", () => {
    const document = parseDoc(source);
    assert.isUndefined(document.find("footnoteDefinition"));
    assert.isUndefined(document.find(() => false));
  });
});

describe("MarkdownDocument.findAll", () => {
  it("collects every match in document pre-order, wherever it nests", () => {
    const document = parseDoc(source);
    const headings = document.findAll("heading");
    assert.strictEqual(headings.length, 3);
    for (const heading of headings) {
      assert(S.is(Heading)(heading));
    }
    assert.deepStrictEqual(
      A.map(headings, (heading) => heading.depth),
      [1, 2, 2],
      "document order puts the quoted heading between the root-level ones, so findAll(heading)[1] addresses it"
    );
    assert.deepStrictEqual(
      headings,
      A.map(document.headings, (entry) => entry.node),
      "the same nodes in the same order as the headings getter"
    );
  });

  it("matches the visitor's Enter order node for node, root included", () => {
    const document = parseDoc(source);
    const events = MarkdownVisitor.visit(document.root).pipe(Stream.runCollect, Effect.runSync);
    const entered = A.map(
      A.filter([...events], (event) => event._tag === "Enter"),
      (event) => event.node
    );
    assert.deepStrictEqual(
      document.findAll(() => true),
      entered
    );
  });

  it("returns an empty array when nothing matches", () => {
    const document = parseDoc("plain paragraph\n");
    assert.deepStrictEqual(document.findAll("code"), []);
  });

  it("collects with a type-guard predicate over fidelity fields", () => {
    const document = parseDoc(source);
    const unordered = document.findAll((node): node is List => node.type === "list" && node.ordered !== true);
    assert.strictEqual(unordered.length, 1);
    assert(S.is(List)(unordered[0]));
  });
});

describe("query helpers feed MarkdownFormat.modify", () => {
  it.effect("finds a node and replaces it by identity", () =>
    Effect.gen(function* () {
      const document = parseDoc(source);
      const outro = document.findAll("heading")[2];
      assert.isDefined(outro);
      const replacement = Heading.make({ depth: 3, children: [Text.make({ value: "Fin" })] });
      const out = yield* MarkdownFormat.modifyToString(document, outro, replacement);
      assert.isTrue(Str.includes("### Fin")(out));
      assert.isFalse(Str.includes("## Outro")(out));
    })
  );
});

describe("guard posture", () => {
  const overDeepDocument = (): MarkdownDocument => {
    let flow: FlowContent = Paragraph.make({ children: [Text.make({ value: "x" })] });
    for (let index = 0; index < MAX_NESTING_DEPTH + 44; index += 1) {
      flow = Blockquote.make({ children: [flow] });
    }
    return MarkdownDocument.make({
      source: "",
      root: Root.make({ children: [flow] }),
      diagnostics: [],
      definitions: HashMap.empty(),
      definitionOrder: [],
    });
  };

  it("refuses an over-deep foreign tree as a defect, mirroring the getters", () => {
    const document = overDeepDocument();
    assert.throws(() => document.findAll("text"));
    const findDescendingPastCap = () => document.find("text");
    assert.throws(findDescendingPastCap);
  });

  it("returns early without visiting the deep region when a shallow node matches", () => {
    const document = overDeepDocument();
    assert.strictEqual(document.find("root"), document.root);
  });
});
