// Section extraction: the finder layer over `MarkdownDocument.sections`.
//
// The sectioning itself already existed and is tested in `document.test.ts` —
// nothing here re-implements it. What is new is the heading TEXT a section
// carries, the body span excluding the heading, and the two finders.
//
// The motivating consumer is a CHANGELOG reader: silk-release-action's
// `extract-release-notes.ts` scans lines for `^## `, which false-positives on
// `## ` inside a fenced code block and misses setext headings entirely. Both
// are regression cases below, and both are fixed by construction here: a
// heading is a parsed node or it is not one.

import { assert, describe, it } from "@effect/vitest";
import * as Result from "effect/Result";
import { MarkdownDocument } from "../../effected/markdown/MarkdownDocument.ts";

const parse = (source: string): MarkdownDocument => {
	const result = MarkdownDocument.parseResult(source);
	if (Result.isFailure(result)) {
		assert.fail("expected the document to parse");
	}
	return result.success;
};

const changelog = [
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
].join("\n");

describe("DocumentSection.text", () => {
	it("carries the heading's plain-text content", () => {
		const document = parse(changelog);
		// EVERY root-level heading opens a section, H3s included — the shipped
		// `sections` contract, flat with `depth` carrying the hierarchy. The
		// finders narrow by depth; they do not change what a section is.
		assert.deepStrictEqual(
			document.sections.map((section) => section.text),
			["my-package", "1.2.30", "Patch changes", "1.2.3", "1.0.0"],
		);
	});

	it("flattens inline formatting in the heading", () => {
		// `DocumentHeading.text` already did this; a section could not reach it
		// because the derivation was module-private. That was the blocking gap.
		const document = parse("## **1.2.3** _(beta)_\n\nbody\n");
		assert.strictEqual(document.sections[0]?.text, "1.2.3 (beta)");
	});

	it("agrees with the matching DocumentHeading entry", () => {
		// Every heading here is root-level, so the two lists must coincide exactly.
		// If they ever diverge, one of the derivations drifted.
		const document = parse(changelog);
		assert.deepStrictEqual(
			document.sections.map((section) => section.text),
			document.headings.map((entry) => entry.text),
		);
	});
});

