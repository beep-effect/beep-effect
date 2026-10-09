import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import type { Block, CliLinksShape, RenderContext } from "../../effected/cli/index.ts";
import { Doc, Glyphs, Render, Status } from "../../effected/cli/index.ts";
import { displayWidth, stripAnsi } from "../../effected/cli/internal/displayWidth.ts";
import { composite } from "./helpers/hostileDoc.ts";
import { contextOf, decodeTokens, link, linksOf, sgrProblems, tokenPaint } from "./helpers/renderContext.ts";
import { LINE_BREAK, isCommand } from "./helpers/runnerCommands.ts";

const Json = S.fromJsonString(S.Unknown);

const ansi = (doc: ReadonlyArray<Block>, overrides: Partial<RenderContext> = {}) =>
	Effect.map(contextOf(overrides), (ctx) => Render.ansi(doc, ctx));
const plain = (doc: ReadonlyArray<Block>, overrides: Partial<RenderContext> = {}) =>
	Effect.map(contextOf(overrides), (ctx) => Render.plain(doc, ctx));

/** A context whose paint marks tokens, so a test decodes them; hyperlinks are off unless a test turns them on. */
const TOKENS = { paint: tokenPaint, link: (_target: unknown, label: string) => label } as const;
const OFF = {
	color: "none",
	paint: (_token: unknown, text: string) => text,
	link: (_target: unknown, label: string) => label,
} as const;

const tokensOf = (doc: ReadonlyArray<Block>, overrides: Partial<RenderContext> = {}) =>
	Effect.map(ansi(doc, { ...TOKENS, ...overrides }), (out) => out.split("\n").map(decodeTokens));

// biome-ignore lint/suspicious/noControlCharactersInRegex: asserting their absence is the point
const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/;
const BOX = /[─│┌┐└┘├┤┬┴┼═║╔╗╚╝]/;

describe("Render.ansi at colour none is Render.plain (the main property)", () => {
	for (const glyphs of [Glyphs.unicode, Glyphs.ascii]) {
		for (const width of [14, 24, 40, 80, 200]) {
			it.effect(`a hostile composite document, ${glyphs.kind} glyphs, width ${width}: identical to plain`, () =>
				Effect.gen(function* () {
					const doc = composite({ codeAndPath: false });
					const overrides = { ...OFF, glyphs, width };
					const a = yield* ansi(doc, overrides);
					const p = yield* plain(doc, overrides);
					assert.strictEqual(a, p);
					assert.isAbove(a.length, 0);
				}),
			);
		}
	}

	it.effect("with Code and Path the only differences are the code markers and the path separator", () =>
		Effect.gen(function* () {
			const doc = composite({ codeAndPath: true });
			const overrides = { ...OFF, width: 400 };
			const a = yield* ansi(doc, overrides);
			const p = yield* plain(doc, overrides);
			assert.notStrictEqual(a, p, "the two really do differ there");
			assert.strictEqual(a.replaceAll(" › ", " > "), p.replaceAll("`", ""));
		}),
	);

	it.effect("the property is not vacuous: with colour on, ansi differs from plain and carries SGR", () =>
		Effect.gen(function* () {
			const doc = composite({ codeAndPath: false });
			const painted = yield* ansi(doc, { width: 80 });
			assert.include(painted, "\u001B[");
			assert.notStrictEqual(painted, yield* plain(doc, { width: 80 }));
		}),
	);

	it.effect("ansi does not force the agent path separator, and follows the audience it is given", () =>
		Effect.gen(function* () {
			const doc = [Doc.paragraph(Doc.path("a", "b"))];
			assert.strictEqual(yield* ansi(doc, OFF), "a › b");
			assert.strictEqual(yield* ansi(doc, { ...OFF, audience: "ci" }), "a › b");
			assert.strictEqual(yield* ansi(doc, { ...OFF, glyphs: Glyphs.ascii }), "a > b");
		}),
	);
});

