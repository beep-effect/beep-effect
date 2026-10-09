// The visitor stream walk: enter/exit events in document pre-order over the
// parsed tree, path/depth context, early termination, and the depth-guard
// posture on decoded foreign trees.
//
// Sibling contract: the event union is a Data.TaggedEnum with a taggedEnum
// constructor const (yaml/toml precedent) and the statics class exposes a
// single visit. Deviation, recorded: yaml and toml visit TEXT (their event
// source is the parse itself), while this visitor walks an already-parsed
// tree — that is what lets it stay infallible at the type level. The guard
// posture mirrors stringify: a decoded foreign tree deeper than
// MAX_NESTING_DEPTH surfaces deliberately (an Error event ending the walk),
// never a defect — and the same tree fails stringifyResult typed, pinned
// here as the posture link.

import { assert, describe, it } from "@effect/vitest";
import { Effect, Equal, Result, Stream } from "effect";
import { Markdown } from "../../effected/markdown/Markdown.ts";
import { Blockquote, Paragraph, Point, Position, Root, Text } from "../../effected/markdown/MarkdownNode.ts";
import { MarkdownVisitor, MarkdownVisitorEvent } from "../../effected/markdown/MarkdownVisitor.ts";
import { Mdast } from "../../effected/markdown/Mdast.ts";

const parse = (text: string, options?: Parameters<typeof Markdown.parseResult>[1]) => {
	const result = Markdown.parseResult(text, options);
	assert.isTrue(Result.isSuccess(result));
	return Result.getOrThrow(result);
};

const collect = (root: Root) => Effect.runSync(Stream.runCollect(MarkdownVisitor.visit(root)));

/** A plain-mdast tree of `depth` nested blockquotes around one paragraph. */
const deepForeignTree = (depth: number): unknown => {
	let node: unknown = { type: "paragraph", children: [{ type: "text", value: "x" }] };
	for (let i = 0; i < depth; i++) {
		node = { type: "blockquote", children: [node] };
	}
	return { type: "root", children: [node] };
};

const syntheticPosition = Position.make({
	start: Point.make({ line: 1, column: 1, offset: 0 }),
	end: Point.make({ line: 1, column: 1, offset: 0 }),
});

