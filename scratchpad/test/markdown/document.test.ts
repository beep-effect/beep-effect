// `MarkdownDocument`: the lossless unit — source, tree, materialized
// diagnostics and the definition index — plus the same parseResult/parse
// parity and guard-materialization contract the bare-tree facade holds.

import { assert, describe, it } from "@effect/vitest";
import { Effect, Result, Schema } from "effect";
import { MAX_NESTING_DEPTH } from "../../effected/markdown/internal/limits.ts";
import { MarkdownDiagnostic } from "../../effected/markdown/MarkdownDiagnostic.ts";
import { MarkdownDocument } from "../../effected/markdown/MarkdownDocument.ts";
import type { FlowContent } from "../../effected/markdown/MarkdownNode.ts";
import { Blockquote, Definition, LinkReference, Paragraph, Point, Position, Root, Text } from "../../effected/markdown/MarkdownNode.ts";

const nestingBomb = `${">".repeat(MAX_NESTING_DEPTH + 44)} foo\n`;

const source = ["# Title", "", "See [ref][a] and [b].", "", '[a]: /a "A"', "[B]: /b", ""].join("\n");

describe("MarkdownDocument.parseResult", () => {
	it("retains the exact source it parsed", () => {
		const result = MarkdownDocument.parseResult(source);
		assert.isTrue(Result.isSuccess(result));
		if (Result.isFailure(result)) return;
		assert.strictEqual(result.success.source, source);
	});

	it("carries the parsed Root tree", () => {
		const result = MarkdownDocument.parseResult(source);
		if (Result.isFailure(result)) {
			assert.fail("expected the document to parse");
			return;
		}
		assert.instanceOf(result.success.root, Root);
		assert.deepStrictEqual(
			result.success.root.children.map((child) => child.type),
			["heading", "paragraph", "definition", "definition"],
		);
	});

	it("indexes the link-reference definitions by case-folded label", () => {
		const result = MarkdownDocument.parseResult(source);
		if (Result.isFailure(result)) {
			assert.fail("expected the document to parse");
			return;
		}
		const { definitions } = result.success;
		// A real Map, not an object: link labels are attacker-controlled, so
		// the index must not be prototype-pollutable.
		assert.instanceOf(definitions, Map);
		assert.strictEqual(definitions.size, 2);
		for (const definition of definitions.values()) {
			assert.instanceOf(definition, Definition);
		}
		// Labels fold case, so `[a]` and `[B]` land under one normalized key each.
		const urls = [...definitions.values()].map((definition) => definition.url).sort();
		assert.deepStrictEqual(urls, ["/a", "/b"]);
	});

	it("keeps the definitions in the tree as well as the index", () => {
		const result = MarkdownDocument.parseResult(source);
		if (Result.isFailure(result)) {
			assert.fail("expected the document to parse");
			return;
		}
		const inTree = result.success.root.children.filter((child) => child.type === "definition");
		assert.strictEqual(inTree.length, 2);
	});

	it("reports no diagnostics, because P1 has no producers of them yet", () => {
		// Not a coverage gap: the engine's carrier array is empty for every
		// input the P1 parser accepts, since no construct emits a non-fatal
		// diagnostic yet (they arrive with unresolved link references and P3
		// frontmatter). The materialization path from carriers to this field
		// is exercised by `materializes the carriers it is given` below, which
		// does not depend on a producer existing.
		const result = MarkdownDocument.parseResult(source);
		if (Result.isFailure(result)) {
			assert.fail("expected the document to parse");
			return;
		}
		assert.deepStrictEqual(result.success.diagnostics, []);
	});

	it("materializes the carriers it is given, deriving line and character", () => {
		// The producers are absent, so drive the materialization directly:
		// this is the exact transformation `parseResult` applies to each
		// carrier, and it is what will light up when producers land.
		const text = "alpha\nbravo charlie\n";
		const diagnostic = MarkdownDiagnostic.fromRaw(text, {
			code: "NestingDepthExceeded",
			message: "synthetic carrier",
			offset: text.indexOf("charlie"),
			length: 7,
		});
		assert.strictEqual(diagnostic.line, 1);
		assert.strictEqual(diagnostic.character, "bravo ".length);
		assert.strictEqual(diagnostic.message, "synthetic carrier");
		assert.strictEqual(diagnostic.length, 7);
	});

	it("prototype pollution through a reference label leaves Object.prototype untouched", () => {
		const result = MarkdownDocument.parseResult('[__proto__]: /x "polluted"\n\n[__proto__]\n');
		if (Result.isFailure(result)) {
			assert.fail("expected the document to parse");
			return;
		}
		assert.isUndefined(Object.getOwnPropertyDescriptor(Object.prototype, "polluted"));
		assert.strictEqual(Object.prototype.constructor, Object);
		assert.strictEqual(result.success.definitions.size, 1);
	});

	it("materializes a tripped guard as a typed MarkdownParseError", () => {
		const result = MarkdownDocument.parseResult(nestingBomb);
		assert.isTrue(Result.isFailure(result));
		if (Result.isSuccess(result)) return;
		assert.strictEqual(result.failure._tag, "MarkdownParseError");
		assert.strictEqual(result.failure.diagnostic.code, "NestingDepthExceeded");
	});

	it("parses the empty document", () => {
		const result = MarkdownDocument.parseResult("");
		if (Result.isFailure(result)) {
			assert.fail("expected the empty document to parse");
			return;
		}
		assert.strictEqual(result.success.source, "");
		assert.deepStrictEqual(result.success.root.children, []);
		assert.strictEqual(result.success.definitions.size, 0);
	});
});

