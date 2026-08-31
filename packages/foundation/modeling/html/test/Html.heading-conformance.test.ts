import { computeHeadingOutline, inspectBestPractices, inspectConformance } from "@beep/html/Html.conformance";
import { Div, Fragment, H1, H2, H3, Section } from "@beep/html/Html.model";
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

  it("keeps the level-one recommendation advisory", () => {
    const root = H2.make({ children: [] });

    expect(inspectConformance(root)).toEqual([]);
    expect(inspectBestPractices(root)).toContainEqual(expect.objectContaining({ rule: "headingLevelOne" }));
  });
});
