import * as Md from "@beep/md/Md.model";
import { documentToPandoc, pandocToDocument } from "@beep/pandoc-ast/Pandoc.mapping";
import * as Pandoc from "@beep/pandoc-ast/Pandoc.model";
import * as PatternOntology from "@beep/schema/PatternOntology";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as R from "effect/Record";
import type { JsonPath, PandocMappingIssue } from "@beep/pandoc-ast/Pandoc.report";
import type * as S from "effect/Schema";

const { collectPoTaggedConstructors, getPoPattern, poConservation } = PatternOntology;

const patternOf = (schema: S.Top): PatternOntology.PoPattern => O.getOrThrow(getPoPattern(schema));

type Rerealization = readonly [source: string, target: string];

const paragraphHoldingOneDisplayMathIsMdMathBlock: ReadonlyArray<Rerealization> = [
  ["para", "mathBlock"],
  ["plain", "mathBlock"],
];
const pandocSpaceMilestonesThatSeparateWordsBecomeWhitespaceKeptInMdText: ReadonlyArray<Rerealization> = [
  ["space", "text"],
];
const pandocAltInlineRunBecomesMdAltStringAttributeWithImageIssueBeneathTheImagePath: ReadonlyArray<Rerealization> = [
  ["image", "img"],
];
const emptyAttributeSpanIsIdentityWrapperPassingChildrenUnchangedWhileAttributedSpanReportsSpanIssueAtItsOwnPath: ReadonlyArray<Rerealization> =
  [
    ["span", "text"],
    ["span", "strong"],
    ["span", "em"],
    ["span", "del"],
    ["span", "code"],
    ["span", "a"],
    ["span", "img"],
    ["span", "br"],
    ["span", "inlineMath"],
  ];

const pandocToMdLosslessRerealizations: ReadonlyArray<Rerealization> = [
  ...paragraphHoldingOneDisplayMathIsMdMathBlock,
  ...pandocSpaceMilestonesThatSeparateWordsBecomeWhitespaceKeptInMdText,
  ...pandocAltInlineRunBecomesMdAltStringAttributeWithImageIssueBeneathTheImagePath,
  ...emptyAttributeSpanIsIdentityWrapperPassingChildrenUnchangedWhileAttributedSpanReportsSpanIssueAtItsOwnPath,
];

const mdMathBlockIsParagraphHoldingOneDisplayMath: ReadonlyArray<Rerealization> = [["mathBlock", "para"]];
const mdAltStringAttributeBecomesPandocAltInlineRun: ReadonlyArray<Rerealization> = [["img", "image"]];
const mdTextTokenizesIntoPandocWordsAndWhitespaceMilestones: ReadonlyArray<Rerealization> = [
  ["text", "space"],
  ["text", "softbreak"],
];

const mdToPandocLosslessRerealizations: ReadonlyArray<Rerealization> = [
  ...mdMathBlockIsParagraphHoldingOneDisplayMath,
  ...mdAltStringAttributeBecomesPandocAltInlineRun,
  ...mdTextTokenizesIntoPandocWordsAndWhitespaceMilestones,
];

const isRerealized = (table: ReadonlyArray<readonly [string, string]>, source: string, target: string): boolean =>
  A.some(table, ([from, to]) => from === source && to === target);

const hasIssueAt = (issues: ReadonlyArray<PandocMappingIssue.Type>, path: JsonPath): boolean =>
  A.some(
    issues,
    (issue) => issue.path.length === path.length && A.every(path, (segment, index) => issue.path[index] === segment)
  );

const isEmptyAllTheWayDown = (inline: unknown): boolean =>
  Predicate.hasProperty(inline, "text")
    ? inline.text === ""
    : Predicate.hasProperty(inline, "children") && A.isArray(inline.children)
      ? A.every(inline.children, isEmptyAllTheWayDown)
      : false;

const hasIssueAtOrBeneath = (issues: ReadonlyArray<PandocMappingIssue.Type>, path: JsonPath): boolean =>
  A.some(
    issues,
    (issue) => issue.path.length >= path.length && A.every(path, (segment, index) => issue.path[index] === segment)
  );

