import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { assert, describe, it } from "@effect/vitest";
import { CommandNeutralizer } from "../../effected/github-commands/index.ts";
import * as Effect from "effect/Effect";
import type { Block, RenderContext } from "../../effected/cli/index.ts";
import { Doc, Render, Status } from "../../effected/cli/index.ts";
import { ESC, composite } from "./helpers/hostileDoc.ts";
import { contextOf } from "./helpers/renderContext.ts";
import { LINE_BREAK, isCommand } from "./helpers/runnerCommands.ts";

const Json = S.fromJsonString(S.Unknown);

const log = (doc: ReadonlyArray<Block>, overrides: Partial<RenderContext> = {}) =>
	Effect.map(contextOf(overrides), (ctx) => Render.githubLog(doc, ctx));
const plain = (doc: ReadonlyArray<Block>, overrides: Partial<RenderContext> = {}) =>
	Effect.map(contextOf(overrides), (ctx) => Render.plain(doc, ctx));
const linesOf = (doc: ReadonlyArray<Block>, overrides: Partial<RenderContext> = {}) =>
	Effect.map(log(doc, overrides), (out) => out.split(LINE_BREAK));

describe("Render.githubLog: groups", () => {
	it.effect("a top-level collapsible is ::group:: title, its body, ::endgroup::", () =>
		Effect.gen(function* () {
			const out = yield* linesOf([
				Doc.paragraph("before"),
				Doc.collapsible("Stack", [Doc.paragraph("frame one"), Doc.paragraph("frame two")]),
				Doc.paragraph("after"),
			]);
			assert.deepStrictEqual(out, ["before", "::group::Stack", "frame one", "frame two", "::endgroup::", "after"]);
		}),
	);

	it.effect("anything but a collapsible is what plain renders", () =>
		Effect.gen(function* () {
			const doc = [
				Doc.heading(1, "Title"),
				Doc.paragraph(Doc.status(Status.core, "failure"), " ", Doc.path("a", "b"), " ", Doc.code("x")),
				Doc.table([{ header: "a" }, { header: "b" }], [["1", "2"]]),
				Doc.list([Doc.paragraph("i")]),
				Doc.tree({ label: "r", children: [{ label: "c" }] }),
				Doc.callout("note", [Doc.paragraph("n")]),
				Doc.codeBlock("code"),
				Doc.diff("a", "b"),
				Doc.counts({
					counters: [Doc.counter(Status.core, "success", { key: "a", label: "ok", n: 1 })],
					layout: "inline",
				}),
			];
			assert.strictEqual(yield* log(doc), yield* plain(doc));
		}),
	);

	it.effect(
		"a nested collapsible flattens: GitHub does not nest groups, so its title is a line inside the outer group",
		() =>
			Effect.gen(function* () {
				const out = yield* linesOf([
					Doc.collapsible("Outer", [
						Doc.paragraph("a"),
						Doc.collapsible("Inner", [Doc.paragraph("b"), Doc.collapsible("Deep", [Doc.paragraph("c")])]),
						Doc.paragraph("d"),
					]),
				]);
				assert.deepStrictEqual(out, ["::group::Outer", "a", "Inner", "  b", "  Deep", "    c", "d", "::endgroup::"]);
				assert.strictEqual(out.filter((line) => line === "::endgroup::").length, 1);
				assert.strictEqual(out.filter((line) => line.startsWith("::group::")).length, 1);
			}),
	);

	it.effect(
		"sibling collapsibles are separate groups, in a section too, and a section's title and blank lines are plain's",
		() =>
			Effect.gen(function* () {
				const out = yield* linesOf([
					Doc.collapsible("One", [Doc.paragraph("1")]),
					Doc.section("Results", [Doc.paragraph("p"), Doc.collapsible("Two", [Doc.paragraph("2")])]),
				]);
				assert.deepStrictEqual(out, [
					"::group::One",
					"1",
					"::endgroup::",
					"Results",
					"",
					"p",
					"",
					"::group::Two",
					"2",
					"::endgroup::",
				]);
			}),
	);

	it.effect(
		"a collapsible that is not at the start of a line is not a group: in a list or callout it is plain's title and indented body",
		() =>
			Effect.gen(function* () {
				const nested = Doc.collapsible("Inside", [Doc.paragraph("body")]);
				const out = yield* linesOf([Doc.list([nested]), Doc.callout("note", [nested])]);
				assert.deepStrictEqual(out, ["- Inside", "    body", "NOTE: Inside", "        body"]);
				assert.isFalse(out.some((line) => line.includes("::group::")));
			}),
	);

	it.effect("an empty body is an open and a close, and the title is escaped like a command message", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* linesOf([Doc.collapsible("T", [])]), ["::group::T", "::endgroup::"]);
			assert.deepStrictEqual(yield* linesOf([Doc.collapsible("100% ready\r\nnot a new line", [])]), [
				"::group::100%25 ready%0D%0Anot a new line",
				"::endgroup::",
			]);
			assert.deepStrictEqual(yield* linesOf([Doc.collapsible("", [Doc.paragraph("x")])]), [
				"::group::",
				"x",
				"::endgroup::",
			]);
		}),
	);
});

