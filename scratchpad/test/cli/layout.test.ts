import { Schema } from "effect";
import { Result } from "effect";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { sanitize } from "../../effected/cli/Fmt.ts";
import type { Inline, RenderContext } from "../../effected/cli/index.ts";
import { Doc, Glyphs, Status } from "../../effected/cli/index.ts";
import { displayWidth, graphemes, stripAnsi } from "../../effected/cli/internal/displayWidth.ts";
import type { Span } from "../../effected/cli/internal/layout.ts";
import { flatten, paintSpans, truncateSpans, widthOf, wrapSpans } from "../../effected/cli/internal/layout.ts";
import { contextOf, linksOf, sgrProblems } from "./helpers/renderContext.ts";

const Json = Schema.fromJsonString(Schema.Unknown);

const CASES: ReadonlyArray<readonly [string, string]> = [
	["ascii", "a long coloured linked label"],
	["CJK", "日本語のラベルです長い"],
	["ZWJ family", "👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦 team"],
	["combining marks", "café résumé née"],
	["flag and skin tone", "🇯🇵🇫🇷 👍🏽 ok"],
];

describe("flatten", () => {
	it.effect("turns a Path into its segments joined by the audience's separator", () =>
		Effect.gen(function* () {
			const human = yield* contextOf();
			assert.strictEqual(
				flatten([Doc.path("a", "b", "c")], human)
					.map((s) => s.text)
					.join(""),
				"a › b › c",
			);
			const agent = yield* contextOf({ audience: "agent" });
			assert.strictEqual(
				flatten([Doc.path("a", "b", "c")], agent)
					.map((s) => s.text)
					.join(""),
				"a > b > c",
			);
			const ascii = yield* contextOf({ glyphs: Glyphs.ascii });
			assert.strictEqual(
				flatten([Doc.path("a", "b")], ascii)
					.map((s) => s.text)
					.join(""),
				"a > b",
			);
			assert.strictEqual(
				flatten([Doc.path("only")], human)
					.map((s) => s.text)
					.join(""),
				"only",
			);
		}),
	);

	it.effect("turns a StatusMark into the glyph of the context's set, painted with the definition's token", () =>
		Effect.gen(function* () {
			const mark = Doc.status(Status.core, "failure");
			const unicode = yield* contextOf();
			assert.deepStrictEqual(flatten([mark], unicode), [{ text: "✗", token: "failure", glyph: true }]);
			const ascii = yield* contextOf({ glyphs: Glyphs.ascii });
			assert.deepStrictEqual(flatten([mark], ascii), [{ text: "[FAIL]", token: "failure", glyph: true }]);
		}),
	);

	it.effect("keeps a token, marks Code, and gives every span of a Link label the same link", () =>
		Effect.gen(function* () {
			const ctx = yield* contextOf();
			const target = { file: "src/a.ts", line: 3 };
			const spans = flatten(
				[Doc.text("x", "muted"), Doc.code("c"), Doc.link(target, [Doc.text("a", "info"), Doc.code("b")])],
				ctx,
			);
			assert.deepStrictEqual(spans, [
				{ text: "x", token: "muted" },
				{ text: "c", code: true },
				{ text: "a", token: "info", link: target },
				{ text: "b", code: true, link: target },
			]);
			assert.strictEqual(spans[2]?.link, spans[3]?.link, "one link, so one hyperlink when painted");
		}),
	);

	it.effect("sanitizes a link target too, so a hostile URL cannot end an OSC 8 early", () =>
		Effect.gen(function* () {
			const ctx = yield* contextOf();
			const hostile = "\u001B]8;;x\u0007https://evil.test/\u0007\u001B[2J";
			const [url, file] = [
				flatten([Doc.link({ url: hostile }, "a")], ctx),
				flatten([Doc.link({ file: `/repo/${hostile}.ts`, line: 3, col: 4 }, "b")], ctx),
			];
			assert.deepStrictEqual(url[0]?.link, { url: "https://evil.test/" });
			assert.deepStrictEqual(file[0]?.link, { file: "/repo/https://evil.test/.ts", line: 3, col: 4 });
			const links = linksOf(paintSpans(url, ctx));
			assert.isTrue(links.balanced);
			assert.strictEqual(links.pairs, 1);
		}),
	);

	it.effect("strips line breaks from a link target, which can never hold one", () =>
		Effect.gen(function* () {
			const ctx = yield* contextOf();
			const [url] = flatten([Doc.link({ url: "https://a.test/x\ny\r\nz\r" }, "a")], ctx);
			const [file] = flatten([Doc.link({ file: "/repo/a\nb.ts", line: 3 }, "b")], ctx);
			assert.deepStrictEqual(url?.link, { url: "https://a.test/xyz" });
			assert.deepStrictEqual(file?.link, { file: "/repo/ab.ts", line: 3 });
		}),
	);

	it.effect("drops escape sequences and empty spans from content", () =>
		Effect.gen(function* () {
			const ctx = yield* contextOf();
			const spans = flatten(
				[Doc.text("\u001B[31mred\u001B[0m"), Doc.text(""), Doc.code("\u001B]8;;u\u0007c\u001B]8;;\u0007")],
				ctx,
			);
			assert.deepStrictEqual(spans, [{ text: "red" }, { text: "c", code: true }]);
		}),
	);
});

