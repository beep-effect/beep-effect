import { Footnote } from "@beep/law-practice-domain";
import { describe, expect, it } from "@effect/vitest";

describe("Footnote.detectTextFootnotes", () => {
  it("detects supported markers and preserves their source spans", () => {
    const text = [
      "Body text.",
      "",
      "----------",
      "FN1. First footnote.",
      "[2] Second footnote.",
      "n.3 Third footnote.",
    ].join("\n");
    const zones = Footnote.detectTextFootnotes(text);

    expect(zones.map(({ footnoteNumber }) => footnoteNumber)).toStrictEqual([1, 2, 3]);
    expect(text.slice(zones[0]?.start, zones[0]?.end)).toContain("First footnote");
    expect(text.slice(zones[2]?.start, zones[2]?.end)).toContain("Third footnote");
  });

  it("ignores numbered body lists without a footnote separator", () => {
    const text = ["The court considered:", "1. The first factor.", "2. The second factor."].join("\n");

    expect(Footnote.detectTextFootnotes(text)).toStrictEqual([]);
  });

  it("caps the final footnote at a subsequent section heading", () => {
    const text = [
      "Body text.",
      "",
      "----------",
      "1. See 200 F.3d 100.",
      "",
      "GOVERNMENT BRIEF",
      "",
      "The court further holds that 400 F.3d 500 controls.",
    ].join("\n");
    const [zone] = Footnote.detectTextFootnotes(text);
    const footnoteText = text.slice(zone?.start, zone?.end);

    expect(footnoteText).toContain("200 F.3d 100");
    expect(footnoteText).not.toContain("GOVERNMENT BRIEF");
  });

  it("does not split indented numbered sub-lists into footnotes", () => {
    const text = [
      "Body text.",
      "",
      "----------",
      "1. The first footnote contains:",
      "  1. Sub-list item one.",
      "  2. Another sub-list item.",
      "2. The second real footnote.",
    ].join("\n");
    const zones = Footnote.detectTextFootnotes(text);

    expect(zones).toHaveLength(2);
    expect(text.slice(zones[0]?.start, zones[0]?.end)).toContain("Another sub-list item.");
  });
});
