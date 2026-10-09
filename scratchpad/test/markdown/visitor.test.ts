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
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import { Markdown } from "../../effected/markdown/Markdown.ts";
import { Blockquote, Paragraph, Point, Position, Root, Text } from "../../effected/markdown/MarkdownNode.ts";
import { MarkdownVisitor, MarkdownVisitorEvent } from "../../effected/markdown/MarkdownVisitor.ts";
import { Mdast } from "../../effected/markdown/Mdast.ts";

const parse = (text: string, options?: Parameters<typeof Markdown.parseResult>[1]) => {
	const result = Markdown.parseResult(text, options);
	assertSuccess(Result.map(result, () => undefined), undefined);
	return Result.getOrThrow(result);
};

const collect = Effect.fn("test.collect")(function* (root: Root) {
	return yield* MarkdownVisitor.visit(root).pipe(Stream.runCollect);
});

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
	it.effect("emits the exact enter/exit sequence for a small document", Effect.fnUntraced(function* () {
		const root = parse("hello *world*\n");
		const events = yield* collect(root);
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
	}));

	it.effect("walks an empty document as a bare root pair", Effect.fnUntraced(function* () {
		const events = yield* collect(parse(""));
		assert.strictEqual(events.length, 2);
		assert.strictEqual(events[0]?._tag, "Enter");
		assert.strictEqual(events[1]?._tag, "Exit");
	}));

	it.effect("covers gfm constructs and frontmatter in document order with balanced events", Effect.fnUntraced(function* () {
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
		const events = yield* collect(root);

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
	}));

	it.effect("reports path segments as child indexes from the root", Effect.fnUntraced(function* () {
		const root = parse("> - item\n");
		const events = yield* collect(root);
		const text = events.find((event) => event._tag === "Enter" && event.node.type === "text");
		assert.isDefined(text);
		if (text !== undefined && text._tag === "Enter") {
			// root > blockquote[0] > list[0] > listItem[0] > paragraph[0] > text[0]
			assert.deepStrictEqual([...text.path], [0, 0, 0, 0, 0]);
			assert.strictEqual(text.depth, 5);
		}
	}));

	it.effect("terminates early under Stream.take without walking the rest", Effect.fnUntraced(function* () {
		const root = parse("a\n\nb\n\nc\n");
		const events = yield* MarkdownVisitor.visit(root).pipe(Stream.take(3), Stream.runCollect);
		assert.strictEqual(events.length, 3);
		assert.strictEqual(events[0]?._tag, "Enter");
	}));

	it.effect("events are structurally equal for the same walk", Effect.fnUntraced(function* () {
		const root = parse("hi\n");
		const [first] = yield* collect(root);
		const [again] = yield* collect(root);
		assert.isTrue(Equal.equals(first, again));
	}));

	it.effect("walks a tree exactly at the depth cap without an Error event", Effect.fnUntraced(function* () {
		// Root(0) + 255 blockquotes + paragraph + text: max depth 257... keep
		// below the cap: 254 blockquotes puts text at depth 256 == cap, legal.
		const result = Mdast.fromMdastResult(deepForeignTree(254));
		assertSuccess(Result.map(result, () => undefined), undefined);
		const events = yield* result.pipe(Result.getOrThrow, collect);
		assert.isFalse(events.some((event) => event._tag === "Error"));
	}));

	it.effect("surfaces a decoded foreign tree past the cap as an Error event ending the walk", Effect.fnUntraced(function* () {
		const result = Mdast.fromMdastResult(deepForeignTree(300));
		assertSuccess(Result.map(result, () => undefined), undefined);
		const tree = Result.getOrThrow(result);

		const events = yield* collect(tree);
		const last = events[events.length - 1];
		assert.isDefined(last);
		assert.strictEqual(last?._tag, "Error");
		if (last !== undefined && last._tag === "Error") {
			assert.strictEqual(last.diagnostic.code, "NestingDepthExceeded");
		}
		// The Error event is terminal — exactly one, nothing after it.
		assert.strictEqual(events.filter((event) => event._tag === "Error").length, 1);

		// Posture link: the same tree fails stringify typed, never a defect.
		assertFailure(Result.mapError(Markdown.stringifyResult(tree), () => undefined), undefined);
	}));

	it("constructs events via the taggedEnum constructors", () => {
		const node = Text.make({ value: "x", position: syntheticPosition });
		const event = MarkdownVisitorEvent.Enter({ node, path: [0], depth: 1 });
		assert.strictEqual(event._tag, "Enter");
		assert.isTrue(MarkdownVisitorEvent.$is("Enter")(event));
	});

	it.effect("enter and exit fire for a leaf back to back", Effect.fnUntraced(function* () {
		const paragraph = Paragraph.make({
			children: [Text.make({ value: "x", position: syntheticPosition })],
			position: syntheticPosition,
		});
		const root = Root.make({ children: [paragraph], position: syntheticPosition });
		const events = yield* collect(root);
		const tags = events.map((event) => event._tag);
		assert.deepStrictEqual(tags, ["Enter", "Enter", "Enter", "Exit", "Exit", "Exit"]);
	}));

	it.effect("blockquote nesting inside the cap via make-constructed classes walks clean", Effect.fnUntraced(function* () {
		let node: Blockquote | Paragraph = Paragraph.make({
			children: [Text.make({ value: "x", position: syntheticPosition })],
			position: syntheticPosition,
		});
		for (let i = 0; i < 10; i++) {
			node = Blockquote.make({ children: [node], position: syntheticPosition });
		}
		const root = Root.make({ children: [node], position: syntheticPosition });
		const events = yield* collect(root);
		assert.strictEqual(events.length, 2 * (1 + 10 + 1 + 1));
		assert.isFalse(events.some((event) => event._tag === "Error"));
	}));
});
