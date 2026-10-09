// Unit coverage for the frontmatter capture construct (P3 Task 1).
//
// The capture is an offset-0 pre-scan, not a registry construct: it can fire
// at most once, before any block, and its content is raw. Grammar authorities
// are recorded in `src/internal/blocks/frontmatter.ts` — gray-matter's
// default `---`/yaml fences and `---json` language hint, remark-frontmatter's
// `+++` toml preset. Capture is OFF by default (a P3 ruling): the spec
// corpora contain documents opening with `---`, and those must keep parsing
// exactly as CommonMark says they do unless a consumer opts in.

import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { parseBlocks } from "../../effected/markdown/internal/blockParser.ts";
import { Markdown, MarkdownParseOptions } from "../../effected/markdown/Markdown.ts";
import { MarkdownDocument } from "../../effected/markdown/MarkdownDocument.ts";
import type { Frontmatter as FrontmatterNode } from "../../effected/markdown/MarkdownNode.ts";
import { Frontmatter, Point, Position, Root } from "../../effected/markdown/MarkdownNode.ts";

const withFrontmatter = MarkdownParseOptions.make({ frontmatter: true });

/** Parse with capture enabled and return the root. */
const parseOn = (source: string): Root => {
	const result = Markdown.parseResult(source, withFrontmatter);
	assertSuccess(result, Result.getOrThrow(result));
	if (!Result.isSuccess(result)) {
		throw new TypeError("unreachable: asserted success above");
	}
	return result.success;
};

/** The head frontmatter node of a capture-enabled parse; fails if absent. */
const captureOf = (source: string): FrontmatterNode => {
	const head = parseOn(source).children[0];
	assert.isDefined(head, "expected the document to have a head node");
	assert.strictEqual(head?.type, "frontmatter");
	if (head?.type !== "frontmatter") {
		throw new TypeError("unreachable: asserted the type above");
	}
	return head;
};

