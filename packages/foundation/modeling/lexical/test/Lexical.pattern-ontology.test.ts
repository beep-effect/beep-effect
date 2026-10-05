import { blockToLexical, nodeToBlocks } from "@beep/lexical-schema/Lexical.codec";
import { LexicalNode, SerializedEditorState } from "@beep/lexical-schema/Lexical.model";
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

/**
 * The Lexical codec has no issue channel: its demotions are the locked
 * lossiness profile in the package README ("Degraded on Md -> Lexical" and
 * "Normalizations"). This table is that profile stated as pattern transitions;
 * a pattern change outside it is a silent demotion and fails the law.
 */
const mdToLexicalDemotions: ReadonlyArray<readonly [source: string, target: string]> = [
  // Degraded: plain-text paragraphs using the canonical Markdown projection.
  ["mathBlock", "paragraph"],
  ["footnoteDefinition", "paragraph"],
  ["admonition", "paragraph"],
  ["embed", "paragraph"],
  // Degraded: Hr -> a literal "---" paragraph.
  ["hr", "paragraph"],
  // Normalization: a block quote flattens to one inline-only quote element.
  ["blockquote", "quote"],
  // Lossless: fenced code text re-realizes as text, tab, and linebreak leaves.
  ["pre", "code"],
  // Lossless: the artifact-link paragraph convention becomes a block leaf.
  ["p", "artifact-ref"],
  // Degraded: marks become text format bits on their flattened children, so a
  // mark projects onto exactly the leaves its children project onto: text
  // runs, line breaks, and links. Images become links; footnote references
  // become literal text.
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

/**
 * `nodeToBlocks` is a total projection. Root-level elements keep their pattern
 * or re-realize through these documented transitions; loose leaves that have no
 * block position in Md wrap into a paragraph.
 */
const lexicalToMdDemotions: ReadonlyArray<readonly [source: string, target: string]> = [
  ["quote", "blockquote"],
  ["code", "pre"],
  ["artifact-ref", "p"],
  // Detached structural nodes project onto their paragraph content; a detached
  // table row re-wraps into a table and conserves its pattern.
  ["listitem", "p"],
  ["tablecell", "p"],
];

/** Inline-level leaves have no block position in Md and wrap into a paragraph. */
const looseLeafTypes: ReadonlyArray<string> = ["text", "tab", "linebreak", "link"];

const isDeclared = (table: ReadonlyArray<readonly [string, string]>, source: string, target: string): boolean =>
  A.some(table, ([from, to]) => from === source && to === target);

const expectConserved = (input: {
  readonly direction: string;
  readonly sourceTag: string;
  readonly sourcePattern: PatternOntology.PoPattern;
  readonly targetTag: string;
  readonly targetPattern: PatternOntology.PoPattern;
  readonly declared: ReadonlyArray<readonly [string, string]>;
}): void => {
  const conservation = poConservation(input.sourcePattern, input.targetPattern);
  const justified = conservation === "preserved" || isDeclared(input.declared, input.sourceTag, input.targetTag);

  expect(
    justified,
    `${input.direction}: ${input.sourceTag}(${input.sourcePattern}) -> ${input.targetTag}(${input.targetPattern}) was demoted silently`
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
            // Empty text leaves vanish in Lexical, so a mark over empty text has
            // nothing a projection could drop.
            expect(Str.isEmpty(Md.Inline.toPlainText(inline)), `md-to-lexical: ${tag} was dropped silently`).toBe(true);
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
        { node: Arbitrary.schema(member) },
        ({ node }) => {
          const blocks = nodeToBlocks(node);

          // The root flattens to its children, which carry their own law.
          if (type === "root") {
            return;
          }

          // An inline leaf wraps into a paragraph; every other node, root-level
          // or detached structural, must conserve or carry a declared transition.
          const looseLeafWrapped = (target: Md.Block): boolean =>
            A.contains(looseLeafTypes, type) && target._tag === "p";

          A.forEach(blocks, (target) => {
            if (looseLeafWrapped(target)) {
              return;
            }
            expectConserved({
              direction: "lexical-to-md",
              sourceTag: type,
              sourcePattern: patternOf(member),
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