describe("DocumentSection — source and body", () => {
	/** Address sections by heading text, never by index — indices drift. */
	const sectionNamed = (source: string, text: string) => {
		const found = parse(source).sectionByHeading(text);
		assert.isDefined(found);
		return found;
	};

	it("`source` is the whole section, heading included", () => {
		const section = sectionNamed(changelog, "1.2.30");
		assert.isTrue(section.source.startsWith("## 1.2.30"));
		assert.strictEqual(
			section.source,
			changelog.slice(section.range.offset, section.range.offset + section.range.length),
		);
	});

	it("`body` excludes the heading and `bodyRange` describes it", () => {
		const section = sectionNamed(changelog, "1.2.3");
		assert.isFalse(section.body.includes("## 1.2.3\n"));
		assert.include(section.body, "- older entry");
		assert.strictEqual(
			section.body,
			changelog.slice(section.bodyRange.offset, section.bodyRange.offset + section.bodyRange.length),
		);
	});

	it("`bodyRange` starts where the heading node ends", () => {
		const section = sectionNamed(changelog, "1.2.30");
		assert.strictEqual(section.bodyRange.offset, section.heading.position.end.offset);
		// And ends exactly where the whole section does.
		assert.strictEqual(
			section.bodyRange.offset + section.bodyRange.length,
			section.range.offset + section.range.length,
		);
	});

	it("`body` is UNTRIMMED — a published span must not silently drop bytes", () => {
		// The consumer writes `.trim()`, visibly. A package that publishes offsets
		// for a span and then hands back a different span is lying about it.
		const section = sectionNamed(changelog, "1.2.3");
		assert.isTrue(section.body.startsWith("\n"));
		assert.strictEqual(section.body.trim(), "- older entry");
	});

	it("a heading with no body has an empty body", () => {
		const document = parse("## 2.0.0\n\n## 1.0.0\n\n- content\n");
		const first = document.sections[0];
		assert.isDefined(first);
		assert.strictEqual(first.body.trim(), "");
	});

	it("the last section runs to the end of the source", () => {
		const document = parse(changelog);
		const last = document.sections.at(-1);
		assert.isDefined(last);
		assert.strictEqual(last.range.offset + last.range.length, changelog.length);
		assert.strictEqual(last.body.trim(), "- oldest entry");
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
		// The H3 inside the newest entry must not terminate it: `### Patch changes`
		// is part of that release's notes, and cutting there is the classic
		// changelog-extraction bug.
		const body = parse(changelog).firstSection({ depth: 2 })?.body ?? "";
		assert.include(body, "### Patch changes");
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
		// THE discriminating test for this surface. A substring default would
		// return the 1.2.30 section here and publish the wrong release notes,
		// silently. `1.2.30` sits EARLIER in the document than `1.2.3`, so a
		// substring implementation returns it first.
		const section = parse(changelog).sectionByHeading("1.2.3");
		assert.strictEqual(section?.text, "1.2.3");
		assert.notInclude(section?.body ?? "", "- newest entry");
	});

	it("accepts a RegExp for the tagged-monorepo heading shape", () => {
		// Real changelogs carry either `## 1.2.3` or `## @scope/pkg@1.2.3`.
		const source = "# pkg\n\n## @scope/pkg@0.9.5\n\n- scoped entry\n";
		const section = parse(source).sectionByHeading(/@0\.9\.5$/);
		assert.strictEqual(section?.text, "@scope/pkg@0.9.5");
	});

	it("a /g/ RegExp is not derailed by its own lastIndex", () => {
		// `RegExp.test` on a global pattern advances `lastIndex`, so the same regex
		// reused across sections would resume from the wrong offset and skip
		// matches. Reusing one pattern object is the natural call-site shape, so
		// the reset has to live here rather than in a caveat.
		const pattern = /\d+\.\d+\.\d+/g;
		const document = parse(changelog);
		assert.strictEqual(document.sectionByHeading(pattern)?.text, "1.2.30");
		assert.strictEqual(document.sectionByHeading(pattern)?.text, "1.2.30");
	});

	it("accepts a predicate over the text and the section", () => {
		const section = parse(changelog).sectionByHeading(
			(text, candidate) => candidate.depth === 2 && text.endsWith(".0"),
		);
		assert.strictEqual(section?.text, "1.0.0");
	});

	it("honours the depth restriction", () => {
		const source = "# 1.0.0\n\ntop\n\n## 1.0.0\n\nnested\n";
		assert.strictEqual(parse(source).sectionByHeading("1.0.0", { depth: 2 })?.body.trim(), "nested");
	});

	it("is undefined when nothing matches", () => {
		assert.isUndefined(parse(changelog).sectionByHeading("9.9.9"));
	});

	it("returns the FIRST match in document order", () => {
		const source = "## dup\n\nfirst\n\n## dup\n\nsecond\n";
		assert.strictEqual(parse(source).sectionByHeading("dup")?.body.trim(), "first");
	});
});

describe("section extraction — the line-scan regressions", () => {
	it("`## ` inside a FENCED CODE BLOCK is not a section", () => {
		// The headline fix. A `^## ` line scan opens a section here; a parser
		// cannot, because the line is part of a `code` node.
		const source = [
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
		].join("\n");
		const document = parse(source);
		assert.deepStrictEqual(
			document.sections.map((section) => section.text),
			["Title", "1.0.0"],
		);
		const release = document.firstSection({ depth: 2 });
		assert.include(release?.body ?? "", "## not a heading");
		assert.include(release?.body ?? "", "- real content");
	});

	it("an INDENTED code block's `## ` is not a section either", () => {
		const source = "# Title\n\n## 1.0.0\n\n    ## indented, not a heading\n\n- real content\n";
		assert.deepStrictEqual(
			parse(source).sections.map((section) => section.text),
			["Title", "1.0.0"],
		);
	});

	it("a SETEXT H2 is a section — the line scan misses these entirely", () => {
		// `Version\n---` is an H2. `/^## /` never matches it, so a line-scanning
		// extractor reports "no H2 section" on a document that plainly has one.
		const source = ["My Title", "========", "", "1.0.0", "-----", "", "- setext content", ""].join("\n");
		const document = parse(source);
		assert.deepStrictEqual(
			document.sections.map((section) => [section.depth, section.text]),
			[
				[1, "My Title"],
				[2, "1.0.0"],
			],
		);
		assert.strictEqual(document.firstSection({ depth: 2 })?.body.trim(), "- setext content");
	});

	it("a heading inside a blockquote does not open a section", () => {
		// Already the shipped `sections` contract (root-level headings only); pinned
		// here because the finders must inherit it rather than re-deciding.
		const source = "# Title\n\n> ## quoted\n\n## 1.0.0\n\n- content\n";
		assert.deepStrictEqual(
			parse(source).sections.map((section) => section.text),
			["Title", "1.0.0"],
		);
	});
});