describe("MarkdownVisitor", () => {
	it("emits the exact enter/exit sequence for a small document", () => {
		const root = parse("hello *world*\n");
		const events = collect(root);
		const shape = events.map((event) =>
			event._tag === "Error" ? "Error" : `${event._tag}:${event.node.type}@${event.depth}[${event.path.join(".")}]`,
		);
		assert.deepStrictEqual(shape, [
			"Enter:root@0[]",
			"Enter:paragraph@1[0]",
			"Enter:text@2[0.0]",
			"Exit:text@2[0.0]",
			"Enter:emphasis@2[0.1]",
			"Enter:text@3[0.1.0]",
			"Exit:text@3[0.1.0]",
			"Exit:emphasis@2[0.1]",
			"Exit:paragraph@1[0]",
			"Exit:root@0[]",
		]);
	});

	it("walks an empty document as a bare root pair", () => {
		const events = collect(parse(""));
		assert.strictEqual(events.length, 2);
		assert.strictEqual(events[0]?._tag, "Enter");
		assert.strictEqual(events[1]?._tag, "Exit");
	});

	it("covers gfm constructs and frontmatter in document order with balanced events", () => {
		const source = [
			"---",
			"title: x",
			"---",
			"# Head",
			"",
			"- [x] task ~~gone~~",
			"",
			"| a |",
			"| - |",
			"| b |",
			"",
			"Text[^f]",
			"",
			"[^f]: note",
			"",
		].join("\n");
		const root = parse(source, { dialect: "gfm", frontmatter: true });
		const events = collect(root);

		// Balanced: every Enter has a matching LIFO Exit, and no Error events.
		const stack: Array<string> = [];
		for (const event of events) {
			assert.notStrictEqual(event._tag, "Error");
			if (event._tag === "Enter") {
				stack.push(event.node.type);
			} else if (event._tag === "Exit") {
				assert.strictEqual(event.node.type, stack.pop());
			}
		}
		assert.strictEqual(stack.length, 0);

		// Document order: frontmatter is the first child entered, and the gfm
		// node types all appear.
		const entered = events.filter((event) => event._tag === "Enter").map((event) => event.node.type);
		assert.strictEqual(entered[0], "root");
		assert.strictEqual(entered[1], "frontmatter");
		for (const expected of ["heading", "listItem", "delete", "table", "tableRow", "tableCell", "footnoteReference"]) {
			assert.include(entered, expected);
		}
	});

	it("reports path segments as child indexes from the root", () => {
		const root = parse("> - item\n");
		const events = collect(root);
		const text = events.find((event) => event._tag === "Enter" && event.node.type === "text");
		assert.isDefined(text);
		if (text !== undefined && text._tag === "Enter") {
			// root > blockquote[0] > list[0] > listItem[0] > paragraph[0] > text[0]
			assert.deepStrictEqual([...text.path], [0, 0, 0, 0, 0]);
			assert.strictEqual(text.depth, 5);
		}
	});

	it("terminates early under Stream.take without walking the rest", () => {
		const root = parse("a\n\nb\n\nc\n");
		const events = Effect.runSync(Stream.runCollect(MarkdownVisitor.visit(root).pipe(Stream.take(3))));
		assert.strictEqual(events.length, 3);
		assert.strictEqual(events[0]?._tag, "Enter");
	});

	it("events are structurally equal for the same walk", () => {
		const root = parse("hi\n");
		const [first] = collect(root);
		const [again] = collect(root);
		assert.isTrue(Equal.equals(first, again));
	});

	it("walks a tree exactly at the depth cap without an Error event", () => {
		// Root(0) + 255 blockquotes + paragraph + text: max depth 257... keep
		// below the cap: 254 blockquotes puts text at depth 256 == cap, legal.
		const result = Mdast.fromMdastResult(deepForeignTree(254));
		assert.isTrue(Result.isSuccess(result));
		const events = collect(Result.getOrThrow(result));
		assert.isFalse(events.some((event) => event._tag === "Error"));
	});

	it("surfaces a decoded foreign tree past the cap as an Error event ending the walk", () => {
		const result = Mdast.fromMdastResult(deepForeignTree(300));
		assert.isTrue(Result.isSuccess(result));
		const tree = Result.getOrThrow(result);

		const events = collect(tree);
		const last = events[events.length - 1];
		assert.isDefined(last);
		assert.strictEqual(last?._tag, "Error");
		if (last !== undefined && last._tag === "Error") {
			assert.strictEqual(last.diagnostic.code, "NestingDepthExceeded");
		}
		// The Error event is terminal — exactly one, nothing after it.
		assert.strictEqual(events.filter((event) => event._tag === "Error").length, 1);

		// Posture link: the same tree fails stringify typed, never a defect.
		assert.isTrue(Result.isFailure(Markdown.stringifyResult(tree)));
	});

	it("constructs events via the taggedEnum constructors", () => {
		const node = Text.make({ value: "x", position: syntheticPosition });
		const event = MarkdownVisitorEvent.Enter({ node, path: [0], depth: 1 });
		assert.strictEqual(event._tag, "Enter");
		assert.isTrue(MarkdownVisitorEvent.$is("Enter")(event));
	});

	it("enter and exit fire for a leaf back to back", () => {
		const paragraph = Paragraph.make({
			children: [Text.make({ value: "x", position: syntheticPosition })],
			position: syntheticPosition,
		});
		const root = Root.make({ children: [paragraph], position: syntheticPosition });
		const events = collect(root);
		const tags = events.map((event) => event._tag);
		assert.deepStrictEqual(tags, ["Enter", "Enter", "Enter", "Exit", "Exit", "Exit"]);
	});

	it("blockquote nesting inside the cap via make-constructed classes walks clean", () => {
		let node: Blockquote | Paragraph = Paragraph.make({
			children: [Text.make({ value: "x", position: syntheticPosition })],
			position: syntheticPosition,
		});
		for (let i = 0; i < 10; i++) {
			node = Blockquote.make({ children: [node], position: syntheticPosition });
		}
		const root = Root.make({ children: [node], position: syntheticPosition });
		const events = collect(root);
		assert.strictEqual(events.length, 2 * (1 + 10 + 1 + 1));
		assert.isFalse(events.some((event) => event._tag === "Error"));
	});
});
