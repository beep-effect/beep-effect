import { assert, describe, it } from "@effect/vitest";
import type { Block, Counter, Inline } from "../../effected/cli/index.ts";
import { Doc, Status, Token } from "../../effected/cli/index.ts";

const deepFrozen = (value: unknown): boolean => {
	if (typeof value !== "object" || value === null) return true;
	if (!Object.isFrozen(value)) return false;
	return Object.values(value).every(deepFrozen);
};

const counter = (key: string, n: number, name: "success" | "failure" | "skip", showZero?: boolean): Counter => ({
	key,
	label: key,
	n,
	status: { name, def: Status.core.resolve(name) },
	...(showZero === undefined ? {} : { showZero }),
});

describe("Doc inline constructors", () => {
	it("text carries the value, and a token only when given", () => {
		const plain = Doc.text("hi");
		assert.deepStrictEqual(plain, { _tag: "Text", value: "hi" });
		assert.notProperty(plain, "token", "an absent token is an absent key, not undefined");
		assert.deepStrictEqual(Doc.text("hi", "failure"), { _tag: "Text", value: "hi", token: "failure" });
		const style = Token.style({ bold: true });
		assert.deepStrictEqual(Doc.text("hi", style), { _tag: "Text", value: "hi", token: style });
		assert.isTrue(Object.isFrozen(plain));
	});

	it("code and path carry their values", () => {
		assert.deepStrictEqual(Doc.code("x"), { _tag: "Code", value: "x" });
		assert.deepStrictEqual(Doc.path("a", "b", "c"), { _tag: "Path", segments: ["a", "b", "c"] });
		assert.isTrue(deepFrozen(Doc.path("a", "b")));
	});

	it("link takes a url or a file target and labels itself with the target when no label is given", () => {
		assert.deepStrictEqual(Doc.link({ url: "https://x.test" }), {
			_tag: "Link",
			target: { url: "https://x.test" },
			label: [{ _tag: "Text", value: "https://x.test" }],
		});
		assert.deepStrictEqual(Doc.link({ file: "src/a.ts", line: 3, col: 5 }, "a.ts"), {
			_tag: "Link",
			target: { file: "src/a.ts", line: 3, col: 5 },
			label: [{ _tag: "Text", value: "a.ts" }],
		});
		assert.deepStrictEqual(Doc.link({ file: "src/a.ts" }).label, [{ _tag: "Text", value: "src/a.ts" }]);
		assert.isTrue(deepFrozen(Doc.link({ file: "src/a.ts", line: 3 }, [Doc.code("a"), " there"])));
	});

	it("status stores the resolved definition, not the vocabulary", () => {
		const mark = Doc.status(Status.core, "failure");
		assert.deepStrictEqual(mark, {
			_tag: "StatusMark",
			name: "failure",
			def: { glyph: "✗", ascii: "[FAIL]", token: "failure", rank: 90 },
		});
		assert.isTrue(deepFrozen(mark));
	});

	it("status resolves an extended vocabulary's own names", () => {
		const vocab = Status.extend({ blocked: { glyph: "⛔", ascii: "[BLOCKED]", token: "error", rank: 80 } });
		assert.deepStrictEqual(Doc.status(vocab, "blocked"), {
			_tag: "StatusMark",
			name: "blocked",
			def: { glyph: "⛔", ascii: "[BLOCKED]", token: "error", rank: 80 },
		});
	});

	it("status rejects a misspelt name at compile time", () => {
		const bad = () =>
			// @ts-expect-error "timeot" is not a status name in the core vocabulary
			Doc.status(Status.core, "timeot");
		assert.isFunction(bad);
	});
});

describe("Doc string normalisation", () => {
	it("a string, an Inline and a mixed array all become a frozen array of Inline", () => {
		const code = Doc.code("c");
		assert.deepStrictEqual(Doc.heading(1, "Title").content, [{ _tag: "Text", value: "Title" }]);
		assert.deepStrictEqual(Doc.heading(2, code).content, [code]);
		assert.deepStrictEqual(Doc.heading(3, ["a ", code, " b"]).content, [
			{ _tag: "Text", value: "a " },
			code,
			{ _tag: "Text", value: " b" },
		]);
		assert.isTrue(Object.isFrozen(Doc.heading(1, "x").content));
	});

	it("paragraph takes its content as rest arguments of any accepted form", () => {
		const p = Doc.paragraph("a ", Doc.code("b"), ["c", Doc.path("d")]);
		assert.deepStrictEqual(p, {
			_tag: "Paragraph",
			content: [
				{ _tag: "Text", value: "a " },
				{ _tag: "Code", value: "b" },
				{ _tag: "Text", value: "c" },
				{ _tag: "Path", segments: ["d"] },
			],
		});
		assert.deepStrictEqual(Doc.paragraph(), { _tag: "Paragraph", content: [] });
	});

	it("copies its input, so editing an array afterwards cannot change a node", () => {
		const parts: Array<string | Inline> = ["a"];
		const node = Doc.heading(1, parts);
		parts.push("b");
		assert.strictEqual(node.content.length, 1);
		const items: Array<Block> = [Doc.paragraph("x")];
		const list = Doc.list(items);
		items.push(Doc.paragraph("y"));
		assert.strictEqual(list.items.length, 1);
	});
});

