import { blockToLexical, nodeToBlocks } from "@beep/lexical-schema/Lexical.codec";
import {
  LexicalNode,
  ListNode,
  ListNodeValue,
  QuoteNode,
  SerializedEditorState,
} from "@beep/lexical-schema/Lexical.model";
import * as Md from "@beep/md/Md.model";
import * as PatternOntology from "@beep/schema/PatternOntology";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type * as S from "effect/Schema";

const { collectPoTaggedConstructors, getPoPattern, poConservation } = PatternOntology;

const patternOf = (schema: S.Top): PatternOntology.PoPattern => O.getOrThrow(getPoPattern(schema));

type PatternTransition = readonly [source: string, target: string];

const plainTextParagraphDemotions: ReadonlyArray<PatternTransition> = [
  ["mathBlock", "paragraph"],
  ["footnoteDefinition", "paragraph"],
  ["admonition", "paragraph"],
  ["embed", "paragraph"],
  ["hr", "paragraph"],
];

const blockquoteFlattening: ReadonlyArray<PatternTransition> = [["blockquote", "quote"]];

const losslessRealizations: ReadonlyArray<PatternTransition> = [
  ["pre", "code"],
  ["p", "artifact-ref"],
];

const markFormatBitDemotions: ReadonlyArray<PatternTransition> = [
  ["strong", "text"],
  ["strong", "linebreak"],
  ["strong", "link"],
  ["em", "text"],
  ["em", "linebreak"],
  ["em", "link"],
  ["del", "text"],
  ["del", "linebreak"],
  ["del", "link"],
  ["img", "link"],
  ["footnoteReference", "text"],
];

const cellParagraphWrapping: ReadonlyArray<PatternTransition> = [["tableCell", "tablecell"]];

const mdToLexicalDemotions: ReadonlyArray<PatternTransition> = [
  ...plainTextParagraphDemotions,
  ...blockquoteFlattening,
  ...losslessRealizations,
  ...markFormatBitDemotions,
  ...cellParagraphWrapping,
];

const detachedStructuralToParagraph: ReadonlyArray<PatternTransition> = [
  ["listitem", "p"],
  ["tablecell", "p"],
];

const cellParagraphUnwrapping: ReadonlyArray<PatternTransition> = [["tablecell", "tableCell"]];

const lexicalToMdDemotions: ReadonlyArray<PatternTransition> = [
  ["quote", "blockquote"],
  ["code", "pre"],
  ["artifact-ref", "p"],
  ...detachedStructuralToParagraph,
  ...cellParagraphUnwrapping,
];

const mdFieldOnlyMembers = {
  li: Md.Li,
  taskItem: Md.TaskItem,
  tableRow: Md.TableRow,
  tableCell: Md.TableCell,
};

type MdFieldOnlyNode = Md.Li | Md.TaskItem | Md.TableRow | Md.TableCell;
type LexicalStructuralNode = Extract<LexicalNode, { readonly type: "listitem" | "tablerow" | "tablecell" }>;

const isLexicalStructural = (node: LexicalNode): node is LexicalStructuralNode =>
  node.type === "listitem" || node.type === "tablerow" || node.type === "tablecell";

const mdFieldOnlyChildren = (block: Md.Block): ReadonlyArray<MdFieldOnlyNode> =>
  block._tag === "ul" || block._tag === "ol" || block._tag === "taskList"
    ? block.children
    : block._tag === "table"
      ? A.flatMap(block.children, (row): ReadonlyArray<MdFieldOnlyNode> => [row, ...row.children])
      : [];

const structuralOnly = (nodes: ReadonlyArray<LexicalNode>): ReadonlyArray<LexicalStructuralNode> =>
  A.getSomes(A.map(nodes, (node) => (isLexicalStructural(node) ? O.some(node) : O.none())));

const lexicalStructuralChildren = (node: LexicalNode): ReadonlyArray<LexicalStructuralNode> =>
  node.type === "list"
    ? structuralOnly(node.children)
    : node.type === "table"
      ? A.flatMap(
          structuralOnly(node.children),
          (row): ReadonlyArray<LexicalStructuralNode> => [row, ...structuralOnly(row.children)]
        )
      : [];

type InPlacePair = readonly [md: MdFieldOnlyNode, lexical: LexicalNode];

const inPlacePair = (md: MdFieldOnlyNode, lexical: LexicalNode): InPlacePair => [md, lexical];

const inPlacePairs = (block: Md.Block, node: LexicalNode): ReadonlyArray<InPlacePair> =>
  (block._tag === "ul" || block._tag === "ol" || block._tag === "taskList") && node.type === "list"
    ? A.zipWith(block.children, node.children, inPlacePair)
    : block._tag === "table" && node.type === "table"
      ? A.flatten(
          A.zipWith(
            block.children,
            node.children,
            (row, lexicalRow): ReadonlyArray<InPlacePair> => [
              inPlacePair(row, lexicalRow),
              ...(lexicalRow.type === "tablerow" ? A.zipWith(row.children, lexicalRow.children, inPlacePair) : []),
            ]
          )
        )
      : [];

