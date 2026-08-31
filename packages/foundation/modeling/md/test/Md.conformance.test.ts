import { Md } from "@beep/md";
import {
  BeepMarkdownDocument,
  BeepMarkdownSpecificationProfile,
  CommonMarkDocument,
  CommonMarkSpecificationProfile,
  formatMarkdownConformanceIssue,
  GfmDocument,
  GfmSpecificationProfile,
  inspectMarkdownDocumentLosslessly,
  inspectMarkdownSpecificationConformance,
  MarkdownConformanceIssue,
  MarkdownConformanceProfile,
  markdownConformanceIssues,
  refineStrictMarkdownDocument,
} from "@beep/md/Md.conformance";
import { CompatibilityUrlPolicy, UrlPolicySpec } from "@beep/md/Md.escape";
import {
  Block,
  Del,
  Document,
  FootnoteIdentifier,
  Heading,
  HeadingLevel,
  HeadingValue,
  Inline,
  ListItemChild,
  OrderedListStart,
  TableCell,
  TaskItem,
  Text,
} from "@beep/md/Md.model";
import { renderHtmlBlock } from "@beep/md/Md.render";
import { DocumentSafetyViolation, RawNodeSafetyViolation } from "@beep/md/Md.safe";
import { ConformanceReport } from "@beep/schema/Conformance";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const tags = (issues: ReadonlyArray<MarkdownConformanceIssue>): ReadonlyArray<MarkdownConformanceIssue["_tag"]> =>
  A.map(issues, ({ _tag }) => _tag);