describe("sanitize", () => {
	it("removes escape sequences and every stray control character, turns a tab into a space, and keeps line breaks", () => {
		assert.strictEqual(sanitize("a\u001B[31mb\u001B[0mc"), "abc");
		assert.strictEqual(sanitize("a\u001B]8;;u\u0007b\u001B]8;;\u0007"), "ab");
		assert.strictEqual(sanitize("lone\u001Bescape"), "loneescape");
		assert.strictEqual(sanitize("bell\u0007 nul\u0000 del\u007F c1\u009B"), "bell nul del c1");
		assert.strictEqual(
			sanitize("tab\tnew\nline\r\nend"),
			"tab new\nline\r\nend",
			"a tab counts 0 columns but draws up to 8",
		);
		assert.strictEqual(
			sanitize("日本 👨‍👩‍👧‍👦 e\u0301"),
			"日本 👨‍👩‍👧‍👦 e\u0301",
			"zero-width joiners and marks are content",
		);
	});

	it.effect("flatten uses it, so a lone ESC in content cannot reach the output", () =>
		Effect.gen(function* () {
			const ctx = yield* contextOf();
			const spans = flatten([Doc.text("a\u001Bb"), Doc.code("c\u0007d"), Doc.path("e\u001B", "f")], ctx);
			assert.deepStrictEqual(spans, [{ text: "ab" }, { text: "cd", code: true }, { text: "e › f" }]);
		}),
	);
});