describe("Doc block constructors", () => {
	it("heading, paragraph and codeBlock", () => {
		assert.deepStrictEqual(Doc.heading(2, "H"), { _tag: "Heading", level: 2, content: [{ _tag: "Text", value: "H" }] });
		assert.deepStrictEqual(Doc.codeBlock("let x"), { _tag: "CodeBlock", text: "let x" });
		assert.deepStrictEqual(Doc.codeBlock("let x", "ts"), { _tag: "CodeBlock", lang: "ts", text: "let x" });
		assert.notProperty(Doc.codeBlock("let x"), "lang");
	});

	it("list carries items, and cap and overflow only when given", () => {
		const bare = Doc.list([Doc.paragraph("a")]);
		assert.deepStrictEqual(bare, {
			_tag: "List",
			items: [{ _tag: "Paragraph", content: [{ _tag: "Text", value: "a" }] }],
		});
		assert.notProperty(bare, "cap");
		assert.notProperty(bare, "overflow");
		const capped = Doc.list([Doc.paragraph("a")], { cap: 1, overflow: (hidden) => `… ${hidden} more` });
		assert.strictEqual(capped.cap, 1);
		assert.isTrue(Object.isFrozen(capped));
	});

	it("an overflow function returns normalised Inline, and a frozen node may hold a function", () => {
		const list = Doc.list([], { cap: 0, overflow: (hidden) => ["… ", Doc.code(String(hidden))] });
		assert.deepStrictEqual(list.overflow?.(12), [
			{ _tag: "Text", value: "… " },
			{ _tag: "Code", value: "12" },
		]);
		assert.isTrue(Object.isFrozen(list));
	});

	it("table normalises headers and every cell, and keeps align, cap and overflow", () => {
		const t = Doc.table(
			[{ header: "Name" }, { header: Doc.code("n"), align: "right" }],
			[
				["a", [Doc.code("1"), " x"]],
				[Doc.path("p"), "c"],
			],
			{ cap: 2, overflow: () => "more" },
		);
		assert.deepStrictEqual(t.columns, [
			{ header: [{ _tag: "Text", value: "Name" }] },
			{ header: [{ _tag: "Code", value: "n" }], align: "right" },
		]);
		assert.notProperty(t.columns[0], "align");
		assert.deepStrictEqual(t.rows[0], [
			[{ _tag: "Text", value: "a" }],
			[
				{ _tag: "Code", value: "1" },
				{ _tag: "Text", value: " x" },
			],
		]);
		assert.strictEqual(t.cap, 2);
		assert.deepStrictEqual(t.overflow?.(1), [{ _tag: "Text", value: "more" }]);
		assert.isTrue(Object.isFrozen(t) && Object.isFrozen(t.columns) && Object.isFrozen(t.rows[0]));
	});

	it("tree normalises every label and defaults children to empty", () => {
		const t = Doc.tree({
			label: "root",
			children: [{ label: Doc.code("a") }, { label: "b", children: [{ label: "c" }] }],
		});
		assert.deepStrictEqual(t, {
			_tag: "Tree",
			root: {
				label: [{ _tag: "Text", value: "root" }],
				children: [
					{ label: [{ _tag: "Code", value: "a" }], children: [] },
					{
						label: [{ _tag: "Text", value: "b" }],
						children: [{ label: [{ _tag: "Text", value: "c" }], children: [] }],
					},
				],
			},
		});
		assert.isTrue(deepFrozen(t));
	});

	it("collapsible, callout, diff and section", () => {
		const body = [Doc.paragraph("b")];
		assert.deepStrictEqual(Doc.collapsible("T", body), {
			_tag: "Collapsible",
			title: [{ _tag: "Text", value: "T" }],
			body: [{ _tag: "Paragraph", content: [{ _tag: "Text", value: "b" }] }],
		});
		const open = Doc.collapsible("T", body, { open: true });
		assert.strictEqual(open.open, true);
		assert.deepStrictEqual(Doc.callout("warning", body), {
			_tag: "Callout",
			kind: "warning",
			body: [{ _tag: "Paragraph", content: [{ _tag: "Text", value: "b" }] }],
		});
		assert.deepStrictEqual(Doc.diff("a", "b"), { _tag: "Diff", expected: "a", received: "b" });
		assert.deepStrictEqual(Doc.diff("a", "b", { cap: 5 }), { _tag: "Diff", expected: "a", received: "b", cap: 5 });
		assert.deepStrictEqual(Doc.section(undefined, body), {
			_tag: "Section",
			children: [{ _tag: "Paragraph", content: [{ _tag: "Text", value: "b" }] }],
		});
		const titled = Doc.section("S", body);
		assert.deepStrictEqual(titled.title, [{ _tag: "Text", value: "S" }]);
		for (const node of [Doc.collapsible("T", body), Doc.callout("note", body), Doc.section("S", body)]) {
			assert.isTrue(deepFrozen(node));
		}
	});
});