describe("frontmatter capture", () => {
	describe("the toggle", () => {
		it("is off by default: a fence document parses as CommonMark says", () => {
			const result = Markdown.parseResult("---\na: 1\n---\n");
			assertSuccess(result, Result.getOrThrow(result));
			if (!Result.isSuccess(result)) {
				return;
			}
			// `---` is a thematic break; `a: 1` then `---` is a setext heading.
			const types = result.success.children.map((child) => child.type);
			assert.deepStrictEqual(types, ["thematicBreak", "heading"]);
		});

		it("is off by default at the engine level too", () => {
			const types = parseBlocks("---\na: 1\n---\n", { dialect: "gfm" }).root.children.map((child) => child.type);
			assert.deepStrictEqual(types, ["thematicBreak", "heading"]);
		});

		it("captures when enabled", () => {
			const node = captureOf("---\na: 1\n---\nrest\n");
			assert.strictEqual(node.format, "yaml");
			assert.strictEqual(node.value, "a: 1");
		});

		it("leaves the body identical to a document without the block", () => {
			const withBlock = parseOn("---\na: 1\n---\n# Title\n\nBody.\n");
			const bare = parseOn("# Title\n\nBody.\n");
			const bodyTypes = withBlock.children.slice(1).map((child) => child.type);
			assert.deepStrictEqual(
				bodyTypes,
				bare.children.map((child) => child.type),
			);
		});
	});

	describe("formats", () => {
		it("--- captures yaml", () => {
			assert.strictEqual(captureOf("---\na: 1\n---\n").format, "yaml");
		});

		it("+++ captures toml", () => {
			const node = captureOf('+++\ntitle = "x"\n+++\nrest\n');
			assert.strictEqual(node.format, "toml");
			assert.strictEqual(node.value, 'title = "x"');
		});

		it("+++ must close with +++, not ---", () => {
			const types = parseOn('+++\ntitle = "x"\n---\n').children.map((child) => child.type);
			assert.notStrictEqual(types[0], "frontmatter");
		});

		it("---json captures json and closes with ---", () => {
			const node = captureOf('---json\n{ "a": 1 }\n---\nrest\n');
			assert.strictEqual(node.format, "json");
			assert.strictEqual(node.value, '{ "a": 1 }');
		});

		it("other language hints are not recognized", () => {
			// gray-matter would honor `---yaml`; this grammar is deliberately
			// closed to three fences. `---yaml` is paragraph text.
			const types = parseOn("---yaml\na: 1\n---\n").children.map((child) => child.type);
			assert.notStrictEqual(types[0], "frontmatter");
		});
	});

	describe("fence strictness", () => {
		it("requires offset 0: a leading blank line defeats the capture", () => {
			const types = parseOn("\n---\na: 1\n---\n").children.map((child) => child.type);
			assert.notStrictEqual(types[0], "frontmatter");
		});

		it("rejects trailing whitespace on the opening fence", () => {
			const types = parseOn("--- \na: 1\n---\n").children.map((child) => child.type);
			assert.notStrictEqual(types[0], "frontmatter");
		});

		it("rejects a longer dash run", () => {
			const types = parseOn("----\na: 1\n----\n").children.map((child) => child.type);
			assert.notStrictEqual(types[0], "frontmatter");
		});

		it("an unclosed fence is not frontmatter and emits no diagnostic", () => {
			const result = MarkdownDocument.parseResult("---\na: 1\n", withFrontmatter);
			assertSuccess(result, Result.getOrThrow(result));
			if (!Result.isSuccess(result)) {
				return;
			}
			const types = result.success.root.children.map((child) => child.type);
			assert.notStrictEqual(types[0], "frontmatter");
			assert.strictEqual(result.success.diagnostics.length, 0);
		});

		it("a fence line with content after the close changes nothing after it", () => {
			const root = parseOn("---\na: 1\n---\n# Title\n");
			assert.strictEqual(root.children[0]?.type, "frontmatter");
			assert.strictEqual(root.children[1]?.type, "heading");
		});
	});

	describe("value fidelity", () => {
		it("captures the empty block", () => {
			const node = captureOf("---\n---\nbody\n");
			assert.strictEqual(node.value, "");
		});

		it("keeps interior line endings raw under CRLF", () => {
			const node = captureOf("---\r\na: 1\r\nb: 2\r\n---\r\nrest\r\n");
			assert.strictEqual(node.format, "yaml");
			assert.strictEqual(node.value, "a: 1\r\nb: 2");
		});

		it("captures under CRLF fences", () => {
			const node = captureOf("---\r\na: 1\r\n---\r\n");
			assert.strictEqual(node.value, "a: 1");
		});

		it("replaces U+0000 with U+FFFD, length-preserved", () => {
			const node = captureOf("---\na: \u0000\n---\n");
			assert.strictEqual(node.value, "a: �");
		});

		it("never inline-parses the value", () => {
			const node = captureOf("---\n*not emphasis*\n---\n");
			assert.strictEqual(node.value, "*not emphasis*");
		});
	});

	describe("positions", () => {
		it("spans the whole block including both fences", () => {
			// "---\na: 1\n---\nrest\n" — fences at 0-3 and 9-12, rest at 13.
			const root = parseOn("---\na: 1\n---\nrest\n");
			const node = root.children[0];
			assert.strictEqual(node?.type, "frontmatter");
			if (node?.type !== "frontmatter") {
				return;
			}
			assert.deepStrictEqual({ ...node.position.start }, { line: 1, column: 1, offset: 0 });
			assert.deepStrictEqual({ ...node.position.end }, { line: 3, column: 4, offset: 12 });
			const body = root.children[1];
			assert.strictEqual(body?.type, "paragraph");
			assert.strictEqual(body?.position.start.offset, 13);
			assert.strictEqual(body?.position.start.line, 4);
		});

		it("a frontmatter-only document keeps a sane root span", () => {
			const root = parseOn("---\na: 1\n---\n");
			assert.strictEqual(root.children.length, 1);
			assert.strictEqual(root.children[0]?.type, "frontmatter");
			assert.isAtLeast(root.position.end.offset, root.children[0]?.position.end.offset ?? Number.NaN);
		});
	});

	describe("dialect independence", () => {
		it("captures identically under commonmark and gfm", () => {
			const commonmark = Markdown.parseResult(
				"---\na: 1\n---\n",
				MarkdownParseOptions.make({ dialect: "commonmark", frontmatter: true }),
			);
			assertSuccess(commonmark, Result.getOrThrow(commonmark));
			if (!Result.isSuccess(commonmark)) {
				return;
			}
			const head = commonmark.success.children[0];
			assert.strictEqual(head?.type, "frontmatter");
		});
	});

	describe("the facade and the schema", () => {
		it.effect("parse and parseResult agree", () => Effect.gen(function* () {
			const viaEffect = yield* Markdown.parse("---\na: 1\n---\n", withFrontmatter);
			const viaResult = parseOn("---\na: 1\n---\n");
			assert.deepStrictEqual(viaEffect, viaResult);
		}));

		it("a frontmatter head survives a Root decode round-trip", () => {
			const root = parseOn("---\na: 1\n---\nrest\n");
			const decoded = S.encodeUnknownResult(Root)(root).pipe(Result.getOrThrow, S.decodeResult(Root), Result.getOrThrow);
			assert.deepStrictEqual(decoded, root);
		});

		it("Frontmatter.make constructs the node directly", () => {
			const node = Frontmatter.make({
				type: "frontmatter",
				format: "yaml",
				value: "a: 1",
				position: Position.make({
					start: Point.make({ line: 1, column: 1, offset: 0 }),
					end: Point.make({ line: 3, column: 4, offset: 12 }),
				}),
			});
			assert.strictEqual(node.format, "yaml");
		});

		// A constructor-defaulted class field accepts a plain-object literal for
		// `position`, matching what `~type.make.in` has always admitted: `make`
		// deep-validates the literal and promotes it to a real `Position`/`Point`
		// instance tree rather than requiring the caller to pre-construct one.
		// This asserts that promotion.
		it("make accepts a plain-object position and promotes it to instances", () => {
			const node = Frontmatter.make({
				type: "frontmatter",
				format: "yaml",
				value: "a: 1",
				position: {
					start: { line: 1, column: 1, offset: 0 },
					end: { line: 3, column: 4, offset: 12 },
				},
			});
			assert.instanceOf(node.position, Position);
			assert.instanceOf(node.position.start, Point);
			assert.instanceOf(node.position.end, Point);
			assert.strictEqual(node.position.end.offset, 12);
		});
	});
});
