import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as Str from "effect/String";

const parse = (source: string): MarkdownDocument => {
  const result = MarkdownDocument.parseResult(source);
  if (Result.isFailure(result)) {
    assert.fail("expected the document to parse");
  }
  return result.success;
};

const changelog = A.join(
  [
    "# my-package",
    "",
    "## 1.2.30",
    "",
    "- newest entry",
    "",
    "### Patch changes",
    "",
    "- a nested subsection that must NOT terminate its release",
    "",
    "## 1.2.3",
    "",
    "- older entry",
    "",
    "## 1.0.0",
    "",
    "- oldest entry",
    "",
  ],
  "\n"
);

describe("DocumentSection.text", () => {
  it("carries the heading's plain-text content", () => {
    const document = parse(changelog);
    assert.deepStrictEqual(
      A.map(document.sections, (section) => section.text),
      ["my-package", "1.2.30", "Patch changes", "1.2.3", "1.0.0"],
      "every root-level heading opens a section, H3s included: the list is flat, depth carries the hierarchy, finders only narrow"
    );
  });

  it("flattens inline formatting in the heading", () => {
    const document = parse("## **1.2.3** _(beta)_\n\nbody\n");
    assert.strictEqual(document.sections[0]?.text, "1.2.3 (beta)");
  });

  it("agrees with the matching DocumentHeading entry", () => {
    const document = parse(changelog);
    assert.deepStrictEqual(
      A.map(document.sections, (section) => section.text),
      A.map(document.headings, (entry) => entry.text),
      "every heading here is root-level, so the lists coincide; a divergence means one derivation drifted"
    );
  });
});

describe("DocumentSection — source and body", () => {
  const sectionNamed = (source: string, text: string) => {
    const found = parse(source).sectionByHeading(text);
    assert.isDefined(found, "sections are addressed by heading text, never by index, since indices drift");
    return found;
  };

  it("`source` is the whole section, heading included", () => {
    const section = sectionNamed(changelog, "1.2.30");
    assert.isTrue(Str.startsWith("## 1.2.30")(section.source));
    assert.strictEqual(
      section.source,
      Str.slice(section.range.offset, section.range.offset + section.range.length)(changelog)
    );
  });

  it("`body` excludes the heading and `bodyRange` describes it", () => {
    const section = sectionNamed(changelog, "1.2.3");
    assert.isFalse(Str.includes("## 1.2.3\n")(section.body));
    assert.include(section.body, "- older entry");
    assert.strictEqual(
      section.body,
      Str.slice(section.bodyRange.offset, section.bodyRange.offset + section.bodyRange.length)(changelog)
    );
  });

  it("`bodyRange` starts where the heading node ends", () => {
    const section = sectionNamed(changelog, "1.2.30");
    assert.strictEqual(section.bodyRange.offset, section.heading.position.end.offset);
    assert.strictEqual(
      section.bodyRange.offset + section.bodyRange.length,
      section.range.offset + section.range.length,
      "and ends exactly where the whole section does"
    );
  });

  it("`body` is UNTRIMMED — a published span must not silently drop bytes", () => {
    const section = sectionNamed(changelog, "1.2.3");
    assert.isTrue(
      Str.startsWith("\n")(section.body),
      "the consumer writes .trim() visibly: publishing offsets for one span and handing back another would lie"
    );
    assert.strictEqual(Str.trim(section.body), "- older entry");
  });

  it("a heading with no body has an empty body", () => {
    const document = parse("## 2.0.0\n\n## 1.0.0\n\n- content\n");
    const first = document.sections[0];
    assert.isDefined(first);
    assert.strictEqual(Str.trim(first.body), "");
  });

  it("the last section runs to the end of the source", () => {
    const document = parse(changelog);
    const last = document.sections.at(-1);
    assert.isDefined(last);
    assert.strictEqual(last.range.offset + last.range.length, changelog.length);
    assert.strictEqual(Str.trim(last.body), "- oldest entry");
  });
});

describe("MarkdownDocument.firstSection", () => {
  it("returns the first section in document order", () => {
    assert.strictEqual(parse(changelog).firstSection()?.text, "my-package");
  });

  it("restricted by depth, finds the first H2 — the newest release entry", () => {
    const section = parse(changelog).firstSection({ depth: 2 });
    assert.strictEqual(section?.text, "1.2.30");
    assert.include(section?.body ?? "", "- newest entry");
  });

  it("a section runs THROUGH its deeper subsections", () => {
    const body = parse(changelog).firstSection({ depth: 2 })?.body ?? "";
    assert.include(
      body,
      "### Patch changes",
      "the H3 belongs to that release's notes; cutting there is the classic changelog-extraction bug"
    );
    assert.include(body, "a nested subsection that must NOT terminate its release");
    assert.notInclude(body, "- older entry");
  });

  it("is undefined when no section matches the depth", () => {
    assert.isUndefined(parse(changelog).firstSection({ depth: 5 }));
  });

  it("is undefined on a document with no headings at all", () => {
    assert.isUndefined(parse("just a paragraph\n").firstSection());
  });
});