describe("Render.ansi: which token paints what (decoded, never raw bytes)", () => {
	it.effect("a heading is emphasis; inline Code is accent with no backticks; a status is its token", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* tokensOf([Doc.heading(1, "Title")]), [[["emphasis", "Title"]]]);
			assert.deepStrictEqual(yield* tokensOf([Doc.paragraph("run ", Doc.code("pnpm test"))]), [
				[
					[undefined, "run "],
					["accent", "pnpm test"],
				],
			]);
			assert.deepStrictEqual(
				yield* tokensOf([Doc.paragraph(Doc.status(Status.core, "failure"), " ", Doc.text("x", "info"))]),
				[
					[
						["failure", "✗"],
						[undefined, " "],
						["info", "x"],
					],
				],
			);
			const heading = yield* tokensOf([Doc.heading(2, [Doc.text("a "), Doc.text("b", "warning")])]);
			assert.deepStrictEqual(heading, [
				[
					["emphasis", "a "],
					["warning", "b"],
				],
			]);
		}),
	);

	it.effect("tree lines are muted, and a tree's labels keep their own style", () =>
		Effect.gen(function* () {
			const out = yield* tokensOf([
				Doc.tree({ label: "root", children: [{ label: "a", children: [{ label: "a1" }] }, { label: "b" }] }),
			]);
			assert.deepStrictEqual(out, [
				[[undefined, "root"]],
				[
					["muted", "├─ "],
					[undefined, "a"],
				],
				[
					["muted", "│  └─ "],
					[undefined, "a1"],
				],
				[
					["muted", "└─ "],
					[undefined, "b"],
				],
			]);
		}),
	);

	it.effect(
		"an overflow row is muted, whether the default or a function's unstyled text, and keeps a token it sets",
		() =>
			Effect.gen(function* () {
				const items = ["a", "b", "c"].map((t) => Doc.paragraph(t));
				assert.deepStrictEqual((yield* tokensOf([Doc.list(items, { cap: 1 })]))[1], [["muted", "… 2 more"]]);
				assert.deepStrictEqual(
					(yield* tokensOf([Doc.list(items, { cap: 1, overflow: (hidden) => `${hidden} hidden` })]))[1],
					[["muted", "2 hidden"]],
				);
				assert.deepStrictEqual(
					(yield* tokensOf([
						Doc.list(items, { cap: 1, overflow: () => [Doc.text("see ", "info"), Doc.code("tool")] }),
					]))[1],
					[
						["info", "see "],
						["accent", "tool"],
					],
				);
			}),
	);

	it.effect("a diff paints its '-' lines failure and its '+' lines success", () =>
		Effect.gen(function* () {
			const out = yield* tokensOf([Doc.diff("a\nb", "c")]);
			assert.deepStrictEqual(out, [[["failure", "- a"]], [["failure", "- b"]], [["success", "+ c"]]]);
		}),
	);

	it.effect("a callout's label takes the kind's token", () =>
		Effect.gen(function* () {
			const expected = {
				note: "info",
				tip: "success",
				important: "accent",
				warning: "warning",
				caution: "error",
			} as const;
			for (const [kind, token] of Object.entries(expected)) {
				const [line] = yield* tokensOf([Doc.callout(kind as keyof typeof expected, [Doc.paragraph("text")])]);
				assert.deepStrictEqual(line, [
					[token, `${kind.toUpperCase()}:`],
					[undefined, " text"],
				]);
			}
		}),
	);

	it.effect(
		"a table header and a section or collapsible title are emphasis, and the rule is muted; alignment is plain",
		() =>
			Effect.gen(function* () {
				const out = yield* tokensOf([
					Doc.table([{ header: "Name" }, { header: "N", align: "right" }], [["alpha", "1"]]),
					Doc.section("Sec", []),
					Doc.collapsible("Stack", []),
				]);
				assert.deepStrictEqual(out[0], [
					["emphasis", "Name"],
					[undefined, "   "],
					["emphasis", "N"],
				]);
				assert.deepStrictEqual(out[1], [
					["muted", "-----"],
					[undefined, "  "],
					["muted", "-"],
				]);
				assert.deepStrictEqual(out[3], [["emphasis", "Sec"]]);
				assert.deepStrictEqual(out[4], [["emphasis", "Stack"]]);
			}),
	);

	it.effect("Counts paint each counter with its status token, and the qualifier and duration muted", () =>
		Effect.gen(function* () {
			const out = yield* tokensOf([
				Doc.counts({
					counters: [
						Doc.counter(Status.core, "success", { key: "a", label: "passed", n: 3 }),
						Doc.counter(Status.core, "failure", { key: "b", label: "failed", n: 1 }),
					],
					qualifier: "(1 flaky)",
					durationMs: 1200,
					layout: "inline",
				}),
			]);
			assert.deepStrictEqual(out[0], [
				["success", "3/4 passed"],
				[undefined, ", "],
				["failure", "1 failed"],
				[undefined, " "],
				["muted", "(1 flaky)"],
				[undefined, " "],
				["muted", "(1.2s)"],
			]);
		}),
	);
});

