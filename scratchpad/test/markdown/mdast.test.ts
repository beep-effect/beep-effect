// The Mdast projection facade: toMdast's canonical plain-JSON emission
// (the mdast-util-from-markdown shape the interop corpus pins), and
// fromMdast's checked admission of foreign mdast — null normalization,
// sentinel positions, frontmatter literal mapping, and typed failure.

import { assert, describe, it } from "@effect/vitest";
import { assertSuccess, assertFailure, assertExitSuccess } from "@effect/vitest/utils";
import * as Exit from "effect/Exit";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Markdown, MarkdownParseOptions } from "../../effected/markdown/Markdown.ts";
import { Frontmatter, Root } from "../../effected/markdown/MarkdownNode.ts";
import { Mdast, MdastDecodeError } from "../../effected/markdown/Mdast.ts";

const isRecord = S.is(S.Record(S.String, S.Unknown));

const gfm = (text: string): Root => {
	const parsed = Markdown.parseResult(text);
	assertSuccess(parsed, Result.getOrThrow(parsed));
	if (Result.isFailure(parsed)) assert.fail("expected a successful parse");
	return parsed.success;
};

const first = (tree: unknown): Record<string, unknown> => {
	if (!isRecord(tree)) assert.fail("expected a record");
	const children = tree.children;
	if (!Array.isArray(children)) assert.fail("expected children");
	const child: unknown = children[0];
	assert.isDefined(child);
	if (!isRecord(child)) assert.fail("expected a child record");
	return child;
};

const firstTypedChild = (root: Root) => {
	const child = root.children[0];
	assert.isDefined(child);
	return child;
};

describe("Mdast.toMdast", () => {
	it("emits plain objects, not schema classes", () => {
		const projected = Mdast.toMdast(gfm("hello\n"));
		assert.strictEqual(Object.getPrototypeOf(projected), Object.prototype);
		assert.strictEqual(projected.type, "root");
	});

	it("strips fidelity extras and keeps positions", () => {
		const heading = first(Mdast.toMdast(gfm("# Title\n")));
		assert.deepStrictEqual(Object.keys(heading).sort(), ["children", "depth", "position", "type"]);
		assert.deepStrictEqual(heading.position, {
			start: { line: 1, column: 1, offset: 0 },
			end: { line: 1, column: 8, offset: 7 },
		});
	});

	it("spells list and item optionality the reference utility's way", () => {
		const list = first(Mdast.toMdast(gfm("- a\n- b\n")));
		assert.strictEqual(list.ordered, false);
		assert.strictEqual(list.start, null);
		assert.strictEqual(list.spread, false);
		const item = first(list);
		assert.isDefined(item);
		assert.strictEqual(item?.spread, false);
		assert.strictEqual(item?.checked, null);
	});

	it("computes list spread as blank-between-items, not looseness", () => {
		// A blank line INSIDE the single item makes the list loose for
		// rendering, but mdast's List.spread reads false: no blank line
		// separates two items.
		const withinItem = first(Mdast.toMdast(gfm("- a\n\n  b\n")));
		assert.strictEqual(withinItem.spread, false);
		// A blank line BETWEEN items reads true.
		const betweenItems = first(Mdast.toMdast(gfm("- a\n\n- b\n")));
		assert.strictEqual(betweenItems.spread, true);
	});

	it("emits explicit nulls for absent code lang and meta and strips the value terminator", () => {
		const code = first(Mdast.toMdast(gfm("```\nbody\n```\n")));
		assert.strictEqual(code.lang, null);
		assert.strictEqual(code.meta, null);
		assert.strictEqual(code.value, "body");
	});

	it("emits task-list state through checked", () => {
		const list = first(Mdast.toMdast(gfm("- [x] done\n- [ ] open\n")));
		const children = list.children;
		if (!Array.isArray(children) || !children.every(isRecord)) assert.fail("expected child records");
		assert.strictEqual(children[0]?.checked, true);
		assert.strictEqual(children[1]?.checked, false);
	});

	it("decodes escapes and references in labels, keeping identifiers source-form", () => {
		const tree = Mdast.toMdast(gfm("[&semi;]\n\n[&semi;]: /x\n"));
		const reference = first(tree);
		const link = first(reference);
		assert.strictEqual(link?.label, ";");
		assert.strictEqual(link?.identifier, "&semi;");
	});

	it("projects gfm tables with alignment", () => {
		const table = first(Mdast.toMdast(gfm("| a | b |\n| :- | -: |\n| c | d |\n")));
		assert.strictEqual(table.type, "table");
		assert.deepStrictEqual(table.align, ["left", "right"]);
	});

	it("projects the frontmatter capture to a format-named literal node", () => {
		for (const [source, type, value] of [
			["---\na: 1\n---\nbody\n", "yaml", "a: 1"],
			["+++\na = 1\n+++\nbody\n", "toml", "a = 1"],
			['---json\n{ "a": 1 }\n---\nbody\n', "json", '{ "a": 1 }'],
		] as const) {
			const parsed = Markdown.parseResult(source, MarkdownParseOptions.make({ frontmatter: true }));
			assertSuccess(parsed, Result.getOrThrow(parsed));
			if (Result.isSuccess(parsed)) {
				const node = first(Mdast.toMdast(parsed.success));
				assert.strictEqual(node.type, type);
				assert.strictEqual(node.value, value);
			}
		}
	});
});