describe("flatten under hostile input: nothing can reassemble into a live sequence", () => {
	// Every character an escape sequence, a C0 or a C1 control is made of, plus one plain letter.
	const ALPHABET = ["\u001B", "[", "]", "(", "P", "\\", ";", "8", "3", "1", "m", "\u0007", "\b", "\u009B", "x"];
	const upTo = (length: number): ReadonlyArray<string> => {
		const out: Array<string> = [];
		let frontier = [""];
		for (let n = 1; n <= length; n++) {
			frontier = frontier.flatMap((prefix) => ALPHABET.map((ch) => prefix + ch));
			out.push(...frontier);
		}
		return out;
	};
	// biome-ignore lint/suspicious/noControlCharactersInRegex: asserting their absence is the point
	const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/;

	const problems = (ctx: RenderContext, inlines: ReadonlyArray<Inline>): ReadonlyArray<string> => {
		const spans = flatten(inlines, ctx);
		const out = paintSpans(spans, ctx);
		const found: Array<string> = [];
		if (CONTROL.test(out)) found.push("a control character survived");
		if (widthOf(spans) !== displayWidth(out))
			found.push(`widthOf ${widthOf(spans)} is not displayWidth ${displayWidth(out)}`);
		return found;
	};

	it.effect(
		"the named probes from the review: split SGR, nested SGR, split OSC 8, split CSI, DCS, charset, C1, BS, BEL",
		() =>
			Effect.gen(function* () {
				const ctx = yield* contextOf({ paint: (_token, text) => text, link: (_target, label) => label });
				const probes: ReadonlyArray<readonly [string, ReadonlyArray<Inline>]> = [
					["split SGR", [Doc.text("\u001B"), Doc.text("[31mred")]],
					["nested SGR", [Doc.text("\u001B\u001B[31m[31mred")]],
					["split OSC 8", [Doc.text("\u001B]8;;http://evil"), Doc.text("\u0007x")]],
					["split CSI across Text and Code", [Doc.text("a\u001B"), Doc.code("[2Jb")]],
					["DCS", [Doc.text("\u001BPq...\u001B\\x")]],
					["charset selection", [Doc.text("\u001B(Bx")]],
					["C1 CSI", [Doc.text("\u009B31mred")]],
					["backspace and bell", [Doc.text("ab\b\bXY\u0007")]],
					["a Path segment", [Doc.path("\u001B", "[31m")]],
				];
				for (const [name, inlines] of probes) assert.deepStrictEqual(problems(ctx, inlines), [], name);
			}),
	);

	it.effect(
		"exhaustively: 1 to 3 adjacent Text and Code nodes over the alphabet leave no control character, and widthOf equals displayWidth",
		() =>
			Effect.gen(function* () {
				const ctx = yield* contextOf({ paint: (_token, text) => text, link: (_target, label) => label });
				const failures: Array<string> = [];
				let cases = 0;
				const check = (inlines: ReadonlyArray<Inline>, label: string): void => {
					cases++;
					const found = problems(ctx, inlines);
					if (found.length > 0 && failures.length < 5) failures.push(`${label} ${JSON.stringify(found)}`);
				};
				for (const one of upTo(3)) {
					check([Doc.text(one)], Result.getOrThrow(Schema.encodeUnknownResult(Json)([one])));
					check([Doc.code(one)], Result.getOrThrow(Schema.encodeUnknownResult(Json)(["code", one])));
				}
				const short = upTo(2);
				for (const first of short) {
					for (const second of short) check([Doc.text(first), Doc.code(second)], Result.getOrThrow(Schema.encodeUnknownResult(Json)([first, second])));
				}
				for (const a of ALPHABET) {
					for (const b of ALPHABET) {
						for (const c of ALPHABET) check([Doc.text(a), Doc.code(b), Doc.text(c)], Result.getOrThrow(Schema.encodeUnknownResult(Json)([a, b, c])));
					}
				}
				assert.isAbove(cases, 60_000, "the enumeration ran");
				assert.deepStrictEqual(failures, []);
			}),
		{ timeout: 60_000 },
	);
});

describe("widthOf", () => {
	it("measures graphemes within a span, so a cluster split across two spans counts as two", () => {
		const flag = "\u{1F1EF}\u{1F1F5}";
		const split = widthOf([{ text: "\u{1F1EF}" }, { text: "\u{1F1F5}" }]);
		assert.strictEqual(split, displayWidth("\u{1F1EF}") + displayWidth("\u{1F1F5}"));
		assert.notStrictEqual(
			split,
			displayWidth(flag),
			"the same cluster in one span is one grapheme and measures differently",
		);
		assert.strictEqual(widthOf([{ text: flag }]), displayWidth(flag));
		const joiner = "\u{1F468}\u200D";
		assert.strictEqual(
			widthOf([{ text: joiner }, { text: "\u{1F469}" }]),
			displayWidth(joiner) + displayWidth("\u{1F469}"),
		);
	});

	it("sums the display width of every span", () => {
		assert.strictEqual(widthOf([]), 0);
		assert.strictEqual(widthOf([{ text: "ab" }, { text: "日本", token: "info" }, { text: "👨‍👩‍👧‍👦" }]), 2 + 4 + 2);
	});
});