const inPlaceLexicalType: Readonly<Record<MdFieldOnlyNode["_tag"], LexicalStructuralNode["type"]>> = {
  li: "listitem",
  taskItem: "listitem",
  tableRow: "tablerow",
  tableCell: "tablecell",
};

const looseLeafTypes: ReadonlyArray<string> = ["text", "tab", "linebreak", "link"];

const NoDiscardListNodes = Arbitrary.schema(ListNodeValue).pipe(Arbitrary.map((payload) => ListNode.make(payload)));

const isDeclared = (table: ReadonlyArray<PatternTransition>, source: string, target: string): boolean =>
  A.some(table, ([from, to]) => from === source && to === target);

const expectConserved = (input: {
  readonly direction: string;
  readonly sourceTag: string;
  readonly sourcePattern: PatternOntology.PoPattern;
  readonly targetTag: string;
  readonly targetPattern: PatternOntology.PoPattern;
  readonly declared: ReadonlyArray<PatternTransition>;
}): void => {
  const conservation = poConservation(input.sourcePattern, input.targetPattern);
  const justified = conservation === "preserved" || isDeclared(input.declared, input.sourceTag, input.targetTag);

  expect(
    justified,
    `${input.direction}: ${input.sourceTag}(${input.sourcePattern}) -> ${input.targetTag}(${input.targetPattern}) was demoted silently; the codec has no issue channel, so every demotion must be in the README lossiness profile`
  ).toBe(true);
};