describe("Mdast.fromMdast", () => {
	it("preserves content line endings when restoring the code terminator", () => {
		for (const [value, carried] of [
			["", ""], ["body", "body\n"], ["body\n", "body\n\n"],
			["body\r\n", "body\r\n\n"], ["body\n\n", "body\n\n\n"],
			["body\r\n\r\n", "body\r\n\r\n\n"], ["body\r", "body\r\r\n"],
		] as const) {
			const back = Mdast.fromMdastResult({ type: "root", children: [{ type: "code", value }] });
			if (Result.isFailure(back)) assert.fail("expected code admission to succeed");
			const code = back.success.children[0];
			assert.strictEqual(code?.type === "code" ? code.value : undefined, carried);
			assert.strictEqual(first(Mdast.toMdast(back.success)).value, value);
		}
	});

	it("round-trips parsed code blocks with trailing blank content lines", () => {
		for (const source of ["```\nbody\n\n```\n", "```\r\nbody\r\n\r\n```\r\n"]) {
			const plain = Mdast.toMdast(gfm(source));
			assert.strictEqual(first(plain).value, "body\n");
			const back = Mdast.fromMdastResult(plain);
			if (Result.isFailure(back)) assert.fail("expected code admission to succeed");
			assert.deepStrictEqual(Mdast.toMdast(back.success), plain);
		}
	});

	it("admits decoded association labels without decoding them twice", () => {
		for (const label of ["&amp;", "a\\*", "\\&amp;", "&#10;", "&semi;", "plain"]) {
			const identifier = "source\\* &amp;";
			const association = { identifier, label };
			const back = Mdast.fromMdastResult({
				type: "root",
				children: [
					{ type: "definition", ...association, url: "/u" },
					{ type: "footnoteDefinition", ...association, children: [] },
					{ type: "paragraph", children: [
						{ type: "linkReference", ...association, referenceType: "full", children: [] },
						{ type: "imageReference", ...association, referenceType: "full", alt: "alt" },
						{ type: "footnoteReference", ...association },
					] },
				],
			});
			if (Result.isFailure(back)) assert.fail("expected association admission to succeed");
			const projected = Mdast.toMdast(back.success);
			const children = projected.children;
			if (!Array.isArray(children) || !children.every(isRecord)) assert.fail("expected child records");
			const references = children[2]?.children;
			if (!Array.isArray(references) || !references.every(isRecord)) assert.fail("expected reference records");
			for (const node of [children[0], children[1], ...references]) {
				assert.strictEqual(node?.label, label);
				assert.strictEqual(node?.identifier, identifier);
			}
		}
	});

	it("round-trips parsed entity-like and escaped association labels", () => {
		for (const source of [
			"[&amp;amp;]\n\n[&amp;amp;]: /u\n",
			"[a\\\\*]\n\n[a\\\\*]: /u\n",
			"[^&amp;amp;]\n\n[^&amp;amp;]: footnote\n",
		]) {
			const plain = Mdast.toMdast(gfm(source));
			const back = Mdast.fromMdastResult(plain);
			if (Result.isFailure(back)) assert.fail("expected association admission to succeed");
			assert.deepStrictEqual(Mdast.toMdast(back.success), plain);
		}
	});

	it.effect("fails typed for prototype-property node kinds through both admission channels", () => Effect.gen(function* () {
		for (const type of ["toString", "constructor", "__proto__"]) {
			for (const input of [{ type }, { type: "root", children: [{ type }] }]) {
				const sync = Mdast.fromMdastResult(input);
				const effect = yield* Effect.exit(Mdast.fromMdast(input));
				assertFailure(sync, sync.pipe(Result.flip, Result.getOrThrow));
				assertSuccess(Exit.findError(effect), sync.failure);
				{
					const effectError = effect.pipe(Exit.findError, Result.getOrThrow);
					assert.instanceOf(sync.failure, MdastDecodeError);
					assert.isDefined(sync.failure.issue);
					assert.instanceOf(effectError, MdastDecodeError);
					assert.deepStrictEqual(effectError.issue, sync.failure.issue);
				}
			}
		}
	}));

	it("round-trips a parsed tree through plain mdast, positions included", () => {
		const root = gfm("# T\n\ntext with *emphasis* and ~~strike~~\n\n- [x] item\n");
		const back = Mdast.fromMdastResult(Mdast.toMdast(root));
		assertSuccess(back, Result.getOrThrow(back));
		if (Result.isSuccess(back)) {
			assert.instanceOf(back.success, Root);
			assert.deepStrictEqual(Mdast.toMdast(back.success), Mdast.toMdast(root));
		}
	});

	it("normalizes explicit nulls to absence", () => {
		const back = Mdast.fromMdastResult({
			type: "root",
			children: [
				{
					type: "list",
					ordered: false,
					start: null,
					spread: false,
					children: [{ type: "listItem", spread: false, checked: null, children: [] }],
				},
			],
		});
		assertSuccess(back, Result.getOrThrow(back));
		if (Result.isSuccess(back)) {
			const list = back.success.children[0];
			assert.strictEqual(list?.type, "list");
			if (list?.type === "list") {
				assert.isFalse(Object.hasOwn(list, "start"));
				const item = list.children[0];
				assert.isDefined(item);
				assert.isFalse(Object.hasOwn(item, "checked"));
				// Explicit false is a value, not absence.
				assert.strictEqual(list.ordered, false);
			}
		}
	});

	it("synthesizes the zero-width sentinel for missing positions", () => {
		const back = Mdast.fromMdastResult({
			type: "root",
			children: [{ type: "paragraph", children: [{ type: "text", value: "hi" }] }],
		});
		assertSuccess(back, Result.getOrThrow(back));
		if (Result.isSuccess(back)) {
			const paragraph = back.success.children[0];
			assert.deepStrictEqual({ ...paragraph?.position.start }, { line: 1, column: 1, offset: 0 });
		}
	});

	it("keeps complete foreign positions and drops incomplete ones", () => {
		const back = Mdast.fromMdastResult({
			type: "root",
			children: [
				{
					type: "paragraph",
					children: [
						{
							type: "text",
							value: "hi",
							position: { start: { line: 3, column: 2, offset: 12 }, end: { line: 3, column: 4, offset: 14 } },
						},
					],
					position: { start: { line: 3 }, end: { line: 3 } },
				},
			],
		});
		assertSuccess(back, Result.getOrThrow(back));
		if (Result.isSuccess(back)) {
			const paragraph = back.success.children[0];
			assert.strictEqual(paragraph?.position.start.offset, 0);
			const text = paragraph?.type === "paragraph" ? paragraph.children[0] : undefined;
			assert.strictEqual(text?.position.start.offset, 12);
		}
	});

	it("decodes frontmatter literal nodes into the capture class", () => {
		const back = Mdast.fromMdastResult({
			type: "root",
			children: [{ type: "yaml", value: "a: 1" }],
		});
		assertSuccess(back, Result.getOrThrow(back));
		if (Result.isSuccess(back)) {
			const node = back.success.children[0];
			assert.instanceOf(node, Frontmatter);
			if (S.is(Frontmatter)(node)) {
				assert.strictEqual(node.format, "yaml");
				assert.strictEqual(node.value, "a: 1");
			}
		}
	});

	it("restores the code value terminator", () => {
		const back = Mdast.fromMdastResult({
			type: "root",
			children: [{ type: "code", lang: null, meta: null, value: "body" }],
		});
		assertSuccess(back, Result.getOrThrow(back));
		if (Result.isSuccess(back)) {
			const code = back.success.children[0];
			assert.strictEqual(code?.type === "code" ? code.value : "", "body\n");
		}
	});

	it("drops foreign data fields at the boundary", () => {
		const back = Mdast.fromMdastResult({
			type: "root",
			children: [{ type: "paragraph", data: { custom: true }, children: [{ type: "text", value: "x" }] }],
		});
		assertSuccess(back, Result.getOrThrow(back));
		if (Result.isSuccess(back)) {
			assert.isFalse(Object.hasOwn(firstTypedChild(back.success), "data"));
		}
	});

	it("fails typed on an unknown node type, carrying the structured issue", () => {
		const back = Mdast.fromMdastResult({
			type: "root",
			children: [{ type: "widget", value: "?" }],
		});
		assertFailure(back, back.pipe(Result.flip, Result.getOrThrow));
		if (Result.isFailure(back)) {
			assert.instanceOf(back.failure, MdastDecodeError);
			assert.isDefined(back.failure.issue);
		}
	});

	it("fails typed on non-tree junk", () => {
		for (const junk of [42, "root", null, { type: 7 }]) {
			const result = Mdast.fromMdastResult(junk);
			assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
		}
	});

	it.effect("agrees with the Effect twin on both channels", () => Effect.gen(function* () {
		const good = { type: "root", children: [] };
		const bad = { type: "widget" };
		const sync = Mdast.fromMdastResult(good);
		assertSuccess(sync, Result.getOrThrow(sync));
		assertExitSuccess(yield* Effect.exit(Mdast.fromMdast(good)), sync.success);
		const effectFailure = yield* Effect.exit(Mdast.fromMdast(bad).pipe(Effect.flip));
		assertExitSuccess(effectFailure, Mdast.fromMdastResult(bad).pipe(Result.flip, Result.getOrThrow));
	}));
});