describe("Doc.counts", () => {
	const counters = [counter("passed", 7, "success"), counter("failed", 2, "failure"), counter("skipped", 0, "skip")];

	it("builds a frozen node carrying its counters, layout and optional parts", () => {
		const node = Doc.counts({ counters, layout: "row" });
		assert.deepStrictEqual(node, { _tag: "Counts", counters, layout: "row" });
		for (const key of ["label", "total", "qualifier", "durationMs"]) assert.notProperty(node, key);
		assert.isTrue(Object.isFrozen(node) && Object.isFrozen(node.counters));
		const full = Doc.counts({ label: "Tests", counters, qualifier: "(1 flaky)", durationMs: 1200, layout: "inline" });
		assert.deepStrictEqual(full, {
			_tag: "Counts",
			label: [{ _tag: "Text", value: "Tests" }],
			counters,
			qualifier: [{ _tag: "Text", value: "(1 flaky)" }],
			durationMs: 1200,
			layout: "inline",
		});
	});

	it("the total is the sum of every counter unless the caller supplies a rule", () => {
		const byDefault = Doc.counts({ counters, layout: "inline" });
		assert.strictEqual(Doc.total(byDefault), 9);
		const timedOut = [...counters, counter("timedOut", 3, "failure")];
		assert.strictEqual(Doc.total(Doc.counts({ counters: timedOut, layout: "inline" })), 12);
		const excluding = Doc.counts({
			counters: timedOut,
			layout: "inline",
			total: (all) => all.filter((c) => c.key !== "skipped").reduce((sum, c) => sum + c.n, 0),
		});
		assert.strictEqual(Doc.total(excluding), 12);
		const passedOnly = Doc.counts({
			counters: timedOut,
			layout: "inline",
			total: (all) => all.filter((c) => c.key === "passed").reduce((sum, c) => sum + c.n, 0),
		});
		assert.strictEqual(Doc.total(passedOnly), 7);
	});

	it("a zero counter is hidden unless it asks to be shown", () => {
		const node = Doc.counts({
			counters: [
				counter("a", 0, "success"),
				counter("b", 0, "failure", true),
				counter("c", 4, "skip"),
				counter("d", 0, "skip", false),
			],
			layout: "columns",
		});
		assert.deepStrictEqual(
			Doc.visibleCounters(node).map((c) => c.key),
			["b", "c"],
		);
		assert.strictEqual(Doc.total(node), 4, "hiding never changes the total");
	});

	it("stores a frozen copy of a definition taken from the vocabulary's live entry", () => {
		const live = Status.core.def("failure");
		const node = Doc.counts({
			counters: [{ key: "f", label: "failed", n: 1, status: { name: "failure", def: live } }],
			layout: "inline",
		});
		assert.isTrue(deepFrozen(node));
		assert.notStrictEqual(node.counters[0]?.status.def, live, "the node does not share the vocabulary's entry");
		assert.isFalse(Object.isFrozen(live), "the live entry is untouched");
		const definition = node.counters[0]?.status.def;
		assert.isDefined(definition);
		const mutable: { rank: number } = definition;
		assert.throws(() => {
			mutable.rank = 0;
		}, TypeError);
		assert.strictEqual(Status.core.def("failure").rank, 90);
	});

	it("copies the counters it is given", () => {
		const input = [counter("a", 1, "success")];
		const node = Doc.counts({ counters: input, layout: "inline" });
		input.push(counter("b", 1, "failure"));
		assert.strictEqual(Doc.total(node), 1);
	});
});