describe("@beep/lexical-schema Pattern Ontology classification", () => {
  it("stamps exactly one valid PO pattern on every tagged constructor reachable from SerializedEditorState", () => {
    const rows = collectPoTaggedConstructors(SerializedEditorState, "type");
    const unannotated = A.getSomes(A.map(rows, (row) => (O.isNone(row.pattern) ? O.some(row.tag) : O.none())));

    expect(unannotated).toEqual([]);
    expect(A.length(A.dedupe(A.map(rows, (row) => row.tag)))).toBe(A.length(rows));
    expect(A.length(rows)).toBe(16);
  });

  it("classifies every LexicalNode union member", () => {
    expect(R.map(LexicalNode.cases, (member) => O.getOrNull(getPoPattern(member)))).toEqual({
      text: "atom",
      tab: "atom",
      linebreak: "milestone",
      "artifact-ref": "meta",
      youtube: "meta",
      root: "container",
      paragraph: "block",
      heading: "block",
      quote: "block",
      list: "table",
      listitem: "container",
      link: "inline",
      code: "block",
      table: "table",
      tablerow: "table",
      tablecell: "container",
    });
  });

  describe("Md -> Lexical conservation: pattern preserved or in the locked lossiness profile", () => {
    for (const [tag, member] of R.toEntries(Md.Block.cases)) {
      it.effect.prop(
        `conserves or explicitly demotes the ${tag} block`,
        { block: Arbitrary.schema(member) },
        Effect.fnUntraced(function* ({ block }) {
          const target = yield* blockToLexical(block);

          expectConserved({
            direction: "md-to-lexical",
            sourceTag: tag,
            sourcePattern: patternOf(member),
            targetTag: target.type,
            targetPattern: patternOf(LexicalNode.cases[target.type]),
            declared: mdToLexicalDemotions,
          });
        }),
        { arbitrary: fcRuns(25) }
      );
    }

    for (const [tag, member] of R.toEntries(Md.Inline.cases)) {
      it.effect.prop(
        `conserves or explicitly demotes the ${tag} inline`,
        { inline: Arbitrary.schema(member) },
        Effect.fnUntraced(function* ({ inline }) {
          const paragraph = yield* blockToLexical(Md.P.make({ children: [inline] }));

          expect(paragraph.type).toBe("paragraph");
          if (paragraph.type !== "paragraph") {
            return;
          }

          if (!A.isReadonlyArrayNonEmpty(paragraph.children)) {
            expect(
              Str.isEmpty(Md.Inline.toPlainText(inline)),
              `md-to-lexical: ${tag} was dropped silently; only a mark over empty text may vanish, since Lexical drops empty text leaves`
            ).toBe(true);
          }

          A.forEach(paragraph.children, (target) =>
            expectConserved({
              direction: "md-to-lexical",
              sourceTag: tag,
              sourcePattern: patternOf(member),
              targetTag: target.type,
              targetPattern: patternOf(LexicalNode.cases[target.type]),
              declared: mdToLexicalDemotions,
            })
          );
        }),
        { arbitrary: fcRuns(25) }
      );
    }
  });

  describe("Lexical -> Md conservation: root elements preserve or re-realize, loose leaves wrap", () => {
    for (const [type, member] of R.toEntries(LexicalNode.cases)) {
      it.prop(
        `projects the ${type} node with a conserved or declared pattern`,
        { node: type === "list" ? NoDiscardListNodes : Arbitrary.schema(member) },
        ({ node }) => {
          const blocks = nodeToBlocks(node);

          if (type === "root") {
            return;
          }

          const looseLeafWrapped = (target: Md.Block): boolean =>
            A.contains(looseLeafTypes, type) && target._tag === "p";

          A.forEach(blocks, (target) => {
            if (looseLeafWrapped(target)) {
              return;
            }
            expectConserved({
              direction: "lexical-to-md",
              sourceTag: type,
              sourcePattern: node.type === "quote" ? QuoteNode.poPatternOf(node) : patternOf(member),
              targetTag: target._tag,
              targetPattern: patternOf(Md.Block.cases[target._tag]),
              declared: lexicalToMdDemotions,
            });
          });
        },
        { arbitrary: fcRuns(25) }
      );
    }
  });

  describe("field-only constructors are checked in place", () => {
    for (const [name, member] of R.toEntries({ Ul: Md.Ul, Ol: Md.Ol, TaskList: Md.TaskList, Table: Md.Table })) {
      it.effect.prop(
        `conserves or explicitly demotes the children of ${name} position by position`,
        { block: Arbitrary.schema(member) },
        Effect.fnUntraced(function* ({ block }) {
          const node = yield* blockToLexical(block);

          const forward = inPlacePairs(block, node);
          expect(
            A.length(forward),
            "md-to-lexical: a field-only child was dropped (zipWith truncates, so a missing sibling shortens the pair count)"
          ).toBe(A.length(mdFieldOnlyChildren(block)));
          A.forEach(forward, ([md, lexical]) => {
            expect(lexical.type, `md-to-lexical: ${md._tag} landed on the wrong node`).toBe(
              inPlaceLexicalType[md._tag]
            );
            expectConserved({
              direction: "md-to-lexical",
              sourceTag: md._tag,
              sourcePattern: patternOf(mdFieldOnlyMembers[md._tag]),
              targetTag: lexical.type,
              targetPattern: patternOf(LexicalNode.cases[lexical.type]),
              declared: mdToLexicalDemotions,
            });
          });

          const backward = O.match(A.head(nodeToBlocks(node)), {
            onNone: A.empty<InPlacePair>,
            onSome: (returned) => inPlacePairs(returned, node),
          });
          expect(
            A.length(backward),
            "lexical-to-md: a structural child was dropped (zipWith truncates, so a missing sibling shortens the pair count)"
          ).toBe(A.length(lexicalStructuralChildren(node)));
          A.forEach(backward, ([md, lexical]) => {
            expect(lexical.type, `lexical-to-md: ${lexical.type} landed on the wrong node`).toBe(
              inPlaceLexicalType[md._tag]
            );
            expectConserved({
              direction: "lexical-to-md",
              sourceTag: lexical.type,
              sourcePattern: patternOf(LexicalNode.cases[lexical.type]),
              targetTag: md._tag,
              targetPattern: patternOf(mdFieldOnlyMembers[md._tag]),
              declared: lexicalToMdDemotions,
            });
          });
        }),
        { arbitrary: fcRuns(25) }
      );
    }
  });

  it("refines the quote pattern per instance", () => {
    const quote = (shadowRoot: boolean) => QuoteNode.make({ shadowRoot: O.some(shadowRoot), children: [] });

    expect(O.getOrNull(getPoPattern(QuoteNode))).toBe("block");
    expect(QuoteNode.poPatternOf(quote(false))).toBe("block");
    expect(QuoteNode.poPatternOf(quote(true))).toBe("container");
    expect(poConservation(QuoteNode.poPatternOf(quote(true)), patternOf(Md.BlockQuote))).toBe("preserved");
  });

  it.effect("records the block quote flattening as an explicit container-to-block demotion", () =>
    Effect.gen(function* () {
      const quote = yield* blockToLexical(
        Md.BlockQuote.make({
          children: [
            Md.P.make({ children: [Md.Text.make({ value: "one" })] }),
            Md.P.make({ children: [Md.Text.make({ value: "two" })] }),
          ],
        })
      );

      expect(quote.type).toBe("quote");
      expect(poConservation(patternOf(Md.BlockQuote), patternOf(LexicalNode.cases[quote.type]))).toBe("demoted");
      expect(isDeclared(mdToLexicalDemotions, "blockquote", quote.type)).toBe(true);
    })
  );
});