describe("Render.ansi: links go through ctx.link, and only it makes OSC 8", () => {
	it.effect("with hyperlinks on, one link wraps the whole painted label and there is no '(target)' suffix", () =>
		Effect.gen(function* () {
			const out = yield* ansi(
				[Doc.paragraph("see ", Doc.link({ url: "https://example.test/x" }, [Doc.text("docs", "info"), Doc.code("!")]))],
				{
					paint: tokenPaint,
					link,
				},
			);
			const links = linksOf(out);
			assert.strictEqual(links.pairs, 1);
			assert.isTrue(links.balanced);
			assert.strictEqual(links.wrapped, "docs!");
			assert.notInclude(stripAnsi(out), "(https");
		}),
	);

	it.effect("with hyperlinks off the target follows the label, muted, unless the label is the target", () =>
		Effect.gen(function* () {
			const url = "https://example.test/x";
			const out = yield* tokensOf(
				[
					Doc.paragraph(Doc.link({ url }, "docs")),
					Doc.paragraph(Doc.link({ url })),
					Doc.paragraph(Doc.link({ file: "/repo/a.ts", line: 3, col: 4 }, "a.ts")),
				],
				{ displayPath: (p: string) => p.replace("/repo/", "") },
			);
			assert.deepStrictEqual(out[0], [
				[undefined, "docs"],
				["muted", ` (${url})`],
			]);
			assert.deepStrictEqual(out[1], [[undefined, url]]);
			assert.deepStrictEqual(out[2], [
				[undefined, "a.ts"],
				["muted", " (a.ts:3:4)"],
			]);
		}),
	);

	it.effect("OSC 8 never appears unless ctx.link produced it, whatever the text says", () =>
		Effect.gen(function* () {
			const out = yield* ansi(composite({ codeAndPath: true }), { ...TOKENS, width: 60 });
			assert.notInclude(out, "]8;");
			const on = yield* ansi(composite({ codeAndPath: true }), { paint: tokenPaint, link, width: 60 });
			assert.include(on, "]8;;https://x.test/");
			assert.notInclude(on, "evil.test", "a link in the text is text, not a hyperlink");
		}),
	);
});