describe("Doc.counter", () => {
	it("resolves the status definition and carries the key, label and count", () => {
		const c = Doc.counter(Status.core, "failure", { key: "failed", label: "failed", n: 2 });
		assert.deepStrictEqual(c, {
			key: "failed",
			label: "failed",
			n: 2,
			status: { name: "failure", def: { glyph: "✗", ascii: "[FAIL]", token: "failure", rank: 90 } },
		});
		assert.notProperty(c, "showZero");
		assert.isTrue(deepFrozen(c));
	});

	it("carries showZero when given, and resolves an extended vocabulary's names", () => {
		const vocab = Status.extend({ blocked: { glyph: "⛔", ascii: "[BLOCKED]", token: "error", rank: 80 } });
		const c = Doc.counter(vocab, "blocked", { key: "b", label: "blocked", n: 0, showZero: true });
		assert.strictEqual(c.showZero, true);
		assert.strictEqual(c.status.def.glyph, "⛔");
	});

	it("feeds Doc.counts directly", () => {
		const node = Doc.counts({
			counters: [
				Doc.counter(Status.core, "success", { key: "p", label: "passed", n: 3 }),
				Doc.counter(Status.core, "failure", { key: "f", label: "failed", n: 1 }),
			],
			layout: "inline",
		});
		assert.strictEqual(Doc.total(node), 4);
	});

	it("rejects a misspelt status name at compile time", () => {
		const bad = () =>
			// @ts-expect-error "timeot" is not a status name in the core vocabulary
			Doc.counter(Status.core, "timeot", { key: "k", label: "l", n: 1 });
		assert.isFunction(bad);
	});
});

describe("Doc: okfit's trial additions", () => {
	it("link takes a suffix option, kept only when given, and stays frozen", () => {
		const off = Doc.link({ file: "/a.md", line: 1 }, "x", { suffix: false });
		assert.strictEqual(off._tag === "Link" ? off.suffix : undefined, false);
		assert.notProperty(Doc.link({ url: "https://x.test" }, "x"), "suffix");
		assert.isTrue(deepFrozen(off));
	});

	it("a link with no target is its label, never a link", () => {
		assert.deepStrictEqual(Doc.link(undefined, "(bundle)"), { _tag: "Text", value: "(bundle)" });
		const code = Doc.code("x");
		assert.strictEqual(Doc.link(undefined, code), code);
	});

	it("verbatim keeps its text and an indent only when given, frozen", () => {
		const block = Doc.verbatim("a\n  b", { indent: 2 });
		assert.deepStrictEqual(block, { _tag: "Verbatim", text: "a\n  b", indent: 2 });
		assert.notProperty(Doc.verbatim("a"), "indent");
		assert.isTrue(deepFrozen(block));
	});

	it("counts carry share and paint only when given", () => {
		const given = Doc.counts({ layout: "inline", counters: [counter("a", 1, "success")], share: false, paint: "none" });
		assert.strictEqual(given.share, false);
		assert.strictEqual(given.paint, "none");
		const bare = Doc.counts({ layout: "inline", counters: [] });
		assert.notProperty(bare, "share");
		assert.notProperty(bare, "paint");
	});

	it("annotation carries its level, its position and title when given, and its message, frozen", () => {
		const block = Doc.annotation({ level: "error", file: "a.ts", line: 3, col: 2, title: "T" }, "boom");
		assert.deepStrictEqual(block, {
			_tag: "Annotation",
			level: "error",
			file: "a.ts",
			line: 3,
			col: 2,
			title: "T",
			message: "boom",
		});
		assert.deepStrictEqual(Doc.annotation({ level: "notice" }, "m"), {
			_tag: "Annotation",
			level: "notice",
			message: "m",
		});
		assert.isTrue(deepFrozen(block));
	});
});

describe("Doc: the reporter blocks are frozen plain data", () => {
	it("strong, em, file, lines, line, countsTable, diffText, compact lists, pipe tables and counts suffix", () => {
		const nodes: ReadonlyArray<Inline | Block> = [
			Doc.strong("a", Doc.code("b")),
			Doc.em("x"),
			Doc.file("/a.ts"),
			Doc.lines(["one", ["two", Doc.code("x")]]),
			Doc.line("a", { truncate: true }),
			Doc.countsTable([{ label: "web", counters: [counter("a", 1, "success")] }], { totalRow: "All" }),
			Doc.diffText("-a\n+b", { cap: 3 }),
			Doc.list([Doc.paragraph("a")], { compact: true }),
			Doc.table([{ header: "h" }], [["c"]], { style: "pipe" }),
			Doc.counts({ layout: "inline", counters: [], suffix: "across 3 files" }),
		];
		for (const node of nodes) assert.isTrue(deepFrozen(node), JSON.stringify(node));
		assert.deepStrictEqual(Doc.strong("a"), { _tag: "Strong", content: [{ _tag: "Text", value: "a" }] });
		assert.deepStrictEqual(Doc.em("a"), { _tag: "Emphasis", content: [{ _tag: "Text", value: "a" }] });
		assert.deepStrictEqual(Doc.file("/a.ts"), { _tag: "File", path: "/a.ts" });
		assert.notProperty(Doc.list([]), "compact");
		assert.notProperty(Doc.table([], []), "style");
		assert.notProperty(Doc.line("a"), "truncate");
	});
});
