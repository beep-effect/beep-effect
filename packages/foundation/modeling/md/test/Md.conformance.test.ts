import { Md } from "@beep/md";
import {
  BeepMarkdownDocument,
  BeepMarkdownSpecificationProfile,
  CommonMarkDocument,
  CommonMarkSpecificationProfile,
  GfmDocument,
  GfmSpecificationProfile,
  inspectMarkdownDocumentLosslessly,
  inspectMarkdownSpecificationConformance,
  MarkdownConformanceProfile,
  markdownConformanceIssues,
  refineStrictMarkdownDocument,
} from "@beep/md/Md.conformance";
import { CompatibilityUrlPolicy, UrlPolicySpec } from "@beep/md/Md.escape";
import { Heading, HeadingValue, OrderedListStart, Text } from "@beep/md/Md.model";
import { renderHtmlBlock } from "@beep/md/Md.render";
import { DocumentSafetyViolation, RawNodeSafetyViolation } from "@beep/md/Md.safe";
import { ConformanceReport } from "@beep/schema/Conformance";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import type { MarkdownConformanceIssue } from "@beep/md/Md.conformance";

const tags = (issues: ReadonlyArray<MarkdownConformanceIssue>): ReadonlyArray<MarkdownConformanceIssue["_tag"]> =>
  A.map(issues, ({ _tag }) => _tag);

describe("Markdown semantic conformance", () => {
  it("exposes six flat heading payload cases with exhaustive helpers", () => {
    const heading = HeadingValue.cases[2].make({ children: [Text.make({ value: "Overview" })] });

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

    const publicHeading = Heading.make({ level: 2, children: heading.children });
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

    expect(tags(markdownConformanceIssues(document, MarkdownConformanceProfile.Enum.Gfm))).toEqual([
      "GfmTableHeader",
      "GfmTableRowWidth",
      "GfmTableAlignmentWidth",
    ]);
    expect(S.is(GfmDocument)(document)).toBe(false);
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

  it("issues distinct strict brands for documents accepted by each profile", () => {
    const document = Md.make([Md.p("Hello")]);

    expect(S.is(CommonMarkDocument)(document)).toBe(true);
    expect(S.is(GfmDocument)(document)).toBe(true);
    expect(S.is(BeepMarkdownDocument)(document)).toBe(true);
    expect(Result.isSuccess(refineStrictMarkdownDocument(document, MarkdownConformanceProfile.Enum.CommonMark))).toBe(
      true
    );
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
      "md-gfm-0.29.0.gfm.13-extensions",
      "md-micromark-4.0.2",
      "md-beep-extensions-baseline",
    ]);
    expect(GfmSpecificationProfile.invariantIds).toContain("md.gfm.disallowed-raw-html");
    expect(BeepMarkdownSpecificationProfile.invariantIds).toContain("md.footnote.unique-definitions");
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