describe("Render.ansi: layout under colour (paint after cut)", () => {
	it.effect(
		"SGR stays balanced, hyperlinks intact and no control character smuggled, with the real theme and hostile text",
		() =>
			Effect.gen(function* () {
				for (const width of [16, 24, 40, 100]) {
					const out = yield* ansi(composite({ codeAndPath: true }), { link, width });
					assert.deepStrictEqual(sgrProblems(out), [], `width ${width}: SGR balanced`);
					assert.isTrue(linksOf(out).balanced, `width ${width}: hyperlinks balanced`);
					// Nothing but the renderer's own SGR and OSC 8 is left: no ESC, BEL or other control character.
					assert.notMatch(stripAnsi(out), CONTROL, `width ${width}: no smuggled control character`);
				}
			}),
	);

	it.effect("the blocks the width governs (paragraphs, tables, lists) fit it at every width, painted", () =>
		Effect.gen(function* () {
			const governed = composite({ codeAndPath: true }).filter((block) =>
				["Paragraph", "Table", "List"].includes(block._tag),
			);
			assert.isAbove(governed.length, 2);
			for (const width of [16, 24, 40, 100]) {
				const out = yield* ansi(governed, { link, width });
				for (const line of out.split("\n"))
					assert.isAtMost(displayWidth(line), width, `width ${width}: "${stripAnsi(line)}"`);
			}
		}),
	);

	it.effect("a painted table cell that is cut keeps its colour, ends in the ellipsis, and the row fits", () =>
		Effect.gen(function* () {
			const doc = [
				Doc.table(
					[{ header: "id" }, { header: "message" }],
					[["1", [Doc.text("a very long message that goes on", "failure")]]],
				),
			];
			const out = yield* ansi(doc, { ...TOKENS, width: 20 });
			const row = out.split("\n")[2] ?? "";
			assert.isAtMost(displayWidth(row), 20);
			const cut = decodeTokens(row).find(([token]) => token === "failure");
			assert.isDefined(cut);
			assert.match(cut?.[1] ?? "", /…$/);
		}),
	);

	it.effect("a column that is empty in every row keeps its separators, and matches plain", () =>
		Effect.gen(function* () {
			const docs = [
				Doc.table(
					[{ header: [] }, { header: "b" }],
					[
						["", "1"],
						["", "22"],
					],
				),
				Doc.table(
					[{ header: "a" }, { header: [] }, { header: "c" }],
					[
						["1", "", "3"],
						["2", "", "4"],
					],
				),
				Doc.table([{ header: [] }, { header: "x y z", align: "right" }], [["", "1"]]),
			];
			const expected = [
				["  b", "  --", "  1", "  22"],
				["a    c", "-    -", "1    3", "2    4"],
				["  x y z", "  -----", "      1"],
			];
			for (const [index, doc] of docs.entries()) {
				const a = yield* ansi([doc], OFF);
				assert.deepStrictEqual(a.split("\n"), expected[index]);
				assert.strictEqual(a, yield* plain([doc], OFF));
			}
		}),
	);

	it.effect("a cut linked table cell keeps exactly one balanced hyperlink around what is left", () =>
		Effect.gen(function* () {
			const doc = [
				Doc.table(
					[{ header: "id" }, { header: "where" }],
					[
						[
							"1",
							[
								Doc.link({ url: "https://example.test/x" }, [
									Doc.text("a long linked label that will be cut", "failure"),
								]),
							],
						],
					],
				),
			];
			for (const width of [12, 16, 20, 30]) {
				const out = yield* ansi(doc, { link, width });
				const links = linksOf(out);
				assert.isTrue(links.balanced, `width ${width}`);
				assert.strictEqual(links.pairs, 1, `width ${width}: one pair`);
				assert.match(links.wrapped, /^a .*…$/, `width ${width}: the pair wraps what is left, ending in the ellipsis`);
				assert.deepStrictEqual(sgrProblems(out), [], `width ${width}: SGR balanced`);
				for (const line of out.split("\n")) assert.isAtMost(displayWidth(line), width);
			}
		}),
	);

	it.effect("a line break in a counter label is a space in ansi too: Counts equal plain in every layout", () =>
		Effect.gen(function* () {
			for (const label of ["a\r\nb", "a\rb", "\r::x", "x\n# h"]) {
				for (const layout of ["inline", "columns", "row"] as const) {
					const doc = [
						Doc.counts({ counters: [Doc.counter(Status.core, "failure", { key: "f", label, n: 1 })], layout }),
					];
					const a = yield* ansi(doc, OFF);
					assert.notMatch(a, /[\r\n]/, `${layout} ${Result.getOrThrow(S.encodeUnknownResult(Json)(label))}: one line`);
					assert.strictEqual(a, yield* plain(doc, OFF), `${layout} ${Result.getOrThrow(S.encodeUnknownResult(Json)(label))}`);
				}
			}
		}),
	);

	it.effect("a line break in a link target cannot split the suffix or reach ctx.link", () =>
		Effect.gen(function* () {
			const seen: Array<string> = [];
			const out = yield* ansi([Doc.paragraph(Doc.link({ url: "https://example.test/a\nb" }, "docs"))], {
				paint: (_t, text) => text,
				link: (target, label) => {
					seen.push("url" in target ? target.url : target.file);
					return label;
				},
			});
			assert.strictEqual(out, "docs (https://example.test/ab)");
			assert.isTrue(
				seen.every((url) => url === "https://example.test/ab"),
				Result.getOrThrow(S.encodeUnknownResult(Json)(seen)),
			);
		}),
	);

	it.effect("tables use plain alignment, never box drawing, even with the unicode glyph set", () =>
		Effect.gen(function* () {
			const out = yield* ansi([Doc.table([{ header: "a" }, { header: "b" }], [["1", "2"]])], {
				...OFF,
				glyphs: Glyphs.unicode,
			});
			assert.notMatch(out, BOX);
			assert.strictEqual(out, "a  b\n-  -\n1  2");
		}),
	);

	it.effect("a table nested in a list, collapsible and callout stays within the context width", () =>
		Effect.gen(function* () {
			const wide = Doc.table(
				[{ header: "id" }, { header: "message" }, { header: "where" }],
				[["1", [Doc.text("a very long message that goes on and on and on", "failure")], "src/some/long/path.ts"]],
			);
			for (const block of [
				wide,
				Doc.list([wide]),
				Doc.collapsible("d", [wide]),
				Doc.callout("note", [Doc.collapsible("d", [Doc.list([wide])])]),
			]) {
				const out = yield* ansi([block], { ...TOKENS, width: 30 });
				for (const line of out.split("\n")) assert.isAtMost(displayWidth(line), 30);
			}
		}),
	);

	it.effect("a paragraph wraps to the width and is never truncated, a long URL stays whole", () =>
		Effect.gen(function* () {
			const url = "https://example.test/a/very/long/path/that/exceeds";
			const out = yield* ansi([Doc.paragraph(`see ${url} now and then some more words`)], { ...OFF, width: 14 });
			assert.include(out.split("\n"), url);
			assert.strictEqual(out.split("\n").join(" "), `see ${url} now and then some more words`);
		}),
	);
});