describe("Markdown semantic conformance", () => {
  it("exposes six flat heading payload cases with exhaustive helpers", () => {
    const heading = HeadingValue.cases[2].make({ children: [Text.make({ value: "Overview" })] });

    expect(S.is(HeadingLevel)(heading.level)).toBe(true);
    expect(heading).toEqual({ level: 2, children: [Text.make({ value: "Overview" })] });
    expect(HeadingValue.guards[2](heading)).toBe(true);
    expect(HeadingValue.guards[1](heading)).toBe(false);
    expect(HeadingValue.isAnyOf([1, 2])(heading)).toBe(true);
    expect(
      HeadingValue.match(heading, {
        1: () => "h1",
        2: () => "h2",
        3: () => "h3",
        4: () => "h4",
        5: () => "h5",
        6: () => "h6",
      })
    ).toBe("h2");

    const publicHeading = Heading.make(heading);
    expect(publicHeading).toEqual({ _tag: "heading", level: 2, children: heading.children });
    expect(renderHtmlBlock(publicHeading)).toBe("<h2>Overview</h2>");
  });

  it("exposes tagged-union helpers on migrated policy and safety unions", () => {
    const policy = UrlPolicySpec.cases.Compatibility.make({});
    const issue = DocumentSafetyViolation.cases.RawNode.make({ path: [], nodeTag: "rawHtml" });

    expect(policy).toEqual(CompatibilityUrlPolicy.make({}));
    expect(UrlPolicySpec.guards.Compatibility(policy)).toBe(true);
    expect(DocumentSafetyViolation.guards.RawNode(issue)).toBe(true);
    expect(issue).toEqual(RawNodeSafetyViolation.make({ path: [], nodeTag: "rawHtml" }));
  });

  it("rejects block children at the heading schema boundary", () => {
    const result = S.decodeUnknownResult(Heading)({
      _tag: "heading",
      level: 2,
      children: [{ _tag: "p", children: [] }],
    });

    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects unknown Markdown variant tags", () => {
    expect(Result.isFailure(S.decodeUnknownResult(Inline)({ _tag: "futureInline" }))).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(Block)({ _tag: "futureBlock" }))).toBe(true);
  });

  it("rejects values outside the list item content grammar", () => {
    const result = S.decodeUnknownResult(ListItemChild)({ _tag: "futureListItemChild" });

    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects non-boolean GFM task item state", () => {
    const result = S.decodeUnknownResult(TaskItem)({
      _tag: "taskItem",
      checked: "yes",
      children: [],
    });

    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects block children inside GFM strikethrough", () => {
    const result = S.decodeUnknownResult(Del)({
      _tag: "del",
      children: [{ _tag: "p", children: [] }],
    });

    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects block children inside GFM table cells", () => {
    const result = S.decodeUnknownResult(TableCell)({
      _tag: "tableCell",
      children: [{ _tag: "p", children: [] }],
    });

    expect(Result.isFailure(result)).toBe(true);
  });

  it("formats every conformance issue variant as a stable diagnostic", () => {
    const identifier = FootnoteIdentifier.fromUnknown("note");
    const issues: ReadonlyArray<MarkdownConformanceIssue> = [
      MarkdownConformanceIssue.cases.NestedLink.make({ path: [] }),
      MarkdownConformanceIssue.cases.UnsupportedNode.make({
        path: [],
        nodeTag: "inlineMath",
        profile: MarkdownConformanceProfile.Enum.CommonMark,
      }),
      MarkdownConformanceIssue.cases.EmptyList.make({ path: [], listTag: "ul" }),
      MarkdownConformanceIssue.cases.OrderedListStart.make({ path: [], start: 1_000_000_000 }),
      MarkdownConformanceIssue.cases.GfmTableHeader.make({ path: [] }),
      MarkdownConformanceIssue.cases.GfmTableRowWidth.make({ path: [], expected: 2, actual: 1 }),
      MarkdownConformanceIssue.cases.GfmTableAlignmentWidth.make({ path: [], expected: 2, actual: 1 }),
      MarkdownConformanceIssue.cases.GfmDisallowedRawHtml.make({ path: [] }),
      MarkdownConformanceIssue.cases.DuplicateFootnoteDefinition.make({ path: [], identifier }),
      MarkdownConformanceIssue.cases.UndefinedFootnoteReference.make({ path: [], identifier }),
    ];

    expect(A.map(issues, formatMarkdownConformanceIssue)).toEqual([
      "A link is nested inside another link.",
      "The inlineMath node is not part of commonmark-0.31.2.",
      "The ul list has no items.",
      "The ordered-list start 1000000000 is outside CommonMark's 0..999999999 range.",
      "A GFM table requires a non-empty header row.",
      "The GFM table row has 1 cells; the header has 2.",
      "The GFM alignment list has 1 entries; the header has 2 cells.",
      "Raw HTML contains a tag filtered by GFM.",
      "Footnote note is defined more than once.",
      "Footnote note is referenced but not defined.",
    ]);
  });

  it("supports data-last inspection across headings and Beep block extensions", () => {
    const inspectCommonMark = markdownConformanceIssues(MarkdownConformanceProfile.Enum.CommonMark);
    const document = Md.make([
      Md.h2([Md.em("emphasis"), Md.inlineMath("x")]),
      Md.youtubeUnsafe("M7lc1UVf-VE"),
      Md.admonition("warning", "Careful"),
      Md.embed("video", "https://example.com/video"),
    ]);

    expect(tags(inspectCommonMark(document))).toEqual([
      "UnsupportedNode",
      "UnsupportedNode",
      "UnsupportedNode",
      "UnsupportedNode",
    ]);
  });

  it("rejects nested links strictly while retaining the exact lossless tree", () => {
    const document = Md.make([Md.p(Md.a("/outer", Md.strong(Md.a("/inner", "nested"))))]);
    const report = inspectMarkdownDocumentLosslessly(document, MarkdownConformanceProfile.Enum.CommonMark);
    const strict = refineStrictMarkdownDocument(document, MarkdownConformanceProfile.Enum.CommonMark);

    expect(report.document).toBe(document);
    expect(tags(report.issues)).toEqual(["NestedLink"]);
    expect(Result.isFailure(strict)).toBe(true);
  });

  it("keeps profile membership explicit for GFM and Beep extensions", () => {
    const gfmDocument = Md.make([
      Md.p(Md.del("removed")),
      Md.taskListFromItems([Md.taskItem("done", { checked: true })]),
      Md.table(
        [
          ["name", "value"],
          ["beep", "1"],
        ],
        { headerRow: true, align: ["left", "right"] }
      ),
    ]);
    const beepDocument = Md.make([Md.mathBlock("x"), Md.p(Md.rawMarkdown("trusted"))]);

    expect(markdownConformanceIssues(gfmDocument, MarkdownConformanceProfile.Enum.CommonMark)).toHaveLength(3);
    expect(markdownConformanceIssues(gfmDocument, MarkdownConformanceProfile.Enum.Gfm)).toHaveLength(0);
    expect(markdownConformanceIssues(beepDocument, MarkdownConformanceProfile.Enum.Gfm)).toHaveLength(2);
    expect(markdownConformanceIssues(beepDocument, MarkdownConformanceProfile.Enum.Beep)).toHaveLength(0);
  });

  it("models zero ordered-list starts losslessly and enforces CommonMark's upper bound strictly", () => {
    const zero = Md.make([Md.ol(["zero"], { start: 0 })]);
    const tooLarge = Md.make([Md.ol(["large"], { start: 1_000_000_000 })]);

    expect(OrderedListStart.is(0)).toBe(true);
    expect(markdownConformanceIssues(zero, MarkdownConformanceProfile.Enum.CommonMark)).toHaveLength(0);
    expect(tags(markdownConformanceIssues(tooLarge, MarkdownConformanceProfile.Enum.CommonMark))).toEqual([
      "OrderedListStart",
    ]);
  });

  it("reports empty lists without narrowing the broad document schema", () => {
    const document = Md.make([Md.ul([]), Md.taskListFromItems([])]);

    expect(S.is(CommonMarkDocument)(document)).toBe(false);
    expect(tags(markdownConformanceIssues(document, MarkdownConformanceProfile.Enum.CommonMark))).toEqual([
      "EmptyList",
      "UnsupportedNode",
      "EmptyList",
    ]);
    expect(inspectMarkdownDocumentLosslessly(document, MarkdownConformanceProfile.Enum.CommonMark).document).toBe(
      document
    );
  });

  it("enforces GFM header, rectangularity, and alignment width as tree invariants", () => {
    const document = Md.make([Md.table([["a", "b"], ["c"]], { headerRow: false, align: ["left"] })]);
    const emptyTable = Md.make([Md.table([], { headerRow: false })]);

    expect(S.is(Document)(document)).toBe(true);
    expect(tags(markdownConformanceIssues(document, MarkdownConformanceProfile.Enum.Gfm))).toEqual([
      "GfmTableHeader",
      "GfmTableRowWidth",
      "GfmTableAlignmentWidth",
    ]);
    expect(S.is(GfmDocument)(document)).toBe(false);
    expect(tags(markdownConformanceIssues(emptyTable, MarkdownConformanceProfile.Enum.Gfm))).toEqual([
      "GfmTableHeader",
    ]);
  });

  it("applies the GFM raw-HTML filter without attributing it to CommonMark or Beep", () => {
    const document = Md.make([Md.p(Md.rawHtml("<script>alert(1)</script>"))]);

    expect(markdownConformanceIssues(document, MarkdownConformanceProfile.Enum.CommonMark)).toHaveLength(0);
    expect(tags(markdownConformanceIssues(document, MarkdownConformanceProfile.Enum.Gfm))).toEqual([
      "GfmDisallowedRawHtml",
    ]);
    expect(markdownConformanceIssues(document, MarkdownConformanceProfile.Enum.Beep)).toHaveLength(0);
  });

  it("checks Beep footnote definition uniqueness and reference resolution recursively", () => {
    const document = Md.make([
      Md.p(Md.footnoteRef("missing")),
      Md.footnoteDef("note", "first"),
      Md.blockquote([Md.footnoteDef("note", "second")]),
    ]);
    const issues = markdownConformanceIssues(document, MarkdownConformanceProfile.Enum.Beep);

    expect(tags(issues)).toEqual([
      "DuplicateFootnoteDefinition",
      "DuplicateFootnoteDefinition",
      "UndefinedFootnoteReference",
    ]);
    expect(S.is(BeepMarkdownDocument)(document)).toBe(false);
  });

  it("accepts one recursively discovered definition for its matching footnote reference", () => {
    const document = Md.make([
      Md.p(Md.footnoteRef("note")),
      Md.blockquote([Md.footnoteDef("note", Md.p("Defined once"))]),
    ]);

    expect(markdownConformanceIssues(document, MarkdownConformanceProfile.Enum.Beep)).toEqual([]);
    expect(S.is(BeepMarkdownDocument)(document)).toBe(true);
  });

  it("walks nested block children inside list items", () => {
    const document = Md.make([Md.ul([Md.li([Md.p("Parent"), Md.ul(["Child"])])])]);

    expect(markdownConformanceIssues(document, MarkdownConformanceProfile.Enum.CommonMark)).toEqual([]);
    expect(S.is(CommonMarkDocument)(document)).toBe(true);
  });

  it("issues distinct strict brands for documents accepted by each profile", () => {
    const document = Md.make([Md.p("Hello")]);

    expect(S.is(CommonMarkDocument)(document)).toBe(true);
    expect(S.is(GfmDocument)(document)).toBe(true);
    expect(S.is(BeepMarkdownDocument)(document)).toBe(true);
    expect(Result.isSuccess(refineStrictMarkdownDocument(document, MarkdownConformanceProfile.Enum.CommonMark))).toBe(
      true
    );
    expect(Result.isSuccess(refineStrictMarkdownDocument(document, MarkdownConformanceProfile.Enum.Gfm))).toBe(true);
    expect(Result.isSuccess(refineStrictMarkdownDocument(document, MarkdownConformanceProfile.Enum.Beep))).toBe(true);
  });

  it("projects implemented checks into shared specification reports", () => {
    const document = Md.make([Md.p(Md.a("/outer", Md.a("/inner", "nested")))]);
    const report = inspectMarkdownSpecificationConformance(document, MarkdownConformanceProfile.Enum.CommonMark);
    const messages = ConformanceReport.match(report, {
      conforming: () => A.empty<string>(),
      nonConforming: ({ issues }) => A.map(issues, ({ message }) => message),
      indeterminate: ({ issues }) => A.map(issues, ({ message }) => message),
    });

    expect(report.status).toBe("nonConforming");
    expect(messages).toEqual(["A link is nested inside another link."]);
    expect(CommonMarkSpecificationProfile.sourceIds).toEqual([
      "md-commonmark-0.31.2-spec",
      "md-commonmark-0.31.2-examples",
      "md-gfm-0.29-published-spec",
      "md-micromark-4.0.2",
      "md-beep-extensions-baseline",
    ]);
    expect(GfmSpecificationProfile.sourceIds).toEqual([
      "md-gfm-0.29-published-spec",
      "md-commonmark-0.31.2-spec",
      "md-gfm-0.29.0.gfm.13-spec",
      "md-gfm-0.29.0.gfm.13-extensions",
      "md-beep-extensions-baseline",
    ]);
    expect(GfmSpecificationProfile.invariantIds).toContain("md.profile.gfm-commonmark-version-divergence");
    expect(GfmSpecificationProfile.invariantIds).toContain("md.gfm.disallowed-raw-html");
    expect(BeepMarkdownSpecificationProfile.invariantIds).toContain("md.footnote.unique-definitions");
  });

  it("retains must strength for required structural invariants in shared reports", () => {
    const report = inspectMarkdownSpecificationConformance(
      Md.make([Md.ul([])]),
      MarkdownConformanceProfile.Enum.CommonMark
    );

    expect(report.status).toBe("nonConforming");
    if (report.status === "nonConforming") {
      expect(report.issues[0]?.strength).toBe("must");
    }
  });

  it("keeps every runtime-checked invariant inside its published profile", () => {
    const document = Md.make([Md.p("Hello")]);
    const commonMarkReport = inspectMarkdownSpecificationConformance(
      document,
      MarkdownConformanceProfile.Enum.CommonMark
    );
    const gfmReport = inspectMarkdownSpecificationConformance(document, MarkdownConformanceProfile.Enum.Gfm);
    const beepReport = inspectMarkdownSpecificationConformance(document, MarkdownConformanceProfile.Enum.Beep);

    expect(
      A.every(commonMarkReport.checkedInvariantIds, (id) => A.contains(CommonMarkSpecificationProfile.invariantIds, id))
    ).toBe(true);
    expect(A.every(gfmReport.checkedInvariantIds, (id) => A.contains(GfmSpecificationProfile.invariantIds, id))).toBe(
      true
    );
    expect(
      A.every(beepReport.checkedInvariantIds, (id) => A.contains(BeepMarkdownSpecificationProfile.invariantIds, id))
    ).toBe(true);
  });
});
