// `MarkdownDocument.find`/`findAll`: the query helpers over the parsed tree —
// type-string selectors that narrow through the node-class union, plain and
// type-guard predicates, document pre-order (the visitor's Enter order,
// root-inclusive), identity into `MarkdownFormat.modify`, and the getters'
// thrown-defect posture on an over-deep foreign tree.

import { assert, describe, it } from "@effect/vitest";
import * as HashMap from "effect/HashMap";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import { MAX_NESTING_DEPTH } from "../../effected/markdown/internal/limits.ts";
import { MarkdownDocument } from "../../effected/markdown/MarkdownDocument.ts";
import { MarkdownFormat } from "../../effected/markdown/MarkdownFormat.ts";
import type { FlowContent } from "../../effected/markdown/MarkdownNode.ts";
import { Blockquote, Heading, List, Paragraph, Root, Table, Text } from "../../effected/markdown/MarkdownNode.ts";
import { MarkdownVisitor } from "../../effected/markdown/MarkdownVisitor.ts";

const parseDoc = (text: string) => {
	const result = MarkdownDocument.parseResult(text);
	assert.isTrue(Result.isSuccess(result));
	return Result.getOrThrow(result);
};

const source = [
	"# Title",
	"",
	"Intro with a [link](/a).",
	"",
	"> ## Quoted heading",
	"",
	"- item one",
	"- item two",
	"",
	"| h |",
	"| - |",
	"| c |",
	"",
	"## Outro",
	"",
].join("\n");

describe("MarkdownDocument.find", () => {
	it("finds the first node of a type, narrowed through the type tag", () => {
		const document = parseDoc(source);
		const heading = document.find("heading");
		assert.isDefined(heading);
		assert.instanceOf(heading, Heading);
		// The narrowed static type exposes `depth` without a cast.
		assert.strictEqual(heading.depth, 1);
	});

	it("matches by identity against the document's own tree", () => {
		const document = parseDoc(source);
		assert.strictEqual(document.find("heading"), document.root.children[0]);
		// The root itself is in the walk, so the widest query returns it first.
		assert.strictEqual(
			document.find(() => true),
			document.root,
		);
		assert.strictEqual(document.find("root"), document.root);
	});

	it("accepts a plain predicate and returns the wide node union", () => {
		const document = parseDoc(source);
		const found = document.find((node) => node.type === "heading" && node.depth === 2);
		assert.isDefined(found);
		assert.instanceOf(found, Heading);
	});

	it("narrows through a type-guard predicate", () => {
		const document = parseDoc(source);
		const table = document.find((node): node is Table => node.type === "table");
		assert.isDefined(table);
		assert.instanceOf(table, Table);
		assert.isDefined(table.align);
	});

	it("returns undefined when nothing matches", () => {
		const document = parseDoc(source);
		assert.isUndefined(document.find("footnoteDefinition"));
		assert.isUndefined(document.find(() => false));
	});
});

describe("MarkdownDocument.findAll", () => {
	it("collects every match in document pre-order, wherever it nests", () => {
		const document = parseDoc(source);
		const headings = document.findAll("heading");
		assert.strictEqual(headings.length, 3);
		for (const heading of headings) {
			assert.instanceOf(heading, Heading);
		}
		// Document order: the quoted heading sits between the two root-level
		// ones, and `findAll("heading")[1]` addresses it without child indexing.
		assert.deepStrictEqual(
			headings.map((heading) => heading.depth),
			[1, 2, 2],
		);
		// Same nodes, same order as the navigation getter, by identity.
		assert.deepStrictEqual(
			headings,
			document.headings.map((entry) => entry.node),
		);
	});

	it("matches the visitor's Enter order node for node, root included", () => {
		const document = parseDoc(source);
		const events = MarkdownVisitor.visit(document.root).pipe(Stream.runCollect, Effect.runSync);
		const entered = [...events].filter((event) => event._tag === "Enter").map((event) => event.node);
		assert.deepStrictEqual(
			document.findAll(() => true),
			entered,
		);
	});

	it("returns an empty array when nothing matches", () => {
		const document = parseDoc("plain paragraph\n");
		assert.deepStrictEqual(document.findAll("code"), []);
	});

	it("collects with a type-guard predicate over fidelity fields", () => {
		const document = parseDoc(source);
		const unordered = document.findAll((node): node is List => node.type === "list" && node.ordered !== true);
		assert.strictEqual(unordered.length, 1);
		assert.instanceOf(unordered[0], List);
	});
});

describe("query helpers feed MarkdownFormat.modify", () => {
	it.effect("finds a node and replaces it by identity", () =>
		Effect.gen(function* () {
			const document = parseDoc(source);
			const outro = document.findAll("heading")[2];
			assert.isDefined(outro);
			const replacement = Heading.make({ depth: 3, children: [Text.make({ value: "Fin" })] });
			const out = yield* MarkdownFormat.modifyToString(document, outro, replacement);
			assert.isTrue(out.includes("### Fin"));
			assert.isFalse(out.includes("## Outro"));
		}),
	);
});

describe("guard posture", () => {
	const overDeepDocument = (): MarkdownDocument => {
		let flow: FlowContent = Paragraph.make({ children: [Text.make({ value: "x" })] });
		for (let index = 0; index < MAX_NESTING_DEPTH + 44; index += 1) {
			flow = Blockquote.make({ children: [flow] });
		}
		return MarkdownDocument.make({
			source: "",
			root: Root.make({ children: [flow] }),
			diagnostics: [],
			definitions: HashMap.empty(),
			definitionOrder: [],
		});
	};

	it("refuses an over-deep foreign tree as a defect, mirroring the getters", () => {
		const document = overDeepDocument();
		assert.throws(() => document.findAll("text"));
		// A find that must descend past the cap trips the same guard.
		assert.throws(() => document.find("text"));
	});

	it("returns early without visiting the deep region when a shallow node matches", () => {
		const document = overDeepDocument();
		assert.strictEqual(document.find("root"), document.root);
	});
});