describe("Render.ansi: okfit's trial (counts paint, link suffix, annotations)", () => {
	const counters = [
		Doc.counter(Status.core, "failure", { key: "error", label: "errors", n: 2 }),
		Doc.counter(Status.core, "warning", { key: "warning", label: "warnings", n: 1 }),
	];
	const label = [Doc.status(Status.core, "failure"), " summary"];

	it.effect("paint: all paints every counter, none paints nothing, glyph paints only a status glyph", () =>
		Effect.gen(function* () {
			const painted = (paint?: "all" | "glyph" | "none") =>
				tokensOf([
					Doc.counts({ layout: "inline", label, counters, durationMs: 5, ...(paint === undefined ? {} : { paint }) }),
				]);
			const all = (yield* painted()).flat();
			assert.isTrue(all.some(([token, text]) => token === "failure" && text.includes("errors")));
			const none = (yield* painted("none")).flat();
			assert.deepStrictEqual(
				none.filter(([token]) => token !== undefined),
				[],
				"nothing is painted",
			);
			const glyph = (yield* painted("glyph")).flat().filter(([token]) => token !== undefined);
			assert.deepStrictEqual(glyph, [["failure", "✗"]], "only the status glyph keeps its token");
		}),
	);

	it.effect("with links off, suffix: false drops the target after the label", () =>
		Effect.gen(function* () {
			const out = yield* ansi([Doc.paragraph(Doc.link({ file: "/r/a.md", line: 2 }, "here", { suffix: false }))], OFF);
			assert.strictEqual(out, "here");
		}),
	);

	it.effect("an annotation renders nothing", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* ansi([Doc.annotation({ level: "warning" }, "careful")]), "");
		}),
	);
});