describe("MarkdownDocument.parse", () => {
	it.effect("agrees with parseResult on the success channel", () =>
		Effect.gen(function* () {
			const viaEffect = yield* MarkdownDocument.parse(source);
			const viaResult = MarkdownDocument.parseResult(source);
			if (Result.isFailure(viaResult)) {
				assert.fail("expected the document to parse");
				return;
			}
			assert.deepStrictEqual(viaEffect, viaResult.success);
		}),
	);

	it.effect("agrees with parseResult on the failure channel", () =>
		Effect.gen(function* () {
			const viaEffect = yield* Effect.result(MarkdownDocument.parse(nestingBomb));
			const viaResult = MarkdownDocument.parseResult(nestingBomb);
			assert.isTrue(Result.isFailure(viaEffect));
			assert.isTrue(Result.isFailure(viaResult));
			if (Result.isSuccess(viaEffect) || Result.isSuccess(viaResult)) return;
			assert.deepStrictEqual(viaEffect.failure, viaResult.failure);
		}),
	);

	it.effect("defaults the dialect to gfm, matching an explicit gfm parse", () =>
		Effect.gen(function* () {
			const implicit = yield* MarkdownDocument.parse(source);
			const explicit = yield* MarkdownDocument.parse(source, { dialect: "gfm" });
			assert.deepStrictEqual(explicit, implicit);
		}),
	);

	it.effect("diverges from an explicit commonmark parse exactly where extension syntax appears", () =>
		Effect.gen(function* () {
			// No extension syntax: the dialects agree on the shared source.
			const gfmDoc = yield* MarkdownDocument.parse(source, { dialect: "gfm" });
			const commonmarkDoc = yield* MarkdownDocument.parse(source, { dialect: "commonmark" });
			assert.deepStrictEqual(gfmDoc.root, commonmarkDoc.root);
			// Extension syntax: they must not agree.
			const struck = "~~struck~~\n";
			const viaDefault = yield* MarkdownDocument.parse(struck);
			const viaCommonmark = yield* MarkdownDocument.parse(struck, { dialect: "commonmark" });
			assert.notDeepEqual(viaDefault.root, viaCommonmark.root);
		}),
	);
});