describe("Render.githubLog: document text cannot become a workflow command", () => {
	const hostileDoc = (): ReadonlyArray<Block> => [
		Doc.paragraph("::error::pwned"),
		Doc.paragraph("   ::warning file=a::pwned"),
		Doc.paragraph("##[error]pwned"),
		Doc.paragraph("##vso[task.setvariable variable=x]pwned"),
		Doc.heading(2, "::set-output name=x::y"),
		Doc.list([Doc.paragraph("::error::in a list")]),
		Doc.table([{ header: "::error::header" }], [["::error::cell"], ["##[group]cell"]]),
		Doc.codeBlock("::error::code\n  ::add-mask::secret"),
		Doc.tree({ label: "::error::root", children: [{ label: "::error::child" }] }),
		Doc.callout("warning", [Doc.paragraph("::error::in a callout")]),
		Doc.section("::error::section", [Doc.paragraph("::notice::child")]),
		Doc.collapsible("::error::title\n::error::second", [
			Doc.paragraph("::error::body"),
			Doc.codeBlock("::error::code"),
		]),
		Doc.counts({
			label: "::error::counts",
			counters: [Doc.counter(Status.core, "failure", { key: "f", label: "::error::n", n: 1 })],
			layout: "row",
		}),
		Doc.paragraph("one\n::error::after a newline"),
		Doc.paragraph("\u00A0::error::after a no-break space"),
		Doc.paragraph("\u3000##[error]after an ideographic space"),
		Doc.paragraph("\u2003::add-mask::after an em space"),
		Doc.paragraph("\u0085::error::after a next-line character"),
		Doc.counts({
			counters: [
				Doc.counter(Status.core, "failure", { key: "a", label: "\r::error::x", n: 1 }),
				Doc.counter(Status.core, "success", { key: "b", label: "ok\r\n::error::y", n: 2 }),
				Doc.counter(Status.core, "info", { key: "c", label: "\n##[error]z", n: 3 }),
			],
			layout: "inline",
		}),
		Doc.counts({
			counters: [Doc.counter(Status.core, "failure", { key: "a", label: "\r::error::x", n: 1 })],
			layout: "columns",
		}),
		Doc.counts({
			counters: [Doc.counter(Status.core, "failure", { key: "a", label: "\r::error::x", n: 1 })],
			layout: "row",
		}),
	];

	it.effect("no line but the renderer's own group commands starts with :: or ## (after its whitespace)", () =>
		Effect.gen(function* () {
			const out = yield* linesOf(hostileDoc());
			const commands = out.filter(isCommand);
			assert.deepStrictEqual(
				commands.filter((line) => !/^::(group::[^\r\n]*|endgroup::)$/.test(line)),
				[],
				"every command-looking line is a group or endgroup the renderer emitted",
			);
			assert.strictEqual(commands.filter((line) => line.startsWith("::group::")).length, 1);
			assert.strictEqual(commands.filter((line) => line === "::endgroup::").length, 1);
			assert.include(out.join("\n"), "pwned", "the text itself is kept");
		}),
	);

	it.effect("the group title holds no raw line break, so it cannot carry a second command", () =>
		Effect.gen(function* () {
			const out = yield* log([Doc.collapsible("a\n::error::b", [])]);
			assert.strictEqual(out, "::group::a%0A::error::b\n::endgroup::");
		}),
	);

	it.effect("the hostile composite has no escape and no command but its own", () =>
		Effect.gen(function* () {
			const out = yield* log(composite({ codeAndPath: true }));
			assert.notInclude(out, ESC);
			const commands = out.split(LINE_BREAK).filter(isCommand);
			assert.isTrue(
				commands.every((line) => /^::(group::|endgroup::)/.test(line)),
				Result.getOrThrow(S.encodeUnknownResult(Json)(commands)),
			);
		}),
	);

	it.effect("a wrapped continuation line that starts with :: is neutralized too", () =>
		Effect.gen(function* () {
			const out = yield* linesOf([Doc.paragraph("some words ::error::x then ::warning::y end")], { width: 12 });
			assert.isTrue(out.length > 2, "the paragraph wrapped");
			assert.deepStrictEqual(out.filter(isCommand), []);
			assert.isTrue(
				out.some((line) => line.includes("::error::x")),
				"the text is kept",
			);
		}),
	);

	it.effect(
		"a CR or CRLF in a counter label cannot start a line, in any Counts layout, and the counts stay one line",
		() =>
			Effect.gen(function* () {
				for (const label of ["\r::error::x", "a\r\n::error::x", "\n##[error]x", "x\r::error::y\r"]) {
					for (const layout of ["inline", "columns", "row"] as const) {
						const counts = Doc.counts({
							counters: [Doc.counter(Status.core, "failure", { key: "f", label, n: 1 })],
							layout,
						});
						const out = yield* linesOf([counts]);
						assert.deepStrictEqual(out.filter(isCommand), [], `${layout} ${Result.getOrThrow(S.encodeUnknownResult(Json)(label))}`);
						assert.strictEqual(out.length, 1, `${layout} ${Result.getOrThrow(S.encodeUnknownResult(Json)(label))}: one line`);
					}
				}
			}),
	);

	it("the neutralizer splits at a lone CR, LF and CRLF, as the runner does, and leaves the rest of each line alone", () => {
		const out = CommandNeutralizer.lines(
			"a\r::error::x\r\n##[group]y\n  ::add-mask::z\rplain text\r\n\u00A0::warning::w\n\u0085::error::n",
		);
		assert.strictEqual(out.length, 7);
		assert.deepStrictEqual(out.filter(isCommand), []);
		assert.deepStrictEqual(
			out.map((line) => line.replaceAll("\u200B", "")),
			["a", "::error::x", "##[group]y", "  ::add-mask::z", "plain text", "\u00A0::warning::w", "\u0085::error::n"],
		);
		assert.deepStrictEqual(CommandNeutralizer.lines("no command\nhere: ::"), ["no command", "here: ::"]);
	});

	it("the legacy ##[ form is a command anywhere in a line: every occurrence is broken, a bare ## is left alone", () => {
		const hostile = [
			"prefix ##[add-mask]secret",
			"a ##[error]b and ##[stop-commands]tok",
			"##[group]x",
			"x##[warning]y",
			"\u0085  ##[error]nel",
		];
		for (const line of hostile) {
			assert.isTrue(isCommand(line), `the oracle flags it first: ${JSON.stringify(line)}`);
			const out = CommandNeutralizer.lines(line);
			assert.deepStrictEqual(out.filter(isCommand), [], JSON.stringify(line));
			assert.strictEqual(out.join("").replaceAll("\u200B", ""), line, "only a zero-width space is added");
		}
		assert.strictEqual(CommandNeutralizer.lines("a ##[x] b ##[y]").join(""), "a ##\u200B[x] b ##\u200B[y]");
		for (const bare of ["## Heading", "a ## b", "##", "###", "## [link]", "#[x]", "# #[x]", "##x[y]"]) {
			assert.deepStrictEqual(CommandNeutralizer.lines(bare), [bare], JSON.stringify(bare));
		}
	});

	it("neutralizing is idempotent, so githubLog's own pass and the facade's never double up", () => {
		for (const text of ["::error::x\n a ##[b]\n##[c]", "plain", "::a::##[b]##[c]", "x\r\n::y"]) {
			const once = CommandNeutralizer.lines(text).join("\n");
			assert.strictEqual(CommandNeutralizer.lines(once).join("\n"), once, JSON.stringify(text));
		}
	});

	it("the detector itself: it finds a command behind every .NET whitespace and not behind U+200B or BOM", () => {
		for (const ws of ["", " ", "\t", "\u00A0", "\u0085", "\u2003", "\u3000", "  \u00A0 "]) {
			assert.isTrue(isCommand(`${ws}::error::x`), JSON.stringify(ws));
			assert.isTrue(isCommand(`${ws}##[group]x`), JSON.stringify(ws));
		}
		for (const prefix of ["\u200B", "\uFEFF", "x", "- "])
			assert.isFalse(isCommand(`${prefix}::error::x`), JSON.stringify(prefix));
		assert.isFalse(isCommand("a :: b"));
		assert.isFalse(isCommand(": :error"));
	});

	it("the detector's mutation controls: a mid-line ##[ is flagged, a bare ## and an ## [ are not", () => {
		assert.isTrue(isCommand("prefix ##[add-mask]secret"));
		assert.isTrue(isCommand("x##[error]y"));
		for (const quiet of ["## Heading", "a ## b", "## [x]", "#[x]", "##\u200B[x]"])
			assert.isFalse(isCommand(quiet), quiet);
	});

	it.effect("an ordinary line is left exactly as plain renders it, so only a command-looking one changes", () =>
		Effect.gen(function* () {
			const doc = [Doc.paragraph("a : b :: c ::"), Doc.paragraph("100% :: done"), Doc.paragraph("# not a command")];
			assert.strictEqual(yield* log(doc), yield* plain(doc));
		}),
	);
});