const expectConserved = (input: {
  readonly direction: string;
  readonly sourceTag: string;
  readonly sourcePattern: PatternOntology.PoPattern;
  readonly targetTag: string;
  readonly targetPattern: PatternOntology.PoPattern;
  readonly explicit: boolean;
  readonly rerealized: ReadonlyArray<readonly [string, string]>;
}): void => {
  const conservation = poConservation(input.sourcePattern, input.targetPattern);
  const justified =
    conservation === "preserved" || input.explicit || isRerealized(input.rerealized, input.sourceTag, input.targetTag);

  expect(
    justified,
    `${input.direction}: ${input.sourceTag}(${input.sourcePattern}) -> ${input.targetTag}(${input.targetPattern}) was demoted silently; a lossless re-realization is the same information under different content models and the mapping emits no diagnostic, and every other pattern change must coincide with a PandocMappingIssue at the construct's path`
  ).toBe(true);
};

describe("@beep/pandoc-ast Pattern Ontology classification", () => {
  it("stamps exactly one valid PO pattern on every tagged constructor reachable from PandocDocument", () => {
    const rows = collectPoTaggedConstructors(Pandoc.PandocDocument, "_tag");
    const unannotated = A.getSomes(A.map(rows, (row) => (O.isNone(row.pattern) ? O.some(row.tag) : O.none())));

    expect(unannotated).toEqual([]);
    expect(A.length(A.dedupe(A.map(rows, (row) => row.tag)))).toBe(A.length(rows));
    expect(A.length(rows)).toBe(44);
  });

  it("classifies every inline, block, and metadata union member", () => {
    const patterns = {
      ...R.map(Pandoc.PandocInline.cases, (member) => O.getOrNull(getPoPattern(member))),
      ...R.map(Pandoc.PandocBlock.cases, (member) => O.getOrNull(getPoPattern(member))),
      ...R.map(Pandoc.PandocMetaValue.cases, (member) => O.getOrNull(getPoPattern(member))),
    };

    expect(patterns).toEqual({
      str: "atom",
      space: "milestone",
      softbreak: "milestone",
      linebreak: "milestone",
      emph: "inline",
      underline: "inline",
      strong: "inline",
      strikeout: "inline",
      superscript: "inline",
      subscript: "inline",
      smallCaps: "inline",
      quoted: "inline",
      cite: "inline",
      code: "atom",
      link: "inline",
      image: "inline",
      span: "inline",
      note: "popup",
      math: "atom",
      rawInline: "atom",
      unknownInline: "milestone",
      plain: "block",
      para: "block",
      lineBlock: "table",
      header: "block",
      blockquote: "container",
      codeblock: "field",
      rawBlock: "field",
      bulletlist: "table",
      orderedlist: "table",
      definitionList: "table",
      horizontalrule: "meta",
      div: "container",
      table: "table",
      figure: "container",
      unknownBlock: "meta",
      metaBool: "field",
      metaString: "field",
      metaInlines: "block",
      metaBlocks: "container",
      metaList: "table",
      metaMap: "record",
      unknownMeta: "meta",
    });
    expect(O.getOrNull(getPoPattern(Pandoc.PandocDocument))).toBe("container");
  });

  describe("Pandoc -> Md conservation: pattern preserved or explicitly demoted", () => {
    for (const [tag, member] of R.toEntries(Pandoc.PandocBlock.cases)) {
      it.effect.prop(
        `conserves or demotes the ${tag} block through PandocMappingIssue`,
        { block: Arbitrary.schema(member) },
        Effect.fnUntraced(function* ({ block }) {
          const result = yield* pandocToDocument(Pandoc.PandocDocument.make({ blocks: [block], meta: {} }));
          const target = O.getOrThrow(A.head(result.document.children));

          expectConserved({
            direction: "pandoc-to-md",
            sourceTag: tag,
            sourcePattern: patternOf(member),
            targetTag: target._tag,
            targetPattern: patternOf(Md.Block.cases[target._tag]),
            explicit: hasIssueAt(result.report.issues, ["blocks", 0]),
            rerealized: pandocToMdLosslessRerealizations,
          });
        }),
        { arbitrary: fcRuns(25) }
      );
    }

    for (const [tag, member] of R.toEntries(Pandoc.PandocInline.cases)) {
      it.effect.prop(
        `conserves or demotes the ${tag} inline through PandocMappingIssue`,
        { inline: Arbitrary.schema(member) },
        Effect.fnUntraced(function* ({ inline }) {
          const result = yield* pandocToDocument(
            Pandoc.PandocDocument.make({ blocks: [Pandoc.Para.make({ children: [inline] })], meta: {} })
          );
          const paragraph = O.getOrThrow(A.head(result.document.children));
          const explicit = hasIssueAt(result.report.issues, ["blocks", 0, "children", 0]);

          if (paragraph._tag !== "p") {
            expect(
              paragraph._tag,
              "a lone display-math inline re-realizes the whole paragraph as a math block, which the block law covers"
            ).toBe("mathBlock");
            return;
          }

          if (!A.isReadonlyArrayNonEmpty(paragraph.children)) {
            expect(
              hasIssueAtOrBeneath(result.report.issues, ["blocks", 0, "children", 0]) || isEmptyAllTheWayDown(inline),
              `pandoc-to-md: ${tag} was dropped silently; a dropped inline demotes everything it held, so an issue at or beneath its path must explain it unless it held nothing`
            ).toBe(true);
          }

          A.forEach(paragraph.children, (target) =>
            expectConserved({
              direction: "pandoc-to-md",
              sourceTag: tag,
              sourcePattern: patternOf(member),
              targetTag: target._tag,
              targetPattern: patternOf(Md.Inline.cases[target._tag]),
              explicit,
              rerealized: pandocToMdLosslessRerealizations,
            })
          );
        }),
        { arbitrary: fcRuns(25) }
      );
    }
  });

  describe("Md -> Pandoc conservation: pattern preserved or explicitly demoted", () => {
    for (const [tag, member] of R.toEntries(Md.Block.cases)) {
      it.effect.prop(
        `conserves or demotes the ${tag} block through PandocMappingIssue`,
        { block: Arbitrary.schema(member) },
        Effect.fnUntraced(function* ({ block }) {
          const result = yield* documentToPandoc(Md.Document.make({ children: [block] }));
          const target = O.getOrThrow(A.head(result.pandoc.blocks));

          expectConserved({
            direction: "md-to-pandoc",
            sourceTag: tag,
            sourcePattern: patternOf(member),
            targetTag: target._tag,
            targetPattern: patternOf(Pandoc.PandocBlock.cases[target._tag]),
            explicit: hasIssueAt(result.report.issues, ["children", 0]),
            rerealized: mdToPandocLosslessRerealizations,
          });
        }),
        { arbitrary: fcRuns(25) }
      );
    }

    for (const [tag, member] of R.toEntries(Md.Inline.cases)) {
      it.effect.prop(
        `conserves or demotes the ${tag} inline through PandocMappingIssue`,
        { inline: Arbitrary.schema(member) },
        Effect.fnUntraced(function* ({ inline }) {
          const result = yield* documentToPandoc(Md.Document.make({ children: [Md.P.make({ children: [inline] })] }));
          const paragraph = O.getOrThrow(A.head(result.pandoc.blocks));
          const explicit = hasIssueAt(result.report.issues, ["children", 0, "children", 0]);

          expect(paragraph._tag).toBe("para");
          if (paragraph._tag !== "para") {
            return;
          }

          if (!A.isReadonlyArrayNonEmpty(paragraph.children)) {
            expect(
              hasIssueAtOrBeneath(result.report.issues, ["children", 0, "children", 0]) || isEmptyAllTheWayDown(inline),
              `md-to-pandoc: ${tag} was dropped silently`
            ).toBe(true);
          }

          A.forEach(paragraph.children, (target) =>
            expectConserved({
              direction: "md-to-pandoc",
              sourceTag: tag,
              sourcePattern: patternOf(member),
              targetTag: target._tag,
              targetPattern: patternOf(Pandoc.PandocInline.cases[target._tag]),
              explicit,
              rerealized: mdToPandocLosslessRerealizations,
            })
          );
        }),
        { arbitrary: fcRuns(25) }
      );
    }
  });

  it.effect("reports a deliberately lossy Pandoc table as an explicit demotion from table to block", () =>
    Effect.gen(function* () {
      const table = yield* Effect.orDie(Arbitrary.sampleEffect(Arbitrary.schema(Pandoc.Table), { count: 1 }));
      const result = yield* pandocToDocument(Pandoc.PandocDocument.make({ blocks: table, meta: {} }));
      const target = O.getOrThrow(A.head(result.document.children));

      expect(poConservation(patternOf(Pandoc.Table), patternOf(Md.Block.cases[target._tag]))).toBe("demoted");
      expect(A.map(result.report.issues, (issue) => [issue.construct, issue.pointer])).toEqual([
        ["Table", "/blocks/0"],
      ]);
    })
  );
});
