// Synthesized-node construction: every node class's `make` fills the
// zero-width `Position.synthetic` when `position` is omitted, so replacement
// fragments for `MarkdownFormat.modify` construct in one line. The default is
// make-only — the controls pin that decode (the mdast admission boundary)
// still requires a full position and that parsed trees still carry real
// spans, so the interop corpus's exact-emission contract is untouched.

import { assert, describe, it } from "@effect/vitest";
import { Effect, Result, Schema } from "effect";
import { Markdown } from "../../effected/markdown/Markdown.ts";
import { MarkdownDocument } from "../../effected/markdown/MarkdownDocument.ts";
import { MarkdownFormat } from "../../effected/markdown/MarkdownFormat.ts";
import { Heading, Paragraph, Point, Position, Root, Text } from "../../effected/markdown/MarkdownNode.ts";

const parseDoc = (text: string) => {
	const result = MarkdownDocument.parseResult(text);
	assert.isTrue(Result.isSuccess(result));
	return Result.getOrThrow(result);
};

describe("Position.synthetic", () => {
	it("is the zero-width sentinel: line 1, column 1, offset 0 at both ends", () => {
		assert.instanceOf(Position.synthetic, Position);
		assert.deepStrictEqual(Position.synthetic.start, Point.make({ line: 1, column: 1, offset: 0 }));
		assert.deepStrictEqual(Position.synthetic.end, Point.make({ line: 1, column: 1, offset: 0 }));
	});
});

// Asserted by both reference and value. `make` passes an already-constructed
// `Position` instance through a nested class-typed field by reference — the
// zero-width default fills in the single shared `Position.synthetic`
// instance, so every synthesized node's position is strictly that same
// object (pinned below with `strictEqual`). `Position` is also an immutable
// value class with structural equality, so `deepStrictEqual` remains the
// right comparison wherever a fresh-but-equal `Position` is legitimate — a
// hand-built plain-object literal, for instance, which `make` promotes to a
// distinct instance rather than reusing.
describe("make fills the synthetic position", () => {
	it("constructs a Text fragment in one line", () => {
		const text = Text.make({ value: "shipped" });
		assert.instanceOf(text, Text);
		assert.strictEqual(text.value, "shipped");
		assert.deepStrictEqual(text.position, Position.synthetic);
		// The default is the single shared `Position.synthetic` instance, not a
		// fresh copy — pins that `make` never re-synthesizes it.
		assert.strictEqual(text.position, Position.synthetic);
	});

	it("constructs Paragraph and Heading fragments in one line", () => {
		const paragraph = Paragraph.make({ children: [Text.make({ value: "p" })] });
		assert.deepStrictEqual(paragraph.position, Position.synthetic);
		const heading = Heading.make({ depth: 2, children: [Text.make({ value: "t" })] });
		assert.strictEqual(heading.depth, 2);
		assert.deepStrictEqual(heading.position, Position.synthetic);
	});

	it("still honors an explicit position over the default", () => {
		const explicit = Position.make({
			start: Point.make({ line: 2, column: 3, offset: 9 }),
			end: Point.make({ line: 2, column: 8, offset: 14 }),
		});
		const text = Text.make({ value: "placed", position: explicit });
		assert.deepStrictEqual(text.position, explicit);
		// the point of the test: the default did NOT win
		assert.notDeepEqual(text.position, Position.synthetic);
		// an already-constructed Position passed explicitly is passed through
		// by reference, not re-constructed
		assert.strictEqual(text.position, explicit);
	});
});

describe("synthesized trees flow through the render surfaces", () => {
	it("stringifies a fully synthesized tree canonically", () => {
		const root = Root.make({
			children: [
				Heading.make({ depth: 2, children: [Text.make({ value: "Title" })] }),
				Paragraph.make({ children: [Text.make({ value: "Body." })] }),
			],
		});
		const rendered = Markdown.stringifyResult(root);
		assert.isTrue(Result.isSuccess(rendered));
		const out = Result.getOrThrow(rendered);
		// Re-parses to the same shape — the canonical-stringify contract.
		const reparsed = parseDoc(out);
		assert.deepStrictEqual(
			reparsed.root.children.map((child) => child.type),
			["heading", "paragraph"],
		);
	});

	it.effect("modify accepts a one-line synthesized fragment", () =>
		Effect.gen(function* () {
			const document = parseDoc("# Old\n\nbody\n");
			const heading = document.find("heading");
			assert.isDefined(heading);
			const out = yield* MarkdownFormat.modifyToString(
				document,
				heading,
				Heading.make({ depth: 1, children: [Text.make({ value: "New" })] }),
			);
			assert.strictEqual(out, "# New\n\nbody\n");
		}),
	);
});

describe("the default is make-only (controls)", () => {
	it("decode still requires a full position", () => {
		const decoded = Schema.decodeUnknownResult(Text)({ type: "text", value: "x" });
		assert.isTrue(Result.isFailure(decoded));
	});

	it("parsed trees still carry real spans, never the sentinel", () => {
		const document = parseDoc("# Hi\n");
		const heading = document.find("heading");
		assert.isDefined(heading);
		assert.notStrictEqual(heading.position, Position.synthetic);
		assert.strictEqual(heading.position.start.offset, 0);
		assert.strictEqual(heading.position.end.offset, 4);
	});

	it("encode of a synthesized node still emits the position", () => {
		const encoded = Schema.encodeUnknownResult(Text)(Text.make({ value: "x" }));
		assert.isTrue(Result.isSuccess(encoded));
		const plain = Result.getOrThrow(encoded) as { position?: unknown };
		assert.deepStrictEqual(plain.position, {
			start: { line: 1, column: 1, offset: 0 },
			end: { line: 1, column: 1, offset: 0 },
		});
	});
});