describe("truncateSpans: a coloured, linked label wider than the width", () => {
	for (const [name, label] of CASES) {
		it.effect(
			`${name}: every width gives at most that many columns, balanced SGR, one intact link, whole graphemes`,
			() =>
				Effect.gen(function* () {
					const ctx = yield* contextOf();
					const target = { url: "https://example.test/x" };
					// Two spans under one link, in different styles, so a cut can land in either.
					const cut = Math.max(1, Math.floor(graphemes(label).length / 2));
					const first = graphemes(label).slice(0, cut).join("");
					const rest = graphemes(label).slice(cut).join("");
					const spans = flatten([Doc.link(target, [Doc.text(first, "failure"), Doc.text(rest, { bold: true })])], ctx);
					const total = widthOf(spans);
					assert.isAbove(total, 6, "the case is wider than the smallest width tried");

					for (let width = 0; width <= total + 2; width++) {
						const out = truncateSpans(spans, width, "…");
						const painted = paintSpans(out, ctx);
						const where = `${name} at width ${width}`;

						assert.isAtMost(displayWidth(painted), width, `${where}: within the width`);
						assert.deepStrictEqual(sgrProblems(painted), [], `${where}: SGR balanced`);

						const links = linksOf(painted);
						assert.isTrue(links.balanced, `${where}: hyperlink opened and closed`);
						const plain = stripAnsi(painted);
						if (plain === "") {
							assert.strictEqual(links.pairs, 0, `${where}: nothing kept, nothing linked`);
							continue;
						}
						assert.strictEqual(links.pairs, 1, `${where}: exactly one OSC 8 pair`);
						assert.strictEqual(links.wrapped, plain, `${where}: the pair wraps all of the kept text`);

						// Whole graphemes: what is kept, less the marker, is a prefix made of whole source graphemes.
						const original = graphemes(label);
						const kept = width >= total ? plain : plain.endsWith("…") ? plain.slice(0, -1) : plain;
						let prefix = "";
						let matched = kept === "";
						for (const g of original) {
							prefix += g;
							if (prefix === kept) matched = true;
						}
						assert.isTrue(matched, `${where}: "${kept}" is a prefix of whole graphemes of "${label}"`);

						// Maximal: when it was cut, the next whole grapheme would not have fitted beside the marker.
						if (width < total) {
							const k = kept === "" ? -1 : original.findIndex((_, i) => original.slice(0, i + 1).join("") === kept);
							assert.isTrue(kept === "" || k >= 0, `${where}: the kept text ends on a grapheme boundary`);
							const next = original[k + 1];
							assert.isDefined(next, `${where}: something was left out`);
							assert.isAbove(
								displayWidth(kept) + displayWidth(next ?? "") + displayWidth("…"),
								width,
								`${where}: "${next}" would have fitted, so too little was kept`,
							);
						}
					}
				}),
		);
	}

	it.effect("text that already fits is returned unchanged", () =>
		Effect.gen(function* () {
			const ctx = yield* contextOf();
			const spans = flatten([Doc.text("abc", "info")], ctx);
			assert.strictEqual(truncateSpans(spans, 3, "…"), spans);
			assert.strictEqual(truncateSpans(spans, 10, "…"), spans);
		}),
	);

	it("marks the cut with the ellipsis inside the last kept span, and omits one that cannot fit", () => {
		const spans: ReadonlyArray<Span> = [{ text: "hello", token: "info" }];
		assert.deepStrictEqual(truncateSpans(spans, 4, "…"), [{ text: "hel…", token: "info" }]);
		assert.deepStrictEqual(truncateSpans(spans, 4, "..."), [{ text: "h...", token: "info" }]);
		assert.deepStrictEqual(truncateSpans(spans, 2, "..."), [{ text: "he", token: "info" }], "the marker cannot fit");
		assert.deepStrictEqual(truncateSpans(spans, 0, "…"), []);
		assert.deepStrictEqual(truncateSpans(spans, -3, "…"), []);
	});

	it("a wide character that would straddle the edge is dropped whole", () => {
		const spans: ReadonlyArray<Span> = [{ text: "日本語" }];
		const cut = (width: number, ellipsis: string) =>
			truncateSpans(spans, width, ellipsis)
				.map((s) => s.text)
				.join("");
		assert.strictEqual(cut(5, "…"), "日本…", "2 + 2 + 1 fits exactly");
		assert.strictEqual(cut(4, "…"), "日…", "the second wide character would pass the edge");
		assert.strictEqual(cut(4, ""), "日本");
		assert.strictEqual(cut(3, ""), "日", "a half-width gap is left rather than splitting the next character");
	});

	it("an ellipsis after a Code span is not inside the code, and keeps the link", () => {
		const target = { url: "u" };
		const spans: ReadonlyArray<Span> = [{ text: "codecode", code: true, link: target }];
		const out = truncateSpans(spans, 5, "…");
		assert.deepStrictEqual(out, [
			{ text: "code", code: true, link: target },
			{ text: "…", link: target },
		]);
	});

	it("when only the marker fits it stands for the label, so it keeps the first span's token and link", () => {
		const target = { url: "u" };
		const out = truncateSpans([{ text: "label", token: "failure", link: target }, { text: "more" }], 1, "…");
		assert.deepStrictEqual(out, [{ text: "…", token: "failure", link: target }]);
	});

	it("cuts across spans and drops the spans after the cut", () => {
		const out = truncateSpans(
			[{ text: "ab", token: "info" }, { text: "cd", token: "failure" }, { text: "ef" }],
			4,
			"…",
		);
		assert.deepStrictEqual(out, [
			{ text: "ab", token: "info" },
			{ text: "c…", token: "failure" },
		]);
	});
});