describe("Render.ansi reporter blocks: contextOf, strong and em, diffText, pipe tables (ansi)", () => {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: asserting the absence of any escape
	const ESCAPE = /\u001b/;
	const doc = [
		Doc.paragraph(Doc.text("bad", "failure"), " ", Doc.strong("Total"), " ", Doc.link({ url: "https://a.test" }, "a")),
	];
	const links: CliLinksShape = {
		mode: "file",
		target: (target) => O.some("url" in target ? target.url : "file:///x"),
	};

	it("Render.contextOf with defaults is escape-free, and an agent stays escape-free at truecolor with links on", () => {
		const ci = Render.contextOf({ audience: "ci" });
		assert.strictEqual(ci.color, "none");
		assert.strictEqual(ci.width, Number.POSITIVE_INFINITY);
		assert.strictEqual(ci.glyphs, Glyphs.unicode);
		assert.notMatch(Render.ansi(doc, ci), ESCAPE);
		const human = Render.contextOf({ audience: "human", color: "truecolor", links });
		assert.match(Render.ansi(doc, human), ESCAPE, "control: a human at truecolor with links is painted and linked");
		const agent = Render.contextOf({ audience: "agent", color: "truecolor", links });
		assert.strictEqual(agent.color, "none");
		assert.notMatch(Render.ansi(doc, agent), ESCAPE);
	});

	it("Render.contextOf carries width, displayPath, neutralizing and linkBase through", () => {
		const ctx = Render.contextOf({
			audience: "ci",
			width: 40,
			displayPath: (a) => a.replace("/r/", ""),
			neutralizeWorkflowCommands: true,
			linkBase: "https://x.test/blob/sha/",
		});
		assert.strictEqual(ctx.width, 40);
		assert.strictEqual(ctx.displayPath("/r/a.ts"), "a.ts");
		assert.isTrue(ctx.neutralizeWorkflowCommands);
		assert.strictEqual(ctx.linkBase, "https://x.test/blob/sha/");
	});

	it.effect("strong is bold and em italic, nested cleanly with a colour", () =>
		Effect.gen(function* () {
			const out = yield* ansi([Doc.paragraph(Doc.strong(Doc.text("x", "failure")), " ", Doc.em("y"))]);
			assert.include(out, "\u001b[1m");
			assert.include(out, "\u001b[3m");
			assert.deepStrictEqual(sgrProblems(out), []);
			assert.strictEqual(stripAnsi(out), "x y");
		}),
	);

	it.effect("diffText keeps the unified diff as given, + lines success and - lines failure", () =>
		Effect.gen(function* () {
			const unified = "@@ -1 +1 @@\n-old\n+new\n same";
			const lines = yield* tokensOf([Doc.diffText(unified)]);
			assert.deepStrictEqual(lines[1], [["failure", "-old"]]);
			assert.deepStrictEqual(lines[2], [["success", "+new"]]);
			assert.deepStrictEqual(lines[3], [[undefined, " same"]]);
		}),
	);

	it.effect("a pipe table has the same shape as in plain", () =>
		Effect.gen(function* () {
			const table = Doc.table([{ header: "File" }, { header: "% Stmts", align: "right" }], [["All files", "100"]], {
				style: "pipe",
			});
			assert.strictEqual(stripAnsi(yield* ansi([table])), yield* plain([table], OFF));
		}),
	);
});

describe("Render.contextOf: a ci audience neutralizes workflow commands by default", () => {
	const doc = [Doc.paragraph("::error::injected"), Doc.paragraph("x ##[warning]y")];
	const commands = (text: string) => text.split(LINE_BREAK).filter(isCommand);

	it("ci neutralizes unless told not to; other audiences keep the explicit setting", () => {
		assert.deepStrictEqual(commands(Render.plain(doc, Render.contextOf({ audience: "ci" }))), []);
		assert.lengthOf(
			commands(Render.plain(doc, Render.contextOf({ audience: "ci", neutralizeWorkflowCommands: false }))),
			2,
			"an explicit false wins",
		);
		assert.lengthOf(commands(Render.plain(doc, Render.contextOf({ audience: "human" }))), 2, "control: a human is not");
	});
});

describe("Render.ansi: diffText in a compact list item (A5)", () => {
	it.effect("a blank line inside the item keeps the item's indent, unpainted", () =>
		Effect.gen(function* () {
			const doc = [Doc.list([Doc.section("FAIL a.test.ts", [Doc.diffText("+ Received\n\n- 1")])], { compact: true })];
			const out = yield* ansi(doc);
			assert.strictEqual(out.split("\n")[2], "  ");
			assert.strictEqual(stripAnsi(out), "- FAIL a.test.ts\n  + Received\n  \n  - 1");
		}),
	);
});
