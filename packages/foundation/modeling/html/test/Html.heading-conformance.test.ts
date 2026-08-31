import { computeHeadingOutline, inspectBestPractices, inspectConformance } from "@beep/html/Html.conformance";
import { Div, Fragment, H1, H2, H3, H4, H5, H6, Section } from "@beep/html/Html.model";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";

describe("HTML heading semantics", () => {
  it("rejects heading descendants because heading content is phrasing-only", () => {
    const root = H2.make({ children: [H1.make({ children: [] })] });

    expect(inspectConformance(root)).toContainEqual(
      expect.objectContaining({
        path: ["children.0"],
        rule: "contentModel",
      })
    );
  });

  it("rejects non-phrasing flow children in headings", () => {
    const root = H1.make({ children: [Div.make({ children: [] })] });

    expect(inspectConformance(root)).toContainEqual(
      expect.objectContaining({
        path: ["children.0"],
        rule: "contentModel",
      })
    );
  });

  it("rejects a skipped computed heading level in tree order", () => {
    const root = Fragment.make({
      children: [H1.make({ children: [] }), H3.make({ children: [] })],
    });

    expect(inspectConformance(root)).toContainEqual(
      expect.objectContaining({
        path: ["children.1"],
        rule: "headingOutline",
      })
    );
  });

  it("rejects an offset-induced skipped computed heading level", () => {
    const root = Fragment.make({
      children: [
        H1.make({ children: [] }),
        Div.make({ headingoffset: O.some(2), children: [H1.make({ children: [] })] }),
      ],
    });

    expect(A.map(computeHeadingOutline(root), ({ level }) => level)).toEqual([1, 3]);
    expect(inspectConformance(root)).toContainEqual(
      expect.objectContaining({
        path: ["children.1", "children.0"],
        rule: "headingOutline",
      })
    );
  });

  it("applies ancestor offsets and reset boundaries", () => {
    const root = Div.make({
      headingoffset: O.some(2),
      children: [
        H1.make({ children: [] }),
        Section.make({
          headingoffset: O.some(1),
          children: [H1.make({ children: [] })],
        }),
        Section.make({
          headingreset: O.some(""),
          children: [H2.make({ children: [] })],
        }),
      ],
    });

    expect(A.map(computeHeadingOutline(root), ({ level }) => level)).toEqual([3, 4, 2]);
  });

  it("caps computed heading levels at nine", () => {
    const root = Div.make({
      headingoffset: O.some(8),
      children: [H3.make({ children: [] })],
    });

    expect(computeHeadingOutline(root)[0]?.level).toBe(9);
  });

  it("preserves every declared heading level before ancestor adjustments", () => {
    const root = Fragment.make({
      children: [H4.make({ children: [] }), H5.make({ children: [] }), H6.make({ children: [] })],
    });

    expect(A.map(computeHeadingOutline(root), ({ level }) => level)).toEqual([4, 5, 6]);
  });

  it("keeps the level-one recommendation advisory", () => {
    const root = H2.make({ children: [] });

    expect(inspectConformance(root)).toEqual([]);
    expect(inspectBestPractices(root)).toContainEqual(expect.objectContaining({ rule: "headingLevelOne" }));
  });

  it("does not report the advisory when any computed level-one heading exists", () => {
    const root = Fragment.make({
      children: [H2.make({ children: [] }), H1.make({ children: [] })],
    });

    expect(inspectBestPractices(root)).toEqual([]);
  });
});