describe("MarkdownDocument schema", () => {
	it("round-trips a parsed document through its own schema", () => {
		const result = MarkdownDocument.parseResult(source);
		if (Result.isFailure(result)) {
			assert.fail("expected the document to parse");
			return;
		}
		const encoded = Schema.encodeUnknownSync(MarkdownDocument)(result.success);
		const decoded = Schema.decodeUnknownSync(MarkdownDocument)(encoded);
		assert.strictEqual(decoded.source, result.success.source);
		assert.strictEqual(decoded.definitions.size, result.success.definitions.size);
		assert.deepStrictEqual(
			decoded.root.children.map((child) => child.type),
			result.success.root.children.map((child) => child.type),
		);
	});
});

describe("MarkdownDocument navigation accessors", () => {
	const navSource = [
		"---",
		"title: Nav",
		"---",
		"",
		"Intro paragraph with [inline](https://example.com/inline).",
		"",
		"# Alpha *one*",
		"",
		"Alpha body with [ref][a] and ![pic](/img.png).",
		"",
		"## Beta `code`",
		"",
		"| cell |",
		"| ---- |",
		"| [cell link](/cell) |",
		"",
		"# Gamma",
		"",
		"> ## Quoted heading",
		"",
		"Trailing www.example.com literal.",
		"",
		'[a]: /a "A"',
		"",
	].join("\n");

	const parseNav = () => {
		const result = MarkdownDocument.parseResult(navSource, { frontmatter: true });
		if (Result.isFailure(result)) {
			assert.fail("expected the navigation document to parse");
			throw new Error("unreachable");
		}
		return result.success;
	};

	it("lists every heading in document order with depth and plain text", () => {
		const document = parseNav();
		assert.deepStrictEqual(
			document.headings.map((entry) => [entry.depth, entry.text]),
			[
				[1, "Alpha one"],
				[2, "Beta code"],
				[1, "Gamma"],
				[2, "Quoted heading"],
			],
		);
		for (const entry of document.headings) {
			assert.strictEqual(entry.node.type, "heading");
			assert.strictEqual(entry.depth, entry.node.depth);
		}
	});

	it("derives sections from root-level headings only", () => {
		const document = parseNav();
		assert.deepStrictEqual(
			document.sections.map((section) => [section.depth, section.heading.children[0]?.type]),
			[
				[1, "text"],
				[2, "text"],
				[1, "text"],
			],
		);
	});

	it("spans each section from its heading to the next boundary heading", () => {
		const document = parseNav();
		const alphaStart = navSource.indexOf("# Alpha");
		const betaStart = navSource.indexOf("## Beta");
		const gammaStart = navSource.indexOf("# Gamma");
		const [alpha, beta, gamma] = document.sections;
		assert.isDefined(alpha);
		assert.isDefined(beta);
		assert.isDefined(gamma);
		assert.strictEqual(alpha.range.offset, alphaStart);
		assert.strictEqual(alpha.range.offset + alpha.range.length, gammaStart);
		assert.strictEqual(beta.range.offset, betaStart);
		assert.strictEqual(beta.range.offset + beta.range.length, gammaStart);
		assert.strictEqual(gamma.range.offset, gammaStart);
		assert.strictEqual(gamma.range.offset + gamma.range.length, navSource.length);
	});

	it("collects the section's root-level content after its heading", () => {
		const document = parseNav();
		const [alpha, beta, gamma] = document.sections;
		assert.isDefined(alpha);
		assert.isDefined(beta);
		assert.isDefined(gamma);
		// Alpha runs to Gamma: body paragraph, the Beta subsection heading, its table.
		assert.deepStrictEqual(
			alpha.children.map((child) => child.type),
			["paragraph", "heading", "table"],
		);
		assert.deepStrictEqual(
			beta.children.map((child) => child.type),
			["table"],
		);
		assert.deepStrictEqual(
			gamma.children.map((child) => child.type),
			["blockquote", "paragraph", "definition"],
		);
	});

	it("excludes frontmatter and the preamble from sections", () => {
		const document = parseNav();
		const first = document.sections[0];
		assert.isDefined(first);
		// The first section starts at the first heading: the frontmatter block and
		// the intro paragraph before it belong to no section.
		assert.strictEqual(first.range.offset, navSource.indexOf("# Alpha"));
		// section.children is typed FlowContent — frontmatter is excluded by
		// construction; assert the intro paragraph stayed out at runtime.
		const sectioned = document.sections.flatMap((section) => section.children);
		const intro = document.root.children.find((child) => child.type === "paragraph");
		assert.isDefined(intro);
		assert.isFalse(sectioned.includes(intro));
	});

	it("collects every link-bearing node in document order with its url", () => {
		const document = parseNav();
		assert.deepStrictEqual(
			document.links.map((entry) => [entry.node.type, entry.url]),
			[
				["link", "https://example.com/inline"],
				["linkReference", "/a"],
				["image", "/img.png"],
				["link", "/cell"],
				["link", "http://www.example.com"],
				["definition", "/a"],
			],
		);
	});

	it("leaves url genuinely absent on an unresolved foreign reference", () => {
		const point = Point.make({ line: 1, column: 1, offset: 0 });
		const position = Position.make({ start: point, end: Point.make({ line: 1, column: 7, offset: 6 }) });
		const reference = LinkReference.make({
			type: "linkReference",
			identifier: "nope",
			referenceType: "shortcut",
			children: [Text.make({ type: "text", value: "nope", position })],
			position,
		});
		const document = MarkdownDocument.make({
			source: "[nope]",
			root: Root.make({
				type: "root",
				children: [Paragraph.make({ type: "paragraph", children: [reference], position })],
				position,
			}),
			diagnostics: [],
			definitions: new Map(),
		});
		const [entry] = document.links;
		assert.isDefined(entry);
		assert.strictEqual(entry.node.type, "linkReference");
		assert.isFalse(Object.hasOwn(entry, "url"));
	});

	it("returns empty accessors on an empty document", () => {
		const result = MarkdownDocument.parseResult("");
		if (Result.isFailure(result)) {
			assert.fail("expected the empty document to parse");
			return;
		}
		assert.deepStrictEqual(result.success.headings, []);
		assert.deepStrictEqual(result.success.sections, []);
		assert.deepStrictEqual(result.success.links, []);
	});

	it("handles skipped depths, setext headings and a trailing heading", () => {
		const source = ["Title", "=====", "", "### Deep", "", "# Last"].join("\n");
		const result = MarkdownDocument.parseResult(source);
		if (Result.isFailure(result)) {
			assert.fail("expected the document to parse");
			return;
		}
		const document = result.success;
		assert.deepStrictEqual(
			document.sections.map((section) => section.depth),
			[1, 3, 1],
		);
		const [title, deep, last] = document.sections;
		assert.isDefined(title);
		assert.isDefined(deep);
		assert.isDefined(last);
		const lastStart = source.indexOf("# Last");
		assert.strictEqual(title.range.offset + title.range.length, lastStart);
		assert.strictEqual(deep.range.offset + deep.range.length, lastStart);
		assert.strictEqual(last.range.offset + last.range.length, source.length);
	});

	it("refuses an over-deep foreign tree as a defect, mirroring the guarded walks", () => {
		const point = Point.make({ line: 1, column: 1, offset: 0 });
		const position = Position.make({ start: point, end: point });
		let flow: FlowContent = Paragraph.make({
			type: "paragraph",
			children: [Text.make({ type: "text", value: "x", position })],
			position,
		});
		for (let index = 0; index < MAX_NESTING_DEPTH + 44; index += 1) {
			flow = Blockquote.make({ type: "blockquote", children: [flow], position });
		}
		const document = MarkdownDocument.make({
			source: "",
			root: Root.make({ type: "root", children: [flow], position }),
			diagnostics: [],
			definitions: new Map(),
		});
		assert.throws(() => document.links);
	});
});