describe("paintSpans", () => {
	it.effect("paints each span, and wraps the spans of one Link in a single hyperlink", () =>
		Effect.gen(function* () {
			const ctx = yield* contextOf();
			const target = { url: "https://example.test" };
			const painted = paintSpans(
				flatten([Doc.text("a "), Doc.link(target, [Doc.text("b", "failure"), Doc.code("c")]), Doc.text(" d")], ctx),
				ctx,
			);
			assert.strictEqual(stripAnsi(painted), "a bc d");
			assert.deepStrictEqual(sgrProblems(painted), []);
			const links = linksOf(painted);
			assert.strictEqual(links.pairs, 1);
			assert.strictEqual(links.wrapped, "bc");
		}),
	);

	it.effect("two separate links stay two hyperlinks", () =>
		Effect.gen(function* () {
			const ctx = yield* contextOf();
			const inlines: ReadonlyArray<Inline> = [Doc.link({ url: "u1" }, "x"), Doc.link({ url: "u2" }, "y")];
			const links = linksOf(paintSpans(flatten(inlines, ctx), ctx));
			assert.strictEqual(links.pairs, 2);
			assert.isTrue(links.balanced);
		}),
	);

	it.effect("at colour none the output carries no SGR, and the link function alone decides hyperlinks", () =>
		Effect.gen(function* () {
			const ctx = yield* contextOf({ paint: (_token, text) => text, link: (_target, label) => label });
			const painted = paintSpans(flatten([Doc.text("a", "failure"), Doc.link({ url: "u" }, "b")], ctx), ctx);
			assert.strictEqual(painted, "ab");
		}),
	);
});