describe("MarkdownDocument.sectionByHeading", () => {
  it("matches a string EXACTLY against the trimmed heading text", () => {
    const section = parse(changelog).sectionByHeading("1.2.3");
    assert.strictEqual(section?.text, "1.2.3");
    assert.include(section?.body ?? "", "- older entry");
  });

  it("`1.2.3` does NOT match `1.2.30` — the wrong-release hazard", () => {
    const section = parse(changelog).sectionByHeading("1.2.3");
    assert.strictEqual(section?.text, "1.2.3");
    assert.notInclude(
      section?.body ?? "",
      "- newest entry",
      "1.2.30 sits earlier than 1.2.3, so a substring match would return it and silently publish the wrong release notes"
    );
  });

  it("accepts a RegExp for the tagged-monorepo heading shape", () => {
    const source = "# pkg\n\n## @scope/pkg@0.9.5\n\n- scoped entry\n";
    const section = parse(source).sectionByHeading(/@0\.9\.5$/);
    assert.strictEqual(
      section?.text,
      "@scope/pkg@0.9.5",
      "real changelogs carry either ## 1.2.3 or ## @scope/pkg@1.2.3"
    );
  });

  it("a /g/ RegExp is not derailed by its own lastIndex", () => {
    const pattern = /\d+\.\d+\.\d+/g;
    const document = parse(changelog);
    assert.strictEqual(document.sectionByHeading(pattern)?.text, "1.2.30");
    assert.strictEqual(
      document.sectionByHeading(pattern)?.text,
      "1.2.30",
      "RegExp.test on a /g/ pattern advances lastIndex; reusing one pattern is the natural call shape, so the finder resets it"
    );
  });

  it("accepts a predicate over the text and the section", () => {
    const section = parse(changelog).sectionByHeading(
      (text, candidate) => candidate.depth === 2 && Str.endsWith(".0")(text)
    );
    assert.strictEqual(section?.text, "1.0.0");
  });

  it("honours the depth restriction", () => {
    const source = "# 1.0.0\n\ntop\n\n## 1.0.0\n\nnested\n";
    assert.strictEqual(Str.trim(parse(source).sectionByHeading("1.0.0", { depth: 2 })?.body ?? ""), "nested");
  });

  it("is undefined when nothing matches", () => {
    assert.isUndefined(parse(changelog).sectionByHeading("9.9.9"));
  });

  it("returns the FIRST match in document order", () => {
    const source = "## dup\n\nfirst\n\n## dup\n\nsecond\n";
    assert.strictEqual(Str.trim(parse(source).sectionByHeading("dup")?.body ?? ""), "first");
  });
});

describe("section extraction — the regressions of a ^## changelog line scan", () => {
  it("`## ` inside a FENCED CODE BLOCK is not a section", () => {
    const source = A.join(
      [
        "# Title",
        "",
        "## 1.0.0",
        "",
        "Example:",
        "",
        "```md",
        "## not a heading",
        "",
        "## also not a heading",
        "```",
        "",
        "- real content",
        "",
      ],
      "\n"
    );
    const document = parse(source);
    assert.deepStrictEqual(
      A.map(document.sections, (section) => section.text),
      ["Title", "1.0.0"],
      "a ^## line scan opens a section here; a parser cannot, because the line is part of a code node"
    );
    const release = document.firstSection({ depth: 2 });
    assert.include(release?.body ?? "", "## not a heading");
    assert.include(release?.body ?? "", "- real content");
  });

  it("an INDENTED code block's `## ` is not a section either", () => {
    const source = "# Title\n\n## 1.0.0\n\n    ## indented, not a heading\n\n- real content\n";
    assert.deepStrictEqual(
      A.map(parse(source).sections, (section) => section.text),
      ["Title", "1.0.0"]
    );
  });

  it("a SETEXT H2 is a section — the line scan misses these entirely", () => {
    const source = A.join(["My Title", "========", "", "1.0.0", "-----", "", "- setext content", ""], "\n");
    const document = parse(source);
    assert.deepStrictEqual(
      A.map(document.sections, (section) => [section.depth, section.text]),
      [
        [1, "My Title"],
        [2, "1.0.0"],
      ],
      "a setext H2 never matches /^## /, so a line-scanning extractor reports no H2 section on a document with one"
    );
    assert.strictEqual(Str.trim(document.firstSection({ depth: 2 })?.body ?? ""), "- setext content");
  });

  it("a heading inside a blockquote does not open a section", () => {
    const source = "# Title\n\n> ## quoted\n\n## 1.0.0\n\n- content\n";
    assert.deepStrictEqual(
      A.map(parse(source).sections, (section) => section.text),
      ["Title", "1.0.0"],
      "root-level headings only, the shipped sections contract the finders inherit rather than re-decide"
    );
  });
});