describe("Render.githubLog: annotations (okfit's trial)", () => {
	/** The documented wire grammar, read independently of the renderer. */
	const decode = (command: string) => {
		const match = /^::(error|warning|notice)(?: ([^:]*))?::([\s\S]*)$/.exec(command);
		if (match === null) return undefined;
		const data = (text: string): string => text.replace(/%0D/g, "\r").replace(/%0A/g, "\n").replace(/%25/g, "%");
		const property = (text: string): string => data(text.replace(/%3A/g, ":").replace(/%2C/g, ","));
		const properties: Record<string, string> = {};
		for (const pair of match[2] === undefined || match[2] === "" ? [] : match[2].split(",")) {
			const at = pair.indexOf("=");
			properties[pair.slice(0, at)] = property(pair.slice(at + 1));
		}
		return { level: match[1], properties, message: data(A.getUnsafe(match, 3)) };
	};
	const commands = (text: string): ReadonlyArray<string> => text.split(LINE_BREAK).filter(isCommand);

	it.effect("an annotation is exactly one command line, with its level, properties and message", () =>
		Effect.gen(function* () {
			const out = yield* log([
				Doc.annotation(
					{ level: "error", file: "src/a.ts", line: 3, col: 2, endLine: 4, endColumn: 9, title: "Type error" },
					"boom",
				),
			]);
			assert.lengthOf(out.split(LINE_BREAK), 1);
			assert.deepStrictEqual(decode(out), {
				level: "error",
				properties: { title: "Type error", file: "src/a.ts", line: "3", endLine: "4", col: "2", endColumn: "9" },
				message: "boom",
			});
		}),
	);

	it.effect("a hostile message, title or file still makes exactly one command, carrying the text intact", () =>
		Effect.gen(function* () {
			const message = "first\r\nsecond\n::error::injected ##[warning]x %0A";
			const title = "t, x::y\nz";
			const out = yield* log([Doc.annotation({ level: "warning", file: "a,b:c.ts", title }, message)]);
			assert.lengthOf(commands(out), 1, out);
			assert.lengthOf(out.split(LINE_BREAK), 1, "one line");
			const decoded = decode(out);
			assert.strictEqual(decoded?.message, message);
			assert.strictEqual(decoded?.properties["title"], title);
			assert.strictEqual(decoded?.properties["file"], "a,b:c.ts");
		}),
	);

	it.effect("the kit's own command is never neutralized, while the text around it is", () =>
		Effect.gen(function* () {
			const out = yield* log([Doc.paragraph("::warning::from text"), Doc.annotation({ level: "notice" }, "real")]);
			assert.deepStrictEqual(commands(out), ["::notice::real"]);
		}),
	);

	it.effect("an annotation inside a group or a top-level section is a command; inside a list it is nothing", () =>
		Effect.gen(function* () {
			const annotation = Doc.annotation({ level: "error" }, "x");
			const grouped = (yield* log([Doc.collapsible("G", [Doc.paragraph("a"), annotation])])).split("\n");
			assert.deepStrictEqual(grouped, ["::group::G", "a", "::error::x", "::endgroup::"]);
			assert.include((yield* log([Doc.section("S", [annotation])])).split("\n"), "::error::x");
			assert.deepStrictEqual(commands(yield* log([Doc.list([Doc.paragraph("a"), annotation])])), []);
		}),
	);
});

describe("Render.githubLog: always neutralizes (G6)", () => {
	it.effect("text that would be a command is neutralized whatever neutralizeWorkflowCommands says", () =>
		Effect.gen(function* () {
			for (const neutralizeWorkflowCommands of [true, false, undefined]) {
				const out = yield* log([Doc.paragraph("::error::injected")], { neutralizeWorkflowCommands });
				assert.isFalse(isCommand(out), String(neutralizeWorkflowCommands));
			}
		}),
	);
});

describe("Render.githubLog: an annotation below a group's direct children", () => {
	it.effect("is dropped, as plain drops it, and documented so", () =>
		Effect.gen(function* () {
			const nested = Doc.collapsible("G", [Doc.section("S", [Doc.annotation({ level: "error" }, "x")])]);
			const out = yield* log([nested]);
			assert.deepStrictEqual(out.split(LINE_BREAK).filter(isCommand), ["::group::G", "::endgroup::"]);
		}),
	);
});