describe("wrapSpans", () => {
	const textOf = (line: ReadonlyArray<Span>): string => line.map((s) => s.text).join("");
	const lines = (spans: ReadonlyArray<Span>, width: number): ReadonlyArray<string> =>
		wrapSpans(spans, width).map(textOf);

	it("breaks at spaces and drops the space at the break", () => {
		assert.deepStrictEqual(lines([{ text: "the quick brown fox" }], 10), ["the quick", "brown fox"]);
		assert.deepStrictEqual(lines([{ text: "the quick brown fox" }], 9), ["the quick", "brown fox"]);
		assert.deepStrictEqual(lines([{ text: "the quick brown fox" }], 8), ["the", "quick", "brown", "fox"]);
	});

	it("keeps spaces inside a line, and text that fits is one line", () => {
		assert.deepStrictEqual(lines([{ text: "a  b" }], 10), ["a  b"]);
		assert.deepStrictEqual(lines([{ text: "  indented" }], 20), ["  indented"]);
		assert.deepStrictEqual(lines([], 10), [""]);
	});

	it("hard-breaks a word longer than the width, on a line of its own", () => {
		assert.deepStrictEqual(lines([{ text: "ab abcdefghij cd" }], 4), ["ab", "abcd", "efgh", "ij", "cd"]);
		for (const line of lines([{ text: "abcdefghij" }], 4)) assert.isAtMost(displayWidth(line), 4);
	});

	it("never lets a wide character straddle the edge", () => {
		const out = lines([{ text: "日本語日本語" }], 5);
		assert.deepStrictEqual(out, ["日本", "語日", "本語"]);
		for (const line of out) assert.isAtMost(displayWidth(line), 5);
	});

	it("never splits a grapheme, such as a ZWJ family (width 2) or a base with a combining mark", () => {
		const family = "👨‍👩‍👧‍👦";
		const out = lines([{ text: `${family}${family}${family}` }], 3);
		assert.deepStrictEqual(out, [family, family, family]);
		assert.deepStrictEqual(lines([{ text: "ééé" }], 2), ["éé", "é"]);
	});

	it("keeps every span's style on the characters that carry it, across lines", () => {
		const spans: ReadonlyArray<Span> = [
			{ text: "red words ", token: "failure" },
			{ text: "and plain ones" },
			{ text: " linked", link: { url: "u" } },
		];
		const wrapped = wrapSpans(spans, 7);
		const pairs = (list: ReadonlyArray<Span>) =>
			list.flatMap((span) =>
				graphemes(span.text)
					.filter((g) => g !== " ")
					.map((g) => [g, span.token ?? null, span.link === undefined ? null : JSON.stringify(span.link)] as const),
			);
		assert.deepStrictEqual(
			wrapped.flatMap((line) => pairs(line)),
			pairs(spans),
			"nothing lost, added or restyled",
		);
		for (const line of wrapped) assert.isAtMost(widthOf(line), 7);
	});

	it("a newline is a forced break", () => {
		assert.deepStrictEqual(lines([{ text: "ab\ncd\r\nef" }], 10), ["ab", "cd", "ef"]);
	});

	it("a width under one is treated as one, and always makes progress", () => {
		assert.deepStrictEqual(lines([{ text: "abc" }], 0), ["a", "b", "c"]);
		assert.deepStrictEqual(lines([{ text: "日本" }], 1), ["日", "本"]);
	});

	it("with hardBreak off, a word longer than the width stays whole on a line of its own", () => {
		const url = "https://example.test/a/very/long/path";
		assert.deepStrictEqual(
			wrapSpans([{ text: `see ${url} now` }], 10, { hardBreak: false }).map((line) => line.map((s) => s.text).join("")),
			["see", url, "now"],
		);
		// Everything else is unchanged: spaces still break and wide characters are never split.
		assert.deepStrictEqual(
			wrapSpans([{ text: "the quick brown fox" }], 9, { hardBreak: false }).map((line) =>
				line.map((s) => s.text).join(""),
			),
			["the quick", "brown fox"],
		);
		assert.deepStrictEqual(
			wrapSpans([{ text: "abcdefghij" }], 4, { hardBreak: true }).map((line) => line.map((s) => s.text).join("")),
			["abcd", "efgh", "ij"],
		);
	});

	it("an unbounded width is one line", () => {
		assert.deepStrictEqual(lines([{ text: "a b c" }], Number.POSITIVE_INFINITY), ["a b c"]);
	});
});
